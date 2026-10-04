import os
from datetime import UTC, datetime
from urllib.parse import urlencode

from floralog_ai.http_client import request_json
from floralog_ai.schemas import AccountSnapshot, PartnerCandidate, Platform, PublishedPost
from floralog_ai.social.compose import ComposedPost, Facet

DEFAULT_SERVICE_URL = "https://bsky.social"
LINK_CARD_TITLE = "Floralog"
LINK_CARD_DESCRIPTION = "Pflanzen entdecken, sammeln und gemeinsam die Natur erkunden."


class BlueskyClient:
    platform = Platform.BLUESKY

    def __init__(self, handle: str, app_password: str, service_url: str = DEFAULT_SERVICE_URL):
        self._handle = handle
        self._app_password = app_password
        self._service_url = service_url.rstrip("/")
        self._session: dict | None = None

    @classmethod
    def from_env(cls) -> "BlueskyClient | None":
        handle = os.getenv("BLUESKY_HANDLE", "").strip()
        app_password = os.getenv("BLUESKY_APP_PASSWORD", "").strip()
        if not handle or not app_password:
            return None
        return cls(handle, app_password, os.getenv("BLUESKY_SERVICE_URL") or DEFAULT_SERVICE_URL)

    def fetch_account(self, limit: int = 30) -> AccountSnapshot:
        did = self._auth()["did"]
        profile = self._get("app.bsky.actor.getProfile", {"actor": did})
        feed = self._get(
            "app.bsky.feed.getAuthorFeed",
            {"actor": did, "limit": limit, "filter": "posts_no_replies"},
        )

        posts: list[PublishedPost] = []
        for item in feed.get("feed", []):
            post = item.get("post", {})
            if item.get("reason") or post.get("author", {}).get("did") != did:
                continue
            record = post.get("record", {})
            posts.append(
                PublishedPost(
                    platform=self.platform,
                    post_id=post["uri"],
                    url=self._web_url(post["uri"]),
                    text=record.get("text", ""),
                    created_at=record.get("createdAt") or post["indexedAt"],
                    likes=post.get("likeCount", 0),
                    reposts=post.get("repostCount", 0),
                    replies=post.get("replyCount", 0),
                    quotes=post.get("quoteCount", 0),
                )
            )
        return AccountSnapshot(
            platform=self.platform, followers=profile.get("followersCount", 0), posts=posts
        )

    def publish(self, composed: ComposedPost, media_urls: list[str]) -> tuple[str, str]:
        session = self._auth()
        record = {
            "$type": "app.bsky.feed.post",
            "text": composed.text,
            "createdAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "langs": ["de"],
            "facets": [_to_bluesky_facet(facet) for facet in composed.facets],
            "embed": {
                "$type": "app.bsky.embed.external",
                "external": {
                    "uri": composed.link_url,
                    "title": LINK_CARD_TITLE,
                    "description": LINK_CARD_DESCRIPTION,
                },
            },
        }
        result = request_json(
            "POST",
            f"{self._service_url}/xrpc/com.atproto.repo.createRecord",
            headers=self._auth_headers(),
            payload={"repo": session["did"], "collection": "app.bsky.feed.post", "record": record},
        )
        return result["uri"], self._web_url(result["uri"])

    def search_accounts(self, term: str, limit: int = 25) -> list[PartnerCandidate]:
        actors = self._get("app.bsky.actor.searchActors", {"q": term, "limit": limit}).get(
            "actors", []
        )
        if not actors:
            return []
        profiles = self._get(
            "app.bsky.actor.getProfiles", {"actors": [actor["did"] for actor in actors]}
        ).get("profiles", [])
        return [
            PartnerCandidate(
                platform=self.platform,
                handle=profile["handle"],
                display_name=profile.get("displayName") or None,
                profile_url=f"https://bsky.app/profile/{profile['handle']}",
                bio=(profile.get("description") or "")[:500] or None,
                followers=profile.get("followersCount"),
                source=f"bluesky search: {term}",
            )
            for profile in profiles
        ]

    def _auth(self) -> dict:
        if self._session is None:
            self._session = request_json(
                "POST",
                f"{self._service_url}/xrpc/com.atproto.server.createSession",
                payload={"identifier": self._handle, "password": self._app_password},
            )
        return self._session

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._auth()['accessJwt']}"}

    def _get(self, method: str, params: dict) -> dict:
        return request_json(
            "GET",
            f"{self._service_url}/xrpc/{method}?{urlencode(params, doseq=True)}",
            headers=self._auth_headers(),
        )

    def _web_url(self, uri: str) -> str:
        return f"https://bsky.app/profile/{self._handle}/post/{uri.rsplit('/', 1)[-1]}"


def _to_bluesky_facet(facet: Facet) -> dict:
    if facet.kind == "link":
        feature = {"$type": "app.bsky.richtext.facet#link", "uri": facet.value}
    else:
        feature = {"$type": "app.bsky.richtext.facet#tag", "tag": facet.value}
    return {
        "index": {"byteStart": facet.byte_start, "byteEnd": facet.byte_end},
        "features": [feature],
    }
