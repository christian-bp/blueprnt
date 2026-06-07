#!/usr/bin/env bash
# Builds PDFs from the planning documents.
# Requires: brew install pandoc typst
set -euo pipefail
cd "$(dirname "$0")/.."

DOCS=(
  docs/PLAN-V1.md
  CONTEXT-MAP.md
  docs/contexts/accounts/CONTEXT.md
  docs/contexts/evaluation-model/CONTEXT.md
  docs/contexts/evaluation-model/standardmall.md
  docs/contexts/evaluation-model/viktning-poangbudget.md
  docs/contexts/assessment/CONTEXT.md
  docs/adr/0001-convex-eu-better-auth.md
  docs/adr/0002-live-recompute-no-versioning.md
  docs/adr/0003-ai-embedded-assistant.md
  docs/adr/0004-point-budget-weighting.md
  docs/adr/0005-level-per-individual.md
)

# The documents are in Swedish, so the date in the PDF uses Swedish formatting.
PDF_DATE="$(LC_TIME=sv_SE.UTF-8 date +"%e %B %Y" | sed 's/^ //')"
COMMON_ARGS=(--pdf-engine=typst --metadata lang=sv -V mainfont="Helvetica Neue" -V fontsize=10pt -V papersize=a4)

# 1) Complete bundle (all documents, with TOC and page breaks between parts)
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
  --metadata date="$PDF_DATE" \
  "${COMMON_ARGS[@]}"
rm -f "$tmp"
echo "✓ docs/blueprnt-planeringsunderlag.pdf"

# 2) The V1 plan only
pandoc docs/PLAN-V1.md -f gfm -o docs/PLAN-V1.pdf \
  --metadata date="$PDF_DATE" \
  "${COMMON_ARGS[@]}"
echo "✓ docs/PLAN-V1.pdf"
