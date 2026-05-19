const fs = require('node:fs');
const path = require('node:path');

const { parse: parseCsv } = require('csv-parse/sync');
const { DOMParser } = require('@xmldom/xmldom');
const JSZip = require('jszip');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

const { detectUploadFileType } = require('./detectUploadFileType');

const SHORT_TEXT_WARNING_THRESHOLD = 20;
const DRAWINGML_NAMESPACE = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships';

async function extractTextFromFile(filePath, options = {}) {
  const absolutePath = path.resolve(filePath || '');
  const detection = detectUploadFileType(absolutePath);
  const baseResult = makeBaseResult(absolutePath, detection);

  if (!filePath || typeof filePath !== 'string') {
    return fail(baseResult, 'A file path is required.');
  }

  if (!detection.supported) {
    return fail(baseResult, detection.errors);
  }

  if (!fs.existsSync(absolutePath)) {
    return fail(baseResult, `Upload source file not found: ${absolutePath}`);
  }

  if (!fs.statSync(absolutePath).isFile()) {
    return fail(baseResult, `Upload source path is not a file: ${absolutePath}`);
  }

  try {
    const extracted = await extractByType(absolutePath, detection.type, options);
    const text = normalizeText(extracted.text || '');
    const warnings = [
      ...baseResult.warnings,
      ...(extracted.warnings || []),
      ...shortTextWarnings(text, detection.type)
    ];

    return {
      ...baseResult,
      success: true,
      text,
      sections: extracted.sections || makeSections(text),
      pages: extracted.pages || [],
      tables: extracted.tables || [],
      metadata: {
        ...baseResult.metadata,
        ...(extracted.metadata || {}),
        characterCount: text.length
      },
      warnings,
      errors: []
    };
  } catch (error) {
    return fail(baseResult, `Failed to extract ${detection.type.toUpperCase()} text: ${error.message}`);
  }
}

async function extractByType(filePath, type, options) {
  if (type === 'txt') return extractTxt(filePath);
  if (type === 'csv') return extractCsv(filePath);
  if (type === 'json') return extractJson(filePath);
  if (type === 'docx') return extractDocx(filePath);
  if (type === 'xlsx') return extractXlsx(filePath);
  if (type === 'pptx') return extractPptx(filePath);
  if (type === 'pdf') return extractPdf(filePath, options);
  throw new Error(`Unsupported upload file type: ${type}`);
}

function extractTxt(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return {
    text,
    sections: makeSections(text),
    tables: [],
    metadata: {}
  };
}

function extractCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(raw, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false
  });
  const text = rows.map((row) => row.map(formatCell).join(' | ')).join('\n');

  return {
    text,
    sections: makeSections(text),
    tables: [
      {
        label: 'CSV',
        rows
      }
    ],
    metadata: {
      rowCount: rows.length
    }
  };
}

function extractJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const value = JSON.parse(raw);
  const text = `${JSON.stringify(value, null, 2)}\n`;

  return {
    text,
    sections: makeSections(text),
    tables: [],
    metadata: {
      topLevelType: Array.isArray(value) ? 'array' : typeof value
    }
  };
}

async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value || '';
  const warnings = (result.messages || []).map((message) => `DOCX parser: ${message.message || String(message)}`);

  return {
    text,
    sections: makeSections(text),
    tables: [],
    metadata: {
      parser: 'mammoth'
    },
    warnings
  };
}

function extractXlsx(filePath) {
  const workbook = xlsx.readFile(filePath, {
    cellDates: true,
    dense: false
  });
  const tables = [];
  const textBlocks = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: ''
    });

    tables.push({
      label: sheetName,
      rows
    });

    textBlocks.push(`Sheet: ${sheetName}`);
    textBlocks.push(rows.map((row) => row.map(formatCell).join(' | ')).join('\n'));
  });

  const text = textBlocks.join('\n\n');

  return {
    text,
    sections: workbook.SheetNames.map((sheetName, index) => ({
      label: sheetName,
      text: tables[index].rows.map((row) => row.map(formatCell).join(' | ')).join('\n')
    })),
    tables,
    metadata: {
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames
    }
  };
}

