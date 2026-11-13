"""Knowledge module — document upload, management, and agent assignment."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.dependencies import TenantContext, get_tenant_context
from app.services.supabase import get_admin_client

router = APIRouter()

STORAGE_BUCKET = "knowledge-documents"
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


# ── Schemas ────────────────────────────────────────────────────────────────────


class AssignDocRequest(BaseModel):
    agent_id: str


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/{org_id}/knowledge")
async def list_knowledge_documents(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """List all knowledge documents for an organization with assigned agents."""
    db = get_admin_client()
    docs = (
        db.table("knowledge_documents")
        .select("id, filename, file_path, mime_type, status, chunk_count, file_size, created_at, updated_at")
        .eq("tenant_id", org_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    # Fetch agent assignments
    try:
        assignments = (
            db.table("agent_knowledge_documents")
            .select("document_id, agent_id, agents(id, name, slug)")
            .eq("tenant_id", org_id)
            .execute()
            .data
        )
    except Exception:
        assignments = []

    doc_agents_map: dict[str, list] = {}
    for a in assignments:
        d_id = a.get("document_id")
        if d_id not in doc_agents_map:
            doc_agents_map[d_id] = []
        if a.get("agents"):
            doc_agents_map[d_id].append(a["agents"])

    for d in docs:
        d["name"] = d.get("filename")
        d["assigned_agents"] = doc_agents_map.get(d["id"], [])
    return {"documents": docs}


@router.post("/{org_id}/knowledge/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_knowledge_document(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    agent_id: str | None = None,
):
    """Upload a knowledge document and trigger background ingestion."""
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, TXT, DOCX, MD",
        )

    db = get_admin_client()
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    file_path = f"{org_id}/{doc_id}/{file.filename}"

    # Upload to Supabase storage
    file_bytes = await file.read()
    try:
        try:
            db.storage.from_(STORAGE_BUCKET).upload(
                path=file_path,
                file=file_bytes,
                file_options={"content-type": file.content_type},
            )
        except Exception as upload_err:
            if "not found" in str(upload_err).lower() or "bucket" in str(upload_err).lower():
                try:
                    db.storage.create_bucket(STORAGE_BUCKET, options={"public": False})
                except Exception:
                    pass
                db.storage.from_(STORAGE_BUCKET).upload(
                    path=file_path,
                    file=file_bytes,
                    file_options={"content-type": file.content_type},
                )
            else:
                raise upload_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage upload failed: {exc}",
        ) from exc

    # Ensure agent_id is present if table requires it
    if not agent_id:
        try:
            agent_res = db.table("agents").select("id").eq("tenant_id", org_id).limit(1).execute()
            if agent_res.data:
                agent_id = agent_res.data[0]["id"]
            else:
                new_agent = db.table("agents").insert({
                    "tenant_id": org_id,
                    "name": "General Assistant",
                    "status": "draft",
                }).execute().data
                if new_agent:
                    agent_id = new_agent[0]["id"]
        except Exception:
            pass

    # Insert knowledge_documents row
    doc_payload = {
        "id": doc_id,
        "tenant_id": org_id,
        "filename": file.filename,
        "file_path": file_path,
        "mime_type": file.content_type,
        "file_size": len(file_bytes),
        "status": "processing",
        "chunk_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    if agent_id:
        doc_payload["agent_id"] = agent_id

    doc = (
        db.table("knowledge_documents")
        .insert(doc_payload)
        .execute()
        .data[0]
    )

    if agent_id:
        try:
            db.table("agent_knowledge_documents").insert({
                "tenant_id": org_id,
                "agent_id": agent_id,
                "document_id": doc_id,
            }).execute()
        except Exception:
            pass

    # Trigger background ingestion
    from app.workers.ingestion_worker import ingest_document
    background_tasks.add_task(ingest_document, doc_id, org_id, agent_id)

    return {
        "document_id": doc_id,
        "name": file.filename,
        "agent_id": agent_id,
        "status": "processing",
        "message": "Document uploaded. Ingestion started in the background.",
    }


@router.get("/{org_id}/knowledge/{doc_id}")
async def get_knowledge_document(
    org_id: str,
    doc_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Get document status and chunk count."""
    db = get_admin_client()
    doc = (
        db.table("knowledge_documents")
        .select("*")
        .eq("id", doc_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    chunk_count = (
        db.table("knowledge_chunks")
        .select("id", count="exact")
        .eq("document_id", doc_id)
        .eq("tenant_id", org_id)
        .execute()
        .count
    )

    return {**doc, "chunk_count": chunk_count or 0}


@router.delete("/{org_id}/knowledge/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_document(
    org_id: str,
    doc_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Delete a knowledge document and all its chunks."""
    db = get_admin_client()

    doc = (
        db.table("knowledge_documents")
        .select("id, file_path")
        .eq("id", doc_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Delete chunks first (FK constraint)
    db.table("knowledge_chunks").delete().eq("document_id", doc_id).eq("tenant_id", org_id).execute()

    # Delete document record
    db.table("knowledge_documents").delete().eq("id", doc_id).eq("tenant_id", org_id).execute()

    # Remove from storage
    try:
        db.storage.from_(STORAGE_BUCKET).remove([doc["file_path"]])
    except Exception:
        pass  # Best effort — record is already gone


@router.post("/{org_id}/knowledge/{doc_id}/assign")
async def assign_document_to_agent(
    org_id: str,
    doc_id: str,
    body: AssignDocRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Assign a knowledge document to an agent."""
    db = get_admin_client()

    # Verify document belongs to org
    doc = (
        db.table("knowledge_documents")
        .select("id, status")
        .eq("id", doc_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.get("status") != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is not ready (status: {doc.get('status')}). Wait for ingestion to complete.",
        )

    # Verify agent belongs to org
    agent = (
        db.table("agents")
        .select("id, active_version_id")
        .eq("id", body.agent_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Upsert assignment
    now = datetime.now(timezone.utc).isoformat()
    db.table("agent_knowledge_documents").upsert({
        "tenant_id": org_id,
        "agent_id": body.agent_id,
        "document_id": doc_id,
        "assigned_at": now,
    }, on_conflict="agent_id,document_id").execute()

    return {
        "message": "Document assigned to agent successfully",
        "agent_id": body.agent_id,
        "document_id": doc_id,
    }


class UpdateDocStatusRequest(BaseModel):
    status: str  # "ready" | "deactivated"


@router.patch("/{org_id}/knowledge/{doc_id}/status")
async def update_document_status(
    org_id: str,
    doc_id: str,
    body: UpdateDocStatusRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Toggle document active status (ready vs deactivated). Deactivated docs are skipped during voice RAG."""
    db = get_admin_client()
    target_status = body.status.lower()
    if target_status not in ("ready", "deactivated"):
        raise HTTPException(status_code=400, detail="Status must be 'ready' or 'deactivated'")

    now = datetime.now(timezone.utc).isoformat()
    res = (
        db.table("knowledge_documents")
        .update({"status": target_status, "updated_at": now})
        .eq("id", doc_id)
        .eq("tenant_id", org_id)
        .execute()
        .data
    )
    if not res:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": f"Document status updated to {target_status}", "document": res[0]}


@router.delete("/{org_id}/knowledge/{doc_id}/assign/{agent_id}")
async def unassign_document_from_agent(
    org_id: str,
    doc_id: str,
    agent_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Remove assignment of a knowledge document from a specific agent."""
    db = get_admin_client()
    db.table("agent_knowledge_documents").delete().eq("tenant_id", org_id).eq("document_id", doc_id).eq("agent_id", agent_id).execute()
    return {"message": "Document unassigned successfully", "document_id": doc_id, "agent_id": agent_id}


@router.get("/{org_id}/knowledge/{doc_id}/content")
async def get_document_source_content(
    org_id: str,
    doc_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Retrieve indexed text chunks for View Source modal."""
    db = get_admin_client()
    doc = (
        db.table("knowledge_documents")
        .select("id, filename, file_path, status, chunk_count, file_size")
        .eq("id", doc_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = (
        db.table("knowledge_chunks")
        .select("chunk_index, content, metadata")
        .eq("document_id", doc_id)
        .eq("tenant_id", org_id)
        .order("chunk_index")
        .limit(50)
        .execute()
        .data
    )
    return {
        "document": doc,
        "chunks": chunks or [],
    }

