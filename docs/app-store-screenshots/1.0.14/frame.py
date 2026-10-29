import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1284, 2778
SHOTS = [
    ("s1.png", "The channel for every game", "on your TV provider"),
    ("s2.png", "What to watch on the", "services you pay for"),
    ("s3.png", "Free movies and shows", "no subscription needed"),
    ("s4.png", "Know the moment a saved", "show lands on your service"),
    ("s5.png", "Just ask: what channel", "is the game on?"),
]


def font(size, weight):
    f = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", size)
    f.set_variation_by_axes([100, 28, 400, weight])
    return f


def notification(bg, top):
    x0, x1 = 150, W - 150
    h = 190
    card = Image.new("RGBA", (x1 - x0, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, x1 - x0, h), 44, fill=(245, 245, 247, 245))
    cd.rounded_rectangle((28, 34, 28 + 76, 34 + 76), 18, fill=(37, 99, 235))
    cd.text((44, 46), "TV", font=font(40, 800), fill=(255, 255, 255))
    cd.text((128, 30), "TUNEDTV", font=font(28, 600), fill=(110, 110, 115))
    cd.text((x1 - x0 - 110, 30), "now", font=font(28, 500), fill=(110, 110, 115))
    cd.text((128, 72), "Stranger Things", font=font(40, 700), fill=(20, 20, 22))
    cd.text((128, 122), "Now on Netflix, which you have. Tap to watch.", font=font(32, 450), fill=(40, 40, 45))
    shadow = Image.new("RGBA", (x1 - x0 + 40, h + 40), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((20, 26, x1 - x0 + 20, h + 26), 44, fill=(0, 0, 0, 110))
    bg.paste(shadow, (x0 - 20, top - 20), shadow)
    bg.paste(card, (x0, top), card)


def rounded(im, r):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0], im.size[1]), r, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im, (0, 0), mask)
    return out


def make(src, line1, line2, out):
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(10 + 12 * t), int(18 + 20 * t), int(36 + 40 * t)))
    f1, f2 = font(92, 760), font(92, 520)
    for text, f, y, color in ((line1, f1, 170, (255, 255, 255)), (line2, f2, 290, (120, 180, 255))):
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, y), text, font=f, fill=color)

    shot = Image.open(src).convert("RGB")
    sw = 1010
    sh = int(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    top = 500
    visible = H - top
    shot = shot.crop((0, 0, sw, min(sh, visible + 60)))
    border = Image.new("RGB", (sw + 12, shot.height + 12), (60, 80, 120))
    border = rounded(border, 64)
    bg.paste(border, ((W - sw - 12) // 2, top - 6), border)
    framed = rounded(shot, 58)
    bg.paste(framed, ((W - sw) // 2, top), framed)
    if src == "s4.png":
        notification(bg, top + 130)
    bg.save(out)


for i, (src, a, b) in enumerate(SHOTS, 1):
    if len(sys.argv) > 1 and str(i) not in sys.argv[1:]:
        continue
    make(src, a, b, f"final-{i}.png")
    print("final", i)
