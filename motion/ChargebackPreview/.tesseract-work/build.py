"""Generates the Chargeback Overview motion as Tesseract action batches.

layout.json  -> every layer, in its settled (final) pose
motion.json  -> keyframes + procedural animators
Geometry is taken from the Figma preview image (1272x860).
"""
import json

C = "main"
FONT = "Google Sans Flex"
W, H = 1272, 860
DUR = 6000


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


def tf(x=0, y=0, ax=0, ay=0, s=100, o=100):
    return {"anchorPoint": [ax, ay], "position": [x, y], "scale": [s, s], "rotation": 0, "opacity": o}


RANGE = {"start": 0, "duration": DUR}
layout, motion = [], []
_next = [1]


def nid():
    i = _next[0]
    _next[0] += 1
    return i


def group(name, parent=None, cx=0, cy=0):
    """Group whose transform is identity but pivots on (cx, cy)."""
    i = nid()
    layout.append({"type": "createFxGroupLayer", "compositionId": C, "layerId": i, "name": name,
                   "parentLayerId": parent, "activeRange": RANGE, "transform": tf(cx, cy, cx, cy)})
    return i


def rect(name, parent, x, y, w, h, fill, r=0, stroke=None, sw=1.5, dashes=None, fill_on=True):
    i = nid()
    shape = {"size": [w, h], "fillColor": fill, "roundness": r, "fillEnabled": fill_on}
    if stroke:
        shape.update({"strokeEnabled": True, "strokeColor": stroke, "strokeWidth": sw})
        if dashes:
            shape["strokeDashes"] = dashes
    layout.append({"type": "createFxRectLayer", "compositionId": C, "layerId": i, "name": name,
                   "parentLayerId": parent, "activeRange": RANGE, "transform": tf(x, y), "rect": shape})
    return i


def stroke_style(color, width, dashes=None, cap="round"):
    s = {"paint": {"type": "solid", "color": color}, "width": width, "cap": cap, "join": "round",
         "miterLimit": 4, "blendMode": "normal", "opacity": 1}
    if dashes:
        s["dashes"] = dashes
    return s


def fill_style(color):
    return {"paint": {"type": "solid", "color": color}, "fillRule": "nonZeroWinding",
            "blendMode": "normal", "opacity": 1}


def shape(name, parent, commands=None, strokes=(), fills=(), ellipse=None, trim=None):
    i = nid()
    content = {"path": {"commands": commands or []}, "strokes": list(strokes), "fills": list(fills)}
    if ellipse:
        content["ellipse"] = ellipse
    if trim:
        content["trim"] = trim
    layout.append({"type": "createFxShapeLayer", "compositionId": C, "layerId": i, "name": name,
                   "parentLayerId": parent, "activeRange": RANGE, "transform": tf(), "shape": content})
    return i


def text(name, parent, x, baseline, s, size, color, style="Regular"):
    i = nid()
    layout.append({"type": "createFxTextLayer", "compositionId": C, "layerId": i, "name": name,
                   "parentLayerId": parent, "activeRange": RANGE, "transform": tf(x, baseline),
                   "sourceText": {"text": s, "fontFamily": FONT, "fontStyle": style, "fontSize": size,
                                  "fillColor": color, "strokeWidth": 0, "justification": "left"}})
    return i


def shadow(layer, item, color, offset, blur):
    layout.append({"type": "addFxLayerStyle", "compositionId": C, "layerId": layer, "itemId": item,
                   "style": {"type": "dropShadow", "enabled": True, "color": color, "offset": offset,
                             "blurRadius": blur, "spreadRadius": 0, "blendMode": "normal"}})


def M(x, y): return {"type": "moveTo", "x": x, "y": y}
def L(x, y): return {"type": "lineTo", "x": x, "y": y}
def Z(): return {"type": "close"}


EASE_OUT = {"type": "cubicBezier", "x1": 0.2, "y1": 0, "x2": 0.2, "y2": 1}
POP = {"type": "cubicBezier", "x1": 0.3, "y1": 1.35, "x2": 0.5, "y2": 1}
LIN = {"type": "linear"}


def keys(layer, prop, pts, tag):
    """pts: [(ms, value, easing)]"""
    motion.append({"type": "setFxPropertyKeyframes", "compositionId": C,
                   "property": {"layerId": layer, "propertyType": prop},
                   "keyframes": [{"id": f"{tag}-{prop}-{n}", "layerTime": t,
                                  "value": {"type": "float", "value": v}, "easing": e}
                                 for n, (t, v, e) in enumerate(pts)]})


def script(layer, prop, code):
    motion.append({"type": "setFxPropertyAnimator", "compositionId": C,
                   "property": {"layerId": layer, "propertyType": prop},
                   "animator": {"type": "jsScript", "layerTimeJsCode": code}, "dependencies": []})


