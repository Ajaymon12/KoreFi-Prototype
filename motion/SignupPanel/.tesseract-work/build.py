"""KoreFi signup side-panel motion: a payout shortfall is caught, disputed, won, recovered.

Canvas 910x1030 (2x the 455px-wide panel). Writes layout.json + motion.json.
Story beats (ms):
  0     payout-check card enters, order rows slide in
  1400  scan bar sweeps rows; #4821 flags "-$18.40 short"
  2400  dispute card enters, stepper fills Detected -> Submitted -> Won
  2700  recovered card enters, total counts up, bars grow
  4150  "+$18.40" chip flies from Won into the total; total bumps
  7300  scene fades out for the loop
"""
import json

C, FONT = "main", "Google Sans Flex"
W, H, DUR = 910, 1030, 8000
RANGE = {"start": 0, "duration": DUR}
layout, motion = [], []
_n = [1]


def nid():
    _n[0] += 1
    return _n[0] - 1


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


def tf(x=0, y=0, ax=0, ay=0, s=100, o=100):
    return {"anchorPoint": [ax, ay], "position": [x, y], "scale": [s, s], "rotation": 0, "opacity": o}


def add(kind, name, parent, transform, **payload):
    i = nid()
    layout.append({"type": kind, "compositionId": C, "layerId": i, "name": name, "parentLayerId": parent,
                   "activeRange": RANGE, "transform": transform, **payload})
    return i


def group(name, parent=None, cx=0, cy=0):
    return add("createFxGroupLayer", name, parent, tf(cx, cy, cx, cy))


def rect(name, parent, x, y, w, h, fill, r=0, stroke=None, sw=1.5, dashes=None, fill_on=True, anchor=None):
    shape = {"size": [w, h], "fillColor": fill, "roundness": r, "fillEnabled": fill_on}
    if stroke:
        shape.update({"strokeEnabled": True, "strokeColor": stroke, "strokeWidth": sw})
        if dashes:
            shape["strokeDashes"] = dashes
    t = tf(x + anchor[0], y + anchor[1], *anchor) if anchor else tf(x, y)
    return add("createFxRectLayer", name, parent, t, rect=shape)


def sstroke(color, width, cap="round"):
    return {"paint": {"type": "solid", "color": color}, "width": width, "cap": cap, "join": "round",
            "miterLimit": 4, "blendMode": "normal", "opacity": 1}


def sfill(color):
    return {"paint": {"type": "solid", "color": color}, "fillRule": "nonZeroWinding", "blendMode": "normal", "opacity": 1}


def shape(name, parent, cmds=None, strokes=(), fills=(), ellipse=None, trim=None, pivot=None):
    content = {"path": {"commands": cmds or []}, "strokes": list(strokes), "fills": list(fills)}
    if ellipse:
        content["ellipse"] = ellipse
    if trim:
        content["trim"] = trim
    t = tf(pivot[0], pivot[1], pivot[0], pivot[1]) if pivot else tf()
    return add("createFxShapeLayer", name, parent, t, shape=content)


def disc(name, parent, cx, cy, d, color, pivot=True):
    return shape(name, parent, fills=[sfill(color)], ellipse={"position": [cx, cy], "size": [d, d]},
                 pivot=(cx, cy) if pivot else None)


def text(name, parent, x, y, s, size, color, style="Regular", just="left"):
    return add("createFxTextLayer", name, parent, tf(x, y),
               sourceText={"text": s, "fontFamily": FONT, "fontStyle": style, "fontSize": size,
                           "fillColor": color, "strokeWidth": 0, "justification": just})


def shadow(layer, item, a=0.07, oy=10, blur=28):
    layout.append({"type": "addFxLayerStyle", "compositionId": C, "layerId": layer, "itemId": item,
                   "style": {"type": "dropShadow", "enabled": True, "color": [0.35, 0.22, 0.1, a],
                             "offset": [0, oy], "blurRadius": blur, "spreadRadius": 0, "blendMode": "normal"}})


def M(x, y): return {"type": "moveTo", "x": x, "y": y}
def L(x, y): return {"type": "lineTo", "x": x, "y": y}
def Q(c1x, c1y, c2x, c2y, x, y): return {"type": "cubicTo", "c1x": c1x, "c1y": c1y, "c2x": c2x, "c2y": c2y, "x": x, "y": y}
def Z(): return {"type": "close"}


