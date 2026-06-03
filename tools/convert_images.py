#!/usr/bin/env python3
"""A1/A2/A3 — Convert original card art (./5legends cartes/) to optimised HD JPEG
in assets/cards/[faction]/, respecting existing asset filenames.

Rules (A2):
  - RGB
  - width >= 1024  -> resize to 1024x1536 LANCZOS ; else keep native (never upscale)
  - UnsharpMask(radius=1, percent=60, threshold=2)
  - JPEG quality=92, optimize, progressive
  - cap 800KB: drop quality by 2 until <800KB, floor q85
"""
import os, sys, unicodedata, io
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "5legends cartes")
DST = os.path.join(ROOT, "assets", "cards")

FACTION_MAP = {  # source folder -> asset folder
    "grec": "greek", "japan": "yokai", "maya": "aztec",
    "nordic": "norse", "egyptian": "egyptian",
}

# Explicit overrides: normalized original name -> existing asset basename
OVERRIDES = {
    # greek
    "charybdis": "charybde", "cyclops": "cyclop", "harpy": "harpie",
    "hippocampus": "hippocampe", "nemeanlyon": "liondenemee",
    "pegasus": "pegase", "sirene": "siren", "artemis": "arthemis",
    "hephaitos": "hephaistos",
    # egyptian
    "thoth": "toth",
    # nordic
    "heimdal": "heimdall", "hildlisvini": "hildisvini",
}

MAX_BYTES = 800 * 1024


def norm(name):
    base = os.path.splitext(name)[0]
    base = unicodedata.normalize("NFKD", base)
    base = "".join(c for c in base if not unicodedata.combining(c))
    base = base.lower()
    return "".join(c for c in base if c.isalnum())


def existing_assets(faction):
    d = os.path.join(DST, faction)
    out = {}
    if not os.path.isdir(d):
        return out
    for f in os.listdir(d):
        if f.lower().endswith(".jpeg") or f.lower().endswith(".jpg"):
            out[os.path.splitext(f)[0].lower()] = f
    return out


def encode(img, cap=True):
    q = 92
    while True:
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        data = buf.getvalue()
        if not cap or len(data) < MAX_BYTES or q <= 85:
            return data, q
        q -= 2


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "convert"
    rows = []
    unmatched = []
    for src_fac, asset_fac in FACTION_MAP.items():
        assets = existing_assets(asset_fac)
        for sub in ("creatures", "gods"):
            sdir = os.path.join(SRC, src_fac, sub)
            if not os.path.isdir(sdir):
                continue
            for fn in sorted(os.listdir(sdir)):
                if fn.startswith(".") or fn == ".DS_Store":
                    continue
                path = os.path.join(sdir, fn)
                if not os.path.isfile(path):
                    continue
                try:
                    im = Image.open(path)
                except Exception as e:
                    print("SKIP (open fail):", path, e)
                    continue
                w, h = im.size
                sz = os.path.getsize(path)
                n = norm(fn)
                target = assets.get(n) or (
                    (n in OVERRIDES and assets.get(OVERRIDES[n])) or None)
                if mode == "diagnose":
                    rows.append((src_fac, sub, fn, w, h, sz, target or "??"))
                    continue
                if not target:
                    unmatched.append((asset_fac, fn, n))
                    continue
                im = im.convert("RGB")
                if w >= 1024:
                    im = im.resize((1024, 1536), Image.LANCZOS)
                im = im.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
                data, q = encode(im)
                outp = os.path.join(DST, asset_fac, target)
                with open(outp, "wb") as f:
                    f.write(data)
                rows.append((asset_fac, target, im.size[0], im.size[1], len(data), q))

    if mode == "diagnose":
        print(f"{'faction':9} {'sub':10} {'file':28} {'res':12} {'KB':>7}  ->asset")
        for fac, sub, fn, w, h, sz, t in rows:
            print(f"{fac:9} {sub:10} {fn:28} {w}x{h:<7} {sz/1024:7.0f}  {t}")
        print(f"\nTotal originals: {len(rows)}")
    else:
        print(f"{'faction':9} {'asset':24} {'res':12} {'KB':>7} q")
        for fac, t, w, h, sz, q in sorted(rows):
            print(f"{fac:9} {t:24} {w}x{h:<7} {sz/1024:7.0f} {q}")
        print(f"\nConverted: {len(rows)} files")
        if unmatched:
            print("\nUNMATCHED (no existing asset, skipped):")
            for fac, fn, n in unmatched:
                print(f"  {fac}/{fn}  (norm={n})")


if __name__ == "__main__":
    main()
