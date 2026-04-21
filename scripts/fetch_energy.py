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

DAILY_LENGTH   = 90    # ~3 months for daily series (Brent, Henry Hub)
WEEKLY_1Y      = 56    # ~1 year of weekly data (gasoline, diesel)
WEEKLY_2Y      = 110   # ~2 years of weekly data (crude stocks, gas storage)


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
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    rows = data.get("response", {}).get("data", [])
    print(f"    -> {len(rows)} rows")
    return rows


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

    # Daily spot prices
    brent_rows = eia_fetch("petroleum/pri/spt",   "RBRTE",                  "daily",  DAILY_LENGTH)
    gas_rows   = eia_fetch("natural-gas/pri/fut",  "RNGWHHD",               "daily",  DAILY_LENGTH)

    # Weekly retail fuel prices (USD/gallon, US national average)
    # Gasoline: regular grade all formulations
    # Diesel: No.2 ultra-low sulfur on-highway
    gasoline_rows = eia_fetch("petroleum/pri/gnd", "EMM_EPMR_PTE_NUS_DPG",    "weekly", WEEKLY_1Y)
    diesel_rows   = eia_fetch("petroleum/pri/gnd", "EMD_EPD2DXL0_PTE_NUS_DPG","weekly", WEEKLY_1Y)

    # Weekly crude oil stocks excl. SPR (thousand barrels)
    crude_stocks_rows = eia_fetch("petroleum/sum/sndw", "WCESTUS1",            "weekly", WEEKLY_2Y)

    # Weekly natural gas working storage, Lower 48 (Bcf)
    gas_storage_rows  = eia_fetch("natural-gas/sum/sndw", "NW2_EPG0_SWO_R48_BCF", "weekly", WEEKLY_2Y)

    payload = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "source":       "U.S. Energy Information Administration (EIA)",
        "brent": {
            "label":  "Brent crude spot price",
            "unit":   "USD/barrel",
            "series": to_series(brent_rows),
        },
        "henry_hub": {
            "label":  "Henry Hub natural gas spot price",
            "unit":   "USD/MMBtu",
            "series": to_series(gas_rows),
        },
        "gasoline": {
            "label":  "US retail gasoline (regular)",
            "unit":   "USD/gallon",
            "series": to_series(gasoline_rows),
        },
        "diesel": {
            "label":  "US retail diesel",
            "unit":   "USD/gallon",
            "series": to_series(diesel_rows),
        },
        "crude_stocks": {
            "label":  "US crude oil stocks (excl. SPR)",
            "unit":   "thousand barrels",
            "series": to_series(crude_stocks_rows),
        },
        "gas_storage": {
            "label":  "US natural gas working storage (L48)",
            "unit":   "Bcf",
            "series": to_series(gas_storage_rows),
        },
    }

    firebase_db.reference("energy/prices").set(payload)
    print("Written to Firebase: energy/prices")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    build_and_write()
    print("Done.")