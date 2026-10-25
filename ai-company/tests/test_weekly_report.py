from datetime import date
from email.message import Message
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

from floralog_ai.slides import (
    _overscale_avatar_asset,
    _tint_border_asset,
    render_admin_weekly_report,
    to_jpeg,
)
from floralog_ai.social import remote_image
from floralog_ai.social.remote_image import _is_allowed_url
from floralog_ai.weekly_report_main import completed_week_start, run_weekly_report

FIXTURES = Path(__file__).parents[1] / "fixtures"


def load_snapshot() -> dict:
    import json

    return json.loads((FIXTURES / "weekly_report_snapshot.json").read_text(encoding="utf-8"))


def test_completed_week_start_is_previous_monday() -> None:
    assert completed_week_start(date(2026, 10, 25)) == date(2026, 10, 12)
    assert completed_week_start(date(2026, 10, 26)) == date(2026, 10, 19)


def test_admin_report_renderer_creates_four_instagram_portrait_slides() -> None:
    snapshot = load_snapshot()
    slides = render_admin_weekly_report(snapshot)

    assert len(slides) == 4
    assert all(slide.size == (1080, 1350) for slide in slides)
    assert all(to_jpeg(slide).startswith(b"\xff\xd8\xff") for slide in slides)
    assert snapshot["zones_completed"] == 5
    assert all(
        slide.getpixel((20, 20))[1] < 70
        for slide in slides
    )


def test_admin_report_background_composites_transparent_autumn_asset(
    monkeypatch, tmp_path: Path
) -> None:
    from floralog_ai import slides

    monkeypatch.setattr(slides, "WEEKLY_REPORT_DECORATIONS_DIR", tmp_path)
    asset_path = tmp_path / "herbst1.png"
    Image.new("RGBA", (400, 500), (0, 0, 0, 0)).save(asset_path)
    without_art = slides._draw_admin_report_background((1080, 1350), 0)
    asset = Image.new("RGBA", (400, 500), (0, 0, 0, 0))
    ImageDraw.Draw(asset).rectangle((200, 0, 399, 499), fill=(255, 0, 0, 255))
    asset.save(asset_path)
    actual = slides._draw_admin_report_background((1080, 1350), 0)

    assert actual.getpixel((990, 10))[0] > without_art.getpixel((990, 10))[0]
    assert actual.getpixel((870, 10)) == without_art.getpixel((870, 10))


def test_weekly_report_dry_run_never_publishes(tmp_path: Path) -> None:
    result = run_weekly_report(load_snapshot(), tmp_path)

    assert result["published"] is False
    assert result["url"] is None
    assert len(result["slides"]) == 4
    assert all(Path(path).is_file() for path in result["slides"])


def test_image_url_allowlist_accepts_project_and_asset_hosts_only() -> None:
    assert _is_allowed_url("https://mppxozsltkgjozcastgv.supabase.co/storage/v1/object/public/a.jpg")
    assert _is_allowed_url("https://floralog-assets.workers.dev/asset/logo.png")
    assert _is_allowed_url("https://pub-abc123.r2.dev/custom_logo/default/face_default.png")
    assert not _is_allowed_url("http://mppxozsltkgjozcastgv.supabase.co/a.jpg")
    assert not _is_allowed_url("https://attacker.example/a.jpg")


def test_public_image_request_uses_identifying_user_agent(monkeypatch) -> None:
    image_bytes = BytesIO()
    Image.new("RGB", (2, 2), (20, 80, 40)).save(image_bytes, format="PNG")
    headers = Message()
    headers["Content-Type"] = "image/png"
    captured = {}

    class Response:
        def __init__(self):
            self.headers = headers

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self, _limit):
            return image_bytes.getvalue()

    class Opener:
        def open(self, request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return Response()

    monkeypatch.setattr(remote_image, "build_opener", lambda *_handlers: Opener())

    result = remote_image.load_public_image(
        "https://floralog-assets-catalog.green-term-27d0.workers.dev/"
        "asset/custom_logo/default/face_default.png",
        "test avatar",
    )

    assert result is not None and result.size == (2, 2)
    assert captured["request"].get_header("User-agent") == (
        "Floralog-Weekly-Report/1.0 (+https://floralog.de)"
    )
    assert captured["timeout"] == 15


def test_avatar_asset_overscale_matches_home_layer_zoom() -> None:
    source = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    ImageDraw.Draw(source).rectangle((40, 40, 60, 60), fill=(255, 0, 255, 255))

    rendered = _overscale_avatar_asset(source, 100)
    visible_alpha = rendered.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    alpha_bounds = visible_alpha.getbbox()

    assert alpha_bounds is not None
    assert 30 <= alpha_bounds[2] - alpha_bounds[0] <= 33
    assert 30 <= alpha_bounds[3] - alpha_bounds[1] <= 33


def test_border_asset_uses_public_profile_hex_color() -> None:
    source = Image.new("RGBA", (10, 10), (255, 255, 255, 0))
    source.putpixel((5, 5), (255, 255, 255, 192))

    tinted = _tint_border_asset(source, "#34c759")

    assert tinted.getpixel((5, 5)) == (52, 199, 89, 192)
    assert tinted.getpixel((0, 0)) == (52, 199, 89, 0)


def test_renderer_uses_public_profile_avatar_layers(monkeypatch) -> None:
    from floralog_ai import slides

    monkeypatch.setattr(
        slides,
        "load_public_image",
        lambda _url, _label: Image.new("RGBA", (32, 32), (255, 0, 255, 255)),
    )
    snapshot = load_snapshot()
    snapshot["leaderboard"][0]["avatar"] = {
        "face": "https://floralog-assets.workers.dev/asset/face.png",
        "plant": None,
        "border": None,
        "border_color": "#ff0000",
    }
    snapshot["top_scan"]["avatar"] = {
        "face": "https://floralog-assets.workers.dev/asset/face.png",
        "plant": None,
        "border": None,
        "border_color": "#ff0000",
    }
    snapshot["top_scan"]["image_url"] = (
        "https://mppxozsltkgjozcastgv.supabase.co/storage/v1/object/public/scan.jpg"
    )

    slides_out = render_admin_weekly_report(snapshot)

    assert len(slides_out) == 4
    avatar_pixels = sum(
        1 for red, green, blue in slides_out[1].getdata()
        if red > 200 and green < 180 and blue > 200
    )
    assert avatar_pixels > 100
    photo_pixels = sum(
        1 for red, green, blue in slides_out[3].getdata()
        if red > 200 and green < 180 and blue > 200
    )
    assert 100_000 < photo_pixels < 500_000
    assert slides_out[3].getpixel((540, 600)) == (255, 0, 255)
    assert slides_out[3].getpixel((40, 500)) != (255, 0, 255)


def test_renderer_does_not_use_local_asset_when_supabase_avatar_cannot_load(monkeypatch) -> None:
    from floralog_ai import slides

    monkeypatch.setattr(slides, "load_public_image", lambda _url, _label: None)
    snapshot = load_snapshot()
    snapshot["leaderboard"][0]["avatar"] = {
        "face": "https://floralog-assets-catalog.example.workers.dev/asset/custom_logo/default/face_default.png",
        "plant": None,
        "border": None,
        "status": "ok",
    }

    slide = render_admin_weekly_report(snapshot)[1]
    magenta_pixels = sum(
        1 for red, green, blue in slide.getdata()
        if red > 200 and green < 80 and blue > 200
    )
    assert magenta_pixels == 0
