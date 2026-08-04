from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "steam-store" / "p0-v3"
CAPSULE_OUT = OUT / "capsules"
SHOT_OUT = OUT / "screenshots" / "zh"
QA_OUT = OUT / "qa"
BG_DIR = OUT / "backgrounds"
ICONS = ROOT / "assets" / "steam-icons"
LOGO = ROOT / "assets" / "steam-store" / "library_logo.png"
ZH_SHOTS = ROOT / "assets" / "steam-store" / "screenshots" / "zh"
FACTORY = ROOT / "assets" / "steam-store" / "screenshots" / "factory"
FONT_PATH = Path(r"C:\Windows\Fonts\msyh.ttc")

DESKTOP_BACKGROUNDS = [
    BG_DIR / "desktop_twilight.png",
    BG_DIR / "desktop_morning.png",
    BG_DIR / "desktop_rainy_night.png",
    BG_DIR / "desktop_daylight.png",
]

SPECIES_TIERS = [
    ["guluduck", "emberfox", "voltmouse", "bubblefrog", "sproutcap", "frostpeng"],
    [
        "weldbug", "voltquill", "aurowl", "zapbun", "voltmare", "chilizard",
        "onsenmonk", "waxlamb", "steamalotl", "pinefawn", "potturtle", "lilyfrog",
        "snowcub", "icejelly", "sudsotter",
    ],
    [
        "pyrepeacock", "stormdrake", "rockrooster", "boilshrimp", "glowhum",
        "windmole", "glowfly", "waddleskate", "frostangler", "maildove",
        "seasonleon", "toastybara", "bobamingo", "lattegolem", "saunapuff",
        "ramencoon", "yarncat", "terrasnail", "scaresprout", "bowlrus",
    ],
    [
        "lanternloong", "discobloom", "juicepitcher", "mochipop", "meteoropus",
        "grillgator", "chimebell", "frostclione", "mistyox", "subhermit",
        "teapir", "brewbat", "porkchef", "spadolphin", "snowbonsai",
    ],
    ["liondance", "manacorn", "queenbuzz", "gargoylite", "crystalwing", "claypango"],
    ["prismkirin"],
]


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def alpha_crop(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"No visible pixels in {path}")
    return image.crop(bbox)


def contain(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = min(width / image.width, height / image.height)
    return image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )


