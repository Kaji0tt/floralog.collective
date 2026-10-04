import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path

from pydantic import Field, TypeAdapter

from floralog_ai.crews import build_partner_crew
from floralog_ai.guardrails import ensure_budget
from floralog_ai.http_client import ApiError
from floralog_ai.schemas import (
    PartnerCandidate,
    PartnerPlan,
    PartnerRecommendation,
    PartnerReport,
    PartnerType,
)
from floralog_ai.schemas.revenue import StrictModel
from floralog_ai.social import BlueskyClient, InstagramClient, MastodonClient

DEFAULT_SEEDS = Path(__file__).resolve().parents[2] / "config" / "partner_seeds.json"
MIN_FOLLOWERS = 30
MAX_CANDIDATES = 40
MAX_INSTAGRAM_LOOKUPS = 30
RELEVANCE_KEYWORDS = (
    "natur",
    "nabu",
    "bund",
    "pflanz",
    "garten",
    "botan",
    "wald",
    "umwelt",
    "wildblum",
    "insekt",
    "biodivers",
    "streuobst",
    "kräuter",
    "wander",
    "ökolog",
    "outdoor",
)
INSTAGRAM_SEED_SOURCE = "instagram seed"


class PartnerSeeds(StrictModel):
    search_terms: list[str] = Field(default_factory=list, max_length=20)
    instagram_usernames: list[str] = Field(default_factory=list, max_length=50)
    instagram_hashtags: list[str] = Field(default_factory=list, max_length=10)


def relevance(candidate: PartnerCandidate) -> int:
    haystack = f"{candidate.display_name or ''} {candidate.handle} {candidate.bio or ''}".lower()
    return sum(keyword in haystack for keyword in RELEVANCE_KEYWORDS)


def filter_candidates(
    candidates: list[PartnerCandidate], exclude_handles: set[str]
) -> list[PartnerCandidate]:
    unique: dict[tuple[str, str], PartnerCandidate] = {}
    for candidate in candidates:
        handle = candidate.handle.lower()
        if handle in exclude_handles or "floralog" in handle:
            continue
        if candidate.followers is not None and candidate.followers < MIN_FOLLOWERS:
            continue
        if candidate.source != INSTAGRAM_SEED_SOURCE and (not candidate.bio or relevance(candidate) == 0):
            continue
        unique.setdefault((candidate.platform.value, handle), candidate)
    ranked = sorted(
        unique.values(), key=lambda item: (relevance(item), item.followers or 0), reverse=True
    )
    return ranked[:MAX_CANDIDATES]


def collect_candidates(seeds: PartnerSeeds) -> list[PartnerCandidate]:
    found: list[PartnerCandidate] = []
    searchers = [client for client in (BlueskyClient.from_env(), MastodonClient.from_env()) if client]
    for term in seeds.search_terms:
        for client in searchers:
            try:
                found.extend(client.search_accounts(term))
            except ApiError as error:
                print(f"[partners] {client.platform.value} search '{term}' failed: {error}")

    instagram = InstagramClient.from_env()
    if instagram:
        usernames = {name: INSTAGRAM_SEED_SOURCE for name in seeds.instagram_usernames}
        if os.getenv("INSTAGRAM_HASHTAG_SEARCH", "").strip().lower() == "true":
            for hashtag in seeds.instagram_hashtags:
                try:
                    for name in instagram.hashtag_mentions(hashtag):
                        usernames.setdefault(name, f"instagram #{hashtag}")
                except ApiError as error:
                    print(f"[partners] instagram hashtag '{hashtag}' failed: {error}")
        for name, source in list(usernames.items())[:MAX_INSTAGRAM_LOOKUPS]:
            candidate = instagram.lookup_business(name, source)
            if candidate:
                found.append(candidate)
    return found


def validate_plan(plan: PartnerPlan, candidates: list[PartnerCandidate]) -> PartnerPlan:
    """Drop recommendations for handles that were not actually found."""
    known = {(candidate.platform, candidate.handle.lower()) for candidate in candidates}
    recommendations = [
        item for item in plan.recommendations if (item.platform, item.handle.lower()) in known
    ]
    return plan.model_copy(update={"recommendations": recommendations})