async function extractPptx(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const slidePaths = Object.keys(zip.files)
    .filter((entryPath) => /^ppt\/slides\/slide\d+\.xml$/i.test(entryPath))
    .sort(compareOoxmlNumberedPaths);
  const notesPaths = Object.keys(zip.files)
    .filter((entryPath) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(entryPath));
  const notesByNumber = new Map();
  const notesByPath = new Map();
  const warnings = [];
  let hasImagesOrMedia = false;

  for (const notesPath of notesPaths) {
    const notesNumber = ooxmlPathNumber(notesPath);
    const notesText = extractOoxmlDrawingText(await zip.files[notesPath].async('string'));
    if (notesNumber) notesByNumber.set(notesNumber, notesText);
    notesByPath.set(notesPath, notesText);
  }

  const sections = [];
  const pages = [];

  for (const slidePath of slidePaths) {
    const slideNumber = ooxmlPathNumber(slidePath) || sections.length + 1;
    const slideXml = await zip.files[slidePath].async('string');
    const relationshipsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const relationshipsXml = zip.files[relationshipsPath]
      ? await zip.files[relationshipsPath].async('string')
      : '';
    const slideText = extractOoxmlDrawingText(slideXml);
    const notesPath = findSlideNotesPath(relationshipsXml);
    const notesText = notesPath && notesByPath.has(notesPath)
      ? notesByPath.get(notesPath)
      : notesByNumber.get(slideNumber) || '';
    const text = [slideText, notesText ? `Speaker notes:\n${notesText}` : '']
      .filter((block) => String(block || '').trim())
      .join('\n\n');
    const section = {
      label: `Slide ${slideNumber}`,
      sourceLocation: `Slide ${slideNumber}`,
      pageNumber: slideNumber,
      text
    };

    if (detectSlideImagesOrMedia(slideXml, relationshipsXml)) hasImagesOrMedia = true;
    sections.push(section);
    pages.push(section);
  }

  const textBearingSlides = pages
    .filter((page) => String(page.text || '').trim())
    .map((page) => page.pageNumber);
  const text = pages
    .filter((page) => String(page.text || '').trim())
    .map((page) => page.text)
    .join('\n\n');

  if (hasImagesOrMedia) {
    warnings.push('PPTX embedded images or media were detected. OCR/vision for image-only slides is not part of this phase; image-only slides may need OCR later.');
  }

  return {
    text,
    sections,
    pages,
    tables: [],
    metadata: {
      parser: 'pptx-ooxml',
      slideCount: slidePaths.length,
      pageCount: slidePaths.length,
      textBearingPages: textBearingSlides,
      pagesWithText: textBearingSlides,
      textBearingSlides,
      firstTextPage: textBearingSlides[0] || null,
      firstTextSlide: textBearingSlides[0] || null,
      hasImagesOrMedia
    },
    warnings
  };
}

async function extractPdf(filePath, options) {
  ensurePdfCanvasGlobals();
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({
    data: fs.readFileSync(filePath)
  });

  try {
    const textResult = await parser.getText({
      pageJoiner: '\n\n'
    });
    const info = options.includePdfInfo === false ? null : await parser.getInfo().catch(() => null);
    const text = textResult.text || '';
    const pages = Array.isArray(textResult.pages)
      ? textResult.pages.map((page) => ({
          pageNumber: page.num,
          text: normalizeText(page.text || '')
        })).filter((page) => page.text.trim().length > 0)
      : [];
    const textBearingPages = pages.map((page) => Number(page.pageNumber)).filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber > 0);
    const warnings = [];

    if (text.trim().length < SHORT_TEXT_WARNING_THRESHOLD) {
      warnings.push('PDF extracted little or no embedded text. It may be scanned or image-based and may need OCR in a later phase.');
    }

    return {
      text,
      sections: makePdfPageSections(textResult.pages, text),
      pages,
      tables: [],
      metadata: {
        parser: 'pdf-parse',
        pageCount: textResult.total,
        textBearingPages,
        pagesWithText: textBearingPages,
        firstTextPage: textBearingPages[0] || null,
        pdfInfo: info
          ? {
              title: info.info && info.info.Title,
              author: info.info && info.info.Author,
              creator: info.info && info.info.Creator,
              producer: info.info && info.info.Producer
            }
          : undefined
      },
      warnings
    };
  } finally {
    await parser.destroy();
  }
}

