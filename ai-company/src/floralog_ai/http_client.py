import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

USER_AGENT = "floralog-ai-company/0.1"


class ApiError(RuntimeError):
    """Raised when an external API call fails. Never contains credentials."""


def require_https(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError(f"Only absolute HTTPS URLs are allowed: {parsed.netloc or url!r}")


def request_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    payload: Any | None = None,
    form: dict[str, str] | None = None,
    body: bytes | None = None,
    content_type: str | None = None,
    timeout_seconds: int = 30,
) -> Any:
    require_https(url)
    parsed = urlparse(url)
    request_headers = {"Accept": "application/json", "User-Agent": USER_AGENT, **(headers or {})}

    data = body
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        content_type = "application/json"
    elif form is not None:
        data = urlencode(form).encode("utf-8")
        content_type = "application/x-www-form-urlencoded"
    if data is not None and content_type:
        request_headers["Content-Type"] = content_type

    request = Request(url, data=data, headers=request_headers, method=method)
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            response_body = response.read()
    except HTTPError as error:
        raise ApiError(f"{method} {parsed.netloc}{parsed.path} returned HTTP {error.code}.") from None
    except URLError as error:
        raise ApiError(f"{method} {parsed.netloc}{parsed.path} failed: {error.reason}.") from None
    return json.loads(response_body.decode("utf-8")) if response_body else {}
