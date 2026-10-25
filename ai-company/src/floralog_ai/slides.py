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
from floralog_ai.social.remote_image import load_public_image

INSTAGRAM_SIZE = (1080, 1350)
PINTEREST_SIZE = (1000, 1500)
MAX_INSTAGRAM_SLIDES = 5
ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
WEEKLY_REPORT_DECORATIONS_DIR = Path(__file__).resolve().parents[2]
BACKGROUND_OVERRIDE = ASSETS_DIR / "season2_background.png"

CREAM = (253, 246, 236)
MINT = (220, 238, 222)
FOREST = (31, 77, 58)
LEAF = (63, 143, 91)
AMBER = (224, 163, 59)
INK = (36, 59, 47)
MUTED = (95, 111, 100)
PANEL = (255, 252, 246, 225)
NIGHT_FOREST = (5, 30, 25)
NIGHT_FOREST_LIGHT = (10, 45, 36)
GOLD = (238, 197, 120)
GOLD_LIGHT = (250, 222, 164)
NIGHT_TEXT = (245, 241, 224)
NIGHT_MUTED = (183, 193, 174)

_UNRENDERABLE = re.compile(r"[\U00002600-\U0010FFFF]")
_HEX_COLOR = re.compile(r"^#?[0-9a-fA-F]{6}$")
AVATAR_OVERSCALE = 1.5
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


