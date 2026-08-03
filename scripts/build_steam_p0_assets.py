from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "steam-store" / "p0-v2"
BACKGROUND = OUT / "capsule_background_v2.png"
LOGO = ROOT / "assets" / "steam-store" / "library_logo.png"
MASCOT = ROOT / "assets" / "steam-icons" / "guluduck.png"


def alpha_crop(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"No visible pixels in {path}")
    return image.crop(bbox)


def contain(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = min(width / image.width, height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def cover(image: Image.Image, width: int, height: int, focus_x: float = 0.5) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    extra_x = max(0, resized.width - width)
    left = round(extra_x * max(0.0, min(1.0, focus_x)))
    top = max(0, (resized.height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def glow_layer(size: tuple[int, int], center: tuple[int, int], radius: int) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 218, 105, 135))
    return layer.filter(ImageFilter.GaussianBlur(max(8, radius // 3)))


def paste_center(base: Image.Image, layer: Image.Image, x: int, y: int) -> None:
    base.alpha_composite(layer, (round(x - layer.width / 2), round(y - layer.height / 2)))


def make_landscape(name: str, size: tuple[int, int], logo_ratio: float, mascot_ratio: float) -> None:
    width, height = size
    bg = Image.open(BACKGROUND).convert("RGBA")
    canvas = cover(bg, width, height)
    canvas.alpha_composite(glow_layer(size, (round(width * 0.52), round(height * 0.72)), round(height * 0.28)))

    logo = contain(alpha_crop(LOGO), round(width * logo_ratio), round(height * 0.31))
    mascot = contain(alpha_crop(MASCOT), round(width * mascot_ratio), round(height * 0.55))
    paste_center(canvas, logo, round(width * 0.52), round(height * 0.20))
    paste_center(canvas, mascot, round(width * 0.52), round(height * 0.72))
    canvas.convert("RGB").save(OUT / name, optimize=True)


def make_small() -> None:
    width, height = 462, 174
    bg = Image.open(BACKGROUND).convert("RGBA")
    canvas = cover(bg, width, height, focus_x=0.34)
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((8, 10, 308, 164), radius=18, fill=(255, 245, 216, 210))
    canvas.alpha_composite(overlay)

    logo = contain(alpha_crop(LOGO), 278, 108)
    mascot = contain(alpha_crop(MASCOT), 132, 142)
    paste_center(canvas, logo, 158, 83)
    paste_center(canvas, mascot, 381, 99)
    canvas.convert("RGB").save(OUT / "small_capsule_v2.png", optimize=True)


def make_vertical() -> None:
    width, height = 748, 896
    bg = Image.open(BACKGROUND).convert("RGBA")
    canvas = Image.new("RGBA", (width, height), (255, 241, 207, 255))
    top = contain(bg, width, 500)
    canvas.alpha_composite(top, ((width - top.width) // 2, 0))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 410, width, height), fill=(255, 241, 207, 225))
    canvas.alpha_composite(glow_layer((width, height), (width // 2, 660), 245))

    logo = contain(alpha_crop(LOGO), 620, 270)
    mascot = contain(alpha_crop(MASCOT), 450, 470)
    paste_center(canvas, logo, width // 2, 176)
    paste_center(canvas, mascot, width // 2, 650)
    canvas.convert("RGB").save(OUT / "vertical_capsule_v2.png", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if not BACKGROUND.exists():
        raise FileNotFoundError(BACKGROUND)
    make_landscape("main_capsule_v2.png", (1232, 706), 0.54, 0.30)
    make_landscape("header_capsule_v2.png", (920, 430), 0.50, 0.26)
    make_small()
    make_vertical()
    print(f"Wrote Steam capsule set to {OUT}")


if __name__ == "__main__":
    main()
