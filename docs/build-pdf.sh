#!/usr/bin/env bash
# Bygger PDF:er från planeringsdokumenten.
# Kräver: brew install pandoc typst
set -euo pipefail
cd "$(dirname "$0")/.."

DOCS=(
  docs/PLAN-V1.md
  CONTEXT-MAP.md
  docs/contexts/accounts/CONTEXT.md
  docs/contexts/evaluation-model/CONTEXT.md
  docs/contexts/evaluation-model/standardmall.md
  docs/contexts/assessment/CONTEXT.md
  docs/adr/0001-convex-eu-better-auth.md
  docs/adr/0002-live-recompute-no-versioning.md
  docs/adr/0003-ai-embedded-assistant.md
)

DATUM="$(LC_TIME=sv_SE.UTF-8 date +"%e %B %Y" | sed 's/^ //')"
GEMENSAMMA=(--pdf-engine=typst --metadata lang=sv -V mainfont="Helvetica Neue" -V fontsize=10pt -V papersize=a4)

# 1) Komplett underlag (alla dokument, med TOC och sidbrytning mellan delar)
tmp="$(mktemp -t underlag).md"
first=1
for f in "${DOCS[@]}"; do
  if [ "$first" -eq 0 ]; then
    printf '\n\n```{=typst}\n#pagebreak()\n```\n\n' >> "$tmp"
  fi
  cat "$f" >> "$tmp"
  first=0
done
pandoc "$tmp" -f gfm+raw_attribute -o docs/blueprnt-planeringsunderlag.pdf \
  --toc --toc-depth=2 \
  --metadata title="blueprnt" \
  --metadata subtitle="Komplett planeringsunderlag — rollvärdering, banding & EU-lönetransparens" \
  --metadata date="$DATUM" \
  "${GEMENSAMMA[@]}"
rm -f "$tmp"
echo "✓ docs/blueprnt-planeringsunderlag.pdf"

# 2) Endast V1-planen
pandoc docs/PLAN-V1.md -f gfm -o docs/PLAN-V1.pdf \
  --metadata date="$DATUM" \
  "${GEMENSAMMA[@]}"
echo "✓ docs/PLAN-V1.pdf"
