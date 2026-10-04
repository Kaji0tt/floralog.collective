from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import TypeAdapter

from floralog_ai.flows import ReachFlow
from floralog_ai.guardrails import GuardrailViolation
from floralog_ai.partner_main import filter_candidates, validate_plan
from floralog_ai.reach_guardrails import review_drafts, summarize_performance, text_violations
from floralog_ai.reach_main import publish_approved, render_summary
from floralog_ai.schemas import (
    ContentPillar,
    ContentSnapshot,
    PartnerCandidate,
    PartnerPlan,
    PartnerRecommendation,
    PartnerType,
    Platform,
    PublishedPost,
    PublishStatus,
    ReachPlan,
    ReachReport,
    SocialHistory,
    SocialPostDraft,
)
from floralog_ai.social.compose import INSTAGRAM_LINK_LINE, compose_post

FIXTURES = Path(__file__).parents[1] / "fixtures"
NOW = datetime(2026, 9, 28, 16, 0, tzinfo=UTC)


def load_content() -> ContentSnapshot:
    return ContentSnapshot.model_validate_json(
        (FIXTURES / "content_snapshot.json").read_text(encoding="utf-8")
    )


def load_history() -> SocialHistory:
    return SocialHistory.model_validate_json(
        (FIXTURES / "social_history.json").read_text(encoding="utf-8")
    )


def draft(text: str, platform: Platform = Platform.BLUESKY, **kwargs) -> SocialPostDraft:
    return SocialPostDraft(
        platform=platform,
        pillar=ContentPillar.PLANT_SPOTLIGHT,
        text=text,
        hashtags=kwargs.pop("hashtags", ["Pflanzen"]),
        rationale="Test draft for guardrails.",
        **kwargs,
    )


def test_bluesky_facets_use_utf8_byte_offsets() -> None:
    composed = compose_post(draft("Gänseblümchen überall – findest du sie?", hashtags=["Natur"]))
    encoded = composed.text.encode("utf-8")
    link, tag = composed.facets
    assert encoded[link.byte_start : link.byte_end].decode() == "floralog.de"
    assert "utm_source=bluesky" in link.value
    assert encoded[tag.byte_start : tag.byte_end].decode() == "#Natur"


def test_mastodon_shows_full_link() -> None:
    composed = compose_post(draft("Rotbuchen entdecken macht Spaß!", platform=Platform.MASTODON))
    assert composed.link_url in composed.text


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Schon 999 Rotbuchen wurden gescannt, unglaublich!", "numbers not backed"),
        ("Unterstütze uns mit einer Spende und entdecke mehr!", "monetization"),
        ("Schau vorbei auf floralog.de und entdecke Pflanzen!", "links"),
        ("Danke @someone für den tollen Scan der Woche!", "mentions"),
        ("Nur heute: doppelte Entdeckerfreude im Park!", "pressure"),
    ],
)
def test_text_guardrails_reject_unsafe_posts(text: str, expected: str) -> None:
    assert any(expected in violation for violation in text_violations(draft(text), load_content()))


def test_text_guardrails_accept_data_backed_post() -> None:
    text = "Diese Woche wurde die Rotbuche 18 Mal entdeckt. Rotbuchen können über 300 Jahre alt werden!"
    assert text_violations(draft(text), load_content()) == []


def test_review_skips_platform_within_cadence_window() -> None:
    history = load_history()
    history.accounts[0].posts.append(
        PublishedPost(
            platform=Platform.BLUESKY,
            post_id="recent",
            text="Ein ganz anderer Post über Pilze im Wald.",
            created_at=NOW - timedelta(hours=3),
        )
    )
    plan = ReachPlan(
        performance_summary="Test plan for cadence handling.",
        next_experiment="Test other formats.",
        posts=[draft("Diese Woche wurde die Rotbuche 18 Mal entdeckt!")],
    )
    [result] = review_drafts(plan, load_content(), history, [Platform.BLUESKY], NOW)
    assert result.status is PublishStatus.SKIPPED