function ensurePdfCanvasGlobals() {
  if (typeof globalThis.DOMMatrix !== 'undefined' && typeof globalThis.ImageData !== 'undefined' && typeof globalThis.Path2D !== 'undefined') {
    return;
  }

  const canvas = require('@napi-rs/canvas');
  if (typeof globalThis.DOMMatrix === 'undefined' && canvas.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix;
  if (typeof globalThis.ImageData === 'undefined' && canvas.ImageData) globalThis.ImageData = canvas.ImageData;
  if (typeof globalThis.Path2D === 'undefined' && canvas.Path2D) globalThis.Path2D = canvas.Path2D;
}

function makePdfPageSections(pages, fallbackText) {
  if (!Array.isArray(pages) || pages.length === 0) return makeSections(fallbackText);
  const sections = pages.map((page) => {
    const pageNumber = Number(page.num || 0);
    return {
      label: pageNumber ? `Page ${pageNumber}` : 'Page',
      sourceLocation: pageNumber ? `Page ${pageNumber}` : 'Page',
      pageNumber,
      text: normalizeText(page.text || '')
    };
  }).filter((section) => section.text.trim().length > 0);
  return sections.length ? sections : makeSections(fallbackText);
}

function makeBaseResult(filePath, detection) {
  return {
    success: false,
    filePath,
    fileName: path.basename(filePath || ''),
    extension: detection.extension || '',
    mimeGuess: detection.mimeGuess || 'application/octet-stream',
    text: '',
    sections: [],
    pages: [],
    tables: [],
    metadata: {
      detectedType: detection.type || 'unsupported'
    },
    warnings: [],
    errors: []
  };
}

function extractOoxmlDrawingText(xml) {
  const document = parseXml(xml);
  const paragraphs = elementsByLocalName(document, 'p', DRAWINGML_NAMESPACE);
  const paragraphTexts = paragraphs
    .map((paragraph) => extractOoxmlParagraphText(paragraph))
    .map((text) => normalizeOoxmlText(text))
    .filter(Boolean);

  if (paragraphTexts.length > 0) {
    return paragraphTexts.join('\n');
  }

  return elementsByLocalName(document, 't', DRAWINGML_NAMESPACE)
    .map((node) => normalizeOoxmlText(node.textContent || ''))
    .filter(Boolean)
    .join('\n');
}

function extractOoxmlParagraphText(paragraph) {
  const parts = [];
  for (let node = paragraph.firstChild; node; node = node.nextSibling) {
    collectParagraphText(node, parts);
  }
  return parts.join('');
}

function collectParagraphText(node, parts) {
  if (!node || !parts) return;
  if (isElement(node, 'br', DRAWINGML_NAMESPACE)) {
    parts.push('\n');
    return;
  }
  if (isElement(node, 'tab', DRAWINGML_NAMESPACE)) {
    parts.push('\t');
    return;
  }
  if (isElement(node, 't', DRAWINGML_NAMESPACE)) {
    parts.push(node.textContent || '');
    return;
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    collectParagraphText(child, parts);
  }
}

function parseXml(xml) {
  return new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => {},
      fatalError: () => {}
    }
  }).parseFromString(String(xml || ''), 'application/xml');
}

function elementsByLocalName(document, localName, namespaceUri) {
  return Array.from(document.getElementsByTagName('*')).filter((node) => (
    node.localName === localName && (!namespaceUri || node.namespaceURI === namespaceUri)
  ));
}

function isElement(node, localName, namespaceUri) {
  return node.nodeType === 1
    && node.localName === localName
    && (!namespaceUri || node.namespaceURI === namespaceUri);
}

function normalizeOoxmlText(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function compareOoxmlNumberedPaths(left, right) {
  return ooxmlPathNumber(left) - ooxmlPathNumber(right);
}

function ooxmlPathNumber(filePath) {
  const match = String(filePath || '').match(/(\d+)\.xml$/i);
  return match ? Number(match[1]) : 0;
}

function findSlideNotesPath(relationshipsXml) {
  const target = parseRelationships(relationshipsXml)
    .find((relationship) => /\/notesSlide$/i.test(relationship.type) && relationship.target);
  return target ? resolvePptRelationshipTarget('ppt/slides', target.target) : '';
}

function detectSlideImagesOrMedia(slideXml, relationshipsXml) {
  if (/(?:<a:blip\b|<p:pic\b|<p:video\b|<p:audio\b|<p14:media\b|<p:media\b)/i.test(slideXml || '')) return true;
  return parseRelationships(relationshipsXml).some((relationship) => {
    const type = String(relationship.type || '');
    const target = String(relationship.target || '');
    return /(\/image|\/video|\/audio|\/media|\/oleObject|\/package)$/i.test(type)
      || /(?:^|\/)media\//i.test(target);
  });
}

function parseRelationships(xml) {
  if (!String(xml || '').trim()) return [];
  const document = parseXml(xml);
  return elementsByLocalName(document, 'Relationship', RELATIONSHIPS_NAMESPACE).map((node) => ({
    id: node.getAttribute('Id') || '',
    type: node.getAttribute('Type') || '',
    target: node.getAttribute('Target') || ''
  }));
}

function resolvePptRelationshipTarget(baseDir, target) {
  const cleanTarget = String(target || '').split('#')[0];
  if (!cleanTarget) return '';
  if (cleanTarget.startsWith('/')) return cleanTarget.replace(/^\/+/, '');
  const resolved = path.posix.normalize(path.posix.join(baseDir, cleanTarget));
  return resolved.replace(/^\/+/, '');
}

function fail(result, errors) {
  return {
    ...result,
    success: false,
    errors: Array.isArray(errors) ? errors : [errors]
  };
}

function makeSections(text) {
  return [
    {
      label: 'Full Text',
      text
    }
  ];
}

function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function shortTextWarnings(text, type) {
  if (type === 'pdf') return [];
  if (text.trim().length === 0) {
    return ['Extracted text is empty.'];
  }
  if (text.trim().length < SHORT_TEXT_WARNING_THRESHOLD) {
    return ['Extracted text is very short.'];
  }
  return [];
}

function formatCell(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

module.exports = {
  extractTextFromFile
};
