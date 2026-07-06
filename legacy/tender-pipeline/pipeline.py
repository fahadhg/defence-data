#!/usr/bin/env python3
"""
Tender Intelligence Pipeline
=============================
Fetches open CanadaBuys tender notices, scores with Claude, sends digest.

Usage:
  python pipeline.py                # score new tenders, send digest
  python pipeline.py --dry-run      # fetch + filter + score, no digest sent
  python pipeline.py --limit 20     # cap at 20 tenders scored per run
  python pipeline.py --reset        # clear seen.json (re-score everything)
  python pipeline.py --top 5        # show top 5 in console (default 10)
"""
import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
SEEN_PATH = DATA_DIR / "seen.json"
ARCHIVE_PATH = DATA_DIR / "tenders.json"


def load_archive() -> list[dict]:
    if ARCHIVE_PATH.exists():
        return json.loads(ARCHIVE_PATH.read_text())
    return []


def save_archive(tenders: list[dict]):
    ARCHIVE_PATH.write_text(json.dumps(tenders, indent=2, default=str))


def main():
    parser = argparse.ArgumentParser(description="Tender Intelligence Pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Score but don't send digest")
    parser.add_argument("--limit", type=int, default=0, help="Max new tenders to score (0=all)")
    parser.add_argument("--reset", action="store_true", help="Clear seen.json and re-score all")
    parser.add_argument("--top", type=int, default=10, help="Top N shown in console digest")
    args = parser.parse_args()

    # Lazy imports so missing deps show clear errors
    from fetch import fetch_open_tenders, load_seen, save_seen, filter_new
    from filter import pre_filter
    from score import score_tender
    from digest import slack_digest, send_email_resend, print_digest

    print("📡  Fetching open tenders from CanadaBuys...")
    try:
        all_tenders = fetch_open_tenders()
    except Exception as e:
        print(f"❌  Fetch failed: {e}")
        sys.exit(1)
    print(f"    {len(all_tenders)} open tenders in feed")

    if args.reset and SEEN_PATH.exists():
        SEEN_PATH.unlink()
        print("    seen.json cleared")

    seen = load_seen(SEEN_PATH)
    new = filter_new(all_tenders, seen)
    print(f"    {len(new)} not yet scored")

    relevant, skipped = pre_filter(new)
    print(f"    {skipped} pre-filtered (irrelevant category)  →  {len(relevant)} to score")

    if not relevant:
        print("✅  No new relevant tenders. Done.")
        return

    if args.limit:
        relevant = relevant[: args.limit]
        print(f"    Capped at {args.limit} (--limit flag)")

    archive = load_archive()
    scored_today: list[dict] = []
    errors = 0

    for i, tender in enumerate(relevant, 1):
        title_short = tender["title"][:55]
        print(f"  [{i:>3}/{len(relevant)}] Scoring: {title_short}...")
        try:
            tender["scoring"] = score_tender(tender)
            archive.append(tender)
            scored_today.append(tender)
            seen.add(tender["ref"])
        except Exception as e:
            errors += 1
            print(f"         ⚠️  Failed ({e})")

    scored_today.sort(key=lambda t: t.get("scoring", {}).get("score", 0), reverse=True)

    save_archive(archive)
    save_seen(SEEN_PATH, seen)

    bid_n = sum(1 for t in scored_today if t["scoring"]["recommendation"] == "bid")
    watch_n = sum(1 for t in scored_today if t["scoring"]["recommendation"] == "watch")
    print(f"\n✅  Scored {len(scored_today)} tenders  ({bid_n} BID  {watch_n} WATCH  {errors} errors)")

    print_digest(scored_today, top_n=args.top)

    if args.dry_run:
        print("🚫  --dry-run: digest not sent.")
        return

    slack_url = os.getenv("SLACK_WEBHOOK_URL")
    if slack_url:
        print("📤  Sending Slack digest...")
        try:
            slack_digest(scored_today, slack_url, top_n=args.top)
            print("    ✓ Slack sent")
        except Exception as e:
            print(f"    ⚠️  Slack failed: {e}")

    resend_key = os.getenv("RESEND_API_KEY")
    to_email = os.getenv("DIGEST_EMAIL")
    from_email = os.getenv("DIGEST_FROM_EMAIL", "tenders@resend.dev")
    if resend_key and to_email:
        print("📧  Sending email digest...")
        try:
            send_email_resend(scored_today, resend_key, to_email, from_email)
            print(f"    ✓ Email sent to {to_email}")
        except Exception as e:
            print(f"    ⚠️  Email failed: {e}")


if __name__ == "__main__":
    main()
