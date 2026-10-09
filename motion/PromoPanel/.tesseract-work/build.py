"""KoreFi signup-panel promo (silent, 9s loop, 910x1030).

Idea: money slips through the cracks (dark) -> the KoreFi slash sweeps in and
brings it back (orange) -> the slash shrinks into the real logo mark (cream).
The logo is native vector geometry parsed from public/get-started/logo.svg.

Beats (ms)
  0     dark: "Money slips / through / the cracks."  payout losses fall away
  2150  giant KoreFi slash sweeps across -> orange
  2550  "KoreFi gets it back."  $12,480 counts up, the losses rise back as gains
  4550  slash collapses into the logo mark; wordmark letters rise in
  6000  tagline; hold
  8400  fade to dark for a seamless loop
"""
import json
import re

C, FONT = "main", "Google Sans Flex"
W, H, DUR = 910, 1030, 9000
RANGE = {"start": 0, "duration": DUR}
layout, motion = [], []
_n = [1]


def nid():
    _n[0] += 1
    return _n[0] - 1


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


def tf(x=0, y=0, ax=0, ay=0, s=100, o=100, rot=0):
    return {"anchorPoint": [ax, ay], "position": [x, y], "scale": [s, s], "rotation": rot, "opacity": o}


def add(kind, name, parent, transform, **payload):
    i = nid()
    layout.append({"type": kind, "compositionId": C, "layerId": i, "name": name, "parentLayerId": parent,
                   "activeRange": RANGE, "transform": transform, **payload})
    return i


def group(name, parent=None, transform=None):
    return add("createFxGroupLayer", name, parent, transform or tf())


def rect(name, parent, x, y, w, h, fill, r=0, stroke=None, sw=2, o=100):
    shape = {"size": [w, h], "fillColor": fill, "roundness": r}
    if stroke:
        shape.update({"strokeEnabled": True, "strokeColor": stroke, "strokeWidth": sw})
    return add("createFxRectLayer", name, parent, tf(x + w / 2, y + h / 2, w / 2, h / 2, o=o), rect=shape)


def sfill(color):
    return {"paint": {"type": "solid", "color": color}, "fillRule": "nonZeroWinding", "blendMode": "normal", "opacity": 1}


def path_shape(name, parent, cmds, color, transform=None):
    return add("createFxShapeLayer", name, parent, transform or tf(),
               shape={"path": {"commands": cmds}, "strokes": [], "fills": [sfill(color)]})


def text(name, parent, x, y, s, size, color, style="Medium", just="left", tracking=0, o=100):
    return add("createFxTextLayer", name, parent, tf(x, y, o=o),
               sourceText={"text": s, "fontFamily": FONT, "fontStyle": style, "fontSize": size,
                           "fillColor": color, "strokeWidth": 0, "justification": just, "tracking": tracking})


