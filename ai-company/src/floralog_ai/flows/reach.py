import json
from datetime import UTC, datetime

from crewai.flow.flow import Flow, listen, start
from pydantic import BaseModel, Field

from floralog_ai.crews import build_reach_crew
from floralog_ai.guardrails import ensure_budget
from floralog_ai.reach_guardrails import review_drafts, summarize_performance
from floralog_ai.schemas import (
    ContentPillar,
    ContentSnapshot,
    Platform,
    ReachPlan,
    ReachReport,
    SocialHistory,
    SocialPostDraft,
)

MAX_FUN_FACT_LENGTH = 120
RECENT_POSTS_PER_PLATFORM = 10


class ReachState(BaseModel):
    content: ContentSnapshot | None = None
    history: SocialHistory | None = None
    platforms: list[Platform] = Field(default_factory=list)
    current_monthly_agent_cost_eur: float = Field(default=0, ge=0)
    dry_run: bool = True
    report: ReachReport | None = None


class ReachFlow(Flow[ReachState]):
    @start()
    def validate_inputs(self) -> ContentSnapshot:
        if self.state.content is None:
            raise ValueError("A content snapshot is required.")
        if self.state.history is None:
            self.state.history = SocialHistory(collected_at=datetime.now(UTC))
        ensure_budget(self.state.current_monthly_agent_cost_eur)
        return self.state.content

    @listen(validate_inputs)
    def create_report(self, content: ContentSnapshot) -> ReachReport:
        now = datetime.now(UTC)
        history = self.state.history
        performance = summarize_performance(history, now)

        if self.state.dry_run:
            plan = build_dry_run_plan(content, self.state.platforms)
        elif not self.state.platforms:
            plan = ReachPlan(
                performance_summary="No social platform is configured; the agent was not called.",
                next_experiment="Configure Bluesky or Mastodon credentials.",
            )
        else:
            recent_posts = [
                {
                    "platform": post.platform.value,
                    "created_at": post.created_at.isoformat(),
                    "text": post.text[:300],
                    "likes": post.likes,
                    "reposts": post.reposts,
                    "replies": post.replies,
                    "quotes": post.quotes,
                    "saves": post.saves,
                    "link_clicks": post.link_clicks,
                    "reach": post.reach,
                }
                for account in history.accounts
                for post in account.posts[:RECENT_POSTS_PER_PLATFORM]
            ]
            result = build_reach_crew().kickoff(
                inputs={
                    "platforms": ", ".join(platform.value for platform in self.state.platforms),
                    "performance": json.dumps(
                        [item.model_dump(mode="json") for item in performance], ensure_ascii=False
                    ),
                    "recent_posts": json.dumps(recent_posts, ensure_ascii=False),
                    "content_snapshot": content.model_dump_json(),
                }
            )
            if result.pydantic is None:
                raise ValueError("Reach crew returned no structured ReachPlan.")
            plan = ReachPlan.model_validate(result.pydantic)

        self.state.report = ReachReport(
            generated_at=now,
            current_monthly_agent_cost_eur=self.state.current_monthly_agent_cost_eur,
            performance=performance,
            plan=plan,
            results=review_drafts(plan, content, history, self.state.platforms, now),
        )
        return self.state.report


def build_dry_run_plan(content: ContentSnapshot, platforms: list[Platform]) -> ReachPlan:
    candidates: list[tuple[ContentPillar, str, str]] = []
    if content.top_plants_7d:
        plant = content.top_plants_7d[0]
        text = (
            f"Diese Woche am häufigsten in Floralog entdeckt: {plant.species_name} "
            f"({plant.scan_count_7d} Scans)."
        )
        if plant.fun_fact and len(plant.fun_fact) <= MAX_FUN_FACT_LENGTH:
            text += f" {plant.fun_fact}"
        candidates.append(
            (
                ContentPillar.PLANT_SPOTLIGHT,
                f"{plant.species_name}: Star der Woche",
                text + " Findest du sie auch?",
            )
        )
    if content.weekly_quest and content.weekly_quest.title:
        candidates.append(
            (
                ContentPillar.QUEST_INVITE,
                f"Wochen-Quest: {content.weekly_quest.title}",
                (
                    f"Neue Wochen-Quest: {content.weekly_quest.title}. "
                    "Schnapp dir dein Handy, geh raus und sammle mit der Community!"
                ),
            )
        )
    community = content.community
    candidates.append(
        (
            ContentPillar.COMMUNITY_MILESTONE,
            "Gemeinsam unterwegs",
            (
                f"In den letzten 7 Tagen hat die Floralog-Community {community.distinct_species_7d} "
                "verschiedene Pflanzenarten entdeckt. Welche findest du vor deiner Haustür?"
            ),
        )
    )

    posts = []
    for index, platform in enumerate(platforms):
        pillar, headline, text = candidates[index % len(candidates)]
        posts.append(
            SocialPostDraft(
                platform=platform,
                pillar=pillar,
                headline=headline[:60],
                text=text,
                hashtags=["Pflanzen", "Natur", "Outdoor"],
                rationale="Deterministic dry-run template built from the supplied game data.",
            )
        )
    return ReachPlan(
        performance_summary=(
            "Dry-run without OpenAI or social network access; posts are deterministic templates."
        ),
        learnings=[],
        next_experiment="Run live to evaluate real engagement per content pillar.",
        posts=posts,
    )
