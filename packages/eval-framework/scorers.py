"""Scoring functions for VoiceDesk evaluation framework.

Each scorer takes (expected, actual, **kwargs) and returns a float in [0, 1].
Scorers can be used standalone or composed inside EvalRunner.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Callable, Dict, List, Optional


# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------
Scorer = Callable[[str, str], float]


# ---------------------------------------------------------------------------
# Lexical / heuristic scorers (synchronous, no LLM calls)
# ---------------------------------------------------------------------------

def exact_match(expected: str, actual: str) -> float:
    """1.0 if strings match exactly (case-insensitive), 0.0 otherwise."""
    return 1.0 if expected.strip().lower() == actual.strip().lower() else 0.0


def token_overlap(expected: str, actual: str) -> float:
    """Jaccard similarity of word-token sets."""
    expected_tokens = set(re.findall(r"\w+", expected.lower()))
    actual_tokens = set(re.findall(r"\w+", actual.lower()))
    if not expected_tokens and not actual_tokens:
        return 1.0
    if not expected_tokens or not actual_tokens:
        return 0.0
    intersection = expected_tokens & actual_tokens
    union = expected_tokens | actual_tokens
    return len(intersection) / len(union)


def fuzzy_similarity(expected: str, actual: str) -> float:
    """SequenceMatcher ratio — good for near-duplicate strings."""
    return SequenceMatcher(None, expected.lower(), actual.lower()).ratio()


def keyword_coverage(expected: str, actual: str, keywords: Optional[List[str]] = None) -> float:
    """Fraction of required keywords found in actual response.

    If *keywords* is not provided, keywords are extracted from *expected* as
    all tokens longer than 4 characters.
    """
    if keywords is None:
        keywords = [t for t in re.findall(r"\w+", expected.lower()) if len(t) > 4]
    if not keywords:
        return 1.0
    actual_lower = actual.lower()
    found = sum(1 for kw in keywords if kw in actual_lower)
    return found / len(keywords)


def length_penalty(
    expected: str,
    actual: str,
    min_ratio: float = 0.5,
    max_ratio: float = 2.0,
) -> float:
    """Penalise responses that are too short or too long relative to expected.

    Returns 1.0 when the length ratio is within [min_ratio, max_ratio],
    linearly decaying to 0.0 at extreme ratios.
    """
    exp_len = max(len(expected.split()), 1)
    act_len = max(len(actual.split()), 1)
    ratio = act_len / exp_len
    if min_ratio <= ratio <= max_ratio:
        return 1.0
    elif ratio < min_ratio:
        return max(0.0, ratio / min_ratio)
    else:
        return max(0.0, 1.0 - (ratio - max_ratio) / max_ratio)


def no_hallucination(expected: str, actual: str, forbidden_patterns: Optional[List[str]] = None) -> float:
    """Return 0.0 if *actual* contains known hallucination patterns, 1.0 otherwise."""
    if forbidden_patterns is None:
        forbidden_patterns = [
            r"\bi don'?t know\b",
            r"\bi'?m not sure\b",
            r"\bi cannot (help|assist)\b",
            r"\bsorry,? i can'?t\b",
        ]
    actual_lower = actual.lower()
    for pattern in forbidden_patterns:
        if re.search(pattern, actual_lower):
            return 0.0
    return 1.0


# ---------------------------------------------------------------------------
# Composite scorer
# ---------------------------------------------------------------------------

class CompositeScorer:
    """Weighted average of multiple scorers."""

    def __init__(self, scorers: Dict[str, tuple[Scorer, float]]):
        """
        Args:
            scorers: mapping of name -> (scorer_fn, weight)
        """
        self.scorers = scorers

    def score(self, expected: str, actual: str) -> float:
        total_weight = sum(w for _, w in self.scorers.values())
        if total_weight == 0:
            return 0.0
        weighted_sum = sum(
            fn(expected, actual) * w for fn, w in self.scorers.values()
        )
        return weighted_sum / total_weight

    def score_breakdown(self, expected: str, actual: str) -> Dict[str, float]:
        return {name: fn(expected, actual) for name, (fn, _) in self.scorers.items()}


# ---------------------------------------------------------------------------
# Pre-built composite scorers
# ---------------------------------------------------------------------------

DEFAULT_SCORER = CompositeScorer(
    {
        "token_overlap": (token_overlap, 0.4),
        "fuzzy_similarity": (fuzzy_similarity, 0.3),
        "keyword_coverage": (keyword_coverage, 0.2),
        "length_penalty": (length_penalty, 0.1),
    }
)

STRICT_SCORER = CompositeScorer(
    {
        "exact_match": (exact_match, 0.5),
        "token_overlap": (token_overlap, 0.3),
        "keyword_coverage": (keyword_coverage, 0.2),
    }
)
