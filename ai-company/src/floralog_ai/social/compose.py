from dataclasses import dataclass
from urllib.parse import urlencode

from floralog_ai.schemas import Platform, SocialPostDraft

SITE_URL = "https://floralog.de/"
BLUESKY_LINK_DISPLAY = "floralog.de"
INSTAGRAM_LINK_LINE = "Jetzt mitspielen: Link in der Bio"
MASTODON_URL_LENGTH = 23
PLATFORM_CHAR_LIMITS = {
    Platform.BLUESKY: 300,
    Platform.MASTODON: 500,
    Platform.INSTAGRAM: 2200,
    Platform.PINTEREST: 500,
}
PLATFORM_MAX_HASHTAGS = {
    Platform.BLUESKY: 3,
    Platform.MASTODON: 3,
    Platform.INSTAGRAM: 5,
    Platform.PINTEREST: 5,
}


@dataclass(frozen=True)
class Facet:
    byte_start: int
    byte_end: int
    kind: str
    value: str


@dataclass(frozen=True)
class ComposedPost:
    platform: Platform
    text: str
    link_url: str
    facets: tuple[Facet, ...]
    title: str | None = None

    def visible_length(self) -> int:
        if self.platform is Platform.MASTODON:
            return len(self.text) - len(self.link_url) + MASTODON_URL_LENGTH
        return len(self.text)


def build_link(platform: Platform) -> str:
    query = urlencode(
        {"utm_source": platform.value, "utm_medium": "social", "utm_campaign": "ai_reach"}
    )
    return f"{SITE_URL}?{query}"


def _link_line(platform: Platform, link_url: str) -> tuple[str, str | None]:
    """Return the visible link line and the facet target (None if not clickable)."""
    if platform is Platform.BLUESKY:
        return BLUESKY_LINK_DISPLAY, link_url
    if platform is Platform.MASTODON:
        return link_url, link_url
    if platform is Platform.INSTAGRAM:
        return INSTAGRAM_LINK_LINE, None
    return "", None


def compose_post(draft: SocialPostDraft) -> ComposedPost:
    link_url = build_link(draft.platform)
    text = draft.text.strip()
    facets: list[Facet] = []

    def append(separator: str, display: str, kind: str | None, value: str | None) -> None:
        nonlocal text
        text += separator
        start = len(text.encode("utf-8"))
        text += display
        if kind and value:
            facets.append(Facet(start, len(text.encode("utf-8")), kind, value))

    link_display, link_target = _link_line(draft.platform, link_url)
    if link_display:
        append("\n\n", link_display, "link", link_target)
    for index, tag in enumerate(draft.hashtags):
        separator = " " if index else ("\n" if link_display else "\n\n")
        append(separator, f"#{tag}", "tag", tag)

    return ComposedPost(draft.platform, text, link_url, tuple(facets), draft.headline)
