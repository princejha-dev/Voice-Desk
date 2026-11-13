"""
Test suite for VoiceDesk agent tools registry and LiveKit FunctionTool compatibility.
Uses Python built-in unittest framework.
"""
import unittest
from livekit.agents import llm
from runtime.engine.context import SessionContext
from runtime.tools.registry import get_tools_for_agent
from runtime.tools.webhook import create_dynamic_webhook_tool


class TestToolsRegistry(unittest.TestCase):
    def test_tools_return_livekit_function_tools(self):
        session_ctx = SessionContext(
            tenant_id="test-tenant-123",
            agent_id="test-agent-456",
            version_id="test-version-789",
            session_id="test-session-abc",
            agent_config={
                "enabled_tools": [
                    "knowledge_search",
                    "book_appointment",
                    "create_ticket",
                    "request_callback",
                ],
                "custom_tools": [
                    {
                        "name": "lookup_customer",
                        "description": "Fetch customer CRM record",
                        "method": "GET",
                        "url": "https://api.example.com/customers/{id}",
                    }
                ],
            },
        )

        tools = get_tools_for_agent(session_ctx.agent_config, session_ctx)
        self.assertEqual(len(tools), 5, f"Expected 5 tools, got {len(tools)}")

        # Crucial check: LiveKit ToolContext must accept all tools without ValueError
        tool_context = llm.ToolContext(tools)
        self.assertIsNotNone(tool_context)

        tool_names = [t.info.name for t in tools]
        self.assertIn("knowledge_search_tool", tool_names)
        self.assertIn("book_appointment_tool", tool_names)
        self.assertIn("create_support_ticket_tool", tool_names)
        self.assertIn("request_callback_tool", tool_names)
        self.assertIn("lookup_customer", tool_names)

    def test_custom_webhook_tool_creation(self):
        session_ctx = SessionContext(
            tenant_id="t1",
            agent_id="a1",
            version_id="v1",
            session_id="s1",
            agent_config={},
        )
        tool_def = {
            "name": "check_weather",
            "description": "Check current weather for city",
            "method": "GET",
            "url": "https://api.weather.com/v1/{city}",
        }
        tool = create_dynamic_webhook_tool(tool_def, session_ctx)
        self.assertIsNotNone(tool)
        self.assertEqual(tool.info.name, "check_weather")

        # Must be valid for ToolContext
        tc = llm.ToolContext([tool])
        self.assertIsNotNone(tc)


if __name__ == "__main__":
    unittest.main()
