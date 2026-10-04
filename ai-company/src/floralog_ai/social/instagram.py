import os
import re
import time
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from floralog_ai.http_client import ApiError, request_json
from floralog_ai.schemas import AccountSnapshot, PartnerCandidate, Platform, PublishedPost
from floralog_ai.social.compose import ComposedPost

GRAPH_HOST = "https://graph.facebook.com"
DEFAULT_GRAPH_VERSION = "v25.0"
INSIGHT_METRICS = "reach,saved,shares,total_interactions"
MAX_INSIGHT_POSTS = 10
CONTAINER_POLL_ATTEMPTS = 10
CONTAINER_POLL_SECONDS = 3
_MENTION = re.compile(r"@([A-Za-z0-9._]{3,30})")


class InstagramClient:
    """Instagram API with Facebook Login (graph.facebook.com), e.g. with a system user token."""

    platform = Platform.INSTAGRAM

    def __init__(self, user_id: str, access_token: str, graph_version: str = DEFAULT_GRAPH_VERSION):
        self._user_id = user_id
        self._access_token = access_token
        self._base = f"{GRAPH_HOST}/{graph_version}"
        self.ai_label = os.getenv("INSTAGRAM_AI_LABEL", "true").strip().lower() == "true"

    @classmethod
    def from_env(cls) -> "InstagramClient | None":
        user_id = os.getenv("INSTAGRAM_USER_ID", "").strip()
        access_token = os.getenv("INSTAGRAM_ACCESS_TOKEN", "").strip()
        if not user_id or not access_token:
            return None
        return cls(user_id, access_token, os.getenv("INSTAGRAM_GRAPH_VERSION") or DEFAULT_GRAPH_VERSION)

    def fetch_account(self, limit: int = 25) -> AccountSnapshot:
        account = self._get(self._user_id, {"fields": "followers_count,username"})
        media = self._get(
            f"{self._user_id}/media",
            {
                "fields": "id,caption,permalink,timestamp,like_count,comments_count",
                "limit": limit,
            },
        )
        insight_cutoff = datetime.now(UTC) - timedelta(days=30)
        posts: list[PublishedPost] = []
        for index, item in enumerate(media.get("data", [])):
            created_at = datetime.fromisoformat(item["timestamp"].replace("+0000", "+00:00"))
            insights = (
                self._insights(item["id"])
                if index < MAX_INSIGHT_POSTS and created_at >= insight_cutoff
                else {}
            )
            posts.append(
                PublishedPost(
                    platform=self.platform,
                    post_id=item["id"],
                    url=item.get("permalink"),
                    text=item.get("caption", ""),
                    created_at=created_at,
                    likes=item.get("like_count", 0),
                    replies=item.get("comments_count", 0),
                    reposts=insights.get("shares", 0),
                    saves=insights.get("saved", 0),
                    reach=insights.get("reach"),
                )
            )
        return AccountSnapshot(
            platform=self.platform, followers=account.get("followers_count", 0), posts=posts
        )

    def publish(self, composed: ComposedPost, media_urls: list[str]) -> tuple[str, str | None]:
        if not media_urls:
            raise ApiError("Instagram posts require at least one image.")

        if len(media_urls) == 1:
            container = self._create_container(
                {"image_url": media_urls[0], "caption": composed.text, **self._ai_flag()}
            )
        else:
            children = [
                self._create_container({"image_url": url, "is_carousel_item": True})
                for url in media_urls
            ]
            for child in children:
                self._wait_until_ready(child)
            container = self._create_container(
                {
                    "media_type": "CAROUSEL",
                    "children": ",".join(children),
                    "caption": composed.text,
                    **self._ai_flag(),
                }
            )
        self._wait_until_ready(container)
        media_id = self._post(f"{self._user_id}/media_publish", {"creation_id": container})["id"]
        permalink = self._get(media_id, {"fields": "permalink"}).get("permalink")
        return media_id, permalink

    def lookup_business(self, username: str, source: str) -> PartnerCandidate | None:
        fields = (
            f"business_discovery.username({username})"
            "{username,name,biography,website,followers_count}"
        )
        try:
            profile = self._get(self._user_id, {"fields": fields}).get("business_discovery")
        except ApiError:
            return None
        if not profile:
            return None
        return PartnerCandidate(
            platform=self.platform,
            handle=profile.get("username", username),
            display_name=profile.get("name"),
            profile_url=f"https://www.instagram.com/{profile.get('username', username)}/",
            bio=(profile.get("biography") or "")[:500] or None,
            website=profile.get("website"),
            followers=profile.get("followers_count"),
            source=source,
        )

    def hashtag_mentions(self, hashtag: str, limit: int = 25) -> set[str]:
        """Usernames mentioned in top posts of a hashtag (requires Instagram Public Content Access)."""
        found = self._get("ig_hashtag_search", {"user_id": self._user_id, "q": hashtag}).get("data", [])
        if not found:
            return set()
        media = self._get(
            f"{found[0]['id']}/top_media",
            {"user_id": self._user_id, "fields": "caption", "limit": limit},
        )
        mentions: set[str] = set()
        for item in media.get("data", []):
            mentions.update(_MENTION.findall(item.get("caption", "")))
        return mentions

    def _ai_flag(self) -> dict:
        return {"is_ai_generated": True} if self.ai_label else {}

    def _insights(self, media_id: str) -> dict[str, int]:
        try:
            response = self._get(f"{media_id}/insights", {"metric": INSIGHT_METRICS})
        except ApiError:
            return {}
        return {
            metric["name"]: metric.get("values", [{}])[0].get("value", 0)
            for metric in response.get("data", [])
        }

    def _create_container(self, payload: dict) -> str:
        return self._post(f"{self._user_id}/media", payload)["id"]

    def _wait_until_ready(self, container_id: str) -> None:
        for _ in range(CONTAINER_POLL_ATTEMPTS):
            status = self._get(container_id, {"fields": "status_code"}).get("status_code")
            if status == "FINISHED":
                return
            if status in {"ERROR", "EXPIRED"}:
                raise ApiError(f"Instagram container {container_id} failed with status {status}.")
            time.sleep(CONTAINER_POLL_SECONDS)
        raise ApiError(f"Instagram container {container_id} was not ready in time.")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._access_token}"}

    def _get(self, path: str, params: dict) -> dict:
        return request_json("GET", f"{self._base}/{path}?{urlencode(params)}", headers=self._headers())

    def _post(self, path: str, payload: dict) -> dict:
        return request_json("POST", f"{self._base}/{path}", headers=self._headers(), payload=payload)
