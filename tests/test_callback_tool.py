import unittest
from runtime.engine.context import SessionContext
from runtime.tools.registry import _build_callback_tool, _build_booking_tool, _build_ticket_tool


class TestCallbackTool(unittest.TestCase):
    def setUp(self):
        self.session_ctx = SessionContext(
            tenant_id="3fdd68a3-92ee-4523-9459-0dd00905042d",
            agent_id="231396a8-ea1d-48fa-b088-383ef1abfced",
            version_id="ver-123",
            session_id="a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
            agent_config={},
        )

    def test_build_callback_tool_registration(self):
        tool = _build_callback_tool(self.session_ctx)
        self.assertEqual(tool.info.name, "request_callback_tool")

    def test_build_ticket_tool_registration(self):
        tool = _build_ticket_tool(self.session_ctx)
        self.assertEqual(tool.info.name, "create_support_ticket_tool")

    def test_build_booking_tool_registration(self):
        tool = _build_booking_tool(self.session_ctx)
        self.assertEqual(tool.info.name, "book_appointment_tool")


if __name__ == "__main__":
    unittest.main()