def cover(image: Image.Image, width: int, height: int, focus_x: float = 0.5) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    left = round(max(0, resized.width - width) * max(0.0, min(1.0, focus_x)))
    top = max(0, (resized.height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def paste_center(base: Image.Image, layer: Image.Image, x: int, y: int) -> None:
    base.alpha_composite(layer, (round(x - layer.width / 2), round(y - layer.height / 2)))


def paste_shadowed(base: Image.Image, layer: Image.Image, x: int, y: int, blur: int = 15) -> None:
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    alpha = layer.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
    shadow.putalpha(alpha.point(lambda p: round(p * 0.48)))
    shadow.paste((4, 12, 30, 255), (0, 0, shadow.width, shadow.height), shadow)
    base.alpha_composite(shadow, (x + 8, y + 14))
    base.alpha_composite(layer, (x, y))


def glow(size: tuple[int, int], center: tuple[int, int], radius: int, color=(255, 215, 92, 130)) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(max(12, radius // 3)))


def pet(name: str, width: int, height: int) -> Image.Image:
    return contain(alpha_crop(ICONS / f"{name}.png"), width, height)


def add_pet_cluster(base: Image.Image, placements: Iterable[tuple[str, float, float, float]]) -> None:
    width, height = base.size
    for name, px, py, scale in placements:
        layer = pet(name, round(height * scale), round(height * scale))
        x = round(width * px - layer.width / 2)
        y = round(height * py - layer.height / 2)
        paste_shadowed(base, layer, x, y, max(6, round(height * 0.018)))


def make_capsule(name: str, size: tuple[int, int], vertical: bool = False, small: bool = False) -> None:
    width, height = size
    bg = Image.open(BG_DIR / "capsule_continuous.png").convert("RGBA")
    canvas = cover(bg, width, height, 0.53 if vertical else 0.5)
    canvas.alpha_composite(glow(size, (round(width * 0.54), round(height * 0.56)), round(height * 0.34)))

    logo = contain(alpha_crop(LOGO), round(width * (0.58 if not small else 0.48)), round(height * 0.30))
    if vertical:
        paste_center(canvas, logo, round(width * 0.50), round(height * 0.22))
        placements = [
            ("lanternloong", 0.52, 0.49, 0.28),
            ("emberfox", 0.26, 0.62, 0.22),
            ("bubblefrog", 0.75, 0.62, 0.22),
            ("guluduck", 0.50, 0.75, 0.27),
            ("sproutcap", 0.22, 0.82, 0.19),
            ("prismkirin", 0.79, 0.82, 0.20),
        ]
    elif small:
        paste_center(canvas, logo, round(width * 0.30), round(height * 0.44))
        placements = [
            ("guluduck", 0.67, 0.60, 0.55),
            ("emberfox", 0.82, 0.59, 0.44),
            ("bubblefrog", 0.93, 0.66, 0.34),
        ]
    else:
        paste_center(canvas, logo, round(width * 0.50), round(height * 0.19))
        placements = [
            ("emberfox", 0.19, 0.69, 0.33),
            ("bubblefrog", 0.34, 0.73, 0.35),
            ("guluduck", 0.50, 0.65, 0.43),
            ("sproutcap", 0.67, 0.73, 0.34),
            ("prismkirin", 0.83, 0.68, 0.34),
        ]
    add_pet_cluster(canvas, placements)

    vignette = Image.new("L", (width, height), 0)
    vg = ImageDraw.Draw(vignette)
    vg.ellipse((-round(width * 0.12), -round(height * 0.22), round(width * 1.12), round(height * 1.18)), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(round(min(size) * 0.14)))
    dark = Image.new("RGBA", size, (1, 8, 23, 66))
    dark.putalpha(vignette.point(lambda p: 66 - round(p * 0.18)))
    canvas.alpha_composite(dark)
    (CAPSULE_OUT / name).parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(CAPSULE_OUT / name, quality=95, optimize=True)


def desktop_base(index: int) -> Image.Image:
    bg = cover(Image.open(DESKTOP_BACKGROUNDS[index % len(DESKTOP_BACKGROUNDS)]).convert("RGBA"), 1920, 1080)
    shade = Image.new("RGBA", bg.size, (4, 13, 28, 28 if index % 2 else 18))
    bg.alpha_composite(shade)
    return bg


def draw_desktop_chrome(canvas: Image.Image, icon_names: tuple[str, ...] = ("项目", "素材", "回收站")) -> None:
    draw = ImageDraw.Draw(canvas)
    f = font(21)
    for i, label in enumerate(icon_names):
        y = 52 + i * 116
        fill = [(61, 190, 236, 245), (255, 201, 77, 245), (179, 228, 220, 245)][i % 3]
        draw.rounded_rectangle((38, y, 92, y + 52), radius=12, fill=fill, outline=(255, 255, 255, 170), width=2)
        if i == 0:
            draw.rectangle((49, y + 14, 81, y + 38), fill=(235, 251, 255, 235))
        elif i == 1:
            draw.polygon([(47, y + 18), (61, y + 18), (68, y + 26), (85, y + 26), (85, y + 42), (47, y + 42)], fill=(255, 245, 199, 255))
        else:
            draw.rectangle((51, y + 15, 79, y + 42), outline=(244, 252, 255, 245), width=3)
        bbox = draw.textbbox((0, 0), label, font=f)
        draw.text((65 - (bbox[2] - bbox[0]) / 2, y + 60), label, font=f, fill=(255, 255, 255, 245), stroke_width=2, stroke_fill=(9, 21, 42, 210))

    draw.rectangle((0, 1023, 1920, 1080), fill=(8, 18, 38, 220))
    draw.rounded_rectangle((24, 1035, 58, 1068), radius=8, fill=(76, 202, 255, 240))
    for x, color in [(90, (255, 199, 76)), (134, (95, 224, 187)), (178, (245, 118, 132)), (222, (150, 146, 255))]:
        draw.rounded_rectangle((x, 1037, x + 31, 1066), radius=8, fill=(*color, 235))
    draw.text((1760, 1037), "11:08", font=font(19), fill=(245, 250, 255, 240))
    draw.text((1754, 1057), "2026/8/18", font=font(13), fill=(218, 230, 243, 230))


def rounded_window(canvas: Image.Image, source: Image.Image, box=(238, 58, 1858, 1005), title="Gulugulu") -> None:
    x0, y0, x1, y1 = box
    width, height = x1 - x0, y1 - y0
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x0 + 10, y0 + 16, x1 + 10, y1 + 16), radius=27, fill=(0, 0, 0, 150))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))

    frame = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle((0, 0, width, height), radius=24, fill=(10, 18, 37, 245), outline=(202, 232, 243, 180), width=2)
    fd.rounded_rectangle((0, 0, width, 54), radius=24, fill=(18, 30, 55, 250))
    fd.rectangle((0, 28, width, 54), fill=(18, 30, 55, 250))
    for cx, color in [(28, (255, 105, 112)), (58, (255, 198, 70)), (88, (76, 210, 142))]:
        fd.ellipse((cx - 8, 19, cx + 8, 35), fill=(*color, 255))
    fd.text((120, 14), title, font=font(21), fill=(231, 241, 250, 240))

    content = cover(source.convert("RGBA"), width, height - 54)
    mask = Image.new("L", (width, height - 54), 255)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, width, height - 54), radius=20, fill=255)
    frame.paste(content, (0, 54), mask)
    canvas.alpha_composite(frame, (x0, y0))


