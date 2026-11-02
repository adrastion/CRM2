"""Generate Android launcher icons from client/public/logo512.png."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "logo512.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
RESOURCES = ROOT / "resources"

LEGACY = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

ADAPTIVE_FG = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def fit_on_canvas(source: Image.Image, size: int, content_ratio: float = 1.0) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    content = max(1, int(size * content_ratio))
    scaled = source.resize((content, content), Image.Resampling.LANCZOS)
    off = (size - content) // 2
    canvas.paste(scaled, (off, off), scaled)
    return canvas


def opaque_black_square(source: Image.Image, size: int) -> Image.Image:
    base = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    scaled = source.resize((size, size), Image.Resampling.LANCZOS)
    return Image.alpha_composite(base, scaled)


def main() -> None:
    img = Image.open(SRC).convert("RGBA")

    for folder, size in LEGACY.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = opaque_black_square(img, size)
        icon.save(out_dir / "ic_launcher.png", "PNG")
        icon.save(out_dir / "ic_launcher_round.png", "PNG")

    for folder, size in ADAPTIVE_FG.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        # logo already has padding; keep plates inside OEM adaptive masks
        fg = fit_on_canvas(img, size, content_ratio=0.78)
        bg = Image.new("RGBA", (size, size), (0, 0, 0, 255))
        Image.alpha_composite(bg, fg).save(out_dir / "ic_launcher_foreground.png", "PNG")

    RESOURCES.mkdir(parents=True, exist_ok=True)
    img.save(RESOURCES / "icon.png", "PNG")
    print("icons generated from", SRC)
    for p in sorted(RES.glob("mipmap-*/ic_launcher*.png")):
        with Image.open(p) as im:
            print(f"  {p.relative_to(RES)} {im.size}")


if __name__ == "__main__":
    main()
