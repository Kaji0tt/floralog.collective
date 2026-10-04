import argparse
import random
import re
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from floralog_ai.schemas import ContentPillar, ContentSnapshot, Platform, SocialPostDraft
from floralog_ai.schemas.reach import (
    CommunityTotals,
    PlantHighlight,
    QuestHighlight,
    ScanOfTheWeekHighlight,
)

INSTAGRAM_SIZE = (1080, 1350)
PINTEREST_SIZE = (1000, 1500)
MAX_INSTAGRAM_SLIDES = 5
ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
BACKGROUND_OVERRIDE = ASSETS_DIR / "season2_background.png"

CREAM = (253, 246, 236)
MINT = (220, 238, 222)
FOREST = (31, 77, 58)
LEAF = (63, 143, 91)
AMBER = (224, 163, 59)
INK = (36, 59, 47)
MUTED = (95, 111, 100)
PANEL = (255, 252, 246, 225)

_UNRENDERABLE = re.compile(r"[\U00002600-\U0010FFFF]")
_FONT_NAMES = {
    True: ("Inter-Bold.ttf", "Inter-Bold.otf", "DejaVuSans-Bold.ttf", "arialbd.ttf"),
    False: ("Inter-Regular.ttf", "Inter-Regular.otf", "DejaVuSans.ttf", "arial.ttf"),
}


@lru_cache(maxsize=32)
def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for name in _FONT_NAMES[bold]:
        for candidate in (ASSETS_DIR / "fonts" / name, name):
            try:
                return ImageFont.truetype(str(candidate), size)
            except OSError:
                continue
    return ImageFont.load_default(size)


def _clean(text: str) -> str:
    return " ".join(_UNRENDERABLE.sub("", text).split())


def draw_season2_background(size: tuple[int, int]) -> Image.Image:
    """Season 2 look: cream-to-mint gradient, map contour lines, claimed area tiles, leaves."""
    width, height = size
    rng = random.Random(2)
    image = Image.new("RGB", size, CREAM)
    pixels = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / height
        color = tuple(round(c + (m - c) * ratio) for c, m in zip(CREAM, MINT, strict=True))
        pixels.line([(0, y), (width, y)], fill=color)

    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for center_x, center_y in ((-0.1, 0.15), (1.1, 0.85)):
        cx, cy = center_x * width, center_y * height
        for ring in range(1, 14):
            radius = ring * width * 0.075
            wobble = rng.uniform(0.9, 1.1)
            draw.ellipse(
                (cx - radius * wobble, cy - radius, cx + radius * wobble, cy + radius),
                outline=(*LEAF, 26),
                width=3,
            )

    tile = width // 12
    for row in range(8, 12):
        for col in range(6, 12):
            x, y = col * tile, row * tile + height - 12 * tile
            claimed = rng.random() < 0.25
            draw.rounded_rectangle(
                (x + 4, y + 4, x + tile - 4, y + tile - 4),
                radius=10,
                fill=(*LEAF, 34) if claimed else None,
                outline=(*FOREST, 22),
                width=2,
            )

    for base_x, base_y, direction in ((-0.03, 0.3, 1), (0.95, 0.62, -1)):
        for index in range(5):
            leaf_width = width * rng.uniform(0.07, 0.11)
            leaf_height = leaf_width * 0.42
            x = base_x * width + direction * index * leaf_width * 0.55
            y = base_y * height + direction * index * leaf_height * 0.7
            leaf = Image.new("RGBA", (int(leaf_width), int(leaf_height)), (0, 0, 0, 0))
            ImageDraw.Draw(leaf).ellipse(
                (0, 0, leaf_width - 1, leaf_height - 1), fill=(*(FOREST if index % 2 else LEAF), 70)
            )
            leaf = leaf.rotate(rng.uniform(-40, 40) + (180 if direction < 0 else 0), expand=True)
            overlay.alpha_composite(leaf, (int(x), int(y)))

    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def background(size: tuple[int, int]) -> Image.Image:
    if BACKGROUND_OVERRIDE.exists():
        with Image.open(BACKGROUND_OVERRIDE) as custom:
            return ImageOps.fit(custom.convert("RGB"), size)
    return draw_season2_background(size)


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int, max_lines: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in _clean(text).split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) == max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and " ".join(lines) != _clean(text):
        lines[-1] = lines[-1].rstrip(".,;: ") + " …"
    return lines


