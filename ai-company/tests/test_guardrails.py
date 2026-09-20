from datetime import UTC, datetime

import pytest

from floralog_ai.guardrails import GuardrailViolation, ensure_budget, validate_experiment
from floralog_ai.schemas import Decision, Evidence, ExperimentProposal


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


def test_stops_at_monthly_budget() -> None:
    ensure_budget(24.99)
    with pytest.raises(GuardrailViolation, match="budget exhausted"):
        ensure_budget(25)


def test_datetime_fixture_is_timezone_aware() -> None:
    assert datetime.now(UTC).tzinfo is not None
