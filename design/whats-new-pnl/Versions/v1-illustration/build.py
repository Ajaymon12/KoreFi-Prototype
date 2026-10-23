"""Builds WhatsNewPnl.tsrct: the animated left panel of KoreFi's "What's new: P&L Summary" popup.

Story (5.6 s, loops: first and last frames are the bare orange background):
  0.15-1.35 s a white $1 coin pops in, then shrinks away          "every dollar you sell"
  1.3-3.8 s   a card rises: four channels, each bar is that $1;   "what each app keeps"
              it fills, then each app's fee bites in from the right (Uber Eats, the costliest, in red)
  3.9-5.55 s  the card clears; "Net profit" counts up to 25%, holds  the payoff
Re-run from this folder's parent:  python3 .tesseract-work/build.py
It recreates the project from scratch (fonts and logos are re-imported).
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, ".tesseract-work")
T = os.path.expanduser("~/Library/Application Support/Tesseract/bin/tsrct")
P = os.path.join(ROOT, "WhatsNewPnl.tsrct")
C = "main"
SIZE = 680
DUR = 5600

MEDIUM = "Google Sans Flex 24pt Medium"
SEMI = "Google Sans Flex 24pt SemiBold"


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


def rect(i, name, size, anchor, pos, color, rnd=0, parent=None, active=(0, DUR), paint=None):
    r = {"size": list(size), "position": [0, 0], "roundness": rnd, "fillColor": color}
    if paint:
        r["fillPaint"] = paint
    return {"type": "createFxRectLayer", "compositionId": C, "layerId": i, "name": name, "insertIndex": 0,
            "parentLayerId": parent, "activeRange": rng(*active), "transform": tf(anchor, pos), "rect": r}


def text(i, name, s, font, size, color, pos, just="left", parent=None, active=(0, DUR), opacity=100):
    return {"type": "createFxTextLayer", "compositionId": C, "layerId": i, "name": name, "insertIndex": 0,
            "parentLayerId": parent, "activeRange": rng(*active), "transform": tf((0, 0), pos, 100, opacity),
            "sourceText": {"text": s, "fontFamily": font, "fontStyle": "Regular", "fontSize": size,
                           "fillColor": color, "strokeWidth": 0, "justification": just}}


def group(i, name, active, anchor=(0, 0), pos=(0, 0), parent=None, opacity=100):
    return {"type": "createFxGroupLayer", "compositionId": C, "layerId": i, "name": name, "insertIndex": 0,
            "parentLayerId": parent, "activeRange": rng(*active), "transform": tf(anchor, pos, 100, opacity)}


EASE_OUT = {"type": "cubicBezier", "x1": 0.16, "y1": 1, "x2": 0.3, "y2": 1}
EASE_IN = {"type": "cubicBezier", "x1": 0.5, "y1": 0, "x2": 0.75, "y2": 0}
EASE_POP = {"type": "cubicBezier", "x1": 0.34, "y1": 1.56, "x2": 0.64, "y2": 1}
LIN = {"type": "linear"}
HOLD = {"type": "hold"}


def keys(layer, prop, pts, kind="float"):
    """pts: [(layerTime, value, easing)]"""
    return {"type": "setFxPropertyKeyframes", "compositionId": C, "property": {"layerId": layer, "propertyType": prop},
            "keyframes": [{"id": f"k{layer}-{prop}-{n}", "layerTime": t, "value": {"type": kind, "value": v}, "easing": e}
                          for n, (t, v, e) in enumerate(pts)]}


def scale_keys(layer, pts):
    return [keys(layer, "scaleX", pts), keys(layer, "scaleY", pts)]


# ── 0. fresh project ─────────────────────────────────────────────────────────────────────
if os.path.exists(P):
    os.remove(P)
tsrct("project", "create", "--project", P)
for w in (500, 600):
    tsrct("project", "import-font", "--project", P, "--file", os.path.join(W, "fonts", f"GoogleSansFlex-w{w}.ttf"))
LOGOS = ["instore", "doordash", "ubereats", "grubhub"]
for a in LOGOS:
    tsrct("project", "import-asset", "--project", P, "--file", os.path.join(W, "assets", f"{a}.png"), "--asset-id", f"logo-{a}", "--kind", "image")

ed = os.path.join(W, "editable.json")
tsrct("project", "checkout", "--project", P, "--output", ed)
doc = json.load(open(ed))
doc["dimensions"] = {"width": SIZE, "height": SIZE}
doc["duration"] = DUR / 1000
doc["backgroundColor"] = rgb("#F76808")
json.dump(doc, open(ed, "w"), indent=1)
tsrct("project", "commit", "--project", P, "--file", ed)

# ── 1. layers (created bottom → top; each insert goes to the front) ───────────────────────
ORANGE_DARK = rgb("#ED5F00")
WHITE = rgb("#FFFFFF")
INK = rgb("#1F1F1F")
GREY = rgb("#6F6F6F")
RED = rgb("#E5484D")

A = []
A.append(rect(1, "Background", (SIZE, SIZE), (0, 0), (0, 0), rgb("#F76808"),
              paint={"type": "gradient", "gradientType": "linear", "start": [0, 0], "end": [SIZE, SIZE],
                     "stops": [{"offset": 0, "color": rgb("#FFB381")}, {"offset": 1, "color": rgb("#ED5F00")}]}))
A.append(rect(2, "Glow", (SIZE, SIZE), (0, 0), (0, 0), rgb("#FFFFFF", 0),
              paint={"type": "gradient", "gradientType": "radial", "start": [340, 300], "end": [340, 700],
                     "stops": [{"offset": 0, "color": rgb("#FFFFFF", 0.35)}, {"offset": 1, "color": rgb("#FFFFFF", 0)}]}))

# Card of channels: 1300-3900 ms
CARD = (1300, 2600)
A.append(group(20, "Fees card", CARD))
A.append(rect(21, "Card", (560, 430), (0, 0), (60, 125), WHITE, rnd=28, parent=20, active=(0, CARD[1])))
A.append(text(22, "Card label", "Fees from each $1", MEDIUM, 24, GREY, (100, 186), parent=20, active=(0, CARD[1])))
ROWS = [("instore", 3, False), ("doordash", 25, False), ("ubereats", 28, True), ("grubhub", 21, False)]
TRACK_X, TRACK_W, BAR_H = 176, 300, 14
for n, (logo, fee, worst) in enumerate(ROWS):
    g, yc = 30 + n * 10, 255 + n * 80
    A.append(group(g, f"Row {logo}", (0, CARD[1]), parent=20))
    A.append(rect(g + 1, "Track", (TRACK_W, BAR_H), (0, BAR_H / 2), (TRACK_X, yc), rgb("#F1F1F1"), rnd=7, parent=g, active=(0, CARD[1])))
    A.append(rect(g + 2, "The $1", (TRACK_W, BAR_H), (0, BAR_H / 2), (TRACK_X, yc), rgb("#FFCCA7"), rnd=7, parent=g, active=(0, CARD[1])))
    fw = max(TRACK_W * fee / 100, BAR_H)
    A.append(rect(g + 3, "App's cut", (fw, BAR_H), (fw, BAR_H / 2), (TRACK_X + TRACK_W, yc), RED if worst else rgb("#3A3A3A"), rnd=7, parent=g, active=(0, CARD[1])))
    A.append(text(g + 4, "Cut label", f"{fee}¢", SEMI, 28, RED if worst else INK, (586, yc + 10), just="right", parent=g, active=(0, CARD[1]), opacity=0))

# $1 coin: 0-1700 ms
COIN = (0, 1700)
A.append(group(10, "Dollar", COIN, anchor=(340, 330), pos=(340, 330)))
A.append(rect(11, "Coin", (230, 230), (115, 115), (340, 330), WHITE, rnd=115, parent=10, active=(0, COIN[1])))
A.append(text(12, "$1", "$1", SEMI, 112, ORANGE_DARK, (340, 370), just="center", parent=10, active=(0, COIN[1])))

# Net profit: 3700-5000 ms
PROFIT = (3880, 1720)
A.append(group(70, "Net profit", PROFIT, anchor=(340, 340), pos=(340, 340)))
A.append(text(71, "Label", "Net profit", MEDIUM, 36, rgb("#FFFFFF", 0.85), (340, 250), just="center", parent=70, active=(0, PROFIT[1])))
A.append(text(72, "Figure", "0%", SEMI, 190, WHITE, (340, 430), just="center", parent=70, active=(0, PROFIT[1])))
apply(A, "layers.json")

# ── 2. logos (Image layers go in through the editable document) ──────────────────────────
tsrct("project", "checkout", "--project", P, "--output", ed)
doc = json.load(open(ed))


def find(layers, i):
    for l in layers:
        if l["id"] == i:
            return l
        hit = find(l.get("layers") or l.get("children") or [], i)
        if hit:
            return hit


for n, (logo, _, _) in enumerate(ROWS):
    g = find(doc["composition"]["layers"], 30 + n * 10)
    kids_key = "layers" if "layers" in g else "children"
    s = 52 / 256 * 100
    g[kids_key].append({"type": "Image", "id": 30 + n * 10 + 5, "name": f"{logo} logo", "blendMode": "normal",
                        "activeRange": rng(0, CARD[1]), "transform": tf((128, 128), (128, 255 + n * 80), s),
                        "source": {"assetId": f"logo-{logo}", "fit": "contain"}})
json.dump(doc, open(ed, "w"), indent=1)
tsrct("project", "commit", "--project", P, "--file", ed)

# ── 3. motion ────────────────────────────────────────────────────────────────────────────
K = []
# coin: pop in, hold, shrink away
K += scale_keys(10, [(150, 0, LIN), (480, 108, EASE_POP), (620, 100, EASE_OUT), (1050, 100, LIN), (1350, 0, EASE_IN)])
K.append(keys(10, "opacity", [(150, 0, LIN), (300, 100, LIN), (1200, 100, LIN), (1350, 0, LIN)]))
# card: rise in (group clock starts at 1300), clear at the end
K.append(keys(20, "positionY", [(0, 50, LIN), (450, 0, EASE_OUT), (2200, 0, LIN), (2550, -20, EASE_IN)]))
K.append(keys(20, "opacity", [(0, 0, LIN), (300, 100, LIN), (2250, 100, LIN), (2550, 0, LIN)]))
for n in range(4):
    g = 30 + n * 10
    t0 = 300 + n * 110  # the $1 fills
    K.append(keys(g + 2, "scaleX", [(t0, 0, LIN), (t0 + 450, 100, EASE_OUT)]))
    t1 = 1000 + n * 130  # then the app's cut bites in from the right
    K.append(keys(g + 3, "scaleX", [(t1, 0, LIN), (t1 + 420, 100, EASE_OUT)]))
    K.append(keys(g + 4, "opacity", [(t1 + 150, 0, LIN), (t1 + 420, 100, EASE_OUT)]))
    K.append(keys(g + 4, "positionX", [(t1 + 150, 600, LIN), (t1 + 420, 586, EASE_OUT)]))
# net profit: settle in, count 0% → 25%, fade before the loop restarts
K += scale_keys(70, [(0, 90, LIN), (450, 100, EASE_OUT)])
K.append(keys(70, "opacity", [(0, 0, LIN), (250, 100, LIN), (1350, 100, LIN), (1680, 0, LIN)]))
count = [(100 + i * 22, f"{i}%", HOLD if i else LIN) for i in range(26)]
K.append(keys(72, "textContent", count, kind="string"))
apply(K, "motion.json")
print("built", P)