def test_review_rejects_second_post_on_same_platform_and_duplicates() -> None:
    history = load_history()
    plan = ReachPlan(
        performance_summary="Test plan for duplicate handling.",
        next_experiment="Test other formats.",
        posts=[
            draft("Herbstzeit ist Pilz- und Beerenzeit! Was habt ihr heute entdeckt?", hashtags=[]),
            draft("Diese Woche wurde die Rotbuche 18 Mal entdeckt!"),
        ],
    )
    first, second = review_drafts(plan, load_content(), history, [Platform.BLUESKY], NOW)
    assert first.status is PublishStatus.REJECTED
    assert "similar" in first.reason
    assert second.status is PublishStatus.REJECTED


def test_performance_summary_uses_engagement() -> None:
    [bluesky, mastodon] = summarize_performance(load_history(), NOW)
    assert bluesky.average_engagement_14d == 9
    assert mastodon.posts_last_14d == 0


def test_dry_run_flow_is_offline_and_never_publishes(tmp_path: Path) -> None:
    content = load_content()
    result = ReachFlow().kickoff(
        inputs={
            "content": content,
            "history": load_history(),
            "platforms": list(Platform),
            "dry_run": True,
            "current_monthly_agent_cost_eur": 0,
        }
    )
    report = publish_approved(
        ReachReport.model_validate(result), content, {}, None, False, tmp_path / "media"
    )

    assert len(report.results) == len(report.plan.posts) == 4
    assert all(item.status is PublishStatus.DRY_RUN for item in report.results)
    by_platform = {item.platform: item for item in report.results}
    assert len(by_platform[Platform.INSTAGRAM].media_files) > 1
    assert len(by_platform[Platform.PINTEREST].media_files) == 1
    assert not by_platform[Platform.BLUESKY].media_files
    assert all(Path(path).read_bytes()[:3] == b"\xff\xd8\xff" for path in by_platform[Platform.INSTAGRAM].media_files)
    assert "Floralog Reach Agent" in render_summary(report)


def test_instagram_caption_has_no_link_but_bio_hint() -> None:
    composed = compose_post(
        draft("Rotbuchen entdecken macht Spaß!", platform=Platform.INSTAGRAM, headline="Rotbuche")
    )
    assert "http" not in composed.text
    assert INSTAGRAM_LINK_LINE in composed.text
    assert composed.title == "Rotbuche"


def test_image_platforms_require_headline_and_respect_hashtag_limits() -> None:
    violations = text_violations(
        draft("Rotbuchen entdecken macht Spaß!", platform=Platform.PINTEREST), load_content()
    )
    assert any("headline" in violation for violation in violations)
    too_many = draft("Rotbuchen entdecken macht Spaß!", hashtags=["A1", "B2", "C3", "D4"])
    assert any("at most 3 hashtags" in v for v in text_violations(too_many, load_content()))


def test_partner_filter_drops_irrelevant_and_keeps_seeds() -> None:
    raw = TypeAdapter(list[PartnerCandidate]).validate_json(
        (FIXTURES / "partner_candidates.json").read_text(encoding="utf-8")
    )
    handles = {candidate.handle for candidate in filter_candidates(raw, set())}
    assert "shop-beispiel.bsky.social" not in handles
    assert {"naturschutz-beispiel.bsky.social", "beispiel_naturpark"} <= handles


def test_partner_plan_drops_hallucinated_handles() -> None:
    candidate = PartnerCandidate(
        platform=Platform.BLUESKY,
        handle="real.bsky.social",
        profile_url="https://bsky.app/profile/real.bsky.social",
        source="test",
    )
    plan = PartnerPlan(
        summary="Test plan with one invented handle.",
        recommendations=[
            PartnerRecommendation(
                platform=Platform.BLUESKY,
                handle=handle,
                partner_type=PartnerType.CLUB,
                fit_score=8,
                why="Fits the nature community.",
                collaboration_idea="Shared plant quest.",
                first_message_draft="Hallo, wir sind ein kleines Indie-Spiel über Pflanzen.",
            )
            for handle in ("real.bsky.social", "invented.bsky.social")
        ],
    )
    assert [item.handle for item in validate_plan(plan, [candidate]).recommendations] == [
        "real.bsky.social"
    ]


def test_flow_respects_budget() -> None:
    with pytest.raises(GuardrailViolation):
        ReachFlow().kickoff(
            inputs={
                "content": load_content(),
                "platforms": list(Platform),
                "dry_run": True,
                "current_monthly_agent_cost_eur": 25,
            }
        )