class _Slide:
    def __init__(self, size: tuple[int, int], week_key: str):
        self.size = size
        self.width, self.height = size
        self.scale = self.width / 1080
        self.image = background(size).convert("RGBA")
        panel = Image.new("RGBA", size, (0, 0, 0, 0))
        margin = int(64 * self.scale)
        ImageDraw.Draw(panel).rounded_rectangle(
            (margin, int(170 * self.scale), self.width - margin, self.height - int(150 * self.scale)),
            radius=int(48 * self.scale),
            fill=PANEL,
        )
        self.image.alpha_composite(panel)
        self.draw = ImageDraw.Draw(self.image)
        self.left = margin + int(56 * self.scale)
        self.max_width = self.width - 2 * self.left
        self.y = int(240 * self.scale)
        self._header()
        self._footer(week_key)

    def px(self, value: float) -> int:
        return int(value * self.scale)

    def _header(self) -> None:
        self.draw.text(
            (self.px(80), self.px(70)), "FLORALOG", font=load_font(self.px(44), True), fill=FOREST
        )
        badge_font = load_font(self.px(30), True)
        label = "SEASON 2"
        badge_width = self.draw.textlength(label, font=badge_font) + self.px(48)
        x1 = self.width - self.px(80)
        self.draw.rounded_rectangle(
            (x1 - badge_width, self.px(66), x1, self.px(122)), radius=self.px(28), fill=AMBER
        )
        self.draw.text((x1 - badge_width + self.px(24), self.px(76)), label, font=badge_font, fill="white")

    def _footer(self, week_key: str) -> None:
        font = load_font(self.px(30))
        self.draw.text(
            (self.px(80), self.height - self.px(100)),
            "floralog.de  ·  Spielerisch entdecken",
            font=font,
            fill=MUTED,
        )
        width = self.draw.textlength(week_key, font=font)
        self.draw.text(
            (self.width - self.px(80) - width, self.height - self.px(100)), week_key, font=font, fill=MUTED
        )

    def label(self, text: str) -> None:
        self.draw.text((self.left, self.y), _clean(text).upper(), font=load_font(self.px(32), True), fill=LEAF)
        self.y += self.px(64)

    def title(self, text: str, size: int = 86, max_lines: int = 3) -> None:
        font = load_font(self.px(size), True)
        for line in _wrap(self.draw, text, font, self.max_width, max_lines):
            self.draw.text((self.left, self.y), line, font=font, fill=INK)
            self.y += int(font.size * 1.15)
        self.y += self.px(24)

    def body(self, text: str, size: int = 40, max_lines: int = 8, color=INK) -> None:
        font = load_font(self.px(size))
        for line in _wrap(self.draw, text, font, self.max_width, max_lines):
            self.draw.text((self.left, self.y), line, font=font, fill=color)
            self.y += int(font.size * 1.35)
        self.y += self.px(20)

    def stat(self, value: str, caption: str) -> None:
        self.draw.text((self.left, self.y), value, font=load_font(self.px(96), True), fill=FOREST)
        self.draw.text(
            (self.left, self.y + self.px(110)), caption, font=load_font(self.px(36)), fill=MUTED
        )
        self.y += self.px(190)

    def cta(self, text: str) -> None:
        font = load_font(self.px(38), True)
        width = self.draw.textlength(text, font=font) + self.px(72)
        bottom = self.height - self.px(200)
        self.draw.rounded_rectangle(
            (self.left, bottom - self.px(84), self.left + width, bottom),
            radius=self.px(42),
            fill=FOREST,
        )
        self.draw.text((self.left + self.px(36), bottom - self.px(66)), text, font=font, fill="white")

    def result(self) -> Image.Image:
        return self.image.convert("RGB")


def render_cover(headline: str, text: str, size: tuple[int, int], week_key: str) -> Image.Image:
    slide = _Slide(size, week_key)
    slide.label("Neu in Floralog")
    slide.title(headline, size=92, max_lines=4)
    slide.body(text, max_lines=9 if size[1] > 1400 else 5)
    slide.cta("Jetzt mitspielen auf floralog.de")
    return slide.result()


