import unittest
from runtime.tools.rag import _cosine_similarity, _parse_embedding


class TestRagHelpers(unittest.TestCase):
    def test_cosine_similarity_identical_vectors(self):
        v1 = [1.0, 0.0, 0.0]
        v2 = [1.0, 0.0, 0.0]
        self.assertAlmostEqual(_cosine_similarity(v1, v2), 1.0, places=5)

    def test_cosine_similarity_orthogonal_vectors(self):
        v1 = [1.0, 0.0, 0.0]
        v2 = [0.0, 1.0, 0.0]
        self.assertAlmostEqual(_cosine_similarity(v1, v2), 0.0, places=5)

    def test_cosine_similarity_opposite_vectors(self):
        v1 = [1.0, 0.0]
        v2 = [-1.0, 0.0]
        self.assertAlmostEqual(_cosine_similarity(v1, v2), -1.0, places=5)

    def test_cosine_similarity_zero_vector(self):
        v1 = [0.0, 0.0]
        v2 = [1.0, 2.0]
        self.assertEqual(_cosine_similarity(v1, v2), 0.0)

    def test_parse_embedding_from_list(self):
        raw = [0.1, 0.2, 0.3]
        parsed = _parse_embedding(raw)
        self.assertEqual(parsed, [0.1, 0.2, 0.3])

    def test_parse_embedding_from_json_string(self):
        raw = "[0.15, -0.25, 0.8]"
        parsed = _parse_embedding(raw)
        self.assertEqual(parsed, [0.15, -0.25, 0.8])

    def test_parse_embedding_invalid(self):
        self.assertIsNone(_parse_embedding("not a vector"))
        self.assertIsNone(_parse_embedding(None))


if __name__ == "__main__":
    unittest.main()
