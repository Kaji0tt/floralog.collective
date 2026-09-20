from datetime import UTC, datetime

from crewai.flow.flow import Flow, listen, start
from pydantic import BaseModel, Field

from floralog_ai.crews import build_revenue_crew
from floralog_ai.guardrails import ensure_budget, validate_review
from floralog_ai.schemas import Decision, Evidence, ExperimentProposal, KpiSnapshot, RevenueReview


class RevenueGrowthState(BaseModel):
    snapshot: KpiSnapshot | None = None
    current_monthly_agent_cost_eur: float = Field(default=0, ge=0)
    dry_run: bool = True
    review: RevenueReview | None = None


class RevenueGrowthFlow(Flow[RevenueGrowthState]):
    @start()
    def validate_inputs(self) -> KpiSnapshot:
        if self.state.snapshot is None:
            raise ValueError("A KPI snapshot is required.")
        ensure_budget(self.state.current_monthly_agent_cost_eur)
        return self.state.snapshot

    @listen(validate_inputs)
    def create_review(self, snapshot: KpiSnapshot) -> RevenueReview:
        if self.state.dry_run:
            review = self._build_dry_run_review(snapshot)
        else:
            result = build_revenue_crew().kickoff(
                inputs={
                    "snapshot": snapshot.model_dump_json(),
                    "current_monthly_agent_cost_eur": self.state.current_monthly_agent_cost_eur,
                }
            )
            if result.pydantic is None:
                raise ValueError("Revenue crew returned no structured RevenueReview.")
            review = RevenueReview.model_validate(result.pydantic)

        self.state.review = validate_review(review)
        return self.state.review

    def _build_dry_run_review(self, snapshot: KpiSnapshot) -> RevenueReview:
        page_to_capture = (
            snapshot.donation_captures_30d / snapshot.donation_page_views_30d
            if snapshot.donation_page_views_30d
            else 0
        )
        proposal = ExperimentProposal(
            title="Spendenfunnel transparent messen und Reibung prüfen",
            target_group="Bestehende erwachsene Unterstützende und engagierte Community-Mitglieder",
            problem=(
                "Der bestehende Support-Funnel ist noch nicht vollständig als Conversion-Kette messbar."
            ),
            hypothesis=(
                "Klare Messpunkte und eine verständliche Anmeldeanforderung erhöhen abgeschlossene "
                "freiwillige Unterstützungen, ohne Spielinhalte zu beschränken."
            ),
            experiment=(
                "Instrumentiere Seitenaufruf, Betragswahl, Order und Capture und teste anschließend "
                "eine transparentere Erklärung der Anmeldung gegen den aktuellen Ablauf."
            ),
            expected_revenue_impact_eur=20,
            community_benefit="Die Finanzierung bleibt freiwillig und der kostenlose Kern unverändert.",
            spirit_score=9,
            effort="small",
            risk="low",
            success_metrics=[
                "Donation page-to-capture conversion improves without lower 30-day engagement",
                "Gross donation revenue increases versus the prior 30-day baseline",
            ],
            stop_metrics=[
                "Donation funnel error rate increases",
                "Community feedback indicates unclear or coercive messaging",
            ],
            evidence=[
                Evidence(
                    claim=(
                        f"The supplied 30-day baseline has {snapshot.donation_page_views_30d} page "
                        f"views and {snapshot.donation_captures_30d} captures "
                        f"({page_to_capture:.1%} conversion)."
                    ),
                    source_type="product_data",
                    confidence=1,
                )
            ],
            code_surfaces=[
                "src/pages/Donate.jsx",
                "src/api/analyticsService.js",
                "supabase/functions/capturePayPalPayment/index.ts",
            ],
            decision=Decision.RECOMMEND,
        )
        return RevenueReview(
            generated_at=datetime.now(UTC),
            current_monthly_agent_cost_eur=self.state.current_monthly_agent_cost_eur,
            baseline=snapshot,
            summary=(
                "Dry-run completed without network or production access. The first recommendation "
                "prioritizes measurement and voluntary support before adding monetization surfaces."
            ),
            experiments=[proposal],
        )
