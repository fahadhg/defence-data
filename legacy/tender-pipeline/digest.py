"""
digest.py — Format and send the daily tender digest to Slack and/or email.
"""
import json
from datetime import date
from typing import Optional

import requests


def _score_emoji(score: int) -> str:
    if score >= 8:
        return "🟢"
    if score >= 5:
        return "🟡"
    return "🔴"


def _slack_block(tender: dict) -> str:
    s = tender["scoring"]
    emoji = _score_emoji(s["score"])
    rec = s["recommendation"].upper()
    tags = "  ".join(f"`{t}`" for t in s["tags"][:4]) if s["tags"] else ""
    flags = "  ".join(f"`⚠ {f}`" for f in s["flags"][:3]) if s["flags"] else ""
    meta = "  ".join(filter(None, [tags, flags]))
    closes = tender["closes"][:10] if tender["closes"] else "?"

    lines = [
        f"{emoji} *{s['score']}/10 — {rec}*  {meta}",
        f"*{tender['title'][:90]}*",
        f"_{tender['department']}_  |  Closes {closes}  |  {tender['method'][:40]}",
        f"{s['rationale'][:180]}",
    ]
    if tender.get("url"):
        lines.append(f"<{tender['url']}|View on CanadaBuys>")
    return "\n".join(lines)


def slack_digest(scored: list[dict], webhook_url: str, top_n: int = 10):
    if not scored:
        return

    today = date.today().strftime("%B %d, %Y")
    bid_count = sum(1 for t in scored if t["scoring"]["recommendation"] == "bid")
    watch_count = sum(1 for t in scored if t["scoring"]["recommendation"] == "watch")

    header = (
        f"*🔔 Tender Intelligence Digest — {today}*\n"
        f"{len(scored)} new tenders scored  •  "
        f"*{bid_count} BID*  •  *{watch_count} WATCH*"
    )

    blocks = [header, "─" * 40]
    for t in scored[:top_n]:
        blocks.append(_slack_block(t))
        blocks.append("")  # blank line between entries

    payload = {"text": "\n".join(blocks)}
    resp = requests.post(webhook_url, json=payload, timeout=15)
    resp.raise_for_status()


def email_digest_html(scored: list[dict]) -> str:
    today = date.today().strftime("%B %d, %Y")
    bid_count = sum(1 for t in scored if t["scoring"]["recommendation"] == "bid")
    watch_count = sum(1 for t in scored if t["scoring"]["recommendation"] == "watch")

    rows = ""
    for t in scored[:20]:
        s = t["scoring"]
        color = "#16a34a" if s["score"] >= 8 else "#d97706" if s["score"] >= 5 else "#dc2626"
        tags_html = " ".join(
            f'<span style="background:#e5e7eb;padding:1px 6px;border-radius:3px;font-size:11px">{tg}</span>'
            for tg in s["tags"][:4]
        )
        rows += f"""
        <tr>
          <td style="font-weight:bold;color:{color};text-align:center">{s['score']}/10</td>
          <td style="font-weight:bold">{t['title'][:80]}</td>
          <td>{t['department'][:45]}</td>
          <td>{t['closes'][:10]}</td>
          <td style="font-weight:bold;color:{color}">{s['recommendation'].upper()}</td>
          <td>{tags_html}</td>
          <td><a href="{t['url']}">View</a></td>
        </tr>
        <tr>
          <td></td>
          <td colspan="6" style="color:#6b7280;font-size:12px;padding-bottom:8px">{s['rationale']}</td>
        </tr>"""

    return f"""<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:900px;margin:auto;padding:20px">
<h2>🔔 Tender Intelligence Digest — {today}</h2>
<p style="color:#6b7280">{len(scored)} new tenders &nbsp;|&nbsp;
  <strong style="color:#16a34a">{bid_count} BID</strong> &nbsp;|&nbsp;
  <strong style="color:#d97706">{watch_count} WATCH</strong>
</p>
<table border="0" cellpadding="6" cellspacing="0"
  style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
  <thead style="background:#f9fafb">
    <tr>
      <th>Score</th><th>Title</th><th>Department</th>
      <th>Closes</th><th>Rec</th><th>Tags</th><th>Link</th>
    </tr>
  </thead>
  <tbody>{rows}</tbody>
</table>
<p style="color:#9ca3af;font-size:11px;margin-top:24px">
  Source: CanadaBuys open data &nbsp;|&nbsp; Scored by Claude Sonnet
</p>
</body></html>"""


def send_email_resend(
    scored: list[dict],
    api_key: str,
    to_email: str,
    from_email: str = "tenders@resend.dev",
):
    import resend  # type: ignore

    resend.api_key = api_key
    today = date.today().strftime("%B %d, %Y")
    html = email_digest_html(scored)
    resend.Emails.send({
        "from": from_email,
        "to": to_email,
        "subject": f"🔔 Tender Digest — {today} ({len(scored)} new)",
        "html": html,
    })


def print_digest(scored: list[dict], top_n: int = 10):
    today = date.today().strftime("%B %d, %Y")
    print(f"\n{'='*60}")
    print(f"  TENDER DIGEST — {today}")
    print(f"{'='*60}")
    for t in scored[:top_n]:
        s = t["scoring"]
        emoji = _score_emoji(s["score"])
        print(f"\n{emoji} {s['score']}/10  [{s['recommendation'].upper()}]  {t['title'][:65]}")
        print(f"   Dept : {t['department'][:55]}")
        print(f"   Close: {t['closes'][:10]}  |  {t['method'][:40]}")
        print(f"   Why  : {s['rationale'][:130]}")
        if s["tags"]:
            print(f"   Tags : {', '.join(s['tags'])}")
        if s["flags"]:
            print(f"   Flags: {', '.join(s['flags'])}")
        if t.get("url"):
            print(f"   URL  : {t['url']}")
    print(f"\n{'='*60}\n")