def code_panel(canvas: Image.Image, chinese: bool = True) -> None:
    panel = Image.new("RGBA", (1000, 660), (9, 18, 37, 238))
    draw = ImageDraw.Draw(panel)
    draw.rounded_rectangle((0, 0, 1000, 660), radius=28, fill=(9, 18, 37, 238), outline=(116, 213, 228, 170), width=2)
    draw.rectangle((0, 0, 1000, 62), fill=(18, 31, 56, 250))
    panel_title = "AI 工作台 · 实时 Token" if chinese else "AI WORKSPACE · LIVE TOKENS"
    draw.text((38, 18), panel_title, font=font(25), fill=(229, 243, 249, 255))
    lines = [
        ("01", "const companion = await gulu.connect();"),
        ("02", "companion.observe(activeProject);"),
        ("03", "companion.react({ mood: 'focused' });"),
        ("04", "tokens.stream().on('pulse', reward);"),
        ("05", "// 它真的看懂你正在做什么" if chinese else "// your companion notices the work"),
        ("06", "await companion.growTogether();"),
    ]
    mono = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 29)
    for i, (no, value) in enumerate(lines):
        y = 105 + i * 76
        draw.text((34, y), no, font=mono, fill=(104, 128, 155, 230))
        color = (113, 225, 200, 255) if i in (1, 3, 5) else (214, 229, 239, 255)
        draw.text((100, y), value, font=mono if all(ord(c) < 128 for c in value) else font(27), fill=color)
    draw.rounded_rectangle((34, 580, 966, 628), radius=14, fill=(26, 49, 71, 230))
    draw.rounded_rectangle((34, 580, 726, 628), radius=14, fill=(64, 207, 184, 210))
    progress = "今日陪伴进度  74%" if chinese else "TODAY'S BOND  74%"
    draw.text((54, 589), progress, font=font(23), fill=(7, 32, 44, 255))
    paste_shadowed(canvas, panel, 170, 150, 18)


