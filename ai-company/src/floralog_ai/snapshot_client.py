import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from floralog_ai.schemas import KpiSnapshot


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
    return KpiSnapshot.model_validate(payload)


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
