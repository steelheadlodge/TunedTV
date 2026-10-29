import sys
sys.path.insert(0, "/tmp/shots")
from PIL import Image, ImageDraw
from frame import font, rounded

W, H = 2064, 2752
COL = (620, 1444)  # content column in the 2064-wide capture
TOP = 560

PAGES = [
    (["s1.png", "s5.png"], "The channel for every game", "on your TV provider", None),
    (["s2.png", "s4.png"], "What to watch on your services", "and an alert when a show lands", 1),
    (["s3.png"], "Free movies and shows", "no subscription needed", None),
]


def notification(bg, x0, x1, top):
    h = 200
    card = Image.new("RGBA", (x1 - x0, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, x1 - x0, h), 44, fill=(245, 245, 247, 248))
    cd.rounded_rectangle((28, 36, 28 + 80, 36 + 80), 18, fill=(37, 99, 235))
    cd.text((45, 50), "TV", font=font(42, 800), fill=(255, 255, 255))
    cd.text((132, 30), "TUNEDTV", font=font(30, 600), fill=(110, 110, 115))
    cd.text((x1 - x0 - 110, 30), "now", font=font(30, 500), fill=(110, 110, 115))
    cd.text((132, 74), "Stranger Things", font=font(42, 700), fill=(20, 20, 22))
    cd.text((132, 128), "Now on Netflix, which you have.", font=font(34, 450), fill=(40, 40, 45))
    bg.paste(card, (x0, top), card)


def panel(src, scale, max_h):
    im = Image.open(src).convert("RGB").crop((COL[0], 0, COL[1], 2752))
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    return im.crop((0, 0, im.width, min(im.height, max_h)))


for n, (srcs, l1, l2, notif_idx) in enumerate(PAGES, 1):
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(10 + 12 * t), int(18 + 20 * t), int(36 + 40 * t)))
    for text, f, y, color in ((l1, font(120, 760), 170, (255, 255, 255)), (l2, font(120, 520), 320, (120, 180, 255))):
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=color)

    scale = 1.08 if len(srcs) == 2 else 1.3
    panels = [panel(s, scale, H - TOP + 60) for s in srcs]
    gap = 90
    total = sum(p.width for p in panels) + gap * (len(panels) - 1)
    x = (W - total) // 2
    for i, p in enumerate(panels):
        border = rounded(Image.new("RGB", (p.width + 12, p.height + 12), (60, 80, 120)), 64)
        bg.paste(border, (x - 6, TOP - 6), border)
        framed = rounded(p, 58)
        bg.paste(framed, (x, TOP), framed)
        if notif_idx == i:
            notification(bg, x - 40, x + p.width + 40, TOP + 150)
        x += p.width + gap
    bg.save(f"final-ipad-{n}.png")
    print("ipad", n, bg.size)