def status_pill(canvas: Image.Image, xy: tuple[int, int], text: str, color: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(canvas)
    x, y = xy
    tw = draw.textbbox((0, 0), text, font=font(27))[2]
    draw.rounded_rectangle((x, y, x + tw + 64, y + 55), radius=26, fill=(*color, 235), outline=(255, 255, 255, 180), width=2)
    draw.ellipse((x + 17, y + 18, x + 35, y + 36), fill=(255, 255, 255, 245))
    draw.text((x + 46, y + 10), text, font=font(27), fill=(10, 24, 36, 255))


def make_pet_desktop(name: str, bg_index: int, headline: str, subtitle: str, pets: list[str], mode: str) -> None:
    canvas = desktop_base(bg_index)
    draw = ImageDraw.Draw(canvas)
    draw_desktop_chrome(canvas)
    if mode == "work":
        code_panel(canvas)
        placements = [(pets[0], 0.76, 0.61, 0.31), (pets[1], 0.88, 0.73, 0.24), (pets[2], 0.67, 0.79, 0.22), (pets[3], 0.93, 0.47, 0.19)]
        add_pet_cluster(canvas, placements)
        for i, label in enumerate(["+12", "+28", "+64"]):
            status_pill(canvas, (1370 + (i % 2) * 200, 230 + i * 85), label, (255, 201, 75))
    else:
        panel = Image.new("RGBA", (1510, 780), (7, 17, 35, 178))
        pd = ImageDraw.Draw(panel)
        pd.rounded_rectangle((0, 0, 1510, 780), radius=38, fill=(7, 17, 35, 178), outline=(214, 239, 246, 130), width=2)
        canvas.alpha_composite(panel, (240, 130))
        xs = [0.31, 0.51, 0.71, 0.85]
        for i, species in enumerate(pets):
            add_pet_cluster(canvas, [(species, xs[i], 0.62 if i % 2 == 0 else 0.67, 0.31 if i == 1 else 0.25)])
        if mode == "think":
            for x, y, t in [(540, 320, "?"), (980, 270, "…"), (1450, 345, "!")]:
                draw.ellipse((x - 44, y - 44, x + 44, y + 44), fill=(236, 248, 250, 235))
                draw.text((x - 16, y - 32), t, font=font(52), fill=(29, 74, 88, 255))
        else:
            for x, y, t in [(560, 330, "Z"), (910, 270, "Zz"), (1390, 350, "z")]:
                draw.text((x, y), t, font=font(54), fill=(218, 232, 255, 240), stroke_width=2, stroke_fill=(65, 69, 125, 220))

    draw.rounded_rectangle((264, 76, 1310, 142), radius=28, fill=(6, 17, 35, 205))
    draw.text((298, 84), headline, font=font(35), fill=(255, 255, 255, 255))
    draw.text((920, 91), subtitle, font=font(23), fill=(166, 228, 224, 255))
    canvas.convert("RGB").save(SHOT_OUT / name, quality=95, optimize=True)


def make_window_shot(name: str, source: Path, bg_index: int, title: str, pets: list[str]) -> None:
    canvas = desktop_base(bg_index)
    draw_desktop_chrome(canvas)
    rounded_window(canvas, Image.open(source), title=title)
    add_pet_cluster(canvas, [
        (pets[0], 0.115, 0.77, 0.16),
        (pets[1], 0.92, 0.82, 0.17),
    ])
    canvas.convert("RGB").save(SHOT_OUT / name, quality=95, optimize=True)


def enhance_factory(source: Path, name: str, crop_focus: bool = False) -> None:
    image = Image.open(source).convert("RGB")
    if crop_focus:
        crop = image.crop((180, 25, image.width - 180, image.height - 25))
        image = cover(crop.convert("RGBA"), 1920, 1080).convert("RGB")
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image = ImageEnhance.Color(image).enhance(1.12)
    image = ImageEnhance.Sharpness(image).enhance(1.15)
    image.save(SHOT_OUT / name, quality=96, optimize=True)


def make_full_species() -> None:
    canvas = desktop_base(3)
    draw_desktop_chrome(canvas, ("图鉴", "融合表", "收藏"))
    panel = Image.new("RGBA", (1640, 930), (7, 18, 39, 236))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle((0, 0, 1640, 930), radius=34, fill=(7, 18, 39, 236), outline=(159, 231, 221, 200), width=3)
    pd.text((46, 26), "全物种图鉴", font=font(45), fill=(246, 252, 255, 255))
    pd.rounded_rectangle((1324, 28, 1584, 92), radius=28, fill=(72, 214, 180, 235))
    pd.text((1380, 37), "63 / 63", font=font(34), fill=(5, 36, 44, 255))
    pd.text((50, 91), "从基础伙伴到全元素旗舰形态，一屏查看完整收藏", font=font(24), fill=(170, 215, 224, 255))

    species = [item for tier in SPECIES_TIERS for item in tier]
    assert len(species) == 63 and len(set(species)) == 63
    x0, y0 = 72, 158
    cell_w, cell_h = 169, 104
    tier_colors = [(117, 202, 255), (112, 225, 183), (255, 203, 92), (255, 145, 101), (197, 144, 255), (255, 115, 180)]
    tier_ends = []
    total = 0
    for tier in SPECIES_TIERS:
        total += len(tier)
        tier_ends.append(total)
    for idx, name in enumerate(species):
        row, col = divmod(idx, 9)
        x, y = x0 + col * cell_w, y0 + row * cell_h
        tier_idx = next(i for i, end in enumerate(tier_ends) if idx < end)
        color = tier_colors[tier_idx]
        pd.rounded_rectangle((x, y, x + 145, y + 88), radius=20, fill=(20, 39, 62, 245), outline=(*color, 190), width=2)
        icon = pet(name, 88, 78)
        panel.alpha_composite(icon, (x + 29, y + 5))
        pd.ellipse((x + 119, y + 11, x + 137, y + 29), fill=(*color, 255))
    pd.text((50, 887), "基础 · 双元素 · 三元素 · 四元素 · 五元素 · 全元素", font=font(22), fill=(173, 210, 224, 245))
    paste_shadowed(canvas, panel, 210, 55, 20)
    canvas.convert("RGB").save(SHOT_OUT / "15_full_species_ui_zh.png", quality=96, optimize=True)


def make_trailer_desktop(locale: str) -> None:
    canvas = desktop_base(0)
    chinese = locale == "zh"
    labels = ("项目", "素材", "回收站") if chinese else ("Projects", "Assets", "Recycle")
    draw_desktop_chrome(canvas, labels)
    code_panel(canvas, chinese=chinese)
    add_pet_cluster(canvas, [
        ("guluduck", 0.76, 0.61, 0.30),
        ("emberfox", 0.88, 0.73, 0.23),
        ("bubblefrog", 0.68, 0.79, 0.21),
        ("prismkirin", 0.93, 0.46, 0.19),
    ])
    canvas.convert("RGB").save(OUT / f"trailer_desktop_multi_{locale}.png", quality=96, optimize=True)


def make_contact_sheet(paths: list[Path], output: Path, thumb=(480, 270), cols=3) -> None:
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb[0], rows * (thumb[1] + 42)), (12, 21, 37))
    draw = ImageDraw.Draw(sheet)
    label_font = font(18)
    for idx, path in enumerate(paths):
        x = (idx % cols) * thumb[0]
        y = (idx // cols) * (thumb[1] + 42)
        image = cover(Image.open(path).convert("RGBA"), *thumb).convert("RGB")
        sheet.paste(image, (x, y))
        draw.text((x + 10, y + thumb[1] + 8), path.stem, font=label_font, fill=(231, 240, 247))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=92)


