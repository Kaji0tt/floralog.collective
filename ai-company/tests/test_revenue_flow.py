from pathlib import Path

from floralog_ai.flows import RevenueGrowthFlow
from floralog_ai.schemas import KpiSnapshot, RevenueReview

FIXTURE = Path(__file__).parents[1] / "fixtures" / "kpi_snapshot.json"


def test_dry_run_returns_guardrailed_review_without_network() -> None:
    snapshot = KpiSnapshot.model_validate_json(FIXTURE.read_text(encoding="utf-8"))
    result = RevenueGrowthFlow().kickoff(
        inputs={
            "snapshot": snapshot,
            "dry_run": True,
            "current_monthly_agent_cost_eur": 0,
        }
    )

    review = RevenueReview.model_validate(result)
    assert review.requires_human_approval is True
    assert 0 < len(review.experiments) <= 3
    assert all(not experiment.pay_to_win for experiment in review.experiments)
    assert all(experiment.spirit_score >= 7 for experiment in review.experiments)
