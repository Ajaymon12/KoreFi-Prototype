"""Builds WhatsNewPnl.tsrct (v2): a product tour of the new P&L Summary for the "What's new" popup.

Real screenshots of the page (shots/, captured from the running app with the sample restaurant), with a
camera that walks through what's new and a caption chip for each stop. 8 s, loops (starts and ends on
the bare background):
  0-1.0 s    the page settles in, whole                        "New: P&L Summary"
  1.0-3.0    push in on "Fees taken from each $1 sold"          "What each app keeps from every $1"
  3.0-4.7    glide to the channel columns, Sales → Money in    "Every channel, side by side"
  4.7-6.7    a cursor hovers DoorDash's "6 differ"; the real   "Unpaid orders, claimed for you"
             popover opens
  6.7-8.0    pull back out and fade
v1 (an illustrated $1 story) is kept in Versions/v1-illustration.
Re-run from this folder:  python3 .tesseract-work/build.py
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, ".tesseract-work")
T = os.path.expanduser("~/Library/Application Support/Tesseract/bin/tsrct")
P = os.path.join(ROOT, "WhatsNewPnl.tsrct")
C = "main"
CW, CH = 1280, 800
DUR = 8000
MEDIUM = "Google Sans Flex 24pt Medium"
GEO = json.load(open(os.path.join(W, "shots", "geo.json")))
K_SHOT = CW / 1440  # CSS px of the 1440-wide capture → page space (the page drawn 1280 wide)


def rgb(h, a=1.0):
    h = h.lstrip("#")
    return [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


def tsrct(*args):
    r = subprocess.run([T, *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"tsrct {' '.join(args)} failed:\n{r.stdout}\n{r.stderr}")
    return r.stdout


def apply(actions, name):
    path = os.path.join(W, name)
    json.dump(actions, open(path, "w"), indent=1)
    tsrct("project", "apply", "--project", P, "--actions", path)


def tf(anchor=(0, 0), pos=(0, 0), scale=100, opacity=100):
    return {"anchorPoint": list(anchor), "position": list(pos), "scale": [scale, scale], "rotation": 0, "opacity": opacity}


def rng(start, dur):
    return {"start": start, "duration": dur}


def page(box, pad=0):
    """A capture box (CSS px) in page space, padded."""
    b = GEO[box]
    return (b["x"] * K_SHOT - pad, b["y"] * K_SHOT - pad, b["w"] * K_SHOT + 2 * pad, b["h"] * K_SHOT + 2 * pad)


def center(box):
    x, y, w, h = page(box)
    return (x + w / 2, y + h / 2)


def rect(i, name, size, anchor, pos, color, rnd=0, parent=None, active=(0, DUR), opacity=100, stroke=None):
    r = {"size": list(size), "position": [0, 0], "roundness": rnd, "fillColor": color}
    if stroke:
        r.update({"strokeEnabled": True, "strokeColor": stroke[0], "strokeWidth": stroke[1]})
        r["fillEnabled"] = color[3] > 0
    return {"type": "createFxRectLayer", "compositionId": C, "layerId": i, "name": name, "insertIndex": 0,
            "parentLayerId": parent, "activeRange": rng(*active), "transform": tf(anchor, pos, 100, opacity), "rect": r}


def text(i, name, s, size, color, pos, parent=None, active=(0, DUR)):
    return {"type": "createFxTextLayer", "compositionId": C, "layerId": i, "name": name, "insertIndex": 0,
            "parentLayerId": parent, "activeRange": rng(*active), "transform": tf((0, 0), pos),
            "sourceText": {"text": s, "fontFamily": MEDIUM, "fontStyle": "Regular", "fontSize": size,
                           "fillColor": color, "strokeWidth": 0, "justification": "center"}}


def group(i, name, active, anchor=(0, 0), pos=(0, 0), parent=None, scale=100, opacity=100):
    return {"type": "createFxGroupLayer", "compositionId": C, "layerId": i, "name": name, "insertIndex": 0,
            "parentLayerId": parent, "activeRange": rng(*active), "transform": tf(anchor, pos, scale, opacity)}


SMOOTH = {"type": "cubicBezier", "x1": 0.65, "y1": 0, "x2": 0.25, "y2": 1}  # camera moves: ease in-out
OUT = {"type": "cubicBezier", "x1": 0.16, "y1": 1, "x2": 0.3, "y2": 1}
LIN = {"type": "linear"}


def keys(layer, prop, pts):
    return {"type": "setFxPropertyKeyframes", "compositionId": C, "property": {"layerId": layer, "propertyType": prop},
            "keyframes": [{"id": f"k{layer}-{prop}-{n}", "layerTime": t, "value": {"type": "float", "value": v}, "easing": e}
                          for n, (t, v, e) in enumerate(pts)]}


def fade(layer, t_in, t_out, d=250, peak=100):
    return keys(layer, "opacity", [(t_in, 0, LIN), (t_in + d, peak, LIN), (t_out - d, peak, LIN), (t_out, 0, LIN)])


# ── 0. fresh project ─────────────────────────────────────────────────────────────────────
if os.path.exists(P):
    os.remove(P)
tsrct("project", "create", "--project", P)
tsrct("project", "import-font", "--project", P, "--file", os.path.join(W, "fonts", "GoogleSansFlex-w500.ttf"))
for a, f in [("shot-page", "shots/a-page.png"), ("shot-popover", "shots/b-popover.png"), ("cursor", "assets/cursor.png")]:
    tsrct("project", "import-asset", "--project", P, "--file", os.path.join(W, f), "--asset-id", a, "--kind", "image")
ed = os.path.join(W, "editable.json")
tsrct("project", "checkout", "--project", P, "--output", ed)
doc = json.load(open(ed))
doc["dimensions"] = {"width": CW, "height": CH}
doc["duration"] = DUR / 1000
doc["backgroundColor"] = rgb("#FFF1E7")
json.dump(doc, open(ed, "w"), indent=1)
tsrct("project", "commit", "--project", P, "--file", ed)

# ── 1. structure ─────────────────────────────────────────────────────────────────────────
# Camera (10): the page in page space (1280×800); its anchor is the point looked at, its position the
# canvas centre, so anchor + scale keys move the camera. Rings and the cursor live inside it and stay
# pinned to the page while it moves.
BRAND = rgb("#F76808")
A = [
    {"type": "createFxRectLayer", "compositionId": C, "layerId": 1, "name": "Background", "insertIndex": 0,
     "activeRange": rng(0, DUR), "transform": tf((0, 0), (0, 0)),
     "rect": {"size": [CW, CH], "position": [0, 0], "roundness": 0, "fillColor": rgb("#FFF1E7"),
              "fillPaint": {"type": "gradient", "gradientType": "linear", "start": [0, 0], "end": [CW, CH],
                            "stops": [{"offset": 0, "color": rgb("#FFF8F2")}, {"offset": 1, "color": rgb("#FFDCC3")}]}}},
    group(10, "Camera", (0, DUR), anchor=(CW / 2, CH / 2), pos=(CW / 2, CH / 2), scale=86),
    rect(11, "Page shadow", (CW + 16, CH + 16), (0, 0), (-8, 4), rgb("#7A3A10", 0.08), rnd=12, parent=10),
]
# rings: the fees card, the channel columns, DoorDash's "differ" chip
FX, FY, FWD, FHT = page("fees", 10)
_, HY, _, _ = page("head")
_, MY, _, MH = page("moneyIn")
COLS_X0, COLS_X1 = 555 * K_SHOT, 1415 * K_SHOT  # In store … Grubhub columns
CX_, CY_, CWD, CHT = page("chip", 4)
RINGS = [(21, "Ring: fees", (FX, FY, FWD, FHT)),
         (22, "Ring: channels", (COLS_X0 - 6, HY - 2, COLS_X1 - COLS_X0 + 12, MY + MH - HY + 4)),
         (23, "Ring: differ", (CX_, CY_, CWD, CHT))]
for i, name, (x, y, w, h) in RINGS:
    A.append(rect(i, name, (w, h), (w / 2, h / 2), (x + w / 2, y + h / 2), rgb("#FFFFFF", 0), rnd=12, parent=10,
                  opacity=0, stroke=(BRAND, 3)))

# caption chip, fixed to the canvas (not the camera)
CAPS = [(31, "New: P&L Summary", 200, 1050), (32, "What each app keeps from every $1", 1350, 3000),
        (33, "Every channel, side by side", 3350, 4700), (34, "Unpaid orders, claimed for you", 5050, 6800)]
for i, s, t0, t1 in CAPS:
    w = len(s) * 13.2 + 64
    A.append(group(i, f"Caption: {s}", (t0, t1 - t0), anchor=(CW / 2, 726), pos=(CW / 2, 726), opacity=0))
    A.append(rect(i * 10, "Pill", (w, 56), (w / 2, 28), (CW / 2, 726), rgb("#1F1F1F", 0.92), rnd=28, parent=i, active=(0, t1 - t0)))
    A.append(text(i * 10 + 1, "Words", s, 24, rgb("#FFFFFF"), (CW / 2, 735), parent=i, active=(0, t1 - t0)))
apply(A, "layers.json")

# screenshots and cursor go in through the editable document (Image layers)
tsrct("project", "checkout", "--project", P, "--output", ed)
doc = json.load(open(ed))


def find(layers, i):
    for l in layers:
        if l["id"] == i:
            return l
        hit = find(l.get("layers") or l.get("children") or [], i)
        if hit:
            return hit


cam = find(doc["composition"]["layers"], 10)
kids_key = "layers" if "layers" in cam else "children"
kids = cam[kids_key]
s = CW / 2880 * 100


def shot(i, name, asset, op):
    return {"type": "Image", "id": i, "name": name, "blendMode": "normal", "activeRange": rng(0, DUR),
            "transform": tf((0, 0), (0, 0), s, op),
            "source": {"assetId": asset, "fit": "contain"}}


# order: index 0 is front — cursor, rings, popover shot, page shot, shadow
rings = [k for k in kids if k["id"] in (21, 22, 23)]
shadow = [k for k in kids if k["id"] == 11]
cursor = {"type": "Image", "id": 15, "name": "Cursor", "blendMode": "normal", "activeRange": rng(0, DUR),
          "transform": tf((15, 7), (900, 620), 34, 0), "source": {"assetId": "cursor", "fit": "contain"}}
cam[kids_key] = [cursor] + rings + [shot(13, "Page + popover", "shot-popover", 0), shot(12, "Page", "shot-page", 100)] + shadow
json.dump(doc, open(ed, "w"), indent=1)
tsrct("project", "commit", "--project", P, "--file", ed)

# ── 2. motion ────────────────────────────────────────────────────────────────────────────
K = []
fees_c = center("fees")
cols_c = ((COLS_X0 + COLS_X1) / 2, (HY + MY + MH) / 2)
chip_c = center("chip")
pop = page("popover")
pop_c = (pop[0] + pop[2] / 2 + 40, (CY_ + pop[1] + pop[3]) / 2)
home = (CW / 2, CH / 2)
camk = [  # (time, anchor, scale, easing)
    (0, home, 82, LIN), (900, home, 86, OUT),
    (1100, home, 86, LIN), (1900, fees_c, 200, SMOOTH),
    (3000, fees_c, 200, LIN), (3800, cols_c, 128, SMOOTH),
    (4700, cols_c, 128, LIN), (5400, pop_c, 175, SMOOTH),
    (6800, pop_c, 175, LIN), (7500, home, 86, SMOOTH),
]
# Keep the page filling the frame when zoomed in: the point looked at can't come closer to an edge than
# half the view (at that zoom), so the background never shows past the page.
def clamp(a, sc):
    if sc <= 100:
        return a
    hx, hy = CW / 2 / (sc / 100), CH / 2 / (sc / 100)
    return (min(max(a[0], hx), CW - hx), min(max(a[1], hy), CH - hy))


camk = [(t, clamp(a, sc), sc, e) for t, a, sc, e in camk]
K.append(keys(10, "anchorPointX", [(t, a[0], e) for t, a, _, e in camk]))
K.append(keys(10, "anchorPointY", [(t, a[1], e) for t, a, _, e in camk]))
K.append(keys(10, "scaleX", [(t, sc, e) for t, _, sc, e in camk]))
K.append(keys(10, "scaleY", [(t, sc, e) for t, _, sc, e in camk]))
K.append(keys(10, "opacity", [(0, 0, LIN), (350, 100, LIN), (7550, 100, LIN), (7950, 0, LIN)]))
# rings draw attention once the camera has arrived
K.append(fade(21, 1850, 3000, 200))
K.append(fade(22, 3750, 4700, 200))
K.append(fade(23, 5250, 5850, 150))
# cursor glides to the chip, the popover opens under it, then it slips away
K.append(keys(15, "opacity", [(4800, 0, LIN), (5000, 100, LIN), (6500, 100, LIN), (6750, 0, LIN)]))
K.append(keys(15, "positionX", [(4800, chip_c[0] + 120, LIN), (5500, chip_c[0] + 8, SMOOTH)]))
K.append(keys(15, "positionY", [(4800, chip_c[1] + 140, LIN), (5500, chip_c[1] + 4, SMOOTH)]))
K.append(keys(13, "opacity", [(5600, 0, LIN), (5750, 100, LIN), (7300, 100, LIN), (7500, 0, LIN)]))
# captions
for i, _, t0, t1 in CAPS:
    d = t1 - t0
    K.append(keys(i, "opacity", [(0, 0, LIN), (220, 100, LIN), (d - 220, 100, LIN), (d, 0, LIN)]))
    K.append(keys(i, "positionY", [(0, 742, LIN), (300, 726, OUT)]))
apply(K, "motion.json")
print("built", P)
