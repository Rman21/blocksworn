#!/usr/bin/env python3
"""
Day 6 brand asset builder. See build-brand-assets.mjs header for context.

Outputs:
  app/icon.png        — 512x512, square logo on dark BG (Next.js auto-favicon)
  app/apple-icon.png  — 180x180, iOS home screen
  public/og-image.png — 1200x630, social card with logo + tagline

Run from /site/:  python3 scripts/build-brand-assets.py
"""
import re
import base64
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SITE = Path(__file__).resolve().parent.parent
GAME_FILE = SITE.parent.parent.parent.parent / 'blocksworn_index_fixed.html'

BG_DARK = (10, 10, 26, 255)   # #0A0A1A — site background
GOLD = (255, 213, 61, 255)    # #FFD53D — primary accent

def extract_logo() -> Image.Image:
    src = GAME_FILE.read_text(encoding='utf-8')
    m = re.search(r"Logo:\s*'data:image/(\w+);base64,([^']+)'", src)
    if not m:
        raise RuntimeError(f'Logo not found in {GAME_FILE}')
    img = Image.open(io.BytesIO(base64.b64decode(m.group(2)))).convert('RGBA')
    return img

def gold_glow(canvas: Image.Image, radius: int = 80, opacity: float = 0.35) -> Image.Image:
    """Soft gold radial glow centered on canvas. Returns RGBA layer."""
    w, h = canvas.size
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    cx, cy = w // 2, h // 2
    for r in range(radius, 0, -1):
        alpha = int(255 * opacity * (1 - r / radius) ** 2)
        draw.ellipse((cx - r * 4, cy - r * 4, cx + r * 4, cy + r * 4),
                     fill=(GOLD[0], GOLD[1], GOLD[2], alpha))
    return glow.filter(ImageFilter.GaussianBlur(radius=40))

def compose_icon(logo: Image.Image, size: int) -> Image.Image:
    """Square icon: logo centered on dark BG with subtle gold glow."""
    canvas = Image.new('RGBA', (size, size), BG_DARK)
    canvas = Image.alpha_composite(canvas, gold_glow(canvas, radius=size // 4, opacity=0.4))
    # Logo is 600x400 — fit within 80% of icon, preserve aspect ratio
    target_w = int(size * 0.85)
    scale = target_w / logo.width
    target_h = int(logo.height * scale)
    if target_h > size * 0.85:
        scale = (size * 0.85) / logo.height
        target_w = int(logo.width * scale)
        target_h = int(size * 0.85)
    logo_resized = logo.resize((target_w, target_h), Image.LANCZOS)
    x = (size - target_w) // 2
    y = (size - target_h) // 2
    canvas.alpha_composite(logo_resized, (x, y))
    return canvas

def compose_og(logo: Image.Image) -> Image.Image:
    """OG card 1200x630: logo centered top + tagline below + gold accent line."""
    W, H = 1200, 630
    canvas = Image.new('RGBA', (W, H), BG_DARK)
    canvas = Image.alpha_composite(canvas, gold_glow(canvas, radius=180, opacity=0.45))
    # Logo: scale to ~640px wide, center horizontally, slightly above middle
    target_w = 640
    scale = target_w / logo.width
    target_h = int(logo.height * scale)
    logo_resized = logo.resize((target_w, target_h), Image.LANCZOS)
    logo_y = int(H * 0.22)
    canvas.alpha_composite(logo_resized, ((W - target_w) // 2, logo_y))
    # Tagline below logo
    draw = ImageDraw.Draw(canvas)
    tagline = 'CLEAR LINES  ·  SUMMON LEGENDS'
    subline = '25 HEROES  ·  15 BOSSES  ·  3 CHAPTERS  ·  ENDLESS TOWER'
    # macOS system fonts — try Cinzel-ish serif fallback chain
    font_main = None
    font_sub = None
    for path in [
        '/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf',
        '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
        '/System/Library/Fonts/Times.ttc',
    ]:
        if Path(path).exists():
            try:
                font_main = ImageFont.truetype(path, 44)
                font_sub = ImageFont.truetype(path, 22)
                break
            except Exception:
                continue
    if font_main is None:
        font_main = ImageFont.load_default()
        font_sub = ImageFont.load_default()
    # Center the taglines below the logo
    main_y = logo_y + target_h + 30
    sub_y = main_y + 70
    bbox = draw.textbbox((0, 0), tagline, font=font_main)
    draw.text(((W - (bbox[2] - bbox[0])) // 2, main_y), tagline, fill=GOLD, font=font_main)
    bbox2 = draw.textbbox((0, 0), subline, font=font_sub)
    draw.text(((W - (bbox2[2] - bbox2[0])) // 2, sub_y), subline,
              fill=(184, 181, 196, 255), font=font_sub)  # text-muted
    # Gold accent line at top
    draw.rectangle([0, 0, W, 4], fill=GOLD)
    return canvas

def main():
    logo = extract_logo()
    print(f'Loaded logo: {logo.size} {logo.mode}')

    out_app = SITE / 'app'
    out_pub = SITE / 'public'

    # Save icon (Next.js auto-generates favicon at multiple sizes from this)
    icon_512 = compose_icon(logo, 512)
    icon_path = out_app / 'icon.png'
    icon_512.save(icon_path, 'PNG', optimize=True)
    print(f'  → {icon_path}  ({icon_path.stat().st_size:,} B)')

    apple_180 = compose_icon(logo, 180)
    apple_path = out_app / 'apple-icon.png'
    apple_180.save(apple_path, 'PNG', optimize=True)
    print(f'  → {apple_path}  ({apple_path.stat().st_size:,} B)')

    og = compose_og(logo)
    og_path = out_pub / 'og-image.png'
    og.save(og_path, 'PNG', optimize=True)
    print(f'  → {og_path}  ({og_path.stat().st_size:,} B)')

if __name__ == '__main__':
    main()
