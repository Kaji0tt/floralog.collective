import os

from floralog_ai.http_client import ApiError, request_json

MAX_UPLOAD_BYTES = 8 * 1024 * 1024


class MediaUploader:
    """Uploads rendered JPEG slides to the public Supabase bucket via the aiSocialMediaUpload function."""

    def __init__(self, endpoint: str, secret: str):
        self._endpoint = endpoint
        self._secret = secret

    @classmethod
    def from_env(cls) -> "MediaUploader | None":
        endpoint = os.getenv("AI_MEDIA_UPLOAD_ENDPOINT", "").strip()
        secret = os.getenv("AI_KPI_SECRET", "").strip()
        if not endpoint or not secret:
            return None
        return cls(endpoint, secret)

    def upload(self, jpeg: bytes) -> str:
        if len(jpeg) > MAX_UPLOAD_BYTES:
            raise ApiError("Rendered image exceeds the 8 MB upload limit.")
        response = request_json(
            "POST",
            self._endpoint,
            headers={"X-Floralog-AI-Secret": self._secret},
            body=jpeg,
            content_type="image/jpeg",
            timeout_seconds=60,
        )
        url = response.get("url")
        if not url:
            raise ApiError("Media upload returned no public URL.")
        return url