OUT = {"type": "cubicBezier", "x1": 0.2, "y1": 0, "x2": 0.2, "y2": 1}
INOUT = {"type": "cubicBezier", "x1": 0.6, "y1": 0, "x2": 0.3, "y2": 1}
POP = {"type": "cubicBezier", "x1": 0.3, "y1": 1.45, "x2": 0.5, "y2": 1}
LIN = {"type": "linear"}
HOLD = {"type": "hold"}


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


def fade_in(layer, t, dur=300):
    keys(layer, "opacity", [(t, 0, LIN), (t + dur, 100, OUT)])


def scale_in(layer, t, frm=80, dur=420, ease=POP):
    for p in ("scaleX", "scaleY"):
        keys(layer, p, [(t, frm, LIN), (t + dur, 100, ease)])


def rise_in(layer, t, base_y, rise=28, dur=600):
    fade_in(layer, t, int(dur * 0.6))
    keys(layer, "positionY", [(t, base_y + rise, LIN), (t + dur, base_y, OUT)])


# palette — KoreFi signup: warm neutrals + the brand orange from the CTA
BG = hexc("#f7f4f1")
WHITE = hexc("#ffffff")
LINE = hexc("#ece7e2")
INK, MUTED = hexc("#1f1f1f"), hexc("#7a7570")
ORANGE, ORANGE_SOFT, ORANGE_TINT = hexc("#fa934e"), hexc("#ffb381"), hexc("#fff1e6")
GREEN, GREEN_TINT = hexc("#2f9a5a"), hexc("#e9f7ee")
RED, RED_TINT, RED_LINE = hexc("#d9534f"), hexc("#fdf1f0"), hexc("#f3b9b4")

scene = group("Scene", cx=W / 2, cy=H / 2)

# ---------------- flying "+$18.40" chip (topmost) ----------------
fly = group("Recovered chip", scene, 750, 590)
text("Amount", fly, 750, 600, "+$18.40", 26, GREEN, "Medium", "center")
rect("Chip", fly, 682, 566, 136, 48, WHITE, r=24, stroke=hexc("#a9dcbc"), sw=1.5)

# ================= Card C: recovered this month =================
CY_C = 716
cardC = group("Recovered card", scene, W / 2, CY_C + 136)
total_grp = group("Total", cardC, 96, CY_C + 114)
total = text("Total amount", total_grp, 96, CY_C + 136, "$12,480", 60, INK, "Medium")
text("Label", cardC, 96, CY_C + 62, "Recovered this month", 24, MUTED)
trend = group("Trend", cardC, 150, CY_C + 176)
text("Trend label", trend, 132, CY_C + 185, "18% vs last month", 22, GREEN, "Medium")
shape("Trend arrow", trend, [M(100, CY_C + 184), L(110, CY_C + 172), L(120, CY_C + 184)], [sstroke(GREEN, 3)])
# weekly bars, grown from the baseline
bars = []
HEIGHTS = [64, 88, 72, 112, 96, 130, 118, 150]
for k, bh in enumerate(HEIGHTS):
    x = 486 + k * 44
    col = ORANGE if k == len(HEIGHTS) - 1 else hexc("#f6e2d3")
    bars.append(rect(f"Bar {k + 1}", cardC, x, CY_C + 224 - bh, 28, bh, col, r=8, anchor=(14, bh)))
rect("Baseline", cardC, 470, CY_C + 232, 368, 1.5, LINE)
cardC_bg = rect("Card", cardC, 56, CY_C, 798, 272, WHITE, r=22, stroke=LINE)
shadow(cardC_bg, 903)

# ================= Card B: dispute stepper =================
CY_B = 432
cardB = group("Dispute card", scene, W / 2, CY_B + 128)
text("Title", cardB, 96, CY_B + 64, "Dispute · Order #4821", 26, INK, "Medium")
# auto-filed tag
text("Tag label", cardB, 708, CY_B + 62, "Auto-filed", 20, MUTED)
shape("Doc icon", cardB, [M(678, CY_B + 42), L(688, CY_B + 42), L(694, CY_B + 48), L(694, CY_B + 64), L(678, CY_B + 64), Z()],
      [sstroke(MUTED, 2)])
rect("Tag", cardB, 660, CY_B + 34, 158, 40, hexc("#f7f4f1"), r=20, stroke=LINE)

