"""
Dynamic Webhook Tool Runner for VoiceDesk.

Executes user-configured HTTP webhook tools during voice agent turns.
Each agent can have its own independent custom tools defined in agent_versions.config.custom_tools.
"""
from __future__ import annotations

import json
import logging
from typing import Any
import httpx
from livekit.agents import llm

from runtime.engine.context import SessionContext

logger = logging.getLogger(__name__)


def create_dynamic_webhook_tool(tool_def: dict, session_ctx: SessionContext) -> Any:
    """
    Creates a LiveKit FunctionTool that LiveKit Agents / OpenAI can invoke.

    Args:
        tool_def: Tool definition dict with keys: name, description, method, url, headers.
        session_ctx: Server session context (tenant_id, agent_id, session_id).

    Returns:
        LiveKit FunctionTool instance.
    """
    name = (tool_def.get("name") or "custom_api_tool").strip().replace(" ", "_")
    desc = tool_def.get("description") or f"Call external API endpoint for {name}"
    method = (tool_def.get("method") or "GET").upper()
    url_template = tool_def.get("url") or ""
    custom_headers = tool_def.get("headers") or {}

    async def _webhook_tool(**kwargs: Any) -> str:
        if not url_template:
            return "Error: No webhook URL configured for this tool."

        url = url_template
        # Replace {param} placeholders in URL with matching kwargs
        for k, v in list(kwargs.items()):
            placeholder = f"{{{k}}}"
            if placeholder in url:
                url = url.replace(placeholder, str(v))

        req_headers = {
            "Content-Type": "application/json",
            "User-Agent": "VoiceDesk-Voice-Agent/1.0",
            "X-VoiceDesk-Tenant-Id": session_ctx.tenant_id,
            "X-VoiceDesk-Agent-Id": session_ctx.agent_id,
            "X-VoiceDesk-Session-Id": session_ctx.session_id,
            **custom_headers,
        }

        try:
            logger.info("Executing custom webhook tool '%s' (%s %s)", name, method, url)
            async with httpx.AsyncClient(timeout=8.0) as client:
                if method == "GET":
                    resp = await client.get(url, params=kwargs, headers=req_headers)
                elif method == "POST":
                    resp = await client.post(url, json=kwargs, headers=req_headers)
                elif method == "PUT":
                    resp = await client.put(url, json=kwargs, headers=req_headers)
                elif method == "DELETE":
                    resp = await client.delete(url, params=kwargs, headers=req_headers)
                else:
                    return f"Error: Unsupported HTTP method {method}"

                if resp.status_code >= 400:
                    logger.warning("Webhook %s returned status %d: %s", name, resp.status_code, resp.text[:200])
                    return f"The service returned status {resp.status_code}."

                try:
                    data = resp.json()
                    return json.dumps(data)
                except Exception:
                    return resp.text[:500]
        except Exception as exc:
            logger.exception("Failed executing custom webhook tool '%s': %s", name, exc)
            return f"Service temporarily unavailable: {exc}"

    _webhook_tool.__name__ = name
    _webhook_tool.__doc__ = desc
    return llm.function_tool(_webhook_tool)
