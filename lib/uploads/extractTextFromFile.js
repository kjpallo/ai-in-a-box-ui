const fs = require('node:fs');
const path = require('node:path');

const { parse: parseCsv } = require('csv-parse/sync');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

const { detectUploadFileType } = require('./detectUploadFileType');

const SHORT_TEXT_WARNING_THRESHOLD = 20;

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

async function extractPdf(filePath, options) {
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
