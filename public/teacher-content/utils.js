(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll('`', '&#096;');
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value || ''));
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  function unwrap(payload) {
    return payload && payload.success === true && payload.data ? payload.data : payload;
  }

  function normalizeSimpleText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function uniqueStrings(items) {
    return Array.from(new Set((Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean)));
  }

  function formatCompactNumberRange(values) {
    const unique = Array.from(new Set((Array.isArray(values) ? values : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
    if (!unique.length) return '';
    const ranges = [];
    let start = unique[0];
    let previous = unique[0];
    for (let index = 1; index < unique.length; index += 1) {
      const value = unique[index];
      if (value === previous + 1) {
        previous = value;
      } else {
        ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
        start = value;
        previous = value;
      }
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    return ranges.join(', ');
  }

  function passFailUnknown(value) {
    if (value === true) return 'Pass';
    if (value === false) return 'Fail';
    return 'Unknown';
  }

  function countItems(value) {
    return Array.isArray(value) ? value.length : 0;
  }

  function firstError(errors, fallback) {
    const list = Array.isArray(errors) ? errors.filter(Boolean) : [];
    return String(list[0] || fallback || '').trim();
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString() : '0';
  }

  function formatDate(value) {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  }

  function titleCase(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
      .join(' ');
  }

  function makeContentNameFromFileName(fileName) {
    const baseName = String(fileName || '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return baseName || 'New knowledge pack';
  }

  function extractNearestMeaningfulParentFolder(relativePath) {
    const normalized = String(relativePath || '')
      .replaceAll('\\', '/')
      .trim();
    if (!normalized.includes('/')) return '';
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    const parentFolder = parts[parts.length - 2];
    if (!parentFolder || /^\.+$/.test(parentFolder)) return '';
    return parentFolder.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function buildDefaultPackNameFromFile(file, fallbackFileName = '') {
    const relativePath = String(file?.webkitRelativePath || file?.relativePath || '').trim();
    const fileName = String(file?.name || fallbackFileName || '').trim();
    const cleanFileName = makeContentNameFromFileName(fileName || relativePath);
    const parentFolderName = extractNearestMeaningfulParentFolder(relativePath);
    if (!parentFolderName) return cleanFileName;
    if (cleanFileName.toLowerCase().startsWith(parentFolderName.toLowerCase())) return cleanFileName;
    return `${parentFolderName} - ${cleanFileName}`;
  }

  ns.utils = {
    byId,
    escapeHtml,
    escapeAttr,
    cssEscape,
    unwrap,
    normalizeSimpleText,
    uniqueStrings,
    formatCompactNumberRange,
    passFailUnknown,
    countItems,
    firstError,
    formatNumber,
    formatDate,
    titleCase,
    makeContentNameFromFileName,
    buildDefaultPackNameFromFile,
    extractNearestMeaningfulParentFolder
  };
})();
