#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOWNLOADS_DIR="${HOME}/Downloads"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
ZIP_PATH="${DOWNLOADS_DIR}/ai-in-a-box-review-${TIMESTAMP}.zip"

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
  "knowledge"
  "charlemagne_motion_force_knowledge_pack"
  "review-handoff"
)

EXCLUDE_PATTERNS=(
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
  "audio/*"
  "*/audio/*"
  "voices/*.onnx"
  "*/voices/*.onnx"
  "models/*"
  "*/models/*"
  "vendor/*"
  "*/vendor/*"
  "tmp/*"
  "*/tmp/*"
  "backups/*"
  "*/backups/*"
  "knowledge/uploads/incoming/*"
  "knowledge/uploads/extracted/*"
  "knowledge/uploads/page-images/*"
  "knowledge/uploads/ocr/*"
  "tmp/model-responses/*"
  "*token*"
  "*secret*"
  "*oauth*"
  "*teacher_auth*"
  "*gmail_auth*"
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
  grep -E -i '(^|/)\.env($|[.])|(^|/)logs/|(^|/)[^/]*token[^/]*($|[.])|(^|/)[^/]*secret[^/]*($|[.])|(^|/)[^/]*(oauth|gmail_auth|teacher_auth)[^/]*($|[.])|(^|/)[^/]*auth[^/]*\.(json|txt|key|pem|env|ini|yaml|yml)$' "${ENTRY_LIST_FILE}" || true
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
