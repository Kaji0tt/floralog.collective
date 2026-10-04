import argparse
import os
from pathlib import Path

from floralog_ai.http_client import ApiError, request_json
from floralog_ai.schemas import ContentSnapshot
from floralog_ai.snapshot_client import fetch_snapshot


def fetch_content_snapshot(endpoint: str, secret: str) -> ContentSnapshot:
    if not secret.strip():
        raise ValueError("AI_KPI_SECRET is required.")
    payload = request_json("GET", endpoint, headers={"X-Floralog-AI-Secret": secret})
    return ContentSnapshot.model_validate(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch the aggregate Floralog content snapshot.")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    secret = os.getenv("AI_KPI_SECRET", "")
    snapshot = fetch_content_snapshot(os.getenv("AI_CONTENT_ENDPOINT", ""), secret)

    kpi_endpoint = os.getenv("AI_KPI_ENDPOINT", "")
    if kpi_endpoint:
        try:
            snapshot.kpi = fetch_snapshot(kpi_endpoint, secret)
        except (ApiError, OSError, RuntimeError, ValueError) as error:
            print(f"[reach] KPI snapshot skipped: {error}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(snapshot.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