def build_dry_run_plan(candidates: list[PartnerCandidate]) -> PartnerPlan:
    recommendations = [
        PartnerRecommendation(
            platform=candidate.platform,
            handle=candidate.handle,
            partner_type=PartnerType.ASSOCIATION,
            fit_score=min(10, 5 + relevance(candidate)),
            why="Dry-run: keyword match on nature-related profile description.",
            collaboration_idea="Gemeinsame Pflanzen-Quest zu einem lokalen Aktionstag.",
            first_message_draft=(
                "Hallo! Wir sind Floralog, ein kleines Indie-Spiel, in dem man echte Pflanzen "
                "entdeckt und sammelt. Hättet ihr Lust auf eine gemeinsame Quest?"
            ),
        )
        for candidate in candidates[:5]
    ]
    return PartnerPlan(
        summary="Dry-run without OpenAI or social network access; ranking is keyword-based.",
        recommendations=recommendations,
    )


def render_partner_summary(report: PartnerReport) -> str:
    lines = [
        "# Floralog Partner Scouting",
        "",
        f"**Stand:** {report.generated_at:%Y-%m-%d}  ",
        f"**Gefundene Kandidaten:** {report.candidates_found}",
        "",
        "> Niemand wurde kontaktiert. Nachrichten bitte prüfen, anpassen und selbst senden.",
        "",
        report.plan.summary,
        "",
        "| Score | Plattform | Profil | Typ | Follower |",
        "| ---: | --- | --- | --- | ---: |",
    ]
    by_key = {(item.platform, item.handle.lower()): item for item in report.candidates}
    for item in report.plan.recommendations:
        candidate = by_key.get((item.platform, item.handle.lower()))
        profile = f"[{item.handle}]({candidate.profile_url})" if candidate else item.handle
        followers = candidate.followers if candidate and candidate.followers is not None else "-"
        lines.append(
            f"| {item.fit_score} | {item.platform.value} | {profile} | "
            f"{item.partner_type.value} | {followers} |"
        )
    lines.append("")
    for item in report.plan.recommendations:
        lines.extend(
            [
                f"### {item.handle} ({item.platform.value})",
                "",
                f"**Warum:** {item.why}",
                "",
                f"**Idee:** {item.collaboration_idea}",
                "",
                "**Entwurf Erstnachricht:**",
                "",
                *[f"> {line}" for line in item.first_message_draft.splitlines()],
                "",
            ]
        )
    if report.plan.search_terms_next_week:
        lines.extend(
            [
                "## Suchbegriffe für nächste Woche",
                "",
                ", ".join(f"`{term}`" for term in report.plan.search_terms_next_week),
                "",
            ]
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Scout partner profiles for Floralog.")
    parser.add_argument("--seeds", type=Path, default=DEFAULT_SEEDS)
    parser.add_argument("--candidates", type=Path, help="Candidate fixture (skips live search).")
    parser.add_argument("--output", type=Path, default=Path("output/partner-report.json"))
    parser.add_argument("--summary", type=Path, default=Path("output/partner-report.md"))
    parser.add_argument("--live", action="store_true", help="Use OpenAI and real platform search.")
    parser.add_argument("--monthly-cost", type=float, default=0)
    args = parser.parse_args()

    ensure_budget(args.monthly_cost)
    seeds = PartnerSeeds.model_validate_json(args.seeds.read_text(encoding="utf-8"))
    if args.candidates:
        raw = TypeAdapter(list[PartnerCandidate]).validate_json(args.candidates.read_text("utf-8"))
    else:
        raw = collect_candidates(seeds) if args.live else []

    exclude = {os.getenv("BLUESKY_HANDLE", "").strip().lower()} - {""}
    candidates = filter_candidates(raw, exclude)

    if not args.live or not candidates:
        plan = build_dry_run_plan(candidates)
    else:
        result = build_partner_crew().kickoff(
            inputs={
                "candidates": json.dumps(
                    [candidate.model_dump(mode="json") for candidate in candidates],
                    ensure_ascii=False,
                )
            }
        )
        if result.pydantic is None:
            raise ValueError("Partner crew returned no structured PartnerPlan.")
        plan = validate_plan(PartnerPlan.model_validate(result.pydantic), candidates)

    report = PartnerReport(
        generated_at=datetime.now(UTC),
        candidates_found=len(candidates),
        plan=plan,
        candidates=candidates,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(render_partner_summary(report), encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
