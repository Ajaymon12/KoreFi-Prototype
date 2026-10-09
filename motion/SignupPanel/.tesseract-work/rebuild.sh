#!/bin/bash
# Regenerates SignupPanel.tsrct from build.py (layout + motion).
set -e
cd "$(dirname "$0")/.."
T="$HOME/Library/Application Support/Tesseract/bin/tsrct"
rm -f SignupPanel.tsrct
"$T" project create --project SignupPanel.tsrct >/dev/null
"$T" project import-font --project SignupPanel.tsrct --file fonts/GoogleSansFlex.ttf >/dev/null 2>&1
"$T" project checkout --project SignupPanel.tsrct --output .tesseract-work/editable.json >/dev/null
python3 -c "
import json;p='.tesseract-work/editable.json';d=json.load(open(p))
d['dimensions']={'width':910,'height':1030};d['duration']=8.0;d['backgroundColor']=[247/255,244/255,241/255,1]
json.dump(d,open(p,'w'))"
"$T" project commit --project SignupPanel.tsrct --file .tesseract-work/editable.json >/dev/null
(cd .tesseract-work && python3 build.py)
"$T" project apply --project SignupPanel.tsrct --actions .tesseract-work/layout.json >/dev/null
"$T" project apply --project SignupPanel.tsrct --actions .tesseract-work/motion.json
