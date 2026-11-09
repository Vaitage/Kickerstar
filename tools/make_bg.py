#!/usr/bin/env python3
"""Erzeugt den Kickertisch-Hintergrund (Draufsicht) als SVG – hoch- und querformat.

    python3 tools/make_bg.py   ->  public/img/table-portrait.svg, public/img/table-landscape.svg

Aufbau wie ein echter Kicker: 8 Stangen, Reihenfolge (von Tor A zu Tor B):
Rot Torwart(1), Rot Abwehr(2), Blau Sturm(3), Rot Mittelfeld(5),
Blau Mittelfeld(5), Rot Sturm(3), Blau Abwehr(2), Blau Torwart(1).
"""
from pathlib import Path

W, H = 600, 1000          # Spielfeld hochkant (Tore oben/unten)
FRAME = 34                # Rahmen außen
OUT = Path(__file__).resolve().parent.parent / 'public' / 'img'

RODS = [('r', 1), ('r', 2), ('b', 3), ('r', 5), ('b', 5), ('r', 3), ('b', 2), ('b', 1)]


def field(rotate=False):
    tw, th = W + 2 * FRAME, H + 2 * FRAME
    p = []
    a = p.append
    a('<defs>')
    a('<linearGradient id="grassA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f7a3a"/><stop offset=".5" stop-color="#25904a"/><stop offset="1" stop-color="#1f7a3a"/></linearGradient>')
    a('<linearGradient id="grassB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a6b33"/><stop offset=".5" stop-color="#1f7d3f"/><stop offset="1" stop-color="#1a6b33"/></linearGradient>')
    a('<linearGradient id="rod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c757d"/><stop offset=".25" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#b9c1c8"/><stop offset=".8" stop-color="#e4e8eb"/><stop offset="1" stop-color="#5d666e"/></linearGradient>')
    a('<linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2f33"/><stop offset=".5" stop-color="#15191c"/><stop offset="1" stop-color="#2a2f33"/></linearGradient>')
    a('<linearGradient id="frameEdge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7dde2"/><stop offset=".5" stop-color="#7c868f"/><stop offset="1" stop-color="#d7dde2"/></linearGradient>')
    for t, c1, c2 in (('r', '#ff5a5f', '#b3121b'), ('b', '#5aa2ff', '#1440a8')):
        a(f'<radialGradient id="body{t}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></radialGradient>')
    a('<radialGradient id="ball" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e9edf0"/><stop offset="1" stop-color="#aeb6bd"/></radialGradient>')
    a('<radialGradient id="light" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#ffffff" stop-opacity=".10"/><stop offset="1" stop-color="#000000" stop-opacity=".35"/></radialGradient>')
    a('<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>')
    a('</defs>')

    # Rahmen
    a(f'<rect width="{tw}" height="{th}" fill="url(#frame)"/>')
    a(f'<rect x="{FRAME - 4}" y="{FRAME - 4}" width="{W + 8}" height="{H + 8}" rx="6" fill="none" stroke="url(#frameEdge)" stroke-width="3"/>')
    a(f'<g transform="translate({FRAME},{FRAME})">')

    # Rasen in Streifen
    stripes = 12
    sh = H / stripes
    for i in range(stripes):
        a(f'<rect y="{i * sh:.1f}" width="{W}" height="{sh + .5:.1f}" fill="url(#grass{"A" if i % 2 == 0 else "B"})"/>')

    # Linien
    L = 'fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="4"'
    m = 22
    a(f'<rect x="{m}" y="{m}" width="{W - 2 * m}" height="{H - 2 * m}" {L}/>')
    a(f'<line x1="{m}" y1="{H / 2}" x2="{W - m}" y2="{H / 2}" {L}/>')
    a(f'<circle cx="{W / 2}" cy="{H / 2}" r="78" {L}/>')
    a(f'<circle cx="{W / 2}" cy="{H / 2}" r="6" fill="#fff" fill-opacity=".85"/>')
    for top in (True, False):
        y0 = m if top else H - m
        d = 1 if top else -1
        bw, bh = 300, 130   # Strafraum
        sw, shh = 150, 55   # Torraum
        a(f'<rect x="{(W - bw) / 2}" y="{y0 if top else y0 - bh}" width="{bw}" height="{bh}" {L}/>')
        a(f'<rect x="{(W - sw) / 2}" y="{y0 if top else y0 - shh}" width="{sw}" height="{shh}" {L}/>')
        a(f'<path d="M {W / 2 - 60} {y0 + d * bh} A 70 70 0 0 {0 if top else 1} {W / 2 + 60} {y0 + d * bh}" {L}/>')
        # Tor
        gw = 170
        gy = (-FRAME + 6) if top else H
        a(f'<rect x="{(W - gw) / 2}" y="{gy}" width="{gw}" height="{FRAME - 6}" rx="4" fill="#0b0e10" stroke="url(#frameEdge)" stroke-width="2"/>')

    # Lichtkegel/Vignette
    a(f'<rect width="{W}" height="{H}" fill="url(#light)"/>')

    # Stangen + Figuren
    gap = H / (len(RODS) + 1)
    for idx, (team, n) in enumerate(RODS):
        y = gap * (idx + 1)
        a(f'<rect x="{-FRAME - 30}" y="{y - 5:.1f}" width="{W + 2 * FRAME + 60}" height="10" rx="5" fill="url(#rod)" filter="url(#shadow)"/>')
        span = {1: 0, 2: 260, 3: 360, 5: 440}[n]
        xs = [W / 2] if n == 1 else [W / 2 - span / 2 + i * span / (n - 1) for i in range(n)]
        face = 1 if team == 'r' else -1   # Rot spielt nach unten, Blau nach oben
        for x in xs:
            a(f'<g transform="translate({x:.1f},{y:.1f})" filter="url(#shadow)">')
            a(f'<rect x="-21" y="-10" width="42" height="20" rx="10" fill="url(#body{team})"/>')               # Schultern
            a(f'<rect x="-6" y="{4 * face - 4 if face > 0 else -4 * 1 - 10}" width="12" height="14" rx="5" fill="url(#body{team})" opacity=".9"/>')  # Fuß
            a(f'<circle r="8.5" fill="#f1d3b5" stroke="#00000033" stroke-width="1"/>')                       # Kopf
            a(f'<circle r="8.5" fill="url(#body{team})" opacity=".35"/>')
            a('</g>')

    # Ball
    a(f'<g filter="url(#shadow)"><circle cx="{W / 2 + 58}" cy="{H / 2 + 34}" r="13" fill="url(#ball)"/></g>')
    a('</g>')

    inner = '\n'.join(p)
    if rotate:
        # Querformat: um 90° drehen
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {th} {tw}" preserveAspectRatio="xMidYMid slice">'
                f'<g transform="translate({th},0) rotate(90)">{inner}</g></svg>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {tw} {th}" preserveAspectRatio="xMidYMid slice">{inner}</svg>'


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'table-portrait.svg').write_text(field(False))
    (OUT / 'table-landscape.svg').write_text(field(True))
    print('ok', OUT)
