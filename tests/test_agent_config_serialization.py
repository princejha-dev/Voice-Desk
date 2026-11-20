import unittest
from pydantic import BaseModel
from apps.api.app.modules.agents.router import AgentConfigSchema, UpdateAgentRequest


class TestAgentConfigSerialization(unittest.TestCase):
    def test_agent_config_preserves_tools_config_and_custom_tools(self):
        payload = {
            "instructions": "Be a professional customer support representative.",
            "greeting": "Hello! How can I help you?",
            "personality": "Helpful and concise",
            "tools": ["knowledge_search", "book_appointment"],
            "tools_config": {
                "knowledge_search": {
                    "match_threshold": 0.25,
                    "max_chunks": 4,
                },
                "book_appointment": {
                    "working_days": ["Monday", "Wednesday", "Friday"],
                    "start_time": "10:00",
                    "end_time": "16:00",
                    "timezone": "America/New_York",
                    "services": ["Onboarding Demo", "Technical Support"],
                },
            },
            "custom_tools": [
                {
                    "name": "lookup_order",
                    "description": "Look up order status by order ID",
                    "endpoint_url": "https://api.example.com/orders",
                    "method": "POST",
                }
            ],
            "knowledge_base_ids": ["doc-123", "doc-456"],
        }

        schema = AgentConfigSchema.model_validate(payload)
        dumped = schema.model_dump()

        self.assertIn("tools_config", dumped)
        self.assertEqual(dumped["tools_config"]["knowledge_search"]["match_threshold"], 0.25)
        self.assertEqual(dumped["tools_config"]["book_appointment"]["timezone"], "America/New_York")
        self.assertIn("custom_tools", dumped)
        self.assertEqual(len(dumped["custom_tools"]), 1)
        self.assertEqual(dumped["custom_tools"][0]["name"], "lookup_order")
        self.assertEqual(dumped["knowledge_base_ids"], ["doc-123", "doc-456"])

    def test_update_agent_request_schema(self):
        req = UpdateAgentRequest(name="Updated Agent", description="New description", slug="sales-bot")
        data = req.model_dump(exclude_unset=True)
        self.assertEqual(data["name"], "Updated Agent")
        self.assertEqual(data["description"], "New description")
        self.assertEqual(data["slug"], "sales-bot")


if __name__ == "__main__":
    unittest.main()
