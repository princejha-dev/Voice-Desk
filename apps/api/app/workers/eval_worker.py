"""
Evaluation runner worker.

Runs automated evaluation against a dataset of test cases:
1. Loads test cases from eval_datasets + eval_cases tables
2. Simulates agent conversations using the agent's config
3. Scores responses with LLM-as-judge
4. Saves per-case results and an aggregate score
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.supabase import get_admin_client

logger = logging.getLogger(__name__)

JUDGE_MODEL = "gpt-4o-mini"
SIMULATION_MODEL = "gpt-4o-mini"


# ── Simulation ─────────────────────────────────────────────────────────────────


async def _simulate_response(
    system_prompt: str,
    user_message: str,
    openai: AsyncOpenAI,
) -> str:
    """Simulate what the agent would say given a user message."""
    response = await openai.chat.completions.create(
        model=SIMULATION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
        max_tokens=400,
    )
    return response.choices[0].message.content or ""


# ── Scoring ────────────────────────────────────────────────────────────────────


async def _score_response(
    user_message: str,
    expected_response: str | None,
    actual_response: str,
    criteria: dict[str, Any],
    openai: AsyncOpenAI,
) -> tuple[float, str]:
    """
    Use an LLM as judge to score the agent's response.

    Returns (score 0.0–1.0, reasoning string).
    """
    judge_prompt = f"""You are evaluating an AI voice agent response.

User message: {user_message}

Agent response: {actual_response}
"""
    if expected_response:
        judge_prompt += f"\nExpected/ideal response: {expected_response}\n"

    if criteria:
        judge_prompt += f"\nEvaluation criteria: {json.dumps(criteria)}\n"

    judge_prompt += """
Score the agent response on a scale from 0 to 10 based on:
- Relevance: Does it address the user's question?
- Accuracy: Is the information correct and helpful?
- Tone: Is the tone appropriate and professional?
- Conciseness: Is it appropriately concise for a voice agent?

Respond in JSON: {"score": <0-10>, "reasoning": "<brief explanation>"}
"""

    try:
        response = await openai.chat.completions.create(
            model=JUDGE_MODEL,
            messages=[{"role": "user", "content": judge_prompt}],
            temperature=0,
            max_tokens=200,
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content or "{}")
        raw_score = float(result.get("score", 5))
        normalized = min(max(raw_score / 10.0, 0.0), 1.0)
        return normalized, result.get("reasoning", "")
    except Exception as exc:
        logger.warning("Judge scoring failed: %s", exc)
        return 0.5, f"Scoring error: {exc}"


# ── Main worker ────────────────────────────────────────────────────────────────


async def run_evaluation(
    run_id: str,
    agent_id: str,
    version_id: str,
    dataset_id: str,
    tenant_id: str,
) -> None:
    """
    Execute a full evaluation run.

    1. Load agent config from agent_versions
    2. Load test cases from eval_cases
    3. Simulate + score each case
    4. Write results to eval_case_results
    5. Update eval_runs with final score
    """
    settings = get_settings()
    db = get_admin_client()
    openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    # Mark run as running
    db.table("eval_runs").update({
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", run_id).eq("tenant_id", tenant_id).execute()

    try:
        # 1. Load agent config
        version_result = (
            db.table("agent_versions")
            .select("config")
            .eq("id", version_id)
            .eq("agent_id", agent_id)
            .eq("tenant_id", tenant_id)
            .single()
            .execute()
        )
        if not version_result.data:
            raise ValueError(f"Agent version {version_id} not found")

        config = version_result.data["config"]
        system_prompt = config.get("system_prompt", "You are a helpful assistant.")

        # 2. Load test cases
        cases_result = (
            db.table("eval_cases")
            .select("*")
            .eq("dataset_id", dataset_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        cases = cases_result.data or []
        if not cases:
            raise ValueError(f"No test cases found in dataset {dataset_id}")

        logger.info("Running eval %s: %d cases", run_id, len(cases))

        scores: list[float] = []

        for case in cases:
            case_id = case["id"]
            user_message = case.get("user_message", "")
            expected_response = case.get("expected_response")
            criteria = case.get("criteria") or {}

            try:
                # Simulate agent response
                actual_response = await _simulate_response(system_prompt, user_message, openai)

                # Score it
                score, reasoning = await _score_response(
                    user_message, expected_response, actual_response, criteria, openai
                )
                scores.append(score)

                # Save case result
                db.table("eval_case_results").insert({
                    "run_id": run_id,
                    "case_id": case_id,
                    "tenant_id": tenant_id,
                    "actual_response": actual_response,
                    "score": score,
                    "reasoning": reasoning,
                    "passed": score >= 0.6,
                }).execute()

            except Exception as case_exc:
                logger.warning("Case %s failed: %s", case_id, case_exc)
                db.table("eval_case_results").insert({
                    "run_id": run_id,
                    "case_id": case_id,
                    "tenant_id": tenant_id,
                    "actual_response": "",
                    "score": 0.0,
                    "reasoning": f"Error: {case_exc}",
                    "passed": False,
                }).execute()
                scores.append(0.0)

            # Small delay to avoid rate limiting
            await asyncio.sleep(0.5)

        # 3. Compute aggregate score
        aggregate = sum(scores) / len(scores) if scores else 0.0
        passed_count = sum(1 for s in scores if s >= 0.6)

        # 4. Update run as completed
        db.table("eval_runs").update({
            "status": "completed",
            "score": aggregate,
            "passed_count": passed_count,
            "total_count": len(cases),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).eq("tenant_id", tenant_id).execute()

        logger.info(
            "Eval run %s complete: %.2f score, %d/%d passed",
            run_id, aggregate, passed_count, len(cases)
        )

    except Exception as exc:
        logger.exception("Eval run %s failed: %s", run_id, exc)
        db.table("eval_runs").update({
            "status": "failed",
            "error_message": str(exc)[:500],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).eq("tenant_id", tenant_id).execute()
        raise

