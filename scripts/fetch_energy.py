import os
import json
import datetime
import urllib.request
import urllib.parse
import firebase_admin
from firebase_admin import credentials, db as firebase_db


# ---------------------------------------------------------------------------
# Firebase init (reuse existing app if already initialized)
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
FETCH_DAYS  = 60   # how many days of history to fetch from EIA


# ---------------------------------------------------------------------------
# EIA fetch helpers
# ---------------------------------------------------------------------------

def fetch_brent(length: int = FETCH_DAYS) -> list[dict]:
    """Fetch daily Brent crude spot price (USD/barrel)."""
    params = urllib.parse.urlencode({
        "api_key": EIA_API_KEY,
        "frequency": "daily",
        "data[0]": "value",
        "facets[product][]": "EPCBRENT",
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": length,
    })
    url = f"https://api.eia.gov/v2/petroleum/pri/spt/data/?{params}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("response", {}).get("data", [])


def fetch_henry_hub(length: int = FETCH_DAYS) -> list[dict]:
    """Fetch daily Henry Hub natural gas spot price (USD/MMBtu)."""
    params = urllib.parse.urlencode({
        "api_key": EIA_API_KEY,
        "frequency": "daily",
        "data[0]": "value",
        "facets[process][]": "PG4",
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": length,
    })
    url = f"https://api.eia.gov/v2/natural-gas/pri/sum/data/?{params}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("response", {}).get("data", [])


def normalize_series(raw: list[dict]) -> dict[str, float]:
    """Convert list of {period, value} records to {date_str: float} dict."""
    result = {}
    for row in raw:
        period = row.get("period", "")
        value  = row.get("value")
        if period and value is not None:
            try:
                result[period] = float(value)
            except (ValueError, TypeError):
                pass
    return result


# ---------------------------------------------------------------------------
# Build combined payload and write to Firebase
# ---------------------------------------------------------------------------

def build_and_write():
    print("Fetching Brent crude from EIA...")
    brent_raw = fetch_brent()
    print(f"  Got {len(brent_raw)} Brent records")

    print("Fetching Henry Hub natural gas from EIA...")
    gas_raw = fetch_henry_hub()
    print(f"  Got {len(gas_raw)} Henry Hub records")

    brent = normalize_series(brent_raw)
    gas   = normalize_series(gas_raw)

    # Build unified date-keyed series for the frontend
    all_dates = sorted(set(list(brent.keys()) + list(gas.keys())))

    series = []
    for date in all_dates:
        series.append({
            "date":   date,
            "brent":  brent.get(date),   # None if missing for that date
            "gas":    gas.get(date),
        })

    payload = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "brent_unit":   "USD/barrel",
        "gas_unit":     "USD/MMBtu",
        "source":       "U.S. Energy Information Administration (EIA)",
        "series":       series,
    }

    firebase_db.reference("energy/prices").set(payload)
    print(f"Written to Firebase: energy/prices ({len(series)} data points)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    build_and_write()
    print("Done.")