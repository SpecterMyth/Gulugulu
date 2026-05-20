from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "projects" / "gulugulu-app" / "public" / "animations" / "guluduck"
POSE_SHEETS = OUT / "pose_sheets"

FRAME_SIZE = 768
ANCHOR = (384, 700)
TARGET_HEIGHT = 640
TARGET_WIDTH = 700


@dataclass(frozen=True)
class AnimationSpec:
    animation_id: str
    label: str
    frames: int
    fps: int
    loop: bool
    cols: int
    rows: int
    source_prompt: str
    keep_detached: bool = True


SPECS = [
    AnimationSpec(
        "idle_normal",
        "普通待机，轻微呼吸、眨眼、呆毛弹动",
        12,
        8,
        True,
        4,
        3,
        "12-frame idle pose sheet: closed bill, slow breathing, tiny weight shift, wing wiggle, blink, feather bounce.",
        False,
    ),
    AnimationSpec(
        "blink",
        "独立眨眼，可叠加或短触发",
        6,
        12,
        False,
        6,
        1,
        "6-frame blink pose sheet: open, half, closed, relaxed, half, open.",
    ),
    AnimationSpec(
        "walk",
        "小脚啪嗒走路，身体左右摇",
        8,
        10,
        True,
        8,
        1,
        "8-frame right-facing waddle walk cycle with alternating feet.",
        False,
    ),
    AnimationSpec(
        "turn_around",
        "左右朝向切换",
        10,
        12,
        False,
        5,
        2,
        "10-frame turn-around: front, three-quarter, side, back, and return.",
        False,
    ),
    AnimationSpec(
        "back_climb",
        "背面上下爬动，自主纵向位移时使用",
        16,
        12,
        True,
        4,
        4,
        "16-frame back-facing climb/scoot loop: alternating feet, wing press, body squash, neckerchief bounce.",
        False,
    ),
    AnimationSpec(
        "happy_dance",
        "开心小碎步转圈/扑翅",
        16,
        12,
        False,
        4,
        4,
        "16-frame happy dance: tiny spin, flapping wings, laughing beak.",
    ),
    AnimationSpec(
        "confused",
        "困惑歪头、眨眼",
        12,
        10,
        False,
        4,
        3,
        "12-frame confused pose sheet: head tilts, wing on beak, puzzled bounce.",
    ),
    AnimationSpec(
        "scared_backstep",
        "惊吓后退、脚抬起",
        14,
        12,
        False,
        7,
        2,
        "14-frame scared backstep: wide eyes, open beak, raised wings, retreat.",
    ),
    AnimationSpec(
        "angry_backturn",
        "生气背对、嘴硬沉默",
        12,
        10,
        False,
        4,
        3,
        "12-frame angry back-turn: pout, turn away, stubborn back-facing wiggle.",
    ),
    AnimationSpec(
        "agent_thinking",
        "agent 思考时认真点头",
        12,
        8,
        True,
        4,
        3,
        "12-frame agent thinking: serious nodding, wing on chin, fake expertise.",
    ),
    AnimationSpec(
        "agent_success",
        "agent 成功时骄傲庆祝",
        14,
        12,
        False,
        7,
        2,
        "14-frame success celebration: proud nod, hop, wing spread, smug landing.",
    ),
    AnimationSpec(
        "eat",
        "token 投喂时啄食/咀嚼",
        16,
        10,
        False,
        4,
        4,
        "16-frame eating: sees snack, pecks crumbs, cheek puff, swallow, satisfied.",
    ),
    AnimationSpec(
        "pet_head",
        "被摸头，先嘴硬后舒服",
        14,
        10,
        False,
        7,
        2,
        "14-frame pet reaction: stubborn, then happy closed-eye comfort.",
    ),
]


def clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def crop_to_alpha(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def chroma_to_alpha(image: Image.Image, keep_detached: bool) -> Image.Image:
    rgba = image.convert("RGBA")
    data = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = data[x, y]
            green_screen = g > 86 and g > r * 1.16 + 18 and g > b * 1.16 + 18
            if green_screen:
                data[x, y] = (r, g, b, 0)
                continue
            if g > r + 28 and g > b + 28:
                data[x, y] = (r, min(g, max(r, b) + 8), b, a)
    alpha = rgba.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.35))
    rgba.putalpha(alpha)
    return crop_to_alpha(keep_near_subject(rgba, keep_detached))


