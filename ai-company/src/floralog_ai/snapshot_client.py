import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from floralog_ai.schemas import KpiSnapshot


def ensure_snapshot_has_signal(snapshot: KpiSnapshot) -> KpiSnapshot:
    signal_values = (
        snapshot.revenue_mtd_eur,
        snapshot.revenue_30d_eur,
        snapshot.transaction_count_30d,
        snapshot.donation_page_views_30d,
        snapshot.donation_orders_30d,
        snapshot.donation_captures_30d,
        snapshot.dau,
        snapshot.wau,
        snapshot.mau,
        snapshot.action_events_30d,
        snapshot.navigation_events_30d,
        snapshot.referrals_completed_30d,
        snapshot.community_actions_30d,
    )
    if not any(float(value) > 0 for value in signal_values):
        raise RuntimeError(
            "Live KPI snapshot contains no signal. The AI review was stopped because "
            "the KPIAdmin aggregate source returned only zeros. Check the SQL migration, "
            "ai_get_kpi_snapshot(), and the Supabase data source before retrying."
        )
    return snapshot


def fetch_snapshot(endpoint: str, secret: str, timeout_seconds: int = 30) -> KpiSnapshot:
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("AI_KPI_ENDPOINT must be an absolute HTTPS URL.")
    if not secret.strip():
        raise ValueError("AI_KPI_SECRET is required.")

    request = Request(
        endpoint,
        headers={
            "Accept": "application/json",
            "X-Floralog-AI-Secret": secret,
            "User-Agent": "floralog-ai-company/0.1",
        },
        method="GET",
    )
    with urlopen(request, timeout=timeout_seconds) as response:
        if response.status != 200:
            raise RuntimeError(f"KPI endpoint returned HTTP {response.status}.")
        payload = json.loads(response.read().decode("utf-8"))
    return ensure_snapshot_has_signal(KpiSnapshot.model_validate(payload))


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch an aggregate Floralog KPI snapshot.")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    endpoint = os.getenv("AI_KPI_ENDPOINT", "")
    secret = os.getenv("AI_KPI_SECRET", "")
    snapshot = fetch_snapshot(endpoint, secret)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(snapshot.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
