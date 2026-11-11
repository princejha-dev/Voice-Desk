import asyncio
import uuid
from typing import List, Dict, Any, Optional


class EvalRunner:
    def __init__(self, openai_client, supabase_client):
        self.openai = openai_client
        self.supabase = supabase_client

    async def run_eval(
        self,
        run_id: str,
        dataset_id: str,
        agent_config: dict,
        tenant_id: str,
    ) -> Dict[str, Any]:
        """Run evaluation against all test cases in a dataset.

        Steps:
        1. Load test cases from eval_datasets
        2. For each case: simulate conversation using LLM with agent's system prompt
        3. Score with LLM-as-judge
        4. Save results
        5. Update run status and aggregate score
        """
        # 1. Load test cases
        resp = (
            self.supabase.table("eval_cases")
            .select("*")
            .eq("dataset_id", dataset_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        cases = resp.data or []

        if not cases:
            await self._update_run(run_id, "completed", score=None, error="No test cases found")
            return {"run_id": run_id, "total": 0, "score": None}

        results = []
        for case in cases:
            case_result = await self._run_case(run_id, case, agent_config, tenant_id)
            results.append(case_result)

        # 5. Aggregate score and update run
        scores = [r["score"] for r in results if r.get("score") is not None]
        aggregate_score = sum(scores) / len(scores) if scores else None
        await self._update_run(run_id, "completed", score=aggregate_score)

        return {
            "run_id": run_id,
            "total": len(cases),
            "passed": len([r for r in results if (r.get("score") or 0) >= 0.7]),
            "score": aggregate_score,
        }

    async def _run_case(
        self,
        run_id: str,
        case: dict,
        agent_config: dict,
        tenant_id: str,
    ) -> Dict[str, Any]:
        """Simulate a conversation for one test case and score it."""
        try:
            # 2. Simulate conversation using LLM
            actual_response = await self._simulate_response(
                system_prompt=agent_config.get("system_prompt", ""),
                user_message=case.get("user_message", ""),
            )

            # 3. Score with LLM-as-judge
            score = await self.score_response(
                expected=case.get("expected_response", ""),
                actual=actual_response,
                criteria=case.get("scoring_criteria", {}),
            )

            result = {
                "case_id": case["id"],
                "actual_response": actual_response,
                "score": score,
                "passed": score >= 0.7,
            }

            # 4. Save result
            self.supabase.table("eval_results").insert(
                {
                    "id": str(uuid.uuid4()),
                    "run_id": run_id,
                    "case_id": case["id"],
                    "tenant_id": tenant_id,
                    "actual_response": actual_response,
                    "score": score,
                    "passed": score >= 0.7,
                }
            ).execute()

            return result

        except Exception as exc:
            return {"case_id": case.get("id"), "score": None, "error": str(exc)}

    async def _simulate_response(self, system_prompt: str, user_message: str) -> str:
        """Call OpenAI to simulate the agent's response."""
        response = await self.openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=500,
            temperature=0.0,
        )
        return response.choices[0].message.content or ""

    async def score_response(
        self,
        expected: str,
        actual: str,
        criteria: dict,
    ) -> float:
        """Use GPT-4 as judge to score response quality 0-1."""
        criteria_text = "\n".join(
            f"- {k}: {v}" for k, v in criteria.items()
        ) if criteria else "- Accuracy: Does the response correctly address the user's need?\n- Tone: Is the response professional and helpful?"

        judge_prompt = f"""You are an expert evaluator for AI voice agents. Score the following response from 0.0 to 1.0.

Scoring criteria:
{criteria_text}

Expected response (reference):
{expected}

Actual response:
{actual}

Reply with ONLY a decimal number between 0.0 and 1.0 representing the quality score. No explanation."""

        response = await self.openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": judge_prompt}],
            max_tokens=10,
            temperature=0.0,
        )
        raw = (response.choices[0].message.content or "0.0").strip()
        try:
            score = float(raw)
            return max(0.0, min(1.0, score))
        except ValueError:
            return 0.0

    async def _update_run(
        self,
        run_id: str,
        status: str,
        score: Optional[float] = None,
        error: Optional[str] = None,
    ) -> None:
        payload: Dict[str, Any] = {"status": status}
        if score is not None:
            payload["aggregate_score"] = score
        if error:
            payload["error"] = error
        self.supabase.table("eval_runs").update(payload).eq("id", run_id).execute()
