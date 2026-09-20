import argparse
import json
from pathlib import Path

from floralog_ai.flows import RevenueGrowthFlow
from floralog_ai.schemas import KpiSnapshot


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Floralog revenue growth flow.")
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("output/revenue-review.json"))
    parser.add_argument("--live", action="store_true", help="Use the configured OpenAI model.")
    parser.add_argument("--monthly-cost", type=float, default=0)
    args = parser.parse_args()

    snapshot = KpiSnapshot.model_validate_json(args.snapshot.read_text(encoding="utf-8"))
    flow = RevenueGrowthFlow()
    review = flow.kickoff(
        inputs={
            "snapshot": snapshot,
            "dry_run": not args.live,
            "current_monthly_agent_cost_eur": args.monthly_cost,
        }
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(review.model_dump(mode="json"), indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    print(args.output)


if __name__ == "__main__":
    main()
