#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const indexPath = path.join(projectRoot, 'public', 'index.html');
const legacyPath = path.join(projectRoot, 'public', 'voice-input.js');
const canonicalPath = path.join(projectRoot, 'public', 'voice', 'voice-input.js');
const systemHealthPath = path.join(projectRoot, 'public', 'system-health.js');
const cleanupCheckPath = path.join(projectRoot, 'scripts', 'project-cleanup-check.js');

const indexHtml = read(indexPath);
const legacyVoiceInput = read(legacyPath);
const canonicalVoiceInput = read(canonicalPath);
const systemHealth = read(systemHealthPath);
const cleanupCheck = read(cleanupCheckPath);

assertIndexLoadsCanonicalVoiceModulesInOrder();
assertLegacyVoiceInputIsCompatibilityStub();
assertCanonicalVoiceInputOwnsImplementation();
assertSystemHealthPointsToCanonicalVoiceInput();
assertCleanupCheckAllowsCompatibilityStub();

console.log('Voice input organization tests passed.');

function assertIndexLoadsCanonicalVoiceModulesInOrder() {
  const expectedScripts = [
    '/voice/voice-status.js',
    '/voice/tts-player.js',
    '/voice/voice-commands.js',
    '/voice/voice-input.js'
  ];

  let lastIndex = -1;
  for (const scriptSrc of expectedScripts) {
    const scriptTag = `<script src="${scriptSrc}"></script>`;
    const currentIndex = indexHtml.indexOf(scriptTag);
    assert.notEqual(currentIndex, -1, `public/index.html should load ${scriptSrc}.`);
    assert.ok(currentIndex > lastIndex, `${scriptSrc} should load after the previous voice script.`);
    lastIndex = currentIndex;
  }

  assert.doesNotMatch(
    indexHtml,
    /<script\s+src="\/voice-input\.js"><\/script>/,
    'public/index.html should not load the legacy root voice-input.js entry.'
  );
}

function assertLegacyVoiceInputIsCompatibilityStub() {
  assert.match(
    legacyVoiceInput,
    /const CANONICAL_VOICE_INPUT_SRC = '\/voice\/voice-input\.js';/,
    'Legacy root voice input should point to the canonical module.'
  );
  assert.match(
    legacyVoiceInput,
    /document\.createElement\('script'\)/,
    'Legacy root voice input should load the canonical module as a script.'
  );
  assert.match(
    legacyVoiceInput,
    /script\.onload = initCanonicalInput;/,
    'Legacy root voice input should initialize after the canonical module loads.'
  );
  assert.doesNotMatch(
    legacyVoiceInput,
    /MediaRecorder|parseAlwaysListeningCommand|sendVoiceTranscript|WAKE_NAME_VARIANTS/,
    'Legacy root voice input should not contain the command or recording implementation.'
  );
}

function assertCanonicalVoiceInputOwnsImplementation() {
  assert.match(canonicalVoiceInput, /WAKE_NAME_VARIANTS/, 'Canonical voice input should contain wake-word handling.');
  assert.match(canonicalVoiceInput, /sendVoiceTranscript/, 'Canonical voice input should contain transcription integration.');
  assert.match(
    canonicalVoiceInput,
    /window\.Charlemagne\.voice\.input = \{/,
    'Canonical voice input should expose the app voice input API.'
  );
  assert.doesNotMatch(
    canonicalVoiceInput,
    /document\.addEventListener\('DOMContentLoaded', init\)/,
    'Canonical voice input should let app.js own initialization.'
  );
}

function assertSystemHealthPointsToCanonicalVoiceInput() {
  assert.match(
    systemHealth,
    /"public\/voice\/voice-input\.js"/,
    'System health mic fix hints should point to the canonical voice input file.'
  );
  assert.doesNotMatch(
    systemHealth,
    /"public\/voice-input\.js"/,
    'System health mic fix hints should not point to the legacy stub.'
  );
}

function assertCleanupCheckAllowsCompatibilityStub() {
  assert.match(
    cleanupCheck,
    /isKnownBrowserCompatibilityPair/,
    'Cleanup check should recognize intentional browser compatibility stubs.'
  );
  assert.match(
    cleanupCheck,
    /public\/voice-input\.js/,
    'Cleanup check should explicitly recognize the legacy voice input stub.'
  );
  assert.match(
    cleanupCheck,
    /public\/voice\/voice-input\.js/,
    'Cleanup check should explicitly recognize the canonical voice input file.'
  );
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}