# ---------- SVG path -> native commands (absolute M/L/H/V/C/Z, as in logo.svg) ----------
def svg_cmds(d):
    toks = re.findall(r"[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    out, i, cx, cy, op = [], 0, 0.0, 0.0, None
    while i < len(toks):
        if toks[i] in "MLHVCZ":
            op = toks[i]
            i += 1
            if op == "Z":
                out.append({"type": "close"})
                continue
        n = lambda k: float(toks[i + k])
        if op == "M":
            cx, cy = n(0), n(1); out.append({"type": "moveTo", "x": cx, "y": cy}); i += 2; op = "L"
        elif op == "L":
            cx, cy = n(0), n(1); out.append({"type": "lineTo", "x": cx, "y": cy}); i += 2
        elif op == "H":
            cx = n(0); out.append({"type": "lineTo", "x": cx, "y": cy}); i += 1
        elif op == "V":
            cy = n(0); out.append({"type": "lineTo", "x": cx, "y": cy}); i += 1
        elif op == "C":
            out.append({"type": "cubicTo", "c1x": n(0), "c1y": n(1), "c2x": n(2), "c2y": n(3), "x": n(4), "y": n(5)})
            cx, cy = n(4), n(5); i += 6
    return out


svg = open("logo.svg").read()
P = {m.group(1): svg_cmds(m.group(2)) for m in re.finditer(r'id="(Vector[_\d]*)" d="([^"]+)"', svg)}
SLASH, NOTCH = P["Vector"], P["Vector_2"]
LETTERS = [("K", P["Vector_8"]), ("o", P["Vector_7"]), ("r", P["Vector_6"]),
           ("e", P["Vector_5"]), ("F", P["Vector_4"]), ("i", P["Vector_3"])]

# ---------- easing / keys ----------
OUT = {"type": "cubicBezier", "x1": 0.16, "y1": 1, "x2": 0.3, "y2": 1}        # expo-out
INOUT = {"type": "cubicBezier", "x1": 0.7, "y1": 0, "x2": 0.2, "y2": 1}
GRAV = {"type": "cubicBezier", "x1": 0.55, "y1": 0, "x2": 1, "y2": 0.45}      # falling
POP = {"type": "cubicBezier", "x1": 0.3, "y1": 1.5, "x2": 0.5, "y2": 1}
LIN, HOLD = {"type": "linear"}, {"type": "hold"}


def keys(layer, prop, pts):
    motion.append({"type": "setFxPropertyKeyframes", "compositionId": C,
                   "property": {"layerId": layer, "propertyType": prop},
                   "keyframes": [{"id": f"L{layer}-{prop}-{k}", "layerTime": t,
                                  "value": {"type": "float", "value": v}, "easing": e}
                                 for k, (t, v, e) in enumerate(pts)]})


def script(layer, prop, code):
    motion.append({"type": "setFxPropertyAnimator", "compositionId": C,
                   "property": {"layerId": layer, "propertyType": prop},
                   "animator": {"type": "jsScript", "layerTimeJsCode": code}, "dependencies": []})


def scale_keys(layer, pts):
    for p in ("scaleX", "scaleY"):
        keys(layer, p, pts)


# ---------- palette ----------
DARK, CREAM, INK = hexc("#12100e"), hexc("#f7f4f1"), hexc("#171717")
ORANGE, ORANGE_DEEP = hexc("#fa934e"), hexc("#e8772e")
FADED = hexc("#f7f4f1", 0.45)

# ---------- logo lockup geometry (logo units -> canvas) ----------
LS = 6.4                                   # 83.88 x 20 units -> 537 x 128 px
LOGO_W = 83.88 * LS
LX, LY = (W - LOGO_W) / 2, 452            # top-left of the lockup
SLASH_ANCHOR = (10.4, 10.0)                # centre of the slash band, in logo units
SLASH_HOME = (LX + SLASH_ANCHOR[0] * LS, LY + SLASH_ANCHOR[1] * LS)

# ===== layers, top -> bottom =====
loop_fade = rect("Loop fade", None, 0, 0, W, H, DARK, o=0)

# --- beat 3: lockup ---
lockup = group("Logo lockup", None, tf(LX, LY, 0, 0, LS * 100))
letters = []
for name, cmds in LETTERS:
    letters.append(path_shape(f"Wordmark {name}", lockup, cmds, INK, tf(o=0)))
notch = path_shape("Mark notch", lockup, NOTCH, INK, tf(o=0))
mark_ink = path_shape("Mark slash", lockup, SLASH, INK, tf(o=0))
tagline = text("Tagline", None, W / 2, LY + 238, "Every dollar, accounted for.", 38, hexc("#5f5a55"), "Regular", "center", o=0)
kicker = group("Kicker", None, tf(W / 2, LY + 318, W / 2, LY + 318, o=0))
text("Kicker text", kicker, W / 2, LY + 327, "Built for restaurant owners", 24, hexc("#c56a2a"), "Medium", "center")
rect("Kicker pill", kicker, W / 2 - 180, LY + 292, 360, 52, hexc("#ffe9da"), r=26)

# --- beat 2: recovery (on orange) ---
b2 = group("Recovery scene", None, tf(o=0))
text("Headline", b2, 64, 206, "KoreFi gets it back.", 58, INK, "Medium", tracking=-10)
total = text("Total", b2, 58, 470, "$12,480", 176, INK, "Medium", tracking=-30)
text("Total label", b2, 66, 530, "recovered this month", 34, hexc("#171717", 0.7), "Regular")
GAINS = [("+$18.40", 64, 640), ("+$42.00", 330, 640), ("+$6.25", 596, 640),
         ("+$73.10", 64, 740), ("+$11.90", 330, 740), ("+$27.35", 596, 740)]
gains = []
for k, (s, x, y) in enumerate(GAINS):
    g = group(f"Gain {s}", b2, tf(x + 125, y + 36, x + 125, y + 36))
    text("Amount", g, x + 125, y + 50, s, 38, CREAM, "Medium", "center")
    rect("Pill", g, x, y, 250, 72, INK, r=36)
    gains.append((g, y + 36, k))
text("Footer", b2, 64, 930, "Delivery payouts · Chargebacks · Fees", 26, hexc("#171717", 0.62), "Regular")

# --- the sweeping slash (becomes the logo mark) ---
slash = path_shape("Sweep slash", None, SLASH, ORANGE,
                   tf(W + 1400, H / 2, SLASH_ANCHOR[0], SLASH_ANCHOR[1], 30000))
orange_bg = rect("Orange field", None, 0, 0, W, H, ORANGE, o=0)
cream_bg = rect("Cream field", None, 0, 0, W, H, CREAM, o=0)

# --- beat 1: the leak (on dark) ---
b1 = group("Leak scene", None)
text("Eyebrow", b1, 64, 150, "RESTAURANT MONEY", 22, hexc("#fa934e"), "Medium", tracking=180)
LINES = [("Money slips", CREAM), ("through", CREAM), ("the cracks.", ORANGE)]
line_ids = []
for k, (s, col) in enumerate(LINES):
    line_ids.append(text(f"Line {k + 1}", b1, 58, 290 + k * 118, s, 112, col, "Medium", tracking=-35))
LOSSES = [("−$18.40", 96, 690, -8), ("−$42.00", 360, 650, 6), ("−$6.25", 610, 720, -4),
          ("−$73.10", 200, 820, 10), ("−$11.90", 520, 830, -9)]
losses = []
for k, (s, x, y, rot) in enumerate(LOSSES):
    g = group(f"Loss {s}", b1, tf(x + 105, y + 32, x + 105, y + 32, rot=rot))
    text("Amount", g, x + 105, y + 45, s, 34, hexc("#ff8a7a"), "Medium", "center")
    rect("Pill", g, x, y, 210, 64, hexc("#2a1d19"), r=32, stroke=hexc("#5a3129"), sw=2)
    losses.append((g, y + 32, rot, k))
path_shape("Crack", b1, [{"type": "moveTo", "x": 0, "y": 960}, {"type": "lineTo", "x": 300, "y": 960},
                         {"type": "lineTo", "x": 330, "y": 990}, {"type": "lineTo", "x": 360, "y": 960},
                         {"type": "lineTo", "x": W, "y": 960}, {"type": "lineTo", "x": W, "y": 964},
                         {"type": "lineTo", "x": 362, "y": 964}, {"type": "lineTo", "x": 330, "y": 996},
                         {"type": "lineTo", "x": 298, "y": 964}, {"type": "lineTo", "x": 0, "y": 964},
                         {"type": "close"}], hexc("#3a302b"))
rect("Dark field", None, 0, 0, W, H, DARK)

# ================= motion =================
# beat 1: headline lines rise in, losses drop in then fall through the crack
for k, lid in enumerate(line_ids):
    t = 80 + k * 140
    keys(lid, "opacity", [(t, 0, LIN), (t + 250, 100, OUT)])
    keys(lid, "positionY", [(t, 290 + k * 118 + 70, LIN), (t + 700, 290 + k * 118, OUT)])
for g, cy, rot, k in losses:
    t = 600 + k * 110
    keys(g, "opacity", [(t, 0, LIN), (t + 200, 100, OUT)])
    fall = 1250 + k * 120
    keys(g, "positionY", [(t, cy - 40, LIN), (t + 450, cy, OUT), (fall, cy, LIN), (fall + 650, H + 220, GRAV)])
    keys(g, "rotation", [(fall, rot, LIN), (fall + 650, rot * 4, GRAV)])

# transition 1: slash sweeps right -> left and floods orange
keys(slash, "positionX", [(2150, W + 1400, LIN), (2500, W / 2, INOUT)])
keys(orange_bg, "opacity", [(0, 0, LIN), (2480, 0, HOLD), (2500, 100, HOLD)])

# beat 2
keys(b2, "opacity", [(0, 0, LIN), (2500, 0, HOLD), (2520, 100, HOLD), (4400, 100, LIN), (4560, 0, LIN)])
keys(b2, "positionY", [(2500, 40, LIN), (3100, 0, OUT)])
script(total, "textContent",
       "const p=Math.min(Math.max((input.time.seconds-2.6)/1.3,0),1);const e=1-Math.pow(1-p,4);"
       "return '$'+String(Math.round(12480*e)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');")
for g, cy, k in gains:
    t = 2850 + k * 90
    keys(g, "opacity", [(t, 0, LIN), (t + 150, 100, OUT)])
    keys(g, "positionY", [(t, H + 120, LIN), (t + 600, cy, OUT)])

# transition 2: orange collapses into the logo mark on cream
keys(orange_bg, "opacity", [(0, 0, LIN), (2480, 0, HOLD), (2500, 100, HOLD), (4560, 100, HOLD), (4580, 0, HOLD)])
keys(cream_bg, "opacity", [(0, 0, LIN), (4560, 0, HOLD), (4580, 100, HOLD)])
keys(slash, "positionX", [(2150, W + 1400, LIN), (2500, W / 2, INOUT), (4560, W / 2, LIN), (5250, SLASH_HOME[0], OUT)])
keys(slash, "positionY", [(4560, H / 2, LIN), (5250, SLASH_HOME[1], OUT)])
scale_keys(slash, [(4560, 30000, LIN), (5250, LS * 100, OUT)])
keys(slash, "opacity", [(5500, 100, LIN), (5800, 0, LIN)])
keys(mark_ink, "opacity", [(5500, 0, LIN), (5800, 100, LIN)])
keys(notch, "opacity", [(5150, 0, LIN), (5300, 100, OUT)])
keys(notch, "positionX", [(5150, -6, LIN), (5550, 0, OUT)])
for k, lid in enumerate(letters):
    t = 5250 + k * 60
    keys(lid, "opacity", [(t, 0, LIN), (t + 200, 100, OUT)])
    keys(lid, "positionY", [(t, 4, LIN), (t + 550, 0, OUT)])
keys(tagline, "opacity", [(6000, 0, LIN), (6350, 100, OUT)])
keys(tagline, "positionY", [(6000, LY + 258, LIN), (6600, LY + 238, OUT)])
keys(kicker, "opacity", [(6300, 0, LIN), (6550, 100, OUT)])
scale_keys(kicker, [(6300, 85, LIN), (6700, 100, POP)])

# loop: fade to the dark opening frame
keys(loop_fade, "opacity", [(8350, 0, LIN), (8950, 100, LIN)])

json.dump(layout, open("layout.json", "w"), indent=1)
json.dump(motion, open("motion.json", "w"), indent=1)
print(len(layout), "layout,", len(motion), "motion; slash home", SLASH_HOME)