def enter(layer, t, tag, dur=450, rise=0, base_y=None, scale_from=None, ease=EASE_OUT):
    keys(layer, "opacity", [(t, 0, LIN), (t + int(dur * 0.7), 100, EASE_OUT)], tag)
    if rise:
        keys(layer, "positionY", [(t, base_y + rise, LIN), (t + dur, base_y, ease)], tag)
    if scale_from is not None:
        for p in ("scaleX", "scaleY"):
            keys(layer, p, [(t, scale_from, LIN), (t + dur, 100, ease)], tag)


# palette (sampled from the design)
WHITE = hexc("#ffffff")
BORDER = hexc("#e6e6e6")
GREY_TXT = hexc("#70757a")
INK = hexc("#1f1f1f")
BLUE, BLUE_BG, BLUE_LINE = hexc("#4a7fe0"), hexc("#eef4fd"), hexc("#a3c1f5")
GREEN, GREEN_BG, GREEN_LINE = hexc("#3e9a5b"), hexc("#eef9ee"), hexc("#a8e0a8")
RED, RED_BG, RED_LINE = hexc("#d9534f"), hexc("#fdf2f1"), hexc("#f3b6b1")
AMBER, AMBER_BG, AMBER_LINE = hexc("#8a6a1d"), hexc("#fdf6e3"), hexc("#f2d27a")
ICON, ICON_BG = hexc("#4d82e8"), hexc("#e4edfc")

scene = group("Scene", cx=W / 2, cy=H / 2)

# ---------- floating feature chips (front) ----------
CHIPS = [  # label, x, y, w, icon, pop time
    ("Real-time P&L", 116, 70, 322, "grid", 700),
    ("Chargeback recovery", -28, 246, 421, "refresh", 1000),
    ("3PD reconciliation", 886, 246, 379, "layers", 1300),
    ("Automated disputes", 422, 652, 408, "shield", 2800),
]
chip_ids = []
for n, (label, x, y, w, icon, t) in enumerate(CHIPS):
    h = 106
    cy = y + h / 2
    g = group(f"Chip - {label}", scene, x + w / 2, cy)
    ix, iy = x + 64, cy
    text("Label", g, ix + 52, cy + 10, label, 27, INK)
    # icon glyph (26px box centred on ix, iy)
    s = stroke_style(ICON, 2.6)
    if icon == "grid":
        for dx, dy in ((-12, -12), (2, -12), (-12, 2), (2, 2)):
            rect("Grid cell", g, ix + dx, iy + dy, 10, 10, ICON, r=2.5, stroke=ICON, sw=2.4, fill_on=False)
    elif icon == "refresh":
        shape("Arrow arc", g, strokes=[s], ellipse={"position": [ix, iy], "size": [24, 24]},
              trim={"start": 8, "end": 42, "mode": "simultaneously"})
        shape("Arrow arc", g, strokes=[s], ellipse={"position": [ix, iy], "size": [24, 24]},
              trim={"start": 58, "end": 92, "mode": "simultaneously"})
        shape("Arrow head", g, [M(ix + 12, iy - 11), L(ix + 12, iy - 4), L(ix + 5, iy - 4)], [s])
        shape("Arrow head", g, [M(ix - 12, iy + 11), L(ix - 12, iy + 4), L(ix - 5, iy + 4)], [s])
    elif icon == "layers":
        shape("Layer top", g, [M(ix, iy - 12), L(ix + 13, iy - 5), L(ix, iy + 2), L(ix - 13, iy - 5), Z()], [s])
        shape("Layer mid", g, [M(ix - 13, iy + 1), L(ix, iy + 8), L(ix + 13, iy + 1)], [s])
        shape("Layer low", g, [M(ix - 13, iy + 7), L(ix, iy + 14), L(ix + 13, iy + 7)], [s])
    elif icon == "shield":
        shape("Shield", g, [M(ix, iy - 13), L(ix + 11, iy - 8),
                            {"type": "cubicTo", "c1x": ix + 11, "c1y": iy + 3, "c2x": ix + 6, "c2y": iy + 10, "x": ix, "y": iy + 13},
                            {"type": "cubicTo", "c1x": ix - 6, "c1y": iy + 10, "c2x": ix - 11, "c2y": iy + 3, "x": ix - 11, "y": iy - 8},
                            Z()], [s])
        shape("Check", g, [M(ix - 5, iy), L(ix - 1, iy + 4), L(ix + 5, iy - 3)], [s])
    shape("Icon disc", g, fills=[fill_style(ICON_BG)], ellipse={"position": [ix, iy], "size": [64, 64]})
    pill = rect("Chip pill", g, x, y, w, h, WHITE, r=h / 2, stroke=BORDER, sw=1.5)
    shadow(pill, 900 + n, [0.1, 0.1, 0.16, 0.10], [0, 8], 22)
    chip_ids.append((g, cy, t, n))

# ---------- dashboard card ----------
CX0, CY0, CW, CH = 68, 118, 1117, 592
card = group("Overview card", scene, CX0 + CW / 2, CY0 + CH / 2)

