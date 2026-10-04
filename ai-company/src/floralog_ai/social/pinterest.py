import base64
import os
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from floralog_ai.http_client import ApiError, request_json
from floralog_ai.schemas import AccountSnapshot, Platform, PublishedPost
from floralog_ai.social.compose import ComposedPost

API_BASE = "https://api.pinterest.com/v5"
ANALYTICS_METRICS = "IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK"
MAX_ANALYTICS_PINS = 10
TITLE_LIMIT = 100


class PinterestClient:
    platform = Platform.PINTEREST

    def __init__(
        self,
        board_id: str,
        *,
        access_token: str = "",
        app_id: str = "",
        app_secret: str = "",
        refresh_token: str = "",
    ):
        self._board_id = board_id
        self._access_token = access_token
        self._app_id = app_id
        self._app_secret = app_secret
        self._refresh_token = refresh_token

    @classmethod
    def from_env(cls) -> "PinterestClient | None":
        board_id = os.getenv("PINTEREST_BOARD_ID", "").strip()
        access_token = os.getenv("PINTEREST_ACCESS_TOKEN", "").strip()
        refresh_token = os.getenv("PINTEREST_REFRESH_TOKEN", "").strip()
        if not board_id or not (access_token or refresh_token):
            return None
        return cls(
            board_id,
            access_token=access_token,
            app_id=os.getenv("PINTEREST_APP_ID", "").strip(),
            app_secret=os.getenv("PINTEREST_APP_SECRET", "").strip(),
            refresh_token=refresh_token,
        )

    def fetch_account(self, limit: int = 25) -> AccountSnapshot:
        account = self._get("user_account", {})
        pins = self._get(f"boards/{self._board_id}/pins", {"page_size": limit}).get("items", [])
        today = datetime.now(UTC).date()
        posts: list[PublishedPost] = []
        for index, pin in enumerate(pins):
            metrics = self._analytics(pin["id"], today) if index < MAX_ANALYTICS_PINS else {}
            posts.append(
                PublishedPost(
                    platform=self.platform,
                    post_id=pin["id"],
                    url=f"https://www.pinterest.com/pin/{pin['id']}/",
                    text=pin.get("description") or pin.get("title") or "",
                    created_at=pin["created_at"],
                    saves=metrics.get("SAVE", 0),
                    link_clicks=metrics.get("OUTBOUND_CLICK", 0),
                    reach=metrics.get("IMPRESSION"),
                )
            )
        return AccountSnapshot(
            platform=self.platform, followers=account.get("follower_count", 0), posts=posts
        )

    def publish(self, composed: ComposedPost, media_urls: list[str]) -> tuple[str, str | None]:
        if not media_urls:
            raise ApiError("Pinterest pins require an image.")
        title = (composed.title or composed.text.split("\n", 1)[0])[:TITLE_LIMIT]
        pin = request_json(
            "POST",
            f"{API_BASE}/pins",
            headers=self._headers(),
            payload={
                "board_id": self._board_id,
                "title": title,
                "description": composed.text,
                "link": composed.link_url,
                "alt_text": title,
                "media_source": {"source_type": "image_url", "url": media_urls[0]},
            },
        )
        return pin["id"], f"https://www.pinterest.com/pin/{pin['id']}/"

    def _analytics(self, pin_id: str, today) -> dict[str, int]:
        params = {
            "start_date": (today - timedelta(days=30)).isoformat(),
            "end_date": today.isoformat(),
            "metric_types": ANALYTICS_METRICS,
        }
        try:
            response = self._get(f"pins/{pin_id}/analytics", params)
        except ApiError:
            return {}
        summary = response.get("all", {}).get("summary_metrics") or {}
        return {key: int(value or 0) for key, value in summary.items()}

    def _headers(self) -> dict[str, str]:
        if not self._access_token:
            self._access_token = self._refresh_access_token()
        return {"Authorization": f"Bearer {self._access_token}"}

    def _refresh_access_token(self) -> str:
        if not (self._app_id and self._app_secret and self._refresh_token):
            raise ApiError("Pinterest refresh requires PINTEREST_APP_ID and PINTEREST_APP_SECRET.")
        credentials = base64.b64encode(f"{self._app_id}:{self._app_secret}".encode()).decode()
        response = request_json(
            "POST",
            f"{API_BASE}/oauth/token",
            headers={"Authorization": f"Basic {credentials}"},
            form={"grant_type": "refresh_token", "refresh_token": self._refresh_token},
        )
        return response["access_token"]

    def _get(self, path: str, params: dict) -> dict:
        query = f"?{urlencode(params)}" if params else ""
        return request_json("GET", f"{API_BASE}/{path}{query}", headers=self._headers())
