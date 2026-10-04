from datetime import datetime
from enum import StrEnum

from pydantic import Field

from floralog_ai.schemas.revenue import KpiSnapshot, StrictModel


class Platform(StrEnum):
    BLUESKY = "bluesky"
    MASTODON = "mastodon"
    INSTAGRAM = "instagram"
    PINTEREST = "pinterest"


IMAGE_PLATFORMS = frozenset({Platform.INSTAGRAM, Platform.PINTEREST})


class ContentPillar(StrEnum):
    PLANT_SPOTLIGHT = "plant_spotlight"
    SCAN_OF_THE_WEEK = "scan_of_the_week"
    QUEST_INVITE = "quest_invite"
    COMMUNITY_MILESTONE = "community_milestone"
    FUN_FACT = "fun_fact"


class PublishStatus(StrEnum):
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"
    DRY_RUN = "dry_run"
    PUBLISHED = "published"
    FAILED = "failed"


class PlantHighlight(StrictModel):
    species_name: str = Field(min_length=1)
    scientific_name: str | None = None
    genus_name: str | None = None
    category: str | None = None
    rarity: str | None = None
    fun_fact: str | None = None
    scan_count_7d: int = Field(ge=0)


class ScanOfTheWeekHighlight(StrictModel):
    week_key: str = Field(min_length=1)
    species_name: str = Field(min_length=1)
    genus_name: str | None = None
    category: str | None = None
    like_count: int | None = Field(default=None, ge=0)
    source: str = Field(pattern="^(scheduler|admin)$")


class QuestHighlight(StrictModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    target_genus_name: str | None = None
    target_species_name: str | None = None
    required_discoveries: int | None = Field(default=None, ge=0)


class CommunityTotals(StrictModel):
    scans_7d: int = Field(ge=0)
    active_explorers_7d: int = Field(ge=0)
    distinct_species_7d: int = Field(ge=0)
    species_in_game: int = Field(ge=0)


class ContentSnapshot(StrictModel):
    generated_at: datetime
    week_key: str = Field(min_length=1)
    community: CommunityTotals
    top_plants_7d: list[PlantHighlight] = Field(default_factory=list, max_length=10)
    scan_of_the_week: ScanOfTheWeekHighlight | None = None
    weekly_quest: QuestHighlight | None = None
    monthly_quest: QuestHighlight | None = None
    kpi: KpiSnapshot | None = None


class PublishedPost(StrictModel):
    platform: Platform
    post_id: str = Field(min_length=1)
    url: str | None = None
    text: str
    created_at: datetime
    likes: int = Field(default=0, ge=0)
    reposts: int = Field(default=0, ge=0)
    replies: int = Field(default=0, ge=0)
    quotes: int = Field(default=0, ge=0)
    saves: int = Field(default=0, ge=0)
    link_clicks: int = Field(default=0, ge=0)
    reach: int | None = Field(default=None, ge=0)

    def engagement(self) -> int:
        return (
            self.likes + self.reposts + self.replies + self.quotes + self.saves + self.link_clicks
        )


class AccountSnapshot(StrictModel):
    platform: Platform
    followers: int = Field(ge=0)
    posts: list[PublishedPost] = Field(default_factory=list)


class SocialHistory(StrictModel):
    collected_at: datetime
    accounts: list[AccountSnapshot] = Field(default_factory=list)


class PlatformPerformance(StrictModel):
    platform: Platform
    followers: int = Field(ge=0)
    posts_last_14d: int = Field(ge=0)
    average_engagement_14d: float = Field(ge=0)
    average_reach_14d: float | None = Field(default=None, ge=0)
    best_post_text: str | None = None
    best_post_engagement: int = Field(default=0, ge=0)
    last_post_at: datetime | None = None


class SocialPostDraft(StrictModel):
    platform: Platform
    pillar: ContentPillar
    headline: str | None = Field(default=None, max_length=60)
    text: str = Field(min_length=20, max_length=1200)
    hashtags: list[str] = Field(default_factory=list, max_length=5)
    rationale: str = Field(min_length=10)


class ReachPlan(StrictModel):
    performance_summary: str = Field(min_length=20)
    learnings: list[str] = Field(default_factory=list, max_length=5)
    next_experiment: str = Field(min_length=10)
    posts: list[SocialPostDraft] = Field(default_factory=list, max_length=4)


class PublishResult(StrictModel):
    platform: Platform
    pillar: ContentPillar
    status: PublishStatus
    text: str
    url: str | None = None
    reason: str | None = None
    media_files: list[str] = Field(default_factory=list)


class ReachReport(StrictModel):
    generated_at: datetime
    current_monthly_agent_cost_eur: float = Field(ge=0)
    posting_enabled: bool = False
    performance: list[PlatformPerformance] = Field(default_factory=list)
    plan: ReachPlan
    results: list[PublishResult] = Field(default_factory=list)


class PartnerType(StrEnum):
    ASSOCIATION = "association"
    CLUB = "club"
    EDUCATION = "education"
    CREATOR = "creator"
    OTHER = "other"


class PartnerCandidate(StrictModel):
    platform: Platform
    handle: str = Field(min_length=1)
    display_name: str | None = None
    profile_url: str
    bio: str | None = Field(default=None, max_length=500)
    website: str | None = None
    followers: int | None = Field(default=None, ge=0)
    source: str = Field(min_length=1)


class PartnerRecommendation(StrictModel):
    platform: Platform
    handle: str = Field(min_length=1)
    partner_type: PartnerType
    fit_score: int = Field(ge=1, le=10)
    why: str = Field(min_length=10)
    collaboration_idea: str = Field(min_length=10)
    first_message_draft: str = Field(min_length=20, max_length=1200)


class PartnerPlan(StrictModel):
    summary: str = Field(min_length=20)
    recommendations: list[PartnerRecommendation] = Field(default_factory=list, max_length=10)
    search_terms_next_week: list[str] = Field(default_factory=list, max_length=8)


class PartnerReport(StrictModel):
    generated_at: datetime
    candidates_found: int = Field(ge=0)
    plan: PartnerPlan
    candidates: list[PartnerCandidate] = Field(default_factory=list)
    requires_human_contact: bool = True
