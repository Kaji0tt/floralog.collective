import hashlib
import html
import os
import re
from urllib.parse import urlencode

from floralog_ai.http_client import request_json
from floralog_ai.schemas import AccountSnapshot, PartnerCandidate, Platform, PublishedPost
from floralog_ai.social.compose import ComposedPost

_LINE_BREAK_TAGS = re.compile(r"<br\s*/?>|</p>", re.IGNORECASE)
_HTML_TAGS = re.compile(r"<[^>]+>")


def html_to_text(content: str) -> str:
    return html.unescape(_HTML_TAGS.sub("", _LINE_BREAK_TAGS.sub("\n", content))).strip()


class MastodonClient:
    platform = Platform.MASTODON

    def __init__(self, instance_url: str, access_token: str):
        self._instance_url = instance_url.rstrip("/")
        self._access_token = access_token

    @classmethod
    def from_env(cls) -> "MastodonClient | None":
        instance_url = os.getenv("MASTODON_INSTANCE_URL", "").strip()
        access_token = os.getenv("MASTODON_ACCESS_TOKEN", "").strip()
        if not instance_url or not access_token:
            return None
        return cls(instance_url, access_token)

    def fetch_account(self, limit: int = 30) -> AccountSnapshot:
        account = self._request("GET", "/api/v1/accounts/verify_credentials")
        query = urlencode({"limit": limit, "exclude_replies": "true", "exclude_reblogs": "true"})
        statuses = self._request("GET", f"/api/v1/accounts/{account['id']}/statuses?{query}")
        posts = [
            PublishedPost(
                platform=self.platform,
                post_id=str(status["id"]),
                url=status.get("url"),
                text=html_to_text(status.get("content", "")),
                created_at=status["created_at"],
                likes=status.get("favourites_count", 0),
                reposts=status.get("reblogs_count", 0),
                replies=status.get("replies_count", 0),
            )
            for status in statuses
        ]
        return AccountSnapshot(
            platform=self.platform, followers=account.get("followers_count", 0), posts=posts
        )

    def publish(self, composed: ComposedPost, media_urls: list[str]) -> tuple[str, str | None]:
        idempotency_key = hashlib.sha256(composed.text.encode("utf-8")).hexdigest()
        status = self._request(
            "POST",
            "/api/v1/statuses",
            payload={"status": composed.text, "visibility": "public", "language": "de"},
            extra_headers={"Idempotency-Key": idempotency_key},
        )
        return str(status["id"]), status.get("url")

    def search_accounts(self, term: str, limit: int = 20) -> list[PartnerCandidate]:
        query = urlencode({"q": term, "type": "accounts", "limit": limit})
        accounts = self._request("GET", f"/api/v2/search?{query}").get("accounts", [])
        return [
            PartnerCandidate(
                platform=self.platform,
                handle=account["acct"],
                display_name=account.get("display_name") or None,
                profile_url=account["url"],
                bio=html_to_text(account.get("note", ""))[:500] or None,
                followers=account.get("followers_count"),
                source=f"mastodon search: {term}",
            )
            for account in accounts
            if not account.get("bot")
        ]

    def _request(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
        extra_headers: dict[str, str] | None = None,
    ):
        headers = {"Authorization": f"Bearer {self._access_token}", **(extra_headers or {})}
        return request_json(method, f"{self._instance_url}{path}", headers=headers, payload=payload)