def keep_near_subject(image: Image.Image, keep_detached: bool) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = alpha.size
    px = alpha.load()
    seen = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for sy in range(height):
        for sx in range(width):
            idx = sy * width + sx
            if seen[idx] or px[sx, sy] <= 14:
                continue
            q = [(sx, sy)]
            seen[idx] = 1
            component: list[tuple[int, int]] = []
            head = 0
            while head < len(q):
                x, y = q[head]
                head += 1
                component.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nidx = ny * width + nx
                    if seen[nidx] or px[nx, ny] <= 14:
                        continue
                    seen[nidx] = 1
                    q.append((nx, ny))
            if len(component) > 20:
                components.append(component)

    if not components:
        return image

    largest = max(components, key=len)
    lx0 = min(x for x, _ in largest)
    ly0 = min(y for _, y in largest)
    lx1 = max(x for x, _ in largest)
    ly1 = max(y for _, y in largest)
    keep_box = (lx0 - 72, ly0 - 72, lx1 + 72, ly1 + 72)

    mask = Image.new("L", (width, height), 0)
    mask_px = mask.load()
    for component in components:
        area = len(component)
        cx = sum(x for x, _ in component) / area
        cy = sum(y for _, y in component) / area
        inside = keep_box[0] <= cx <= keep_box[2] and keep_box[1] <= cy <= keep_box[3]
        # Keep close crumbs and motion accents, but drop floating punctuation/sparkles above the head.
        not_floating_above_head = cy > ly0 + 70
        if component is largest or (keep_detached and inside and not_floating_above_head):
            for x, y in component:
                mask_px[x, y] = px[x, y]

    result = image.copy()
    result.putalpha(mask)
    return result


def normalize_frame(raw: Image.Image, keep_detached: bool = True) -> Image.Image:
    sprite = chroma_to_alpha(raw, keep_detached)
    sprite = crop_to_alpha(sprite)
    bbox = sprite.getchannel("A").getbbox()
    if not bbox:
        return Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    sprite_w = bbox[2] - bbox[0]
    sprite_h = bbox[3] - bbox[1]
    scale = min(TARGET_WIDTH / sprite_w, TARGET_HEIGHT / sprite_h)
    resized = sprite.resize(
        (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
        Image.Resampling.LANCZOS,
    )
    resized = crop_to_alpha(resized)

    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = round(ANCHOR[0] - resized.width / 2)
    y = round(ANCHOR[1] - resized.height)
    canvas.alpha_composite(resized, (x, y))
    return canvas


def slice_pose_sheet(spec: AnimationSpec) -> list[Image.Image]:
    sheet_path = POSE_SHEETS / f"{spec.animation_id}.png"
    if not sheet_path.exists():
        raise FileNotFoundError(f"Missing pose sheet: {sheet_path}")
    sheet = Image.open(sheet_path)
    if spec.rows == 1:
        segmented = segment_single_row_sheet(sheet, spec.frames)
        if len(segmented) == spec.frames:
            return [normalize_frame(frame, keep_detached=spec.keep_detached) for frame in segmented]

    cell_w = sheet.width / spec.cols
    cell_h = sheet.height / spec.rows
    frames: list[Image.Image] = []
    for index in range(spec.frames):
        col = index % spec.cols
        row = index // spec.cols
        crop = sheet.crop(
            (
                round(col * cell_w),
                round(row * cell_h),
                round((col + 1) * cell_w),
                round((row + 1) * cell_h),
            )
        )
        frames.append(normalize_frame(crop, keep_detached=spec.keep_detached))
    return frames


def green_key_alpha(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    alpha = Image.new("L", rgb.size, 255)
    src = rgb.load()
    out = alpha.load()
    width, height = rgb.size
    for y in range(height):
        for x in range(width):
            r, g, b = src[x, y]
            if g > 86 and g > r * 1.16 + 18 and g > b * 1.16 + 18:
                out[x, y] = 0
    return alpha.filter(ImageFilter.MinFilter(3))


def segment_single_row_sheet(sheet: Image.Image, expected: int) -> list[Image.Image]:
    alpha = green_key_alpha(sheet)
    width, height = alpha.size
    px = alpha.load()
    seen = bytearray(width * height)
    boxes: list[tuple[int, int, int, int, int]] = []

    for sy in range(height):
        for sx in range(width):
            idx = sy * width + sx
            if seen[idx] or px[sx, sy] <= 14:
                continue
            q = [(sx, sy)]
            seen[idx] = 1
            min_x = max_x = sx
            min_y = max_y = sy
            count = 0
            head = 0
            while head < len(q):
                x, y = q[head]
                head += 1
                count += 1
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nidx = ny * width + nx
                    if seen[nidx] or px[nx, ny] <= 14:
                        continue
                    seen[nidx] = 1
                    q.append((nx, ny))

            box_w = max_x - min_x + 1
            box_h = max_y - min_y + 1
            if count > 900 and box_w > 40 and box_h > 80:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1, count))

    # Merge only actual overlaps. Tight but non-overlapping single-row sheets must stay separate.
    boxes.sort(key=lambda b: (b[0] + b[2]) / 2)
    merged: list[list[int]] = []
    for box in boxes:
        x0, y0, x1, y1, count = box
        if merged and x0 < merged[-1][2]:
            merged[-1][0] = min(merged[-1][0], x0)
            merged[-1][1] = min(merged[-1][1], y0)
            merged[-1][2] = max(merged[-1][2], x1)
            merged[-1][3] = max(merged[-1][3], y1)
            merged[-1][4] += count
        else:
            merged.append([x0, y0, x1, y1, count])

    if len(merged) > expected:
        merged = sorted(merged, key=lambda b: b[4], reverse=True)[:expected]
        merged.sort(key=lambda b: (b[0] + b[2]) / 2)
    if len(merged) != expected:
        return []

    frames: list[Image.Image] = []
    for x0, y0, x1, y1, _ in merged:
        margin = 24
        frames.append(
            sheet.crop(
                (
                    max(0, x0 - margin),
                    max(0, y0 - margin),
                    min(width, x1 + margin),
                    min(height, y1 + margin),
                )
            )
        )
    return frames


def write_preview() -> None:
    html = """<!doctype html>
<meta charset="utf-8">
<title>Guluduck Animation Preview</title>
<style>
body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; background: #f6efe2; color: #2a2016; }
h1 { margin: 0 0 6px; font-size: 20px; line-height: 1.2; }
.meta { margin: 0 0 18px; color: #6b5a48; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
.card { background: rgba(255,255,255,.72); border: 1px solid rgba(77,47,18,.14); border-radius: 8px; padding: 12px; }
.stage { width: 192px; height: 192px; overflow: hidden; background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 24px 24px; }
.sprite { display: block; width: auto; height: 192px; max-width: none; will-change: transform; }
.name { margin-top: 8px; font-size: 13px; }
</style>
<h1>Guluduck Animation Preview</h1>
<p class="meta" id="meta">Loading animations...</p>
<div class="grid" id="grid"></div>
<script>
fetch('./manifest.json').then(r => r.json()).then(manifest => {
  const grid = document.getElementById('grid');
  const meta = document.getElementById('meta');
  grid.innerHTML = '';
  meta.textContent = `${Object.keys(manifest.animations).length} animations - ${manifest.frameSize.width}x${manifest.frameSize.height} frames`;
  const version = Date.now();
  for (const [name, anim] of Object.entries(manifest.animations)) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="stage"><img class="sprite" alt="" draggable="false"></div><div class="name">${name} - ${anim.frames}f @ ${anim.fps}fps</div>`;
    const sprite = card.querySelector('.sprite');
    sprite.src = `${anim.src}?v=${version}`;
    sprite.style.width = `${192 * anim.frames}px`;
    const style = document.createElement('style');
    const key = `play_${name}`;
    style.textContent = `@keyframes ${key} { from { transform: translateX(0); } to { transform: translateX(-${192 * (anim.frames - 1)}px); } }`;
    document.head.appendChild(style);
    sprite.style.animation = `${key} ${anim.frames / anim.fps}s steps(${Math.max(1, anim.frames - 1)}, end) infinite`;
    grid.appendChild(card);
  }
});
</script>
"""
    (OUT / "preview.html").write_text(html, encoding="utf-8")


def write_overview(manifest: dict) -> None:
    thumb = 160
    pad = 18
    label_h = 28
    cols = 4
    rows = (len(manifest["animations"]) + cols - 1) // cols
    overview = Image.new(
        "RGBA",
        (cols * (thumb + pad) + pad, rows * (thumb + label_h + pad) + pad),
        (246, 239, 226, 255),
    )
    draw = ImageDraw.Draw(overview)
    for index, (animation_id, anim) in enumerate(manifest["animations"].items()):
        row = index // cols
        col = index % cols
        x = pad + col * (thumb + pad)
        y = pad + row * (thumb + label_h + pad)
        frame = Image.open(OUT / "frames" / animation_id / f"{animation_id}_0001.png").convert("RGBA")
        frame.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
        checker = Image.new("RGBA", (thumb, thumb), (255, 255, 255, 255))
        checker_draw = ImageDraw.Draw(checker)
        step = 16
        for yy in range(0, thumb, step):
            for xx in range(0, thumb, step):
                if (xx // step + yy // step) % 2 == 0:
                    checker_draw.rectangle((xx, yy, xx + step - 1, yy + step - 1), fill=(224, 224, 224, 255))
        checker.alpha_composite(frame, ((thumb - frame.width) // 2, (thumb - frame.height) // 2))
        overview.alpha_composite(checker, (x, y))
        draw.text((x, y + thumb + 6), f"{animation_id}  {anim['frames']}f/{anim['fps']}fps", fill=(42, 32, 22, 255))
    overview.convert("RGB").save(OUT / "overview.png", quality=92)


def main() -> None:
    frame_root = OUT / "frames"
    webp_root = OUT / "webp"
    clean_dir(frame_root)
    clean_dir(webp_root)

    manifest = {
        "character": "guluduck",
        "source": "imagegen_pose_sheets",
        "frameSize": {"width": FRAME_SIZE, "height": FRAME_SIZE},
        "anchor": {"x": ANCHOR[0], "y": ANCHOR[1]},
        "animations": {},
    }
    prompt_lines = [
        "# Guluduck Imagegen Animation Assets",
        "",
        "These assets are generated from dedicated Imagegen pose sheets stored in `pose_sheets/`.",
        "Each sheet is sliced by its declared grid, chroma-keyed from #00ff00, normalized to 768x768 frames, and packed into a single-row WebP spritesheet.",
        "",
    ]

    for spec in SPECS:
        frames_dir = frame_root / spec.animation_id
        frames_dir.mkdir(parents=True, exist_ok=True)
        frames = slice_pose_sheet(spec)
        for index, frame in enumerate(frames):
            frame.save(frames_dir / f"{spec.animation_id}_{index + 1:04d}.png")

        sheet = Image.new("RGBA", (FRAME_SIZE * spec.frames, FRAME_SIZE), (0, 0, 0, 0))
        for index, frame in enumerate(frames):
            sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
        sheet.save(webp_root / f"{spec.animation_id}.webp", format="WEBP", lossless=True, method=6)

        manifest["animations"][spec.animation_id] = {
            "src": f"/animations/guluduck/webp/{spec.animation_id}.webp",
            "frames": spec.frames,
            "fps": spec.fps,
            "loop": spec.loop,
        }

        prompt_lines.extend(
            [
                f"## {spec.animation_id}",
                "",
                f"- Purpose: {spec.label}",
                f"- Pose sheet: `pose_sheets/{spec.animation_id}.png`",
                f"- Grid: {spec.cols}x{spec.rows}",
                f"- Frames: {spec.frames}",
                f"- FPS: {spec.fps}",
                f"- Loop: {str(spec.loop).lower()}",
                f"- Imagegen prompt summary: {spec.source_prompt}",
                "- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.",
                "",
            ]
        )

    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "prompts.md").write_text("\n".join(prompt_lines), encoding="utf-8")
    write_preview()
    write_overview(manifest)


if __name__ == "__main__":
    main()
