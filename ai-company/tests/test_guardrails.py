from datetime import UTC, datetime

import pytest

from floralog_ai.guardrails import (
    GuardrailViolation,
    ensure_budget,
    validate_experiment,
    validate_review,
)
from floralog_ai.schemas import Decision, Evidence, ExperimentProposal, KpiSnapshot, RevenueReview


def build_proposal(**overrides: object) -> ExperimentProposal:
    values = {
        "title": "Freiwillige Community-Unterstützung testen",
        "target_group": "Erwachsene Community-Mitglieder",
        "problem": "Laufende Kosten sind noch nicht vollständig gedeckt.",
        "hypothesis": "Freiwillige Unterstützung kann die Betriebskosten mittragen.",
        "experiment": "Teste eine klar gekennzeichnete freiwillige Unterstützung.",
        "expected_revenue_impact_eur": 20,
        "community_benefit": "Der kostenlose Kern bleibt für alle verfügbar.",
        "spirit_score": 9,
        "effort": "small",
        "risk": "low",
        "success_metrics": ["Revenue increases"],
        "stop_metrics": ["Negative community feedback"],
        "evidence": [
            Evidence(
                claim="Current revenue is below the monthly target.",
                source_type="product_data",
                confidence=1,
            )
        ],
        "decision": Decision.RECOMMEND,
    }
    values.update(overrides)
    return ExperimentProposal.model_validate(values)


def test_rejects_pay_to_win() -> None:
    with pytest.raises(GuardrailViolation, match="pay-to-win"):
        validate_experiment(build_proposal(pay_to_win=True))


def test_rejects_unsourced_market_claim() -> None:
    evidence = [
        Evidence(
            claim="A market report claims strong demand for this product.",
            source_type="market_source",
            confidence=0.6,
        )
    ]
    with pytest.raises(GuardrailViolation, match="source URL"):
        validate_experiment(build_proposal(evidence=evidence))


def test_rejects_non_http_market_source() -> None:
    evidence = [
        Evidence(
            claim="A market report claims strong demand for this product.",
            source_type="market_source",
            source_url="not-a-url",
            confidence=0.6,
        )
    ]
    with pytest.raises(GuardrailViolation, match="source URL"):
        validate_experiment(build_proposal(evidence=evidence))


def test_stops_at_monthly_budget() -> None:
    ensure_budget(24.99)
    with pytest.raises(GuardrailViolation, match="budget exhausted"):
        ensure_budget(25)


def test_review_drops_unsafe_experiment_instead_of_failing() -> None:
    unsafe = build_proposal(spirit_score=4)
    safe = build_proposal(title="Freiwillige faire Kosmetik testen")
    review = RevenueReview(
        generated_at=datetime.now(UTC),
        baseline=KpiSnapshot.model_validate_json(
            '{"generated_at":"2026-09-20T00:00:00Z","revenue_mtd_eur":1,"revenue_30d_eur":1,'
            '"donation_revenue_30d_eur":1,"amber_revenue_30d_eur":0,"average_donation_eur":1,'
            '"transaction_count_30d":1,"donation_page_views_30d":1,"donation_orders_30d":1,'
            '"donation_captures_30d":1,"dau":1,"wau":1,"mau":1,"stickiness_percent":100,'
            '"action_events_30d":1,"navigation_events_30d":1,"navigation_event_counts":[],'
            '"referrals_completed_30d":0,"community_actions_30d":1}'
        ),
        current_monthly_agent_cost_eur=0,
        summary="A sufficiently detailed review summary for guardrail testing.",
        experiments=[unsafe, safe],
    )
    validated = validate_review(review)
    assert [item.title for item in validated.experiments] == [safe.title]


def test_datetime_fixture_is_timezone_aware() -> None:
    assert datetime.now(UTC).tzinfo is not None
