"""Generates every original graphic of the landing page (logo, phone screens, icons, QR).
Text is converted to outlines with the bundled Inter Tight font so the SVGs look the same everywhere.
Run: python tools/make_assets.py   (needs fonttools, brotli, qrcode)"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG, ICO = os.path.join(ROOT, "assets/img"), os.path.join(ROOT, "assets/icons")
FONT = os.path.join(ROOT, "assets/fonts/intertight-701d4a64.woff2")
_cache = {}


def font(w):
    if w not in _cache:
        f = TTFont(FONT)
        _cache[w] = instancer.instantiateVariableFont(f, {"wght": w}, inplace=False) if "fvar" in f else f
    return _cache[w]


def text_path(s, x, y, size, w=600, anchor="start", track=0):
    f = font(w)
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    k = size / f["head"].unitsPerEm
    adv = [gs[cmap[ord(c)]].width * k + track * size for c in s]
    total = sum(adv)
    cx = x - (total / 2 if anchor == "middle" else total if anchor == "end" else 0)
    d = []
    for c, a in zip(s, adv):
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}")
        gs[cmap[ord(c)]].draw(TransformPen(pen, (k, 0, 0, -k, cx, y)))
        d.append(pen.getCommands())
        cx += a
    return " ".join(d), total


def T(s, x, y, size, fill, w=600, anchor="start", track=0):
    d, _ = text_path(s, x, y, size, w, anchor, track)
    return f'<path d="{d}" fill="{fill}"/>'


def wrap(s, x, y, size, fill, width, w=400, lh=1.32, anchor="start"):
    lines, cur = [], ""
    for wd in s.split():
        t = (cur + " " + wd).strip()
        if text_path(t, 0, 0, size, w)[1] <= width:
            cur = t
        else:
            lines.append(cur)
            cur = wd
    lines.append(cur)
    return "".join(T(l, x, y + i * size * lh, size, fill, w, anchor) for i, l in enumerate(lines))


def write(path, s):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(s)


TEAL_D, TEAL_I, INK, MIST = "#b22435", "#8f1c2b", "#0e1116", "#5b6472"
SHIELD = "M24 5 L39 10.5 V23 C39 32.5 32.5 39.5 24 43 C15.5 39.5 9 32.5 9 23 V10.5 Z"
CHECK = "M16.5 24.5l5 5 10-11"

# ------------------------------------------------------------ logo (shield + check)
SC = "translate(24 24) scale(.8) translate(-24 -24)"
write(f"{IMG}/logo.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="1024" height="1024"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c92a3d"/><stop offset="1" stop-color="#8f1c2b"/></linearGradient></defs><rect width="48" height="48" fill="url(#b)"/><path d="{SHIELD}" transform="{SC}" fill="#ffcc33" fill-opacity=".22" stroke="#ffcc33" stroke-width="2.6" stroke-linejoin="round"/><path d="{CHECK}" transform="{SC}" fill="none" stroke="#ffcc33" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# ------------------------------------------------------------ footer wordmark
d, w = text_path("checkwith.us", 0, 0, 200, 700, track=-0.02)
asc, desc = 156, 44
write(f"{IMG}/wordmark-white.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -{asc} {w:.0f} {asc + desc}" width="{w:.0f}" height="{asc + desc}"><path d="{d}" fill="#fff"/></svg>')
print("wordmark aspect", round(w / (asc + desc), 3), "-> width", round(w), "height", asc + desc)

# ------------------------------------------------------------ phone screens
W, H = 1200, 2483
HOME = f'<rect x="{W / 2 - 190}" y="{H - 110}" width="380" height="14" rx="7" fill="{INK}" opacity=".85"/>'


def phone(inner, bg="#f4f7f6"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>'
            f'<clipPath id="s"><rect x="34" y="34" width="{W - 68}" height="{H - 68}" rx="150"/></clipPath>'
            '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c92a3d"/><stop offset="1" stop-color="#8f1c2b"/></linearGradient>'
            '<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0e1116" flood-opacity=".10"/></filter></defs>'
            f'<rect width="{W}" height="{H}" rx="190" fill="#0e1116"/><rect x="10" y="10" width="{W - 20}" height="{H - 20}" rx="182" fill="none" stroke="#3a414d" stroke-width="6"/>'
            f'<g clip-path="url(#s)"><rect x="34" y="34" width="{W - 68}" height="{H - 68}" fill="{bg}"/>{inner}</g>'
            f'<rect x="{W / 2 - 150}" y="62" width="300" height="86" rx="43" fill="#0e1116"/></svg>')


def status():
    return (T("9:41", 140, 142, 50, INK, 700)
            + f'<rect x="{W - 300}" y="108" width="62" height="30" rx="6" fill="none" stroke="{INK}" stroke-width="4" opacity=".6"/>'
            + f'<rect x="{W - 295}" y="113" width="44" height="20" rx="3" fill="{INK}"/>')


def shield_big(cx, cy, r, ok=True):
    col = "url(#g)" if ok else "#ffcc33"
    mark = CHECK if ok else "M24 15v11M24 31.5v.5"
    return (f'<g transform="translate({cx} {cy}) scale({r / 24}) translate(-24 -24)"><path d="{SHIELD}" fill="{col}"/>'
            f'<path d="{mark}" fill="none" stroke="{"#fff" if ok else INK}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>')


def card(x, y, w, h, fill="#fff", r=44):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" filter="url(#sh)"/>'


def button(x, y, w, h, label, size=84):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="60" fill="url(#g)"/>' + T(label, x + w / 2, y + h / 2 + size * 0.35, size, "#fff", 700, "middle")


# 1) Messages: a scam text was filtered
s = status() + T("Messages", 110, 330, 96, INK, 700)
s += card(90, 410, 1020, 330, "#fff3c4") + shield_big(205, 575, 62)
s += T("1 scam text blocked", 310, 548, 58, TEAL_I, 700) + T("It never reached your inbox.", 310, 620, 44, TEAL_D, 500)
s += T("Today", 110, 850, 44, MIST, 600)
y = 890
for n, m, c in [("Mom", "Dinner at 6? I made soup.", "#fbbf24"), ("Dr. Patel", "Reminder: visit on Thursday", "#60a5fa"),
                ("Pharmacy", "Your prescription is ready", "#34d399"), ("Anna", "Sending photos from the trip", "#f472b6")]:
    s += card(90, y, 1020, 235) + f'<circle cx="215" cy="{y + 118}" r="64" fill="{c}"/>' + T(n[0], 215, y + 140, 62, "#fff", 700, "middle")
    s += T(n, 320, y + 105, 54, INK, 700) + T(m, 320, y + 175, 44, MIST, 500)
    y += 265
write(f"{IMG}/screen-texts.svg", phone(s + HOME))

# 2) Payment paused (hero centre phone)
s = status() + shield_big(600, 470, 190, ok=False) + T("Paused", 600, 810, 150, INK, 700, "middle", -0.02)
s += wrap("Your family will call you before this goes through.", 600, 940, 60, MIST, 860, 500, anchor="middle")
s += card(110, 1200, 980, 380) + T("$200.00", 190, 1370, 120, INK, 700) + T("Gift cards", 190, 1450, 54, MIST, 500) + T("Paid during a phone call", 190, 1520, 46, "#7a5a00", 600)
s += button(110, 1690, 980, 220, "Ask my family") + T("Nothing else to do. We'll let you know.", 600, 2030, 46, MIST, 500, "middle")
write(f"{IMG}/screen-paused.svg", phone(s + HOME, "#fff3c4"))

# 3) Family approval (Guardian push)
s = status() + T("Family", 110, 330, 96, INK, 700) + card(80, 430, 1040, 880, "#ffffff", 56)
s += '<rect x="130" y="480" width="86" height="86" rx="22" fill="url(#g)"/>' + T("checkwith.us", 245, 548, 46, MIST, 600) + T("now", 1050, 548, 40, MIST, 500, "end")
s += T("Approve this payment?", 130, 700, 74, INK, 700) + T("Mom wants to send", 130, 800, 50, MIST, 500) + T("$200.00 to GiftCardsNow", 130, 880, 56, INK, 700)
s += '<rect x="130" y="940" width="940" height="180" rx="36" fill="#fff3c4"/>' + T("Why it was held", 175, 1010, 40, "#7a5a00", 700)
s += wrap("Gift card bought during a phone call.", 175, 1075, 46, INK, 840, 500)
s += '<rect x="130" y="1170" width="440" height="110" rx="32" fill="#eceff3"/>' + T("Deny", 350, 1245, 56, INK, 700, "middle")
s += '<rect x="600" y="1170" width="470" height="110" rx="32" fill="url(#g)"/>' + T("Approve", 835, 1245, 56, "#fff", 700, "middle")
s += T("Recent holds", 110, 1450, 54, INK, 700)
for i, (a, b, c) in enumerate([("$480 to a new payee", "Needs 2 of 3 approvals", "#7a5a00"), ("$62 to City Power", "Paid within allowance", TEAL_D)]):
    yy = 1500 + i * 250
    s += card(90, yy, 1020, 215) + f'<circle cx="190" cy="{yy + 108}" r="26" fill="{c}"/>' + T(a, 260, yy + 98, 52, INK, 700) + T(b, 260, yy + 160, 42, MIST, 500)
write(f"{IMG}/screen-approve.svg", phone(s + HOME))

# 4) Safe home (feature shot)
s = status() + shield_big(600, 470, 190) + T("You're safe", 600, 810, 150, INK, 700, "middle", -0.02)
s += wrap("Nothing to do. Your family is keeping watch.", 600, 940, 60, MIST, 860, 500, anchor="middle")
s += card(110, 1180, 980, 250) + T("Protected today", 190, 1300, 52, MIST, 600) + T("3 scams stopped", 190, 1385, 72, TEAL_I, 700)
s += button(110, 1560, 980, 220, "Ask my family")
write(f"{IMG}/screen-safe.svg", phone(s + HOME, "#fffbea"))


# ------------------------------------------------------------ icons
def icon(name, body):
    write(f"{ICO}/{name}.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="50" height="50"><linearGradient id="g-{name}" x1="38" y1="6" x2="10" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffcc33"/><stop offset="1" stop-color="#ffffff"/></linearGradient><g stroke="#b22435" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">{body}</g></svg>')


def F(n):
    return f'fill="url(#g-{n})"'


icon("texts", f'<path d="M7 11h34a2 2 0 0 1 2 2v19a2 2 0 0 1-2 2H22l-9 7v-7H7a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z" {F("texts")}/><path d="M18 19l9 8M27 19l-9 8"/>')
icon("calls", f'<path d="M12 6h8l3 9-5 3a24 24 0 0 0 12 12l3-5 9 3v8a3 3 0 0 1-3 3A34 34 0 0 1 8 9a3 3 0 0 1 4-3z" {F("calls")}/>')
icon("payments", f'<rect x="5" y="11" width="38" height="26" rx="5" {F("payments")}/><path d="M5 20h38M13 30h8"/>')
icon("freeze", f'<path d="M24 5v38M7.5 14.5l33 19M40.5 14.5l-33 19"/><circle cx="24" cy="24" r="7" {F("freeze")}/><path d="M19 8l5 4 5-4M19 40l5-4 5 4"/>')
icon("allowance", f'<circle cx="24" cy="24" r="18" {F("allowance")}/><path d="M24 13v11l7 5"/>')
icon("family", f'<circle cx="17" cy="16" r="6" {F("family")}/><circle cx="33" cy="18" r="5" {F("family")}/><path d="M5 40c0-7 5-12 12-12s12 5 12 12zM30 31c1-1 2-1 3-1 6 0 10 4 10 10H34"/>')
icon("shield", f'<path d="{SHIELD}" {F("shield")}/><path d="{CHECK}"/>')
icon("tap", f'<path d="M20 20V10a3.5 3.5 0 0 1 7 0v14l6 1a4 4 0 0 1 3.5 4L36 41H20L11 30a3 3 0 0 1 5-3l4 4z" {F("tap")}/><path d="M9 12a12 12 0 0 1 4-6M39 12a12 12 0 0 0-4-6"/>')
write(f"{ICO}/tick.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="50" height="50"><circle cx="24" cy="24" r="21" fill="#fff1c2"/><path d="M14 25l7 7 14-15" fill="none" stroke="#b22435" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# ------------------------------------------------------------ QR code to https://checkwith.us
import qrcode

qr = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
qr.add_data("https://checkwith.us")
qr.make(fit=True)
m = qr.get_matrix()
n = len(m)
path = "".join(f"M{x} {y}h1v1h-1z" for y, r in enumerate(m) for x, v in enumerate(r) if v)
write(f"{IMG}/qr-checkwith-us.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" width="500" height="500" shape-rendering="crispEdges"><rect width="{n}" height="{n}" fill="#fff"/><path d="{path}" fill="#0e1116"/></svg>')
print("done")
