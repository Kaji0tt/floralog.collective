from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw

from floralog_ai.slides import render_admin_weekly_report, to_jpeg
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
    slides = render_admin_weekly_report(load_snapshot())

    assert len(slides) == 4
    assert all(slide.size == (1080, 1350) for slide in slides)
    assert all(to_jpeg(slide).startswith(b"\xff\xd8\xff") for slide in slides)
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
    }
    snapshot["top_scan"]["avatar"] = {
        "face": "https://floralog-assets.workers.dev/asset/face.png",
        "plant": None,
        "border": None,
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
