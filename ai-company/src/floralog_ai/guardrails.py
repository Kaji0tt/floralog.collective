from collections.abc import Iterable
from urllib.parse import urlparse

from floralog_ai.schemas import ExperimentProposal, RevenueReview

MAX_EXPERIMENTS = 3
MIN_SPIRIT_SCORE = 7
MONTHLY_AGENT_BUDGET_EUR = 25.0


class GuardrailViolation(ValueError):
    """Raised when an AI proposal violates a deterministic Floralog rule."""


def is_http_url(value: str | None) -> bool:
    if not value:
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def ensure_budget(current_monthly_cost_eur: float) -> None:
    if current_monthly_cost_eur >= MONTHLY_AGENT_BUDGET_EUR:
        raise GuardrailViolation(
            f"Monthly AI budget exhausted: {current_monthly_cost_eur:.2f} EUR "
            f">= {MONTHLY_AGENT_BUDGET_EUR:.2f} EUR."
        )


def validate_experiment(proposal: ExperimentProposal) -> ExperimentProposal:
    violations: list[str] = []
    if proposal.pay_to_win:
        violations.append("pay-to-win is forbidden")
    if proposal.restricts_core_access:
        violations.append("learning, scanning, discovery, and community must remain accessible")
    if proposal.targets_minors_with_purchase_pressure:
        violations.append("purchase pressure aimed at minors is forbidden")
    if proposal.spirit_score < MIN_SPIRIT_SCORE:
        violations.append(f"spirit score must be at least {MIN_SPIRIT_SCORE}")
    if not proposal.success_metrics or not proposal.stop_metrics:
        violations.append("success and stop metrics are required")
    if any(
        item.source_type == "market_source" and not is_http_url(item.source_url)
        for item in proposal.evidence
    ):
        violations.append("market evidence requires a source URL")

    if violations:
        raise GuardrailViolation(f"{proposal.title}: " + "; ".join(violations))
    return proposal


def validate_review(review: RevenueReview) -> RevenueReview:
    if len(review.experiments) > MAX_EXPERIMENTS:
        raise GuardrailViolation(f"A review may contain at most {MAX_EXPERIMENTS} experiments.")
    if review.current_monthly_agent_cost_eur > review.monthly_agent_budget_eur:
        raise GuardrailViolation("The review exceeds its declared monthly agent budget.")
    if not review.requires_human_approval:
        raise GuardrailViolation("Every Floralog product experiment requires human approval.")
    review.experiments = reject_unsafe_experiments(review.experiments)
    return review


def reject_unsafe_experiments(
    proposals: Iterable[ExperimentProposal],
) -> list[ExperimentProposal]:
    safe: list[ExperimentProposal] = []
    for proposal in proposals:
        try:
            safe.append(validate_experiment(proposal))
        except GuardrailViolation:
            continue
    return safe[:MAX_EXPERIMENTS]