def main() -> None:
    for directory in (CAPSULE_OUT, SHOT_OUT, QA_OUT):
        directory.mkdir(parents=True, exist_ok=True)
    for path in [*DESKTOP_BACKGROUNDS, BG_DIR / "capsule_continuous.png", LOGO]:
        if not path.exists():
            raise FileNotFoundError(path)

    make_capsule("main_capsule_v3.png", (1232, 706))
    make_capsule("header_capsule_v3.png", (920, 430))
    make_capsule("small_capsule_v3.png", (462, 174), small=True)
    make_capsule("vertical_capsule_v3.png", (748, 896), vertical=True)

    make_pet_desktop("01_ai_desktop_multi_zh.png", 0, "AI 实时陪伴你的工作", "让每一次 Token 都变成成长", ["guluduck", "emberfox", "sproutcap", "prismkirin"], "work")
    make_pet_desktop("02_pet_thinking_multi_zh.png", 2, "它们会观察、思考，也会回应", "不只是挂在桌面的装饰", ["voltmouse", "lanternloong", "bubblefrog", "queenbuzz"], "think")
    make_pet_desktop("03_pet_sleeping_multi_zh.png", 1, "忙完以后，一起休息一会儿", "每个伙伴都有自己的状态", ["frostpeng", "snowcub", "icejelly", "aurowl"], "sleep")

    enhance_factory(FACTORY / "factory_full_stack_00m40s500_schinese.png", "04_office_stackup_tall_zh.png")
    enhance_factory(FACTORY / "factory_full_stack_00m40s500_schinese.png", "05_office_stackup_tower_closeup_zh.png", crop_focus=True)
    enhance_factory(FACTORY / "factory_kpi_pulse_00m22s400_schinese.png", "06_office_kpi_pulse_zh.png")
    enhance_factory(FACTORY / "factory_desks_00m18s700_schinese.png", "07_office_desks_zh.png")
    enhance_factory(FACTORY / "factory_hiring_00m14s300_schinese.png", "08_office_hiring_zh.png")

    make_window_shot("09_backyard_home_zh.png", ZH_SHOTS / "backyard_home_zh.png", 3, "Gulugulu · 后院", ["bubblefrog", "lanternloong"])
    make_window_shot("10_backyard_shop_zh.png", ZH_SHOTS / "backyard_shop_zh.png", 1, "Gulugulu · 商店", ["sproutcap", "emberfox"])
    make_window_shot("11_backyard_hatchery_zh.png", ZH_SHOTS / "backyard_pits_zh.png", 2, "Gulugulu · 孵化场", ["voltmouse", "frostpeng"])
    make_window_shot("12_backyard_market_zh.png", ZH_SHOTS / "backyard_market_zh.png", 0, "Gulugulu · 市场", ["manacorn", "queenbuzz"])
    make_window_shot("13_backyard_notice_zh.png", ZH_SHOTS / "backyard_notice_zh.png", 3, "Gulugulu · 事件", ["gargoylite", "crystalwing"])
    make_window_shot("14_pet_menu_multi_zh.png", ZH_SHOTS / "pet_menu_closeup_zh.png", 1, "Gulugulu · 伙伴菜单", ["guluduck", "prismkirin"])
    make_full_species()
    make_trailer_desktop("en")
    make_trailer_desktop("zh")

    capsules = sorted(CAPSULE_OUT.glob("*.png"))
    shots = sorted(SHOT_OUT.glob("*.png"))
    make_contact_sheet(capsules, QA_OUT / "capsules_contact_sheet.jpg", thumb=(410, 260), cols=2)
    make_contact_sheet(shots, QA_OUT / "zh_screenshots_contact_sheet.jpg", thumb=(480, 270), cols=3)
    print(f"Wrote {len(capsules)} capsules and {len(shots)} screenshots to {OUT}")


if __name__ == "__main__":
    main()
