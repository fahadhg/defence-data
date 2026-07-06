"""
score.py — Score a tender using Claude with structured tool-use output.
"""
from anthropic import Anthropic

client = Anthropic()

SCORE_TOOL = {
    "name": "score_tender",
    "description": "Score a Canadian government tender for bid worthiness",
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {
                "type": "integer",
                "minimum": 0,
                "maximum": 10,
                "description": "Bid worthiness score 0-10",
            },
            "recommendation": {
                "type": "string",
                "enum": ["bid", "watch", "pass"],
                "description": "bid=pursue now, watch=monitor, pass=skip",
            },
            "rationale": {
                "type": "string",
                "description": "1-2 sentence explanation of the score",
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Category tags e.g. ai-ml, defence, consulting, data-analytics, digital-transformation, it-services, policy-research",
            },
            "flags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Risk/opportunity flags e.g. short-deadline, sole-source, limited-competition, high-value, security-clearance, open-bidding, incumbent-likely",
            },
        },
        "required": ["score", "recommendation", "rationale", "tags", "flags"],
    },
}

SYSTEM = """You are a procurement intelligence analyst for a Canadian SME with these capabilities:
- AI / ML / data analytics implementation
- Digital transformation consulting
- Defence and national security technology
- Policy research and advisory services
- Software development (Python, web, data pipelines)
- Strategic analysis and program evaluation

Score each tender 0–10 for bid worthiness:
9–10 → Strong strategic fit, realistic odds, recommend bidding
7–8  → Good fit, worth a bid decision meeting
5–6  → Marginal fit or significant risk flags, worth monitoring
0–4  → Poor fit or disqualifying factors, pass

Scoring factors:
+ High fit with AI/data/digital/consulting/defence/policy work
+ Open competitive bidding method (not sole-source or limited)
+ Sufficient time to close (>21 days)
+ Ontario/National Capital Region delivery (preferred)
+ Smaller contract value where SME can compete (<$5M)
− Construction, facilities, food, trades (not our space)
− <14 days to close (short-deadline flag)
− Sole-source or limited tendering
− Security clearances required at SECRET/TOP SECRET level
− Clearly requires large prime contractor"""


def score_tender(tender: dict) -> dict:
    desc = tender.get("description", "") or ""
    prompt = f"""Score this Canadian government tender:

Title: {tender['title']}
Department: {tender['department']}
Category: {tender['category']}
GSIN: {tender['gsin']}
UNSPSC: {tender['unspsc']}
Notice Type: {tender['notice_type']}
Method: {tender['method']}
Selection Criteria: {tender['selection']}
Limited Tendering Reason: {tender['limited_reason']}
Closes: {tender['closes']}
Regions of Opportunity: {tender['regions']}
Delivery Regions: {tender['delivery']}
Description: {desc[:1000] if desc else '(none provided)'}
"""

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM,
        tools=[SCORE_TOOL],
        tool_choice={"type": "tool", "name": "score_tender"},
        messages=[{"role": "user", "content": prompt}],
    )

    for block in resp.content:
        if block.type == "tool_use":
            return block.input

    return {
        "score": 0,
        "recommendation": "pass",
        "rationale": "Scoring failed — no tool_use block returned.",
        "tags": [],
        "flags": [],
    }