NODES = [(170, "Detected", 2500, ORANGE), (455, "Submitted", 3250, ORANGE), (740, "Won", 4000, GREEN)]
NY = CY_B + 150
node_parts = []
for x, label, t, col in NODES:
    g = group(f"Step - {label}", cardB, x, NY)
    shape("Check", g, [M(x - 8, NY), L(x - 2, NY + 6), L(x + 9, NY - 6)], [sstroke(WHITE, 3.5)])
    disc("Active disc", g, x, NY, 44, col, pivot=False)
    node_parts.append((g, t, col, x))
    text(f"{label} label", cardB, x, NY + 60, label, 22, MUTED, "Regular", "center")
ring = shape("Won pulse", cardB, strokes=[sstroke(GREEN, 3)],
             ellipse={"position": [740, NY], "size": [44, 44]}, pivot=(740, NY))
for x, *_ in NODES:
    disc("Idle node", cardB, x, NY, 44, WHITE, pivot=False)
    shape("Idle ring", cardB, strokes=[sstroke(hexc("#dcd5ce"), 2.5)], ellipse={"position": [x, NY], "size": [42, 42]})
progress = shape("Progress", cardB, [M(170, NY), L(740, NY)], [sstroke(ORANGE, 5)],
                 trim={"start": 0, "end": 0, "mode": "simultaneously"})
shape("Track", cardB, [M(170, NY), L(740, NY)], [sstroke(hexc("#ede7e1"), 5)])
cardB_bg = rect("Card", cardB, 56, CY_B, 798, 256, WHITE, r=22, stroke=LINE)
shadow(cardB_bg, 902)

# ================= Card A: 3PD payout check =================
CY_A = 44
cardA = group("Payout card", scene, W / 2, CY_A + 182)
text("Title", cardA, 96, CY_A + 64, "Delivery payout check", 26, INK, "Medium")
live = group("Live tag", cardA, 770, CY_A + 54)
text("Live label", live, 760, CY_A + 62, "Live", 20, hexc("#c56a2a"), "Medium")
live_dot = disc("Live dot", live, 742, CY_A + 55, 12, ORANGE)
rect("Live pill", live, 724, CY_A + 34, 94, 40, ORANGE_TINT, r=20)

# scan bar sweeps the rows (above rows, below header)
scan = group("Scan", cardA, W / 2, CY_A + 144)
rect("Scan edge", scan, 80, CY_A + 110, 750, 3, ORANGE, r=1.5)
rect("Scan wash", scan, 80, CY_A + 110, 750, 68, hexc("#ffb381", 0.16), r=12)

ROWS = [("#4819", "Delivery app", "$36.80", False), ("#4821", "Delivery app", "$24.20", True),
        ("#4824", "Pickup", "$52.10", False)]
row_groups, flag = [], None
for k, (order, src, amt, short) in enumerate(ROWS):
    y = CY_A + 110 + k * 80
    g = group(f"Row {order}", cardA, W / 2, y + 34)
    if short:
        red_amt = text("Amount short", g, 810, y + 44, amt, 24, RED, "Medium", "right")
    amt_id = text("Amount", g, 810, y + 44, amt, 24, INK, "Medium", "right")
    if short:
        ink_amt = amt_id
    text("Order", g, 168, y + 32, f"Order {order}", 22, INK, "Medium")
    text("Source", g, 168, y + 56, src, 18, MUTED)
    # bag glyph
    bx, by = 124, y + 34
    shape("Bag", g, [M(bx - 9, by - 5), L(bx + 9, by - 5), L(bx + 10, by + 10), L(bx - 10, by + 10), Z()], [sstroke(ORANGE, 2.2)])
    shape("Bag handle", g, [M(bx - 4, by - 5), Q(bx - 4, by - 13, bx + 4, by - 13, bx + 4, by - 5)], [sstroke(ORANGE, 2.2)])
    disc("Icon disc", g, bx, by, 48, ORANGE_TINT, pivot=False)
    if short:
        flag = group("Short flag", g, 580, y + 34)
        text("Flag", flag, 580, y + 42, "−$18.40 short", 20, RED, "Medium", "center")
        rect("Flag pill", flag, 508, y + 16, 144, 36, WHITE, r=18, stroke=RED_LINE)
        tint = rect("Short tint", g, 80, y, 750, 68, RED_TINT, r=14, stroke=RED_LINE)
    rect("Row", g, 80, y, 750, 68, hexc("#fbf9f7"), r=14, stroke=hexc("#f0ebe6"))
    row_groups.append((g, y + 34, k))
