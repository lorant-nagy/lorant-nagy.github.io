import os
import json
import datetime
import urllib.request
import urllib.parse
import firebase_admin
from firebase_admin import credentials, db as firebase_db


# ---------------------------------------------------------------------------
# Firebase init
# ---------------------------------------------------------------------------

SERVICE_ACCOUNT = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
DATABASE_URL = "https://github-page-edfd8-default-rtdb.asia-southeast1.firebasedatabase.app"

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EIA_API_KEY = os.environ["EIA_API_KEY"]

DAILY_LENGTH   = 90
WEEKLY_1Y      = 56
WEEKLY_2Y      = 110


# ---------------------------------------------------------------------------
# EIA fetch helpers
# ---------------------------------------------------------------------------

def eia_fetch(route: str, series_id: str, frequency: str, length: int) -> list[dict]:
    """Fetch via APIv2 route + facets[series]."""
    params = urllib.parse.urlencode({
        "api_key":            EIA_API_KEY,
        "frequency":          frequency,
        "data[0]":            "value",
        "facets[series][]":   series_id,
        "sort[0][column]":    "period",
        "sort[0][direction]": "desc",
        "length":             length,
    })
    url = f"https://api.eia.gov/v2/{route}/data/?{params}"
    print(f"  GET {route} [{series_id}] ...")
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        rows = data.get("response", {}).get("data", [])
        print(f"    -> {len(rows)} rows")
        return rows
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"    -> HTTP {e.code}: {body[:300]}")
        raise


def to_series(rows: list[dict]) -> list[dict]:
    """Convert raw EIA rows to [{date, value}] sorted ascending."""
    result = []
    for row in rows:
        period = row.get("period", "")
        value  = row.get("value")
        if period and value is not None:
            try:
                result.append({"date": period, "value": float(value)})
            except (ValueError, TypeError):
                pass
    return sorted(result, key=lambda x: x["date"])


# ---------------------------------------------------------------------------
# Build payload and write to Firebase
# ---------------------------------------------------------------------------

def build_and_write():

    brent_rows    = eia_fetch("petroleum/pri/spt",   "RBRTE",                   "daily",  DAILY_LENGTH)
    gas_rows      = eia_fetch("natural-gas/pri/fut",  "RNGWHHD",                "daily",  DAILY_LENGTH)
    gasoline_rows = eia_fetch("petroleum/pri/gnd",    "EMM_EPMR_PTE_NUS_DPG",   "weekly", WEEKLY_1Y)
    diesel_rows   = eia_fetch("petroleum/pri/gnd",    "EMD_EPD2DXL0_PTE_NUS_DPG","weekly", WEEKLY_1Y)
    crude_stocks_rows = eia_fetch("petroleum/sum/sndw","WCESTUS1",               "weekly", WEEKLY_2Y)

    # Try multiple known route variants for gas storage
    gas_storage_rows = []
    for route, sid in [
        ("natural-gas/stor/sum",    "NW2_EPG0_SWO_R48_BCF"),
        ("natural-gas/sum/snd",     "NW2_EPG0_SWO_R48_BCF"),
        ("natural-gas/stor/wkly",   "NW2_EPG0_SWO_R48_BCF"),
    ]:
        try:
            gas_storage_rows = eia_fetch(route, sid, "weekly", WEEKLY_2Y)
            if gas_storage_rows:
                break
        except Exception:
            continue

    if not gas_storage_rows:
        print("  WARNING: gas storage data unavailable, using empty series")

    payload = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "source":       "U.S. Energy Information Administration (EIA)",
        "brent":        {"label": "Brent crude spot price",             "unit": "USD/barrel",        "series": to_series(brent_rows)},
        "henry_hub":    {"label": "Henry Hub natural gas spot price",   "unit": "USD/MMBtu",          "series": to_series(gas_rows)},
        "gasoline":     {"label": "US retail gasoline (regular)",       "unit": "USD/gallon",         "series": to_series(gasoline_rows)},
        "diesel":       {"label": "US retail diesel",                   "unit": "USD/gallon",         "series": to_series(diesel_rows)},
        "crude_stocks": {"label": "US crude oil stocks (excl. SPR)",    "unit": "thousand barrels",   "series": to_series(crude_stocks_rows)},
        "gas_storage":  {"label": "US natural gas working storage (L48)","unit": "Bcf",              "series": to_series(gas_storage_rows)},
    }

    firebase_db.reference("energy/prices").set(payload)
    print("Written to Firebase: energy/prices")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    build_and_write()
    print("Done.")