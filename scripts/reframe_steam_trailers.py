from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "steam-store" / "p0-v2"
SOURCES = {
    "en": ROOT / "ops" / "steam" / "gulugulu_trailer_en.mp4",
    "zh": ROOT / "ops" / "steam" / "gulugulu_trailer_zh.mp4",
}


def duration(path: Path) -> float:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    return float(json.loads(raw)["format"]["duration"])


def render(lang: str, source: Path) -> Path:
    total = duration(source)
    # Cold-open structure:
    #   0.0-2.6s   AI/editor + desktop pet
    #   9.4-12.8s  token feeding/reaction
    #   14.0s-end  Office Stack-Up, collection, evolution, end card
    segments = [(0.0, 2.6), (9.4, 12.8), (14.0, total)]
    cross = 0.18
    filters: list[str] = []
    for i, (start, end) in enumerate(segments):
        filters.append(f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]")
        filters.append(f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]")

    first_offset = segments[0][1] - segments[0][0] - cross
    second_offset = first_offset + (segments[1][1] - segments[1][0]) - cross
    filters.extend(
        [
            f"[v0][v1]xfade=transition=fade:duration={cross}:offset={first_offset}[v01]",
            f"[v01][v2]xfade=transition=fade:duration={cross}:offset={second_offset}[vout]",
            f"[a0][a1]acrossfade=d={cross}:c1=tri:c2=tri[a01]",
            f"[a01][a2]acrossfade=d={cross}:c1=tri:c2=tri[aout]",
        ]
    )

    out = OUT / f"gulugulu_trailer_{lang}_v2.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[vout]",
            "-map",
            "[aout]",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-r",
            "30",
            "-c:a",
            "aac",
            "-b:a",
            "320k",
            "-movflags",
            "+faststart",
            str(out),
        ],
        check=True,
    )
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for lang, source in SOURCES.items():
        output = render(lang, source)
        print(output)


if __name__ == "__main__":
    main()
