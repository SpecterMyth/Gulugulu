from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "steam-store" / "p0-v3" / "trailers"
STILLS = {
    "en": ROOT / "assets" / "steam-store" / "p0-v3" / "trailer_desktop_multi_en.png",
    "zh": ROOT / "assets" / "steam-store" / "p0-v3" / "trailer_desktop_multi_zh.png",
}
SOURCES = {
    "en": ROOT / "ops" / "steam" / "gulugulu_trailer_en.mp4",
    "zh": ROOT / "ops" / "steam" / "gulugulu_trailer_zh.mp4",
}


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "json", str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def render(locale: str, source: Path, still: Path) -> Path:
    duration = probe_duration(source)
    tail_start = 44.5
    output = OUT / f"gulugulu_trailer_{locale}_v3.mp4"
    temporary = OUT / f"gulugulu_trailer_{locale}_v3.rendering.mp4"

    # Exactly six seconds before the main narrative:
    # 1.5 s multi-pet desktop, 3.0 s accelerated real Stack-Up footage, 1.5 s pet reaction.
    filter_graph = ";".join(
        [
            "[1:v]trim=duration=1.5,fps=30,scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v0]",
            "[0:a:0]atrim=start=0:end=1.5,asetpts=PTS-STARTPTS[a0]",
            "[0:v:0]trim=start=35:end=44,setpts=(PTS-STARTPTS)/3,fps=30,setsar=1,format=yuv420p[v1]",
            "[0:a:0]atrim=start=35:end=44,asetpts=PTS-STARTPTS,atempo=3.0[a1]",
            "[0:v:0]trim=start=9.4:end=10.9,setpts=PTS-STARTPTS,fps=30,setsar=1,format=yuv420p[v2]",
            "[0:a:0]atrim=start=9.4:end=10.9,asetpts=PTS-STARTPTS[a2]",
            "[0:v:0]trim=start=0:end=14,setpts=PTS-STARTPTS,fps=30,setsar=1,format=yuv420p[v3]",
            "[0:a:0]atrim=start=0:end=14,asetpts=PTS-STARTPTS[a3]",
            "[0:v:0]trim=start=14:end=35,setpts=PTS-STARTPTS,fps=30,setsar=1,format=yuv420p[v4]",
            "[0:a:0]atrim=start=14:end=35,asetpts=PTS-STARTPTS[a4]",
            f"[0:v:0]trim=start={tail_start}:end={duration:.6f},setpts=PTS-STARTPTS,fps=30,setsar=1,format=yuv420p[v5]",
            f"[0:a:0]atrim=start={tail_start}:end={duration:.6f},asetpts=PTS-STARTPTS[a5]",
            "[v0][a0][v1][a1][v2][a2][v3][a3][v4][a4][v5][a5]concat=n=6:v=1:a=1[outv][outa]",
        ]
    )

    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y",
        "-i", str(source),
        "-loop", "1", "-framerate", "30", "-i", str(still),
        "-filter_complex", filter_graph,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
        "-r", "30", "-g", "60",
        "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
        "-movflags", "+faststart", "-map_metadata", "-1", "-shortest",
        str(temporary),
    ]
    subprocess.run(command, check=True)
    temporary.replace(output)
    return output


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    outputs = []
    for locale, source in SOURCES.items():
        if not source.exists():
            raise FileNotFoundError(source)
        still = STILLS[locale]
        if not still.exists():
            raise FileNotFoundError(still)
        outputs.append(render(locale, source, still))
    for output in outputs:
        print(f"{output.name}: {probe_duration(output):.3f} s")


if __name__ == "__main__":
    main()
