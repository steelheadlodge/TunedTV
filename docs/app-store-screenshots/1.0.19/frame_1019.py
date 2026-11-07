# 1.0.19 store images from raw captures (scripts/phone-sim/store-shots.mjs in tuned-tv-finder).
#   python3 frame_1019.py /tmp/store/ip3 /tmp/store/ipad
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, "../1.0.14")
from frame import font, rounded

IP, PAD = sys.argv[1], sys.argv[2]
# Captions stay clear of other companies' names (App Store guideline 2.3.7). The movie and title
# screens are left out on purpose: their posters and backdrop stills are studio-owned artwork.
IPHONE = [
    ("1-sports", "Tonight's game, your channel", "and one tap puts it on"),
    ("5-ask", "Just say what you want on", "and your TV changes"),
    ("4-remote", "No TV handy?", "Try it on the demo TV"),
]
IPAD = [
    (["1-sports", "5-ask"], "Tonight's game, your channel", "just say it, and it's on"),
]


def backdrop(w, h):
    bg = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(bg)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(10 + 12 * t), int(18 + 20 * t), int(36 + 40 * t)))
    return bg, d


def place(bg, shot, x, top):
    border = rounded(Image.new("RGB", (shot.width + 12, shot.height + 12), (60, 80, 120)), 64)
    bg.paste(border, (x - 6, top - 6), border)
    bg.paste(rounded(shot, 58), (x, top), rounded(shot, 58))


W, H = 1284, 2778
for i, (src, l1, l2) in enumerate(IPHONE, 1):
    bg, d = backdrop(W, H)
    for text, f, y, c in ((l1, font(92, 760), 170, (255, 255, 255)), (l2, font(80, 520), 290, (120, 180, 255))):
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=c)
    shot = Image.open(f"{IP}/{src}.png").convert("RGB")
    sw = 1010
    shot = shot.resize((sw, int(shot.height * sw / shot.width)), Image.LANCZOS)
    shot = shot.crop((0, 0, sw, min(shot.height, H - 500 + 60)))
    place(bg, shot, (W - sw) // 2, 500)
    bg.save(f"iphone-6.5-{i}-{src[2:]}.png")
    print("iphone", i, bg.size)

W, H = 2064, 2752
COL, TOP = (620, 1444), 560
for n, (srcs, l1, l2) in enumerate(IPAD, 1):
    bg, d = backdrop(W, H)
    for text, f, y, c in ((l1, font(120, 760), 170, (255, 255, 255)), (l2, font(104, 520), 320, (120, 180, 255))):
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=c)
    panels = []
    for s in srcs:
        im = Image.open(f"{PAD}/{s}.png").convert("RGB").crop((COL[0], 0, COL[1], 2752))
        im = im.resize((int(im.width * 1.08), int(im.height * 1.08)), Image.LANCZOS)
        panels.append(im.crop((0, 0, im.width, min(im.height, H - TOP + 60))))
    gap = 90
    x = (W - sum(p.width for p in panels) - gap * (len(panels) - 1)) // 2
    for p in panels:
        place(bg, p, x, TOP)
        x += p.width + gap
    bg.save(f"ipad-13-{n}-{srcs[0][2:]}.png")
    print("ipad", n, bg.size)