rect("Header divider", cardA, 56, CY_A + 90, 798, 1.5, hexc("#f1ece7"))
cardA_bg = rect("Card", cardA, 56, CY_A, 798, 364, WHITE, r=22, stroke=LINE)
shadow(cardA_bg, 901)

# ---------------- background ----------------
dots = []
for gx in range(0, W + 1, 34):
    for gy in range(0, H + 1, 34):
        dots += [M(gx - 1.3, gy - 1.3), L(gx + 1.3, gy - 1.3), L(gx + 1.3, gy + 1.3), L(gx - 1.3, gy + 1.3), Z()]
glow = disc("Warm glow", None, 760, 120, 520, hexc("#ffc9a3", 0.55))
layout.append({"type": "addFxLayerEffect", "compositionId": C, "layerId": glow, "effectId": 950,
               "effect": {"type": "gaussianBlur", "blurriness": 140}})
shape("Dot grid", None, dots, fills=[sfill(hexc("#e6dfd8"))])

# ================= motion =================
rise_in(cardA, 0, CY_A + 182)
for g, base, k in row_groups:
    t = 350 + k * 170
    fade_in(g, t, 300)
    keys(g, "positionX", [(t, W / 2 + 36, LIN), (t + 500, W / 2, OUT)])
script(live_dot, "opacity", "return 55+45*Math.cos(input.time.seconds*Math.PI*1.6);")

# scan: sweep rows 1 -> 3, pause on the short row
sy = CY_A + 144
keys(scan, "opacity", [(1300, 0, LIN), (1450, 100, OUT), (2350, 100, LIN), (2600, 0, OUT)])
keys(scan, "positionY", [(1300, sy, LIN), (1750, sy + 80, INOUT), (2050, sy + 80, LIN), (2400, sy + 160, INOUT)])
fade_in(tint, 1750, 250)
fade_in(red_amt, 1750, 250)
keys(ink_amt, "opacity", [(1750, 100, LIN), (2000, 0, OUT)])
fade_in(flag, 1800, 200)
scale_in(flag, 1800, 70, 420)

rise_in(cardB, 2250, CY_B + 128)
keys(progress, "trimEnd", [(2500, 0, LIN), (3250, 50, INOUT), (4000, 100, INOUT)])
for g, t, col, x in node_parts:
    fade_in(g, t, 150)
    scale_in(g, t, 55, 450)
script(ring, "scaleX", "const s=input.time.seconds-4.0;if(s<0)return 100;return 100+((s%1.4)/1.4)*90;")
script(ring, "scaleY", "const s=input.time.seconds-4.0;if(s<0)return 100;return 100+((s%1.4)/1.4)*90;")
script(ring, "opacity", "const s=input.time.seconds-4.0;if(s<0)return 0;return 70*(1-(s%1.4)/1.4);")

rise_in(cardC, 2700, CY_C + 136)
for k, b in enumerate(bars):
    t = 2900 + k * 70
    keys(b, "scaleY", [(t, 0, LIN), (t + 550, 100, OUT)] +
         ([(4800, 100, LIN), (5150, 118, POP)] if k == len(bars) - 1 else []))
script(total, "textContent",
       "const s=input.time.seconds;const ease=p=>1-Math.pow(1-Math.min(Math.max(p,0),1),3);"
       "const v=12462*ease((s-2.9)/1.1)+18*ease((s-4.8)/0.35);"
       "return '$'+String(Math.round(v)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');")
for p in ("scaleX", "scaleY"):
    keys(total_grp, p, [(4780, 100, LIN), (4950, 106, OUT), (5250, 100, OUT)])
fade_in(trend, 3700, 350)

# chip: appears on Won, arcs down into the total, then dissolves
keys(fly, "opacity", [(4150, 0, LIN), (4300, 100, OUT), (4700, 100, LIN), (4880, 0, LIN)])
scale_in(fly, 4150, 60, 350)
keys(fly, "positionX", [(4300, 740, LIN), (4850, 250, INOUT)])
keys(fly, "positionY", [(4300, NY, LIN), (4850, CY_C + 116, {"type": "cubicBezier", "x1": 0.5, "y1": 0, "x2": 0.9, "y2": 0.6})])

keys(scene, "opacity", [(7300, 100, LIN), (7900, 0, OUT)])

json.dump(layout, open("layout.json", "w"), indent=1)
json.dump(motion, open("motion.json", "w"), indent=1)
print(len(layout), "layout,", len(motion), "motion, last id", _n[0] - 1)
