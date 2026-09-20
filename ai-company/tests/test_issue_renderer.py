from pathlib import Path

from floralog_ai.flows import RevenueGrowthFlow
from floralog_ai.issue_renderer import render_issue
from floralog_ai.schemas import KpiSnapshot, RevenueReview

FIXTURE = Path(__file__).parents[1] / "fixtures" / "kpi_snapshot.json"


def test_issue_requires_human_approval() -> None:
    snapshot = KpiSnapshot.model_validate_json(FIXTURE.read_text(encoding="utf-8"))
    result = RevenueGrowthFlow().kickoff(inputs={"snapshot": snapshot, "dry_run": True})
    markdown = render_issue(RevenueReview.model_validate(result))

    assert "ai-approved" in markdown
    assert "kein Merge, Deploy oder SQL" in markdown
    assert "100 EUR Bruttoumsatz/Monat" in markdown
