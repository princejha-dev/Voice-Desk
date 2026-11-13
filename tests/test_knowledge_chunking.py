"""
Test suite for knowledge document text extraction and chunking.
Uses Python built-in unittest framework.
"""
import unittest
import tempfile
from pathlib import Path

from apps.api.app.workers.ingestion_worker import _chunk_text, _extract_text


class TestKnowledgeChunking(unittest.TestCase):
    def test_chunking_logic(self):
        sample_text = (
            "VoiceDesk is an autonomous voice AI agent platform. "
            "It supports real-time appointment booking, customer support, and knowledge search. "
            "Agents can operate across custom business hours and timezones. "
        ) * 20

        chunks = _chunk_text(sample_text, chunk_chars=200, overlap_chars=40)
        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertGreater(len(chunk), 0)

    def test_plain_text_extraction(self):
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w", encoding="utf-8") as f:
            f.write("VoiceDesk Customer Support FAQ\nQ: What are your hours?\nA: 9 AM to 5 PM.")
            tmp_name = f.name

        try:
            extracted = _extract_text(tmp_name, "faq.txt")
            self.assertIn("VoiceDesk Customer Support FAQ", extracted)
            self.assertIn("9 AM to 5 PM", extracted)
        finally:
            Path(tmp_name).unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
