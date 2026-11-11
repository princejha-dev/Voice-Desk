"""Evaluations module — datasets, test cases, and evaluation runs."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import TenantContext, get_tenant_context
from app.services.supabase import get_admin_client

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────


class CreateDatasetRequest(BaseModel):
    name: str
    description: str | None = None


class AddTestCaseRequest(BaseModel):
    input: str
    expected_output: str | None = None
    metadata: dict | None = None


class TriggerEvalRunRequest(BaseModel):
    agent_id: str
    version_id: str
    dataset_id: str


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/{org_id}/evaluations/datasets")
async def list_datasets(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """List all evaluation datasets for the organization."""
    db = get_admin_client()
    datasets = (
        db.table("eval_datasets")
        .select("id, name, description, case_count, created_at")
        .eq("tenant_id", org_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {"datasets": datasets}


@router.post("/{org_id}/evaluations/datasets", status_code=status.HTTP_201_CREATED)
async def create_dataset(
    org_id: str,
    body: CreateDatasetRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Create a new evaluation dataset."""
    db = get_admin_client()
    now = datetime.now(timezone.utc).isoformat()
    dataset = (
        db.table("eval_datasets")
        .insert({
            "id": str(uuid.uuid4()),
            "tenant_id": org_id,
            "name": body.name,
            "description": body.description,
            "case_count": 0,
            "created_at": now,
            "updated_at": now,
        })
        .execute()
        .data[0]
    )
    return dataset


@router.post("/{org_id}/evaluations/datasets/{dataset_id}/cases", status_code=status.HTTP_201_CREATED)
async def add_test_case(
    org_id: str,
    dataset_id: str,
    body: AddTestCaseRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Add a test case to a dataset."""
    db = get_admin_client()

    # Verify dataset belongs to org
    dataset = (
        db.table("eval_datasets")
        .select("id")
        .eq("id", dataset_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    now = datetime.now(timezone.utc).isoformat()
    case = (
        db.table("eval_cases")
        .insert({
            "id": str(uuid.uuid4()),
            "tenant_id": org_id,
            "dataset_id": dataset_id,
            "input": body.input,
            "expected_output": body.expected_output,
            "metadata": body.metadata or {},
            "created_at": now,
        })
        .execute()
        .data[0]
    )

    # Increment case count
    db.rpc("increment_eval_dataset_case_count", {"p_dataset_id": dataset_id}).execute()

    return case


@router.get("/{org_id}/evaluations/datasets/{dataset_id}/cases")
async def list_test_cases(
    org_id: str,
    dataset_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """List test cases in a dataset."""
    db = get_admin_client()

    dataset = (
        db.table("eval_datasets")
        .select("id")
        .eq("id", dataset_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    cases = (
        db.table("eval_cases")
        .select("*")
        .eq("dataset_id", dataset_id)
        .eq("tenant_id", org_id)
        .order("created_at", desc=False)
        .execute()
        .data
    )
    return {"cases": cases}


@router.post("/{org_id}/evaluations/runs", status_code=status.HTTP_202_ACCEPTED)
async def trigger_eval_run(
    org_id: str,
    body: TriggerEvalRunRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    background_tasks: BackgroundTasks,
):
    """Trigger an evaluation run for an agent version against a dataset."""
    db = get_admin_client()

    # Verify agent and dataset exist under this org
    agent = (
        db.table("agents")
        .select("id")
        .eq("id", body.agent_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    dataset = (
        db.table("eval_datasets")
        .select("id, case_count")
        .eq("id", body.dataset_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    now = datetime.now(timezone.utc).isoformat()
    run_id = str(uuid.uuid4())

    run = (
        db.table("eval_runs")
        .insert({
            "id": run_id,
            "tenant_id": org_id,
            "agent_id": body.agent_id,
            "version_id": body.version_id,
            "dataset_id": body.dataset_id,
            "status": "pending",
            "case_count": dataset.get("case_count", 0),
            "created_at": now,
            "triggered_by": ctx.user.id,
        })
        .execute()
        .data[0]
    )

    # Trigger background eval job
    from app.workers.eval_worker import run_evaluation
    background_tasks.add_task(run_evaluation, run_id, org_id)

    return run


@router.get("/{org_id}/evaluations/runs")
async def list_eval_runs(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """List all evaluation runs for the organization."""
    db = get_admin_client()
    runs = (
        db.table("eval_runs")
        .select("id, agent_id, version_id, dataset_id, status, case_count, avg_score, created_at, completed_at")
        .eq("tenant_id", org_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {"runs": runs}


@router.get("/{org_id}/evaluations/runs/{run_id}")
async def get_eval_run(
    org_id: str,
    run_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Get detailed results for an evaluation run."""
    db = get_admin_client()

    run = (
        db.table("eval_runs")
        .select("*")
        .eq("id", run_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eval run not found")

    results = (
        db.table("eval_case_results")
        .select("*")
        .eq("run_id", run_id)
        .order("created_at", desc=False)
        .execute()
        .data
    )

    return {**run, "results": results}

