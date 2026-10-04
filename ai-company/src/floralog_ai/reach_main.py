import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path

from floralog_ai.flows import ReachFlow
from floralog_ai.http_client import ApiError
from floralog_ai.schemas import (
    IMAGE_PLATFORMS,
    ContentSnapshot,
    Platform,
    PublishResult,
    PublishStatus,
    ReachReport,
    SocialHistory,
)
from floralog_ai.slides import build_slides, to_jpeg
from floralog_ai.social import (
    MediaUploader,
    SocialClient,
    build_clients_from_env,
    collect_history,
    compose_post,
)

POSTING_FLAG = "FLORALOG_REACH_POSTING_ENABLED"


def publish_approved(
    report: ReachReport,
    content: ContentSnapshot,
    clients: dict[Platform, SocialClient],
    uploader: MediaUploader | None,
    posting_enabled: bool,
    media_dir: Path,
) -> ReachReport:
    results: list[PublishResult] = []
    for draft, result in zip(report.plan.posts, report.results, strict=True):
        if result.status is not PublishStatus.APPROVED:
            results.append(result)
            continue

        jpegs: list[bytes] = []
        media_files: list[str] = []
        if draft.platform in IMAGE_PLATFORMS:
            media_dir.mkdir(parents=True, exist_ok=True)
            for index, slide in enumerate(build_slides(draft, content), start=1):
                jpeg = to_jpeg(slide)
                path = media_dir / f"{draft.platform.value}_{index}.jpg"
                path.write_bytes(jpeg)
                jpegs.append(jpeg)
                media_files.append(path.as_posix())
        result = result.model_copy(update={"media_files": media_files})

        if not posting_enabled:
            results.append(
                result.model_copy(
                    update={"status": PublishStatus.DRY_RUN, "reason": "posting disabled"}
                )
            )
            continue
        try:
            if jpegs and uploader is None:
                raise ApiError("AI_MEDIA_UPLOAD_ENDPOINT is not configured.")
            media_urls = [uploader.upload(jpeg) for jpeg in jpegs] if jpegs else []
            _, url = clients[draft.platform].publish(compose_post(draft), media_urls)
            results.append(result.model_copy(update={"status": PublishStatus.PUBLISHED, "url": url}))
        except ApiError as error:
            results.append(
                result.model_copy(update={"status": PublishStatus.FAILED, "reason": str(error)})
            )
    return report.model_copy(update={"results": results, "posting_enabled": posting_enabled})


def render_summary(report: ReachReport) -> str:
    lines = [
        "# Floralog Reach Agent",
        "",
        f"**Stand:** {report.generated_at:%Y-%m-%d %H:%M} UTC  ",
        f"**Posting aktiv:** {'ja' if report.posting_enabled else 'nein'}  ",
        f"**Agentenbudget verbraucht:** {report.current_monthly_agent_cost_eur:.2f} EUR",
        "",
        "## Performance (14 Tage)",
        "",
        "| Plattform | Follower | Posts | Ø Engagement | Ø Reichweite | Bester Post |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
        *[
            f"| {item.platform.value} | {item.followers} | {item.posts_last_14d} | "
            f"{item.average_engagement_14d:.2f} | "
            f"{'-' if item.average_reach_14d is None else f'{item.average_reach_14d:.0f}'} | "
            f"{item.best_post_engagement} |"
            for item in report.performance
        ],
        "",
        "## Auswertung",
        "",
        report.plan.performance_summary,
        "",
        *[f"- {learning}" for learning in report.plan.learnings],
        "",
        f"**Nächstes Experiment:** {report.plan.next_experiment}",
        "",
        "## Posts",
        "",
    ]
    if not report.results:
        lines.append("_Der Agent hat in diesem Lauf bewusst nichts gepostet._")
    for draft, result in zip(report.plan.posts, report.results, strict=True):
        lines.extend(
            [
                f"### {result.platform.value} · {result.pillar.value} · `{result.status.value}`",
                "",
                *([f"**Headline:** {draft.headline}", ""] if draft.headline else []),
                *[f"> {line}" for line in result.text.splitlines()],
                "",
                f"**Begründung:** {draft.rationale}",
            ]
        )
        if result.media_files:
            lines.append(f"**Slides:** {len(result.media_files)} (siehe Artefakt `media/`)")
        if result.url:
            lines.append(f"**Link:** {result.url}")
        if result.reason:
            lines.append(f"**Hinweis:** {result.reason}")
        lines.append("")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Floralog reach agent.")
    parser.add_argument("--content-snapshot", type=Path, required=True)
    parser.add_argument("--history", type=Path, help="Social history fixture (skips live fetch).")
    parser.add_argument("--output", type=Path, default=Path("output/reach-report.json"))
    parser.add_argument("--summary", type=Path, default=Path("output/reach-report.md"))
    parser.add_argument("--live", action="store_true", help="Use OpenAI and real social accounts.")
    parser.add_argument("--publish", action="store_true", help="Publish approved posts.")
    parser.add_argument("--monthly-cost", type=float, default=0)
    args = parser.parse_args()

    content = ContentSnapshot.model_validate_json(args.content_snapshot.read_text(encoding="utf-8"))
    clients = build_clients_from_env() if args.live else {}
    uploader = MediaUploader.from_env() if args.live else None
    if args.live and uploader is None:
        for platform in IMAGE_PLATFORMS & clients.keys():
            print(f"[reach] {platform.value} disabled: AI_MEDIA_UPLOAD_ENDPOINT is not configured.")
            del clients[platform]

    if args.history:
        history = SocialHistory.model_validate_json(args.history.read_text(encoding="utf-8"))
    elif clients:
        history = collect_history(clients)
    else:
        history = SocialHistory(collected_at=datetime.now(UTC))

    platforms = list(clients) if args.live else list(Platform)
    report = ReachReport.model_validate(
        ReachFlow().kickoff(
            inputs={
                "content": content,
                "history": history,
                "platforms": platforms,
                "dry_run": not args.live,
                "current_monthly_agent_cost_eur": args.monthly_cost,
            }
        )
    )

    posting_enabled = (
        args.live and args.publish and os.getenv(POSTING_FLAG, "").strip().lower() == "true"
    )
    report = publish_approved(
        report, content, clients, uploader, posting_enabled, args.output.parent / "media"
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(render_summary(report), encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