def _draw_admin_report_background(size: tuple[int, int], variant: int) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, NIGHT_FOREST)
    pixels = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / height
        color = tuple(
            round(dark + (light - dark) * ratio)
            for dark, light in zip(NIGHT_FOREST, NIGHT_FOREST_LIGHT, strict=True)
        )
        pixels.line([(0, y), (width, y)], fill=color)

    assets = [WEEKLY_REPORT_DECORATIONS_DIR / f"herbst{index}.png" for index in range(1, 4)]
    asset_path = assets[variant % len(assets)]
    if not asset_path.is_file():
        raise FileNotFoundError(f"Weekly report decoration is missing: {asset_path}")
    with Image.open(asset_path) as source:
        plant = ImageOps.contain(source.convert("RGBA"), (width // 4, height // 3))
    alpha = plant.getchannel("A").point(lambda value: value * 3 // 4)
    plant.putalpha(alpha)

    canvas = image.convert("RGBA")
    positions = (
        (width - plant.width + width // 24, -height // 24),
        (-plant.width + width // 16, height - plant.height + height // 18),
    )
    for position in positions:
        canvas.alpha_composite(plant, position)
    return canvas.convert("RGB")


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


def _overscale_avatar_asset(asset: Image.Image, size: int) -> Image.Image:
    fitted = ImageOps.contain(asset.convert("RGBA"), (size, size))
    scaled = fitted.resize(
        (round(fitted.width * AVATAR_OVERSCALE), round(fitted.height * AVATAR_OVERSCALE)),
        Image.Resampling.LANCZOS,
    )
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return layer


def _tint_border_asset(asset: Image.Image, border_color: object) -> Image.Image:
    if not isinstance(border_color, str) or not _HEX_COLOR.fullmatch(border_color.strip()):
        return asset.convert("RGBA")
    color = border_color.strip().lstrip("#")
    rgb = tuple(int(color[index:index + 2], 16) for index in (0, 2, 4))
    alpha = asset.convert("RGBA").getchannel("A")
    tinted = Image.new("RGBA", asset.size, (*rgb, 0))
    tinted.putalpha(alpha)
    return tinted


class _Slide:
    def __init__(
        self,
        size: tuple[int, int],
        week_key: str,
        background_image: Image.Image | None = None,
        dark_theme: bool = False,
        autumn_variant: int = 0,
    ):
        self.size = size
        self.width, self.height = size
        self.scale = self.width / 1080
        self.dark_theme = dark_theme
        has_background_image = background_image is not None
        self.image = (
            _draw_admin_report_background(size, autumn_variant) if dark_theme else background(size)
        ).convert("RGBA")
        if background_image is not None:
            photo = ImageOps.fit(background_image.convert("RGB"), size).convert("RGBA")
            self.image = Image.blend(self.image, photo, 0.92 if dark_theme else 0.42)
        panel = Image.new("RGBA", size, (0, 0, 0, 0))
        margin = int(64 * self.scale)
        panel_draw = ImageDraw.Draw(panel)
        panel_fill = (5, 30, 25, 145 if has_background_image else 222) if dark_theme else PANEL
        panel_draw.rounded_rectangle(
            (margin, int(170 * self.scale), self.width - margin, self.height - int(150 * self.scale)),
            radius=int(48 * self.scale),
            fill=panel_fill,
            outline=(GOLD[0], GOLD[1], GOLD[2], 90) if dark_theme else None,
            width=max(2, self.px(2)) if dark_theme else 1,
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
        brand = NIGHT_TEXT if self.dark_theme else FOREST
        self.draw.text(
            (self.px(80), self.px(70)), "FLORALOG", font=load_font(self.px(44), True), fill=brand
        )
        if self.dark_theme:
            self.draw.line(
                (self.px(80), self.px(132), self.px(335), self.px(132)),
                fill=GOLD,
                width=max(2, self.px(2)),
            )
            return
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
        color = GOLD if self.dark_theme else MUTED
        self.draw.text(
            (self.px(80), self.height - self.px(100)),
            "floralog.de  ·  Spielerisch entdecken",
            font=font,
            fill=color,
        )
        width = self.draw.textlength(week_key, font=font)
        self.draw.text(
            (self.width - self.px(80) - width, self.height - self.px(100)),
            week_key,
            font=font,
            fill=color,
        )

    def label(self, text: str) -> None:
        color = GOLD if self.dark_theme else LEAF
        self.draw.text((self.left, self.y), _clean(text).upper(),
                       font=load_font(self.px(32), True), fill=color)
        self.y += self.px(64)

    def title(self, text: str, size: int = 86, max_lines: int = 3) -> None:
        font = load_font(self.px(size), True)
        color = GOLD_LIGHT if self.dark_theme else INK
        for line in _wrap(self.draw, text, font, self.max_width, max_lines):
            self.draw.text((self.left, self.y), line, font=font, fill=color)
            self.y += int(font.size * 1.15)
        self.y += self.px(24)

    def body(self, text: str, size: int = 40, max_lines: int = 8, color=INK) -> None:
        font = load_font(self.px(size))
        if self.dark_theme and color == INK:
            color = NIGHT_TEXT
        elif self.dark_theme and color == MUTED:
            color = NIGHT_MUTED
        for line in _wrap(self.draw, text, font, self.max_width, max_lines):
            self.draw.text((self.left, self.y), line, font=font, fill=color)
            self.y += int(font.size * 1.35)
        self.y += self.px(20)

    def stat(self, value: str, caption: str) -> None:
        value_color = GOLD_LIGHT if self.dark_theme else FOREST
        caption_color = NIGHT_MUTED if self.dark_theme else MUTED
        self.draw.text((self.left, self.y), value, font=load_font(self.px(96), True), fill=value_color)
        self.draw.text(
            (self.left, self.y + self.px(110)),
            caption,
            font=load_font(self.px(36)),
            fill=caption_color,
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


def render_admin_weekly_report(stats: dict) -> list[Image.Image]:
    """Render the four weekly-report cards from the admin report's aggregate snapshot."""
    from datetime import date

    start = date.fromisoformat(str(stats["week_start"])[:10])
    end = date.fromisoformat(str(stats["week_end"])[:10])
    end = date.fromordinal(end.toordinal() - 1)
    week_key = f"{start:%d.%m.}–{end:%d.%m.%Y}"
    next_variant = 0

    def create_slide(label: str, title: str) -> _Slide:
        nonlocal next_variant
        slide = _Slide(INSTAGRAM_SIZE, week_key, dark_theme=True, autumn_variant=next_variant)
        next_variant += 1
        slide.label(label)
        slide.title(title, size=70, max_lines=2)
        return slide

    def draw_rows(slide: _Slide, rows: list[tuple[str, str]], *, start_y: int | None = None) -> None:
        font = load_font(slide.px(35))
        value_font = load_font(slide.px(40), True)
        y = slide.y if start_y is None else slide.px(start_y)
        for label, value in rows:
            height = slide.px(112)
            slide.draw.rounded_rectangle(
                (slide.left, y, slide.width - slide.left, y + height),
                radius=slide.px(24),
                fill=(9, 43, 35, 230),
                outline=(*GOLD, 105),
                width=max(2, slide.px(2)),
            )
            slide.draw.text(
                (slide.left + slide.px(28), y + slide.px(34)),
                label,
                font=font,
                fill=NIGHT_MUTED,
            )
            value_width = slide.draw.textlength(value, font=value_font)
            slide.draw.text(
                (slide.width - slide.left - slide.px(28) - value_width, y + slide.px(28)),
                value,
                font=value_font,
                fill=GOLD_LIGHT,
            )
            y += height + slide.px(18)

    def draw_avatar(
        slide: _Slide,
        avatar: dict | None,
        x: int,
        y: int,
        size: int,
    ) -> bool:
        size_px = slide.px(size)
        layer = Image.new("RGBA", (size_px, size_px), (0, 0, 0, 0))
        has_asset = False
        if avatar:
            status = str(avatar.get("status") or "asset_unavailable")
            for asset_type in ("plant", "border", "face"):
                url = avatar.get(asset_type)
                if not url:
                    continue
                asset = load_public_image(str(url), f"{asset_type} avatar asset")
                if asset is None:
                    continue
                if asset_type == "border":
                    asset = _tint_border_asset(asset, avatar.get("border_color"))
                fitted = _overscale_avatar_asset(asset, size_px)
                layer.alpha_composite(fitted)
                has_asset = True
            if not has_asset:
                print(f"[weekly-report] Avatar unavailable ({status}); hiding avatar slot.")
        else:
            print("[weekly-report] Avatar unavailable (profile not public or missing); hiding avatar slot.")
        if not has_asset:
            return False
        mask = Image.new("L", (size_px, size_px), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size_px - 1, size_px - 1), fill=255)
        layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", layer.size, 0), mask))
        slide.image.alpha_composite(layer, (x, y))
        return True

    def number(value: object) -> str:
        return f"{int(value or 0):,}".replace(",", ".")

    first = create_slide("Samen & Spieler", "Gemeinsam gesammelt")
    first.stat(number(stats.get("seeds_earned")), "Samen verdient")
    draw_rows(first, [
        ("Aktive SpielerInnen", number(stats.get("unique_scanners"))),
        ("Neue SpielerInnen", number(stats.get("new_players"))),
    ])

    second = create_slide("Rangliste", "Top 5 Samen")
    leaderboard = stats.get("leaderboard") or []
    if leaderboard:
        font = load_font(second.px(35))
        value_font = load_font(second.px(40), True)
        y = second.y
        for index, item in enumerate(leaderboard[:5], start=1):
            height = second.px(132)
            second.draw.rounded_rectangle(
                (second.left, y, second.width - second.left, y + height),
                radius=second.px(24),
                fill=(9, 43, 35, 230),
                outline=(*GOLD, 105),
                width=max(2, second.px(2)),
            )
            avatar_x = second.left + second.px(12)
            avatar_y = y + (height - second.px(100)) // 2
            name = str(item.get("name") or "Entdecker:in")
            name_status = str(item.get("name_status") or "")
            if name_status and name_status != "available":
                print(f"[weekly-report] Leaderboard rank {index} name status: {name_status}.")
            has_avatar = draw_avatar(second, item.get("avatar"), avatar_x, avatar_y, 100)
            text_x = avatar_x + second.px(118) if has_avatar else second.left + second.px(20)
            second.draw.text(
                (text_x, y + second.px(42)),
                f"{index}. {name[:20]}",
                font=font,
                fill=NIGHT_TEXT,
            )
            value = number(item.get("weekly_seed_total"))
            value_width = second.draw.textlength(value, font=value_font)
            second.draw.text(
                (second.width - second.left - second.px(24) - value_width, y + second.px(40)),
                value,
                font=value_font,
                fill=GOLD_LIGHT,
            )
            y += height + second.px(12)
    else:
        second.body("Noch keine Daten für diese Woche.")

    third = create_slide("Scan-Statistiken", "Diese Woche in Zahlen")
    report_rows = [
        ("Scans gesamt", number(stats.get("total_scans"))),
        ("Verschiedene Arten", number(stats.get("distinct_species"))),
        ("Selten oder seltener", number(stats.get("rare_scans"))),
    ]
    report_rows.append(("Geozonen erschlossen", number(stats.get("zones_completed"))))
    if stats.get("quest_plant_label"):
        report_rows.append((str(stats["quest_plant_label"])[:24],
                            f"{number(stats.get('quest_finds'))}×"))
    draw_rows(third, report_rows)

    fourth = create_slide("Scan der Woche", "Community-Liebling")
    top_scan = stats.get("top_scan")
    if top_scan:
        if top_scan.get("name_status") and top_scan["name_status"] != "available":
            print(f"[weekly-report] Scan owner name status: {top_scan['name_status']}.")
        photo = load_public_image(str(top_scan["image_url"]), "scan photo") \
            if top_scan.get("image_url") else None
        if not top_scan.get("image_url"):
            print(
                "[weekly-report] Scan photo unavailable "
                f"({top_scan.get('image_status') or 'image_url_missing'})."
            )
        if photo is not None:
            photo_width = fourth.width - 2 * fourth.left
            photo_height = fourth.px(410)
            photo_x = fourth.left
            photo_y = fourth.y + fourth.px(8)
            fitted_photo = ImageOps.fit(photo.convert("RGB"), (photo_width, photo_height))
            photo_mask = Image.new("L", fitted_photo.size, 0)
            ImageDraw.Draw(photo_mask).rounded_rectangle(
                (0, 0, photo_width - 1, photo_height - 1),
                radius=fourth.px(28),
                fill=255,
            )
            fourth.image.paste(fitted_photo, (photo_x, photo_y), photo_mask)
            fourth.draw.rounded_rectangle(
                (photo_x, photo_y, photo_x + photo_width, photo_y + photo_height),
                radius=fourth.px(28),
                outline=(*GOLD, 180),
                width=max(2, fourth.px(2)),
            )
            fourth.y = photo_y + photo_height + fourth.px(28)

        species_name = str(top_scan.get("species_name") or "Unbekannte Art")
        species_font = load_font(fourth.px(48), True)
        species_lines = _wrap(fourth.draw, species_name, species_font, fourth.max_width, 2)
        for line in species_lines:
            fourth.draw.text((fourth.left, fourth.y), line, font=species_font, fill=GOLD_LIGHT)
            fourth.y += int(species_font.size * 1.12)
        fourth.y += fourth.px(8)

        metadata_font = load_font(fourth.px(30), True)
        rarity = str(top_scan.get("rarity") or "").strip()
        if rarity:
            fourth.draw.text(
                (fourth.left, fourth.y),
                rarity.upper(),
                font=metadata_font,
                fill=NIGHT_MUTED,
            )
        likes_text = f"{number(top_scan.get('like_count'))} LIKES"
        likes_width = fourth.draw.textlength(likes_text, font=metadata_font)
        fourth.draw.text(
            (fourth.width - fourth.left - likes_width, fourth.y),
            likes_text,
            font=metadata_font,
            fill=GOLD,
        )
        fourth.y += fourth.px(48)

        display_name = str(top_scan.get("display_name") or "Entdecker:in")
        owner_avatar_x = fourth.left
        has_avatar = draw_avatar(
            fourth,
            top_scan.get("avatar"),
            owner_avatar_x,
            fourth.y,
            72,
        )
        owner_text_x = owner_avatar_x + fourth.px(92) if has_avatar else owner_avatar_x
        fourth.draw.text(
            (owner_text_x, fourth.y + fourth.px(18)),
            display_name,
            font=load_font(fourth.px(34), True),
            fill=NIGHT_TEXT,
        )
    else:
        fourth.body("Noch kein Scan mit Likes diese Woche.")

    return [first.result(), second.result(), third.result(), fourth.result()]


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
