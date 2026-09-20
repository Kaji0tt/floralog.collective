from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Decision(StrEnum):
    RECOMMEND = "recommend"
    HOLD = "hold"
    REJECT = "reject"


class Evidence(StrictModel):
    claim: str = Field(min_length=10)
    source_url: HttpUrl | None = None
    source_type: str = Field(pattern="^(product_data|market_source|assumption)$")
    confidence: float = Field(ge=0, le=1)


class KpiSnapshot(StrictModel):
    generated_at: datetime
    revenue_mtd_eur: float = Field(ge=0)
    revenue_30d_eur: float = Field(ge=0)
    donation_revenue_30d_eur: float = Field(ge=0)
    amber_revenue_30d_eur: float = Field(ge=0)
    average_donation_eur: float = Field(ge=0)
    transaction_count_30d: int = Field(ge=0)
    donation_page_views_30d: int = Field(ge=0)
    donation_orders_30d: int = Field(ge=0)
    donation_captures_30d: int = Field(ge=0)
    dau: int = Field(ge=0)
    wau: int = Field(ge=0)
    mau: int = Field(ge=0)
    referrals_completed_30d: int = Field(ge=0)
    community_actions_30d: int = Field(ge=0)
    suppressed_small_cohorts: bool = True


class ExperimentProposal(StrictModel):
    title: str = Field(min_length=8, max_length=120)
    target_group: str = Field(min_length=5)
    problem: str = Field(min_length=10)
    hypothesis: str = Field(min_length=15)
    experiment: str = Field(min_length=15)
    expected_revenue_impact_eur: float = Field(ge=0)
    community_benefit: str = Field(min_length=10)
    spirit_score: int = Field(ge=1, le=10)
    effort: str = Field(pattern="^(small|medium|large)$")
    risk: str = Field(pattern="^(low|medium|high)$")
    success_metrics: list[str] = Field(min_length=1)
    stop_metrics: list[str] = Field(min_length=1)
    evidence: list[Evidence] = Field(min_length=1)
    code_surfaces: list[str] = Field(default_factory=list)
    pay_to_win: bool = False
    restricts_core_access: bool = False
    targets_minors_with_purchase_pressure: bool = False
    decision: Decision


class RevenueReview(StrictModel):
    generated_at: datetime
    target_monthly_revenue_eur: float = Field(default=100, ge=0)
    monthly_agent_budget_eur: float = Field(default=25, ge=0)
    current_monthly_agent_cost_eur: float = Field(ge=0)
    baseline: KpiSnapshot
    summary: str = Field(min_length=20)
    experiments: list[ExperimentProposal] = Field(max_length=3)
    requires_human_approval: bool = True
