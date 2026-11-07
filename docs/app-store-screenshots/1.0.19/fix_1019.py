# Fixes on the 1.0.19 set: captions clear of the frame, no empty footer on the ask shot,
# iPad images from real iPad captures (one screen, as the app runs there).
#   python3 fix_1019.py /tmp/store/ipad
import sys
from PIL import Image, ImageDraw, ImageFont

SF = "/System/Library/Fonts/SFNS.ttf"
def font(size, weight):
    f = ImageFont.truetype(SF, size)
    f.set_variation_by_axes([100, 28, 400, weight])
    return f

def backdrop(w, h):
    bg = Image.new("RGB", (w, h)); d = ImageDraw.Draw(bg)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(10 + 12 * t), int(18 + 20 * t), int(36 + 40 * t)))
    return bg, d

def rounded(im, r):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    im = im.convert("RGBA"); im.putalpha(m); return im

def captions(d, W, l1, l2, s1, s2, y1, y2):
    for text, f, y, c in ((l1, font(s1, 760), y1, (255, 255, 255)), (l2, font(s2, 520), y2, (120, 180, 255))):
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=c)

def frame_top(im):
    x = 200
    return next(y for y in range(200, 700) if sum(abs(a - b) for a, b in zip(im.getpixel((x, y)), (60, 80, 120))) < 40)

def recaption(name, l1, l2):
    im = Image.open(name).convert("RGB"); W, H = im.size
    top = frame_top(im)
    body = im.crop((0, top, W, H))
    k = 0.92
    body = body.resize((int(W * k), int(body.height * k)), Image.LANCZOS)
    bg, d = backdrop(W, H)
    bg.paste(body, ((W - body.width) // 2, 330))
    captions(d, W, l1, l2, 92, 80, 60, 180)
    bg.save(name); print("recaptioned", name)

recaption("iphone-6.5-3-remote.png", "The remote on your phone", "your channels, one tap")
recaption("iphone-6.5-7-swipe.png", "Prefer to swipe?", "tap the corner to switch")

# Ask: the TMDB block sits mid-screen under a short chat. Same screen color over it.
im = Image.open("iphone-6.5-2-ask.png").convert("RGB")
fill = im.getpixel((640, 1900))
ImageDraw.Draw(im).rectangle((150, 1440, 1134, 1760), fill=fill)
im.save("iphone-6.5-2-ask.png"); print("ask footer cleared", fill)

PAD = sys.argv[1]
W, H = 2064, 2752
for n, (src, l1, l2) in enumerate([
    ("1-sports", "Tonight's game, your channel", "and one tap puts it on"),
    ("4-remote", "The remote for your TV", "channels and apps, one tap"),
], 1):
    bg, d = backdrop(W, H)
    captions(d, W, l1, l2, 120, 104, 120, 270)
    shot = Image.open(f"{PAD}/{src}.png").convert("RGB")
    sw = 1720; shot = shot.resize((sw, int(shot.height * sw / shot.width)), Image.LANCZOS)
    top = 470; shot = shot.crop((0, 0, sw, min(shot.height, H - top - 40)))
    x = (W - sw) // 2
    border = rounded(Image.new("RGB", (sw + 12, shot.height + 12), (60, 80, 120)), 52)
    bg.paste(border, (x - 6, top - 6), border)
    r = rounded(shot, 46); bg.paste(r, (x, top), r)
    out = f"ipad-13-{n}-{src[2:]}.png"; bg.save(out); print(out, bg.size)
