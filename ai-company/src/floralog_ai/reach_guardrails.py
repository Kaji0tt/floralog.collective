import re
from collections.abc import Iterable
from datetime import datetime, timedelta
from difflib import SequenceMatcher

from floralog_ai.schemas import (
    IMAGE_PLATFORMS,
    ContentSnapshot,
    Platform,
    PlatformPerformance,
    PublishedPost,
    PublishResult,
    PublishStatus,
    ReachPlan,
    SocialHistory,
    SocialPostDraft,
)
from floralog_ai.social.compose import PLATFORM_CHAR_LIMITS, PLATFORM_MAX_HASHTAGS, compose_post

MIN_HOURS_BETWEEN_POSTS = 20
MAX_POSTS_PER_7_DAYS = 4
DUPLICATE_SIMILARITY = 0.8
ALWAYS_ALLOWED_NUMBERS = frozenset({"1", "2", "3", "7"})
BLOCKED_TERMS = (
    "spend",
    "donat",
    "paypal",
    "kauf",
    "buy",
    "bernstein",
    "nur heute",
    "letzte chance",
    "last chance",
    "limitiert",
    "pay to win",
    "pay-to-win",
)

_HASHTAG = re.compile(r"^[A-Za-z0-9_ÄÖÜäöüß]{2,40}$")
_URL = re.compile(r"https?://|www\.|\b[\w-]+\.(?:de|com|app|org|net|io)\b", re.IGNORECASE)
_MENTION = re.compile(r"@\w")
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")


def _normalize_number(value: str) -> set[str]:
    dotted = value.replace(",", ".")
    if "." in dotted:
        dotted = dotted.rstrip("0").rstrip(".")
    return {dotted, dotted.replace(".", "")}


def _values(node: object) -> Iterable[str]:
    if isinstance(node, dict):
        for value in node.values():
            yield from _values(value)
    elif isinstance(node, list):
        for value in node:
            yield from _values(value)
    elif node is not None and not isinstance(node, bool):
        yield str(node)


def allowed_numbers(snapshot: ContentSnapshot) -> set[str]:
    numbers: set[str] = set(ALWAYS_ALLOWED_NUMBERS)
    for value in _values(snapshot.model_dump(mode="json")):
        for match in _NUMBER.findall(value):
            numbers |= _normalize_number(match)
    return numbers


def text_violations(draft: SocialPostDraft, snapshot: ContentSnapshot) -> list[str]:
    violations: list[str] = []
    visible = f"{draft.headline or ''}\n{draft.text}"
    lowered = visible.lower()
    if _URL.search(visible):
        violations.append("links are appended automatically and must not appear in the text")
    if _MENTION.search(visible):
        violations.append("mentions and e-mail addresses are forbidden")
    blocked = [term for term in BLOCKED_TERMS if term in lowered]
    if blocked:
        violations.append(f"monetization or pressure terms are forbidden: {', '.join(blocked)}")
    invalid_tags = [tag for tag in draft.hashtags if not _HASHTAG.match(tag)]
    if invalid_tags:
        violations.append(f"invalid hashtags: {', '.join(invalid_tags)}")
    max_tags = PLATFORM_MAX_HASHTAGS[draft.platform]
    if len(draft.hashtags) > max_tags:
        violations.append(f"at most {max_tags} hashtags on {draft.platform.value}")
    if draft.platform in IMAGE_PLATFORMS and not (draft.headline and draft.headline.strip()):
        violations.append("image posts require a headline for the slide")

    known = allowed_numbers(snapshot)
    unsupported = [
        number for number in _NUMBER.findall(visible) if not _normalize_number(number) & known
    ]
    if unsupported:
        violations.append(f"numbers not backed by game data: {', '.join(unsupported)}")

    composed = compose_post(draft)
    limit = PLATFORM_CHAR_LIMITS[draft.platform]
    if composed.visible_length() > limit:
        violations.append(f"post exceeds {limit} characters ({composed.visible_length()})")
    return violations


def _posts_for(history: SocialHistory, platform: Platform) -> list[PublishedPost]:
    return [post for account in history.accounts if account.platform is platform for post in account.posts]


def cadence_violation(platform: Platform, history: SocialHistory, now: datetime) -> str | None:
    posts = _posts_for(history, platform)
    if any(now - post.created_at < timedelta(hours=MIN_HOURS_BETWEEN_POSTS) for post in posts):
        return f"last post is younger than {MIN_HOURS_BETWEEN_POSTS} hours"
    recent = [post for post in posts if now - post.created_at < timedelta(days=7)]
    if len(recent) >= MAX_POSTS_PER_7_DAYS:
        return f"weekly limit of {MAX_POSTS_PER_7_DAYS} posts reached"
    return None


def is_duplicate(text: str, posts: Iterable[PublishedPost]) -> bool:
    normalized = text.lower()
    return any(
        SequenceMatcher(None, normalized, post.text.lower()).ratio() >= DUPLICATE_SIMILARITY
        for post in posts
    )


def summarize_performance(history: SocialHistory, now: datetime) -> list[PlatformPerformance]:
    summaries: list[PlatformPerformance] = []
    for account in history.accounts:
        recent = [post for post in account.posts if now - post.created_at < timedelta(days=14)]
        best = max(recent, key=PublishedPost.engagement, default=None)
        reach_values = [post.reach for post in recent if post.reach is not None]
        summaries.append(
            PlatformPerformance(
                platform=account.platform,
                followers=account.followers,
                posts_last_14d=len(recent),
                average_engagement_14d=(
                    round(sum(post.engagement() for post in recent) / len(recent), 2)
                    if recent
                    else 0
                ),
                average_reach_14d=(
                    round(sum(reach_values) / len(reach_values), 2) if reach_values else None
                ),
                best_post_text=best.text if best else None,
                best_post_engagement=best.engagement() if best else 0,
                last_post_at=max((post.created_at for post in account.posts), default=None),
            )
        )
    return summaries


def review_drafts(
    plan: ReachPlan,
    snapshot: ContentSnapshot,
    history: SocialHistory,
    platforms: Iterable[Platform],
    now: datetime,
) -> list[PublishResult]:
    """Return exactly one result per draft, in the same order as `plan.posts`."""
    available = set(platforms)
    seen: set[Platform] = set()
    results: list[PublishResult] = []

    for draft in plan.posts:
        composed = compose_post(draft)
        status = PublishStatus.APPROVED
        reason: str | None = None

        if draft.platform not in available:
            status, reason = PublishStatus.SKIPPED, "platform is not configured"
        elif draft.platform in seen:
            status, reason = PublishStatus.REJECTED, "only one post per platform and run"
        elif violations := text_violations(draft, snapshot):
            status, reason = PublishStatus.REJECTED, "; ".join(violations)
        elif is_duplicate(composed.text, _posts_for(history, draft.platform)):
            status, reason = PublishStatus.REJECTED, "too similar to a recent post"
        elif cadence := cadence_violation(draft.platform, history, now):
            status, reason = PublishStatus.SKIPPED, cadence

        seen.add(draft.platform)
        results.append(
            PublishResult(
                platform=draft.platform,
                pillar=draft.pillar,
                status=status,
                text=composed.text,
                reason=reason,
            )
        )
    return results
