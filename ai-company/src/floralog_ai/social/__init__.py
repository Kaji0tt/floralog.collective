from datetime import UTC, datetime
from typing import Protocol

from floralog_ai.http_client import ApiError
from floralog_ai.schemas import AccountSnapshot, Platform, SocialHistory
from floralog_ai.social.bluesky import BlueskyClient
from floralog_ai.social.compose import ComposedPost, compose_post
from floralog_ai.social.instagram import InstagramClient
from floralog_ai.social.mastodon import MastodonClient
from floralog_ai.social.media import MediaUploader
from floralog_ai.social.pinterest import PinterestClient


class SocialClient(Protocol):
    platform: Platform

    def fetch_account(self, limit: int = 30) -> AccountSnapshot: ...

    def publish(self, composed: ComposedPost, media_urls: list[str]) -> tuple[str, str | None]: ...


def build_clients_from_env() -> dict[Platform, SocialClient]:
    clients: dict[Platform, SocialClient] = {}
    for client in (
        BlueskyClient.from_env(),
        MastodonClient.from_env(),
        InstagramClient.from_env(),
        PinterestClient.from_env(),
    ):
        if client is not None:
            clients[client.platform] = client
    return clients


def collect_history(clients: dict[Platform, SocialClient]) -> SocialHistory:
    """Fetch account stats; platforms whose history cannot be read are dropped from `clients`."""
    accounts: list[AccountSnapshot] = []
    for platform in list(clients):
        try:
            accounts.append(clients[platform].fetch_account())
        except ApiError as error:
            print(f"[reach] {platform.value} history unavailable, platform disabled: {error}")
            del clients[platform]
    return SocialHistory(collected_at=datetime.now(UTC), accounts=accounts)


__all__ = [
    "BlueskyClient",
    "ComposedPost",
    "InstagramClient",
    "MastodonClient",
    "MediaUploader",
    "PinterestClient",
    "SocialClient",
    "build_clients_from_env",
    "collect_history",
    "compose_post",
]