def render_plant(plant: PlantHighlight, size: tuple[int, int], week_key: str) -> Image.Image:
    slide = _Slide(size, week_key)
    slide.label("Meistentdeckt diese Woche")
    slide.title(plant.species_name)
    if plant.scientific_name:
        slide.body(plant.scientific_name, size=38, color=MUTED)
    slide.stat(str(plant.scan_count_7d), "Scans in den letzten 7 Tagen")
    if plant.fun_fact:
        slide.body(plant.fun_fact, max_lines=6)
    return slide.result()


def render_community(community: CommunityTotals, size: tuple[int, int], week_key: str) -> Image.Image:
    slide = _Slide(size, week_key)
    slide.label("Community-Woche")
    slide.title("Gemeinsam unterwegs", size=72)
    slide.stat(str(community.scans_7d), "Scans")
    slide.stat(str(community.distinct_species_7d), "verschiedene Arten")
    slide.stat(str(community.active_explorers_7d), "aktive Entdecker:innen")
    return slide.result()


def render_sotw(sotw: ScanOfTheWeekHighlight, size: tuple[int, int], week_key: str) -> Image.Image:
    slide = _Slide(size, week_key)
    slide.label("Wochenliebling" if sotw.source == "scheduler" else "Scan der Woche")
    slide.title(sotw.species_name)
    if sotw.like_count:
        slide.stat(str(sotw.like_count), "Likes aus der Community")
    slide.body("Jede Woche wählt die Community ihren liebsten Scan.", color=MUTED)
    return slide.result()


def render_quest(quest: QuestHighlight, size: tuple[int, int], week_key: str) -> Image.Image:
    slide = _Slide(size, week_key)
    slide.label("Aktuelle Quest")
    slide.title(quest.title or "Neue Quest")
    if quest.description:
        slide.body(quest.description)
    slide.body("Mach mit und sammle Pflanzen in deiner Umgebung.", color=MUTED)
    return slide.result()


def _data_slides(content: ContentSnapshot, size: tuple[int, int]) -> dict[ContentPillar, Image.Image]:
    week = content.week_key
    slides: dict[ContentPillar, Image.Image] = {
        ContentPillar.COMMUNITY_MILESTONE: render_community(content.community, size, week)
    }
    if content.top_plants_7d:
        plant_slide = render_plant(content.top_plants_7d[0], size, week)
        slides[ContentPillar.PLANT_SPOTLIGHT] = plant_slide
        slides[ContentPillar.FUN_FACT] = plant_slide
    if content.scan_of_the_week:
        slides[ContentPillar.SCAN_OF_THE_WEEK] = render_sotw(content.scan_of_the_week, size, week)
    quest = content.weekly_quest or content.monthly_quest
    if quest and quest.title:
        slides[ContentPillar.QUEST_INVITE] = render_quest(quest, size, week)
    return slides


def build_slides(draft: SocialPostDraft, content: ContentSnapshot) -> list[Image.Image]:
    size = PINTEREST_SIZE if draft.platform is Platform.PINTEREST else INSTAGRAM_SIZE
    cover = render_cover(draft.headline or "Floralog", draft.text, size, content.week_key)
    if draft.platform is not Platform.INSTAGRAM:
        return [cover]

    data = _data_slides(content, size)
    ordered = [data.pop(draft.pillar)] if draft.pillar in data else []
    seen = {id(image) for image in ordered}
    for image in data.values():
        if id(image) not in seen:
            ordered.append(image)
            seen.add(id(image))
    return [cover, *ordered][:MAX_INSTAGRAM_SLIDES]


def to_jpeg(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=90, optimize=True)
    return buffer.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the Season 2 social background.")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, size in (("instagram", INSTAGRAM_SIZE), ("pinterest", PINTEREST_SIZE)):
        path = args.output_dir / f"season2_social_{name}_{size[0]}x{size[1]}.png"
        draw_season2_background(size).save(path)
        print(path)


if __name__ == "__main__":
    main()
