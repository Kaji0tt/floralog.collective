from io import BytesIO
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from PIL import Image

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_HOSTS = ("supabase.co", "workers.dev", "floralog.de")


def _is_allowed_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    if host == "supabase.co" or host.endswith(".supabase.co"):
        return True
    return any(host == domain or host.endswith(f".{domain}") for domain in ALLOWED_HOSTS[1:])


class _SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not _is_allowed_url(newurl):
            return None
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def load_public_image(url: str, label: str) -> Image.Image | None:
    if not _is_allowed_url(url):
        host = urlparse(url).hostname or "unknown"
        print(f"[weekly-report] Skipped {label}: image host '{host}' is not allowlisted.")
        return None

    request = Request(url, headers={"Accept": ", ".join(sorted(ALLOWED_IMAGE_TYPES))})
    try:
        with build_opener(_SafeRedirectHandler()).open(request, timeout=15) as response:
            content_type = response.headers.get_content_type()
            if content_type not in ALLOWED_IMAGE_TYPES:
                print(
                    f"[weekly-report] Skipped {label}: response content type "
                    f"'{content_type}' is not an allowed image type."
                )
                return None
            data = response.read(MAX_IMAGE_BYTES + 1)
    except HTTPError as error:
        print(f"[weekly-report] Skipped {label}: image server returned HTTP {error.code}.")
        return None
    except (URLError, TimeoutError, OSError) as error:
        print(
            f"[weekly-report] Skipped {label}: image request failed "
            f"({type(error).__name__})."
        )
        return None

    if not data or len(data) > MAX_IMAGE_BYTES:
        print(f"[weekly-report] Skipped {label}: image is empty or exceeds the size limit.")
        return None
    try:
        with Image.open(BytesIO(data)) as image:
            image.load()
            return image.convert("RGBA")
    except (OSError, ValueError):
        print(f"[weekly-report] Skipped {label}: image data is invalid.")
        return None