# pipeline row
pipe = group("Status pipeline", card, 626, 572)
PILLS = [("Claimable", 175, 178, BLUE, BLUE_BG, BLUE_LINE, 1300),
         ("Claimed", 443, 158, AMBER, AMBER_BG, AMBER_LINE, 1900),
         ("Won", 691, 111, GREEN, GREEN_BG, GREEN_LINE, 2500)]
pill_ids = []
for label, x, w, fg, bg, line, t in PILLS:
    g = group(f"Pill - {label}", pipe, x + w / 2, 573)
    tw = {"Claimable": 118, "Claimed": 97, "Won": 51}[label]
    text("Label", g, x + (w - tw) / 2, 581, label, 22, fg, "Medium")
    rect("Pill", g, x, 545, w, 56, bg, r=28, stroke=line, sw=1.5)
    pill_ids.append((g, t, label))
conn_ids = []
for n, (x0, x1) in enumerate(((377, 419), (625, 667))):
    conn_ids.append(shape(f"Connector {n + 1}", pipe, [M(x0, 573), L(x1, 573)],
                          [stroke_style(hexc("#c4c4c4"), 2, dashes=[6, 6], cap="butt")],
                          trim={"start": 0, "end": 100, "mode": "simultaneously"}))
pipe_box = rect("Pipeline frame", pipe, 133, 502, 986, 141, WHITE, r=12, stroke=hexc("#ececec"), sw=1.5,
                dashes=[8, 6], fill_on=False)

# stat cards
STATS = [("Claimable", 4820, 133, BLUE, BLUE_BG, BLUE_LINE, 450),
         ("Won", 3110, 473, GREEN, GREEN_BG, GREEN_LINE, 600),
         ("Declined", 640, 813, RED, RED_BG, RED_LINE, 750)]
stat_ids = []
for label, amount, x, fg, bg, line, t in STATS:
    g = group(f"Stat - {label}", card, x + 153, 378)
    val = text("Amount", g, x + 34, 406, f"${amount:,}", 32, fg, "Medium")
    text("Label", g, x + 34, 363, label, 22, GREY_TXT)
    rect("Stat bg", g, x, 305, 306, 147, bg, r=12, stroke=line, sw=1.5)
    stat_ids.append((g, val, amount, t))

# header
text("Title", card, 277, 189, "Chargeback Overview", 26, GREY_TXT)
for n, (cx, col) in enumerate(((130, "#f2b3ae"), (178, "#f5d98a"), (226, "#abe2a6"))):
    shape("Window dot", card, fills=[fill_style(hexc(col))], ellipse={"position": [cx, 180], "size": [26, 26]})
rect("Header divider", card, CX0, 240, CW, 1.5, hexc("#eeeeee"))
card_bg = rect("Card", card, CX0, CY0, CW, CH, WHITE, r=22, stroke=BORDER, sw=1.5)
shadow(card_bg, 800, [0.1, 0.1, 0.16, 0.08], [0, 14], 34)

# ---------------- motion ----------------
enter(card, 0, "card", dur=650, rise=36, base_y=CY0 + CH / 2, scale_from=97)

for g, val, amount, t in stat_ids:
    enter(g, t, f"stat{g}", dur=450, rise=18, base_y=378)
    start, dur = (t + 100) / 1000, 0.9
    script(val, "textContent",
           f"const p=Math.min(Math.max((input.time.seconds-{start})/{dur},0),1);"
           f"const e=1-Math.pow(1-p,3);"
           f"return '$'+String(Math.round({amount}*e)).replace(/\\B(?=(\\d{{3}})+(?!\\d))/g, ',');")

keys(pipe_box, "opacity", [(900, 0, LIN), (1200, 100, EASE_OUT)], "pipebox")
for g, t, label in pill_ids:
    enter(g, t, f"pill{g}", dur=380, scale_from=82, ease=POP)
for c, t in zip(conn_ids, (1600, 2200)):
    keys(c, "trimEnd", [(t, 0, LIN), (t + 300, 100, EASE_OUT)], f"conn{c}")

for g, cy, t, n in chip_ids:
    enter(g, t, f"chip{g}", dur=420, scale_from=86, ease=POP)
    # gentle idle float once settled, each chip on its own phase
    script(g, "positionY",
           f"const s=input.time.seconds;const k=Math.min(Math.max((s-{(t + 420) / 1000})/0.6,0),1);"
           f"return {cy}+Math.sin((s-{t / 1000})*2.1+{n * 1.3})*5*k;")

# whole scene fades out so the loop restarts cleanly
keys(scene, "opacity", [(5450, 100, LIN), (5950, 0, EASE_OUT)], "scene")

json.dump(layout, open("layout.json", "w"), indent=1)
json.dump(motion, open("motion.json", "w"), indent=1)
print(len(layout), "layout actions,", len(motion), "motion actions, last id", _next[0] - 1)
