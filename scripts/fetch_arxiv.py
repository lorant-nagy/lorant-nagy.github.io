import os
import json
import time
import datetime
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import firebase_admin
from firebase_admin import credentials, db


# ---------------------------------------------------------------------------
# Firebase init
# ---------------------------------------------------------------------------

SERVICE_ACCOUNT = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
DATABASE_URL = "https://github-page-edfd8-default-rtdb.asia-southeast1.firebasedatabase.app"

cred = credentials.Certificate(SERVICE_ACCOUNT)
firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BUDAPEST_TZ = datetime.timezone(datetime.timedelta(hours=1))  # UTC+1 (winter)
# Note: for production you may want to handle DST properly via the `pytz` or
# `zoneinfo` library. For now UTC+1 is fine for most of the year;
# in summer Budapest is UTC+2 so the window shifts by one hour but
# arXiv data is still captured correctly since we fetch by full calendar day.

QFIN_CATS = [
    "q-fin.CP", "q-fin.EC", "q-fin.GN", "q-fin.MF",
    "q-fin.PM", "q-fin.PR", "q-fin.RM", "q-fin.ST", "q-fin.TR",
]

QBIO_CATS = [
    "q-bio.BM", "q-bio.CB", "q-bio.GN", "q-bio.MN", "q-bio.NC",
    "q-bio.OT", "q-bio.PE", "q-bio.QM", "q-bio.SC", "q-bio.TO",
]

ARXIV_NS = "http://www.w3.org/2005/Atom"
ARXIV_EXT_NS = "http://arxiv.org/schemas/atom"


# ---------------------------------------------------------------------------
# arXiv helpers
# ---------------------------------------------------------------------------

def day_to_gmt_range(date: datetime.date) -> tuple[str, str]:
    """Convert a Budapest calendar date to arXiv GMT minute strings."""
    # Budapest midnight = start of day in local time
    local_start = datetime.datetime(date.year, date.month, date.day, 0, 0,
                                    tzinfo=BUDAPEST_TZ)
    local_end   = local_start + datetime.timedelta(days=1)
    utc_start   = local_start.astimezone(datetime.timezone.utc)
    utc_end     = local_end.astimezone(datetime.timezone.utc)
    fmt = "%Y%m%d%H%M"
    return utc_start.strftime(fmt), utc_end.strftime(fmt)


def build_query(cats: list[str], start_gmt: str, end_gmt: str) -> str:
    cat_clause = " OR ".join(f"cat:{c}" for c in cats)
    return f"({cat_clause}) AND submittedDate:[{start_gmt} TO {end_gmt}]"


def fetch_arxiv(query: str, max_results: int = 200) -> str:
    base = "https://export.arxiv.org/api/query"
    params = urllib.parse.urlencode({
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    })
    url = f"{base}?{params}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_entries(xml_text: str) -> list[dict]:
    root = ET.fromstring(xml_text)
    entries = []
    for entry in root.findall(f"{{{ARXIV_NS}}}entry"):
        raw_id = entry.findtext(f"{{{ARXIV_NS}}}id", "")
        arxiv_id = raw_id.split("/abs/")[-1].strip()
        title = (entry.findtext(f"{{{ARXIV_NS}}}title") or "").replace("\n", " ").strip()
        published = entry.findtext(f"{{{ARXIV_NS}}}published", "")
        updated   = entry.findtext(f"{{{ARXIV_NS}}}updated", "")
        summary   = (entry.findtext(f"{{{ARXIV_NS}}}summary") or "").replace("\n", " ").strip()

        authors = [
            a.findtext(f"{{{ARXIV_NS}}}name", "")
            for a in entry.findall(f"{{{ARXIV_NS}}}author")
        ]

        primary_cat = ""
        pc_el = entry.find(f"{{{ARXIV_EXT_NS}}}primary_category")
        if pc_el is not None:
            primary_cat = pc_el.get("term", "")

        categories = [
            c.get("term", "")
            for c in entry.findall(f"{{{ARXIV_NS}}}category")
        ]

        entries.append({
            "id": f"arXiv:{arxiv_id}",
            "url": f"https://arxiv.org/abs/{arxiv_id}",
            "title": title,
            "published": published,
            "updated": updated,
            "summary": summary,
            "authors": authors,
            "primary_category": primary_cat,
            "categories": categories,
        })
    return entries


# ---------------------------------------------------------------------------
# Per-day fetch + write
# ---------------------------------------------------------------------------

def fetch_day(date: datetime.date) -> dict:
    start_gmt, end_gmt = day_to_gmt_range(date)
    print(f"  Fetching {date}  (GMT window: {start_gmt} – {end_gmt})")

    qfin_xml = fetch_arxiv(build_query(QFIN_CATS, start_gmt, end_gmt))
    time.sleep(3)
    qbio_xml = fetch_arxiv(build_query(QBIO_CATS, start_gmt, end_gmt))

    qfin_entries = parse_entries(qfin_xml)
    qbio_entries = parse_entries(qbio_xml)

    # histogram over primary categories (combined)
    hist: dict[str, int] = {}
    for e in qfin_entries + qbio_entries:
        pc = e["primary_category"]
        if pc:
            hist[pc] = hist.get(pc, 0) + 1
    histogram = sorted(
        [{"category": k, "count": v} for k, v in hist.items()],
        key=lambda x: -x["count"]
    )

    return {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "day_label": date.isoformat(),
        "q_fin_count": len(qfin_entries),
        "q_bio_count": len(qbio_entries),
        "histogram": histogram,
        "q_fin": qfin_entries,
        "q_bio": qbio_entries,
    }


def write_to_firebase(date: datetime.date, data: dict):
    key = date.isoformat()          # e.g. "2026-04-21"
    db.reference(f"arxiv/daily/{key}").set(data)
    print(f"  Written to Firebase: arxiv/daily/{key}")


# ---------------------------------------------------------------------------
# ── BACKFILL BLOCK ──────────────────────────────────────────────────────────
# Run this once manually to populate historical data, then delete this block.
# Trigger via: workflow_dispatch in GitHub Actions, or locally with:
#   BACKFILL=1 python fetch_arxiv.py
# ── BACKFILL BLOCK ──────────────────────────────────────────────────────────

if os.environ.get("BACKFILL") == "1":
    print("=== BACKFILL MODE ===")
    today = datetime.date.today()
    BACKFILL_DAYS = 60
    for i in range(BACKFILL_DAYS, 0, -1):
        target = today - datetime.timedelta(days=i)
        # skip weekends — arXiv has no submissions
        if target.weekday() >= 5:
            print(f"  Skipping {target} (weekend)")
            continue
        print(f"[{BACKFILL_DAYS - i + 1}/{BACKFILL_DAYS}] {target}")
        day_data = fetch_day(target)
        write_to_firebase(target, day_data)
        time.sleep(3)   # be polite to arXiv between days
    print("=== BACKFILL DONE — delete this block now ===")

# ── END BACKFILL BLOCK ──────────────────────────────────────────────────────


# ---------------------------------------------------------------------------
# Daily run (always executes)
# ---------------------------------------------------------------------------

else:
    today = datetime.date.today()
    # adjust for Budapest timezone — if the Actions job runs at 05:15 UTC
    # and Budapest is UTC+1/+2, "today" in Budapest is the same calendar date
    budapest_now = datetime.datetime.now(BUDAPEST_TZ)
    today = budapest_now.date()

    print(f"=== Daily fetch for {today} ===")
    day_data = fetch_day(today)
    write_to_firebase(today, day_data)
    print("=== Done ===")