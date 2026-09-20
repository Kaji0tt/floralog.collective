import argparse
from pathlib import Path

from floralog_ai.schemas import RevenueReview


def render_issue(review: RevenueReview) -> str:
    baseline = review.baseline
    lines = [
        "# Floralog AI Revenue Review",
        "",
        f"**Stand:** {review.generated_at:%Y-%m-%d}",
        f"**Ziel:** {review.target_monthly_revenue_eur:.0f} EUR Bruttoumsatz/Monat",
        (
            f"**Agentenbudget:** {review.current_monthly_agent_cost_eur:.2f} / "
            f"{review.monthly_agent_budget_eur:.2f} EUR"
        ),
        "",
        "## KPI-Baseline",
        "",
        f"- Umsatz MTD: {baseline.revenue_mtd_eur:.2f} EUR",
        f"- Umsatz letzte 30 Tage: {baseline.revenue_30d_eur:.2f} EUR",
        (
            f"- Davon Spenden / Bernstein: {baseline.donation_revenue_30d_eur:.2f} / "
            f"{baseline.amber_revenue_30d_eur:.2f} EUR"
        ),
        f"- Durchschnittsspende: {baseline.average_donation_eur:.2f} EUR",
        f"- Zahlungen letzte 30 Tage: {baseline.transaction_count_30d}",
        (
            f"- Spendenfunnel: {baseline.donation_page_views_30d} Aufrufe -> "
            f"{baseline.donation_orders_30d} Orders -> "
            f"{baseline.donation_captures_30d} Captures"
        ),
        f"- DAU / WAU / MAU: {baseline.dau} / {baseline.wau} / {baseline.mau}",
        "",
        "## Zusammenfassung",
        "",
        review.summary,
        "",
        "## Experimente",
        "",
    ]

    for index, experiment in enumerate(review.experiments, start=1):
        lines.extend(
            [
                f"### {index}. {experiment.title}",
                "",
                f"**Entscheidung:** `{experiment.decision.value}`  ",
                f"**Spirit-Score:** {experiment.spirit_score}/10  ",
                f"**Aufwand / Risiko:** `{experiment.effort}` / `{experiment.risk}`  ",
                f"**Erwarteter Umsatzbeitrag:** {experiment.expected_revenue_impact_eur:.2f} EUR",
                "",
                f"**Hypothese:** {experiment.hypothesis}",
                "",
                f"**Experiment:** {experiment.experiment}",
                "",
                f"**Community-Nutzen:** {experiment.community_benefit}",
                "",
                "**Erfolg:**",
                *[f"- {metric}" for metric in experiment.success_metrics],
                "",
                "**Abbruch:**",
                *[f"- {metric}" for metric in experiment.stop_metrics],
                "",
                "**Evidenz:**",
                *[
                    f"- {evidence.claim} "
                    f"({evidence.source_url or evidence.source_type}, "
                    f"Konfidenz {evidence.confidence:.0%})"
                    for evidence in experiment.evidence
                ],
                "",
            ]
        )

    lines.extend(
        [
            "## Freigabe",
            "",
            (
                "Keine Umsetzung ohne menschliche Freigabe. Für ein Experiment bitte das Label "
                "`ai-approved` setzen und Akzeptanzkriterien kommentieren."
            ),
            "",
            "_Automatisch erstellt; kein Merge, Deploy oder SQL wurde ausgeführt._",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a RevenueReview as a GitHub issue.")
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    review = RevenueReview.model_validate_json(args.review.read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_issue(review), encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
