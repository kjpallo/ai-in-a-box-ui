#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOWNLOADS_DIR="${HOME}/Downloads"
TIMESTAMP="$(date +"%Y-%m-%d-%H%M")"
ZIP_PATH="${DOWNLOADS_DIR}/ai-in-a-box-ui-review-${TIMESTAMP}.zip"

mkdir -p "${DOWNLOADS_DIR}"

INCLUDE_PATHS=(
  "server.js"
  "piper_http_server.py"
  "package.json"
  "package-lock.json"
  "README.md"
  "REVIEW_DIFF_STAT.txt"
  "standards_metadata_overlay.phase7a3.json"
  "public"
  "routes"
  "lib"
  "scripts"
  "tests"
  "knowledge/approved-packs"
  "knowledge/draft-packs"
  "knowledge/packs"
  "knowledge/schema"
  "knowledge/standards"
  "knowledge/standards-banks"
  "knowledge/periodic_table.json"
  "knowledge/chemistry_compounds.json"
  "knowledge/teacher_facts.json"
  "charlemagne_motion_force_knowledge_pack"
)

EXCLUDE_PATTERNS=(
  ".DS_Store"
  "*/.DS_Store"
  ".git/*"
  "*/.git/*"
  "node_modules/*"
  "*/node_modules/*"
  ".env"
  ".env.*"
  "*/.env"
  "*/.env.*"
  "logs/*"
  "*/logs/*"
  "exports/*"
  "*/exports/*"
  "audio/*"
  "*/audio/*"
  "coverage/*"
  "*/coverage/*"
  "dist/*"
  "*/dist/*"
  "build/*"
  "*/build/*"
  "voices/*.onnx"
  "*/voices/*.onnx"
  "voices/*.json"
  "*/voices/*.json"
  "models/*"
  "*/models/*"
  "vendor/*"
  "*/vendor/*"
  "tmp/*"
  "*/tmp/*"
  "backups/*"
  "*/backups/*"
  "review-handoff/*"
  "*/review-handoff/*"
  "*.zip"
  "*.log"
  "*.bak"
  "*.bak-*"
  "*~"
  "*.tmp"
  "*.temp"
  ".cache/*"
  "*/.cache/*"
  ".pytest_cache/*"
  "*/.pytest_cache/*"
  ".npm/*"
  "*/.npm/*"
  "knowledge/deleted-approved-packs/*"
  "knowledge/draft-packs/_accepted/*"
  "knowledge/draft-packs/_removed/*"
  "knowledge/uploads/incoming/*"
  "knowledge/uploads/extracted/*"
  "knowledge/uploads/page-images/*"
  "knowledge/uploads/ocr/*"
  "tmp/model-responses/*"
  "*.pem"
  "*.key"
  "*.p12"
  "*.pfx"
  "*token*"
  "*secret*"
  "*oauth*"
  "*teacher_auth*"
  "*gmail_auth*"
  "*teacher*auth*.json"
  "*gmail*auth*.json"
  "*auth*.key"
  "*auth*.pem"
)

(
  cd "${PROJECT_ROOT}"
  rm -f "${ZIP_PATH}"
  zip -r -q "${ZIP_PATH}" "${INCLUDE_PATHS[@]}" -x "${EXCLUDE_PATTERNS[@]}"
)

ENTRY_LIST_FILE="$(mktemp)"
trap 'rm -f "${ENTRY_LIST_FILE}"' EXIT

zipinfo -1 "${ZIP_PATH}" > "${ENTRY_LIST_FILE}"

SUSPICIOUS_PATHS="$(
  grep -E -i '(^|/)\.env($|[.])|(^|/)\.DS_Store$|(^|/)(logs|exports)/|(^|/)audio/|(^|/)coverage/|(^|/)dist/|(^|/)build/|(^|/)models/|(^|/)vendor/|(^|/)backups/|(^|/)review-handoff/|(^|/)tmp/|(^|/)knowledge/(uploads/(incoming|extracted|page-images|ocr)|deleted-approved-packs|draft-packs/_(accepted|removed))/|(^|/)[^/]*(token|secret|oauth|gmail[_-]?auth|teacher[_-]?auth)[^/]*\.(json|txt|key|pem|env|ini|yaml|yml)$|(^|/)[^/]*auth[^/]*\.(json|txt|key|pem|env|ini|yaml|yml)$|(^|/)[^/]*\.(pem|key|p12|pfx|zip|log|bak|tmp|temp)$|(^|/)voices/[^/]*\.(onnx|json)$' "${ENTRY_LIST_FILE}" || true
)"

if [[ -n "${SUSPICIOUS_PATHS}" ]]; then
  echo "Review zip created at: ${ZIP_PATH}"
  echo
  echo "WARNING: suspicious paths were found in the review zip:"
  echo "${SUSPICIOUS_PATHS}"
  echo
  echo "Zip failed safety validation. Remove suspicious files from the include set before sharing."
  exit 1
fi

echo "Review zip created safely at: ${ZIP_PATH}"
