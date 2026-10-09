#!/bin/bash
# Regenerates PromoPanel.tsrct from build.py (layout + motion).
set -e
cd "$(dirname "$0")/.."
T="$HOME/Library/Application Support/Tesseract/bin/tsrct"
rm -f PromoPanel.tsrct
"$T" project create --project PromoPanel.tsrct >/dev/null
"$T" project import-font --project PromoPanel.tsrct --file fonts/GoogleSansFlex.ttf >/dev/null 2>&1
"$T" project checkout --project PromoPanel.tsrct --output .tesseract-work/editable.json >/dev/null
python3 -c "
import json;p='.tesseract-work/editable.json';d=json.load(open(p))
d['dimensions']={'width':910,'height':1030};d['duration']=9.0;d['backgroundColor']=[18/255,16/255,14/255,1]
json.dump(d,open(p,'w'))"
"$T" project commit --project PromoPanel.tsrct --file .tesseract-work/editable.json >/dev/null
(cd .tesseract-work && python3 build.py)
"$T" project apply --project PromoPanel.tsrct --actions .tesseract-work/layout.json >/dev/null
"$T" project apply --project PromoPanel.tsrct --actions .tesseract-work/motion.json
