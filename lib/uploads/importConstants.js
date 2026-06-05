const path = require('node:path');

const DEFAULT_MODEL = 'gemma4:e2b';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_OLLAMA_TIMEOUT_MS = 300000;
const DEFAULT_OLLAMA_KEEP_ALIVE = '10m';
const DEFAULT_MODEL_SEED = 42;
const DEFAULT_MODEL_TEMPERATURE = 0;
const DEFAULT_MODEL_TOP_P = 1;
const DEFAULT_MODEL_TOP_K = 40;
const PROMPT_VERSION = 'teacher-content-draft-v3-compact';
const DEFAULT_RAW_MODEL_RESPONSES_DIR = path.join(__dirname, '..', '..', 'tmp', 'model-responses');
const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';
const DEFAULT_SCHEMA_VERSION = '1.0.0';
const DEFAULT_DRAFT_VERSION = '0.1.0-draft';
const DEFAULT_BATCH_MAX_CHARACTERS = 2500;
const DEFAULT_RETRY_BATCH_MAX_CHARACTERS = 1250;
const DEFAULT_BATCH_MAX_CHUNKS = 4;
const DEFAULT_PREVIEW_MAX_PAGES = 1;
const DEFAULT_PREVIEW_MAX_CHARACTERS = 1000;
const DEFAULT_FULL_REQUIRES_CONFIRMATION = true;
const DEFAULT_LARGE_IMPORT_CHARACTERS = 12000;
const DEFAULT_LARGE_IMPORT_PAGES = 10;
const DEFAULT_LARGE_IMPORT_BATCHES = 6;
const DEFAULT_HARD_STOP_CHARACTERS = 60000;
const DEFAULT_HARD_STOP_PAGES = 60;
const DEFAULT_HARD_STOP_BATCHES = 24;
const GENERATED_ITEM_SECTIONS = [
  'sourceFiles',
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];
const MODEL_GENERATION_TIMEOUT_CODE = 'MODEL_GENERATION_TIMEOUT';
const MODEL_GENERATION_TIMEOUT_MESSAGE = 'Local Gemma took too long while reading this batch.';
const SOURCE_GROUNDING_WARNING = 'Generated wording was not strongly supported by the extracted source text.';
const THIN_EXTRACTION_WARNING = 'Only limited text was extracted from this range. Review may need OCR later.';
const SOURCE_GROUNDING_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas'
];
const REJECTED_VOCAB_LABEL_KEYS = new Set([
  'core concept',
  'core concepts',
  'key concept',
  'key concepts',
  'concept check',
  'key idea',
  'key ideas',
  'important idea',
  'important ideas',
  'main idea',
  'main ideas',
  'vocabulary',
  'useful vocabulary',
  'useful vocab',
  'terms',
  'useful terms',
  'key term',
  'key terms',
  'concepts',
  'useful concept',
  'useful concepts',
  'review items',
  'review item',
  'misconception',
  'misconceptions',
  'common mistake',
  'common mistakes',
  'cause and effect',
  'timeline',
  'people events dates',
  'people event dates',
  'procedure',
  'procedures',
  'steps',
  'procedure steps',
  'process steps',
  'sequence process steps',
  'examples',
  'reference formula',
  'reference formulas',
  'reference-only formula',
  'reference-only formulas',
  'key formula',
  'key formulas',
  'formula',
  'formulas',
  'example',
  'review',
  'practice',
  'use',
  'se alignment'
]);
const FORMULA_LABEL_PATTERN = '(?:reference\\s+formula(?:s)?|reference(?:-|\\s+)only\\s+formula(?:s)?(?:\\s+on\\s+this\\s+deck)?|key\\s+formula(?:s)?|formula(?:s)?|reference\\s+idea)';
const VOCAB_SECTION_LABEL_PATTERN = '(?:vocabulary|useful\\s+vocab(?:ulary)?|terms?|useful\\s+terms?|key\\s+terms?)';
const CONCEPT_LABEL_PATTERN = '(?:core\\s+concepts?|key\\s+concepts?|concept\\s+check|key\\s+ideas?|important\\s+ideas?|main\\s+ideas?|useful\\s+concepts?|review\\s+items?|misconceptions?|common\\s+mistakes?|cause\\s+(?:and|&)\\s+effect|timeline|people\\s*(?:\\/|&|and)?\\s*events?\\s*(?:\\/|&|and)?\\s*dates?|procedure\\s*(?:\\/|&|and)?\\s*steps?|procedures?|steps?|process\\s*steps?|sequence\\s*(?:\\/|&|and)?\\s*process\\s*steps?)';
const FORMULA_VARIABLE_VOCAB_KEYS = new Set(['v', 'i', 'r', 'm', 't', 'f', 'd', 'h', 'g']);


module.exports = {
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  DEFAULT_OLLAMA_KEEP_ALIVE,
  DEFAULT_MODEL_SEED,
  DEFAULT_MODEL_TEMPERATURE,
  DEFAULT_MODEL_TOP_P,
  DEFAULT_MODEL_TOP_K,
  PROMPT_VERSION,
  DEFAULT_RAW_MODEL_RESPONSES_DIR,
  KNOWLEDGE_PACK_FILE_NAME,
  DEFAULT_SCHEMA_VERSION,
  DEFAULT_DRAFT_VERSION,
  DEFAULT_BATCH_MAX_CHARACTERS,
  DEFAULT_RETRY_BATCH_MAX_CHARACTERS,
  DEFAULT_BATCH_MAX_CHUNKS,
  DEFAULT_PREVIEW_MAX_PAGES,
  DEFAULT_PREVIEW_MAX_CHARACTERS,
  DEFAULT_FULL_REQUIRES_CONFIRMATION,
  DEFAULT_LARGE_IMPORT_CHARACTERS,
  DEFAULT_LARGE_IMPORT_PAGES,
  DEFAULT_LARGE_IMPORT_BATCHES,
  DEFAULT_HARD_STOP_CHARACTERS,
  DEFAULT_HARD_STOP_PAGES,
  DEFAULT_HARD_STOP_BATCHES,
  GENERATED_ITEM_SECTIONS,
  MODEL_GENERATION_TIMEOUT_CODE,
  MODEL_GENERATION_TIMEOUT_MESSAGE,
  SOURCE_GROUNDING_WARNING,
  THIN_EXTRACTION_WARNING,
  SOURCE_GROUNDING_SECTIONS,
  REJECTED_VOCAB_LABEL_KEYS,
  FORMULA_LABEL_PATTERN,
  VOCAB_SECTION_LABEL_PATTERN,
  CONCEPT_LABEL_PATTERN,
  FORMULA_VARIABLE_VOCAB_KEYS
};
