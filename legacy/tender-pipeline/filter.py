"""
filter.py — Pre-filter tenders before sending to Claude.

Avoids burning tokens on clearly irrelevant tenders (food services, laundry,
grounds maintenance, etc.) when you're a tech/consulting firm.

Set FOCUS_KEYWORDS in .env to restrict by title/description match.
Leave it empty to score everything.
"""
import os
import re

# Keywords that strongly suggest irrelevance for a tech/consulting SME.
# Tenders matching ANY of these are skipped before Claude scoring.
SKIP_PATTERNS = [
    r"\blaundry\b", r"\bfood service\b", r"\bcatering\b", r"\bcafeteria\b",
    r"\bgrounds (maintenance|keeping)\b", r"\bjanitorial\b", r"\bcleaning service\b",
    r"\bparking\b", r"\blandscaping\b", r"\bsnow removal\b", r"\bpest control\b",
    r"\bplumbing\b", r"\bhvac\b", r"\belectrical contractor\b",
    r"\bfurniture\b", r"\buniform\b", r"\bworkwear\b",
]

_skip_re = re.compile("|".join(SKIP_PATTERNS), re.IGNORECASE)


def _focus_keywords() -> list[str]:
    raw = os.getenv("FOCUS_KEYWORDS", "")
    return [k.strip().lower() for k in raw.split(",") if k.strip()]


def is_relevant(tender: dict) -> bool:
    """Return False to skip this tender before scoring."""
    text = f"{tender['title']} {tender['description']} {tender['gsin']} {tender['unspsc']}"

    if _skip_re.search(text):
        return False

    focus = _focus_keywords()
    if focus:
        return any(kw in text.lower() for kw in focus)

    return True


def pre_filter(tenders: list[dict]) -> tuple[list[dict], int]:
    """Returns (relevant, skipped_count)."""
    relevant = [t for t in tenders if is_relevant(t)]
    return relevant, len(tenders) - len(relevant)
