import argparse
import json
import os
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from floralog_ai.http_client import request_json
from floralog_ai.schemas import Platform
from floralog_ai.slides import INSTAGRAM_SIZE, render_admin_weekly_report, to_jpeg
from floralog_ai.social import InstagramClient, MediaUploader
from floralog_ai.social.compose import ComposedPost


def completed_week_start(today: date | None = None) -> date:
    current = today or datetime.now(UTC).date()
    this_monday = current - timedelta(days=current.weekday())
    return this_monday - timedelta(days=7)


def fetch_snapshot(endpoint: str, secret: str, week_start: str | None = None) -> dict:
    if not endpoint.strip():
        raise ValueError("WEEKLY_REPORT_SNAPSHOT_ENDPOINT is required.")
    if not secret.strip():
        raise ValueError("AI_KPI_SECRET is required.")
    url = endpoint
    if week_start:
        url = f"{endpoint}?week_start={week_start}"
    return request_json("GET", url, headers={"X-Floralog-AI-Secret": secret})


def caption_for_week(snapshot: dict) -> str:
    start = date.fromisoformat(str(snapshot["week_start"])[:10])
    end = date.fromisoformat(str(snapshot["week_end"])[:10]) - timedelta(days=1)
    date_range = f"{start:%d.%m.}–{end:%d.%m.%Y}"
    return (
        f"Unser Wochenrückblick 🌿 {date_range}\n\n"
        "Danke an alle, die mit uns Pflanzen entdecken und die Floralog-Community "
        "lebendig machen! Welche Pflanze habt ihr diese Woche gefunden?\n\n"
        "Jetzt mitspielen: Link in der Bio\n"
        "#Floralog #PflanzenEntdecken #NaturEntdecken"
    )


def run_weekly_report(
    snapshot: dict,
    output_dir: Path,
    *,
    publish: bool = False,
) -> dict:
    slides = render_admin_weekly_report(snapshot)
    if len(slides) != 4 or any(slide.size != INSTAGRAM_SIZE for slide in slides):
        raise RuntimeError("Weekly report renderer must return four Instagram portrait slides.")

    output_dir.mkdir(parents=True, exist_ok=True)
    files = []
    for index, slide in enumerate(slides, start=1):
        path = output_dir / f"floralog_weekly_report_{index}.jpg"
        path.write_bytes(to_jpeg(slide))
        files.append(path)

    result = {
        "week_start": snapshot["week_start"],
        "slides": [str(path) for path in files],
        "published": False,
        "url": None,
    }
    if not publish:
        return result

    if os.getenv("FLORALOG_WEEKLY_REPORT_POSTING_ENABLED", "").strip().lower() != "true":
        raise RuntimeError("Publishing is disabled; set FLORALOG_WEEKLY_REPORT_POSTING_ENABLED=true.")
    uploader = MediaUploader.from_env()
    instagram = InstagramClient.from_env()
    if uploader is None:
        raise RuntimeError("AI_MEDIA_UPLOAD_ENDPOINT and AI_KPI_SECRET must be configured.")
    if instagram is None:
        raise RuntimeError("INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN must be configured.")

    media_urls = [uploader.upload(path.read_bytes()) for path in files]
    _, url = instagram.publish(
        ComposedPost(
            platform=Platform.INSTAGRAM,
            text=caption_for_week(snapshot),
            link_url="",
            facets=(),
        ),
        media_urls,
    )
    result.update({"published": True, "url": url})
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Render or publish the AdminWeeklyReport carousel.")
    parser.add_argument("--snapshot", type=Path, help="Use a local snapshot JSON instead of Supabase.")
    parser.add_argument("--week-start", help="Monday date (YYYY-MM-DD); defaults to last completed week.")
    parser.add_argument("--output-dir", type=Path, default=Path("output/weekly-report"))
    parser.add_argument("--publish", action="store_true", help="Publish the rendered carousel.")
    args = parser.parse_args()

    if args.snapshot:
        snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    else:
        week_start = args.week_start or completed_week_start().isoformat()
        snapshot = fetch_snapshot(
            os.getenv("WEEKLY_REPORT_SNAPSHOT_ENDPOINT", ""),
            os.getenv("AI_KPI_SECRET", ""),
            week_start,
        )

    result = run_weekly_report(snapshot, args.output_dir, publish=args.publish)
    report_path = args.output_dir / "result.json"
    report_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(report_path)


if __name__ == "__main__":
    main()
