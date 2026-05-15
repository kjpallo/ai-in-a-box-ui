const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { registerTeacherContentRoutes } = require('../routes/teacherContentRoutes');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-teacher-content-routes');
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const approvedPacksDir = path.join(tempRoot, 'approved-packs');
const uploadIncomingDir = path.join(tempRoot, 'uploads', 'incoming');
const uploadExtractedDir = path.join(tempRoot, 'uploads', 'extracted');
const realApprovedPacksDir = path.join(projectRoot, 'knowledge', 'approved-packs');
const standardsBank = makeStandardsBank();

cleanupTempRoot();
fs.mkdirSync(draftPacksDir, { recursive: true });
fs.mkdirSync(approvedPacksDir, { recursive: true });
fs.mkdirSync(uploadIncomingDir, { recursive: true });
fs.mkdirSync(uploadExtractedDir, { recursive: true });

const approvedPacksBefore = snapshotFiles(realApprovedPacksDir);
const routerStudentFilesBefore = snapshotRouterAndStudentFiles();

main().catch((error) => {
  console.error('Teacher content route tests failed.');
  console.error(error);
  cleanupTempRoot();
  process.exit(1);
});

async function main() {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-draft-pack',
    vocabulary: [
      makeVocabularyItem('net-force', 'pending'),
      makeVocabularyItem('balanced-force', 'approved')
    ],
    concepts: [
      makeConceptItem('balanced-forces', 'rejected')
    ]
  }));
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'route-approved-pack',
    version: '1.0.0',
    vocabulary: [
      makeVocabularyItem('net-force', 'approved'),
      makeVocabularyItem('balanced-force', 'approved')
    ]
  }));
  const handlers = new Map();
  registerTeacherContentRoutes(createApp(handlers), {
    draftPacksDir,
    approvedPacksDir,
    uploadIncomingDir,
    uploadExtractedDir,
    standardsBank
  });

  try {
    await assertDashboardEndpoint(handlers);
    await assertSuccessfulTxtUploadExtraction(handlers);
    await assertUnsupportedUploadExtensionFails(handlers);
    await assertUnsafeUploadFilenameIsSanitized(handlers);
    await assertDraftsEndpoint(handlers);
    await assertDraftReportEndpoint(handlers);
    await assertPromoteDraftEndpointSucceeds(handlers);
    await assertPromoteBlocksPendingItems(handlers);
    await assertPromoteBlocksRejectedItems(handlers);
    await assertPromoteBlocksInvalidFormulaSolverStatus(handlers);
    await assertPromoteDoesNotOverwriteWithoutForce(handlers);
    await assertPromoteOverwritesWithForce(handlers);
    await assertInvalidPromotePathTraversalRejected(handlers);
    await assertApproveDraftItemEndpoint(handlers);
    await assertRejectDraftItemEndpoint(handlers);
    await assertEditDraftItemEndpoint(handlers);
    await assertDisallowedEditFails(handlers);
    await assertInvalidPatchPathTraversalRejected(handlers);
    await assertInvalidSectionRejected(handlers);
    await assertInvalidIndexRejected(handlers);
    await assertInvalidReviewStatusRejected(handlers);
    await assertSolverStatusEditRejected(handlers);
    await assertApprovedEndpoint(handlers);
    await assertMissingDraftReportEndpoint(handlers);
    await assertPathTraversalRejected(handlers);
    assertRealApprovedPacksAreNotModified();
    assertNoRouterOrStudentModulesImported();
  } finally {
    cleanupTempRoot();
  }

  console.log('Teacher content route tests passed.');
}

async function assertDashboardEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/dashboard');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.draftPacks, 1);
  assert.deepEqual(response.body.data.availableTabs, [
    'upload',
    'standards',
    'draftPack',
    'reviewDraft',
    'importReport',
    'approvedPacks'
  ]);
}

async function assertDraftsEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/drafts');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.draftPacks.length, 1);
  assert.equal(response.body.data.draftPacks[0].packId, 'route-draft-pack');
  assert.equal(response.body.data.draftPacks[0].totalPending, 1);
  assert.equal(response.body.data.draftPacks[0].totalRejected, 1);
}

async function assertDraftReportEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, {
    packId: 'route-draft-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.draftPack.packId, 'route-draft-pack');
  assert.equal(response.body.data.pendingReview.totalPending, 1);
  assert.equal(response.body.data.promotionReadiness.ready, false);
  assert.ok(response.body.data.promotionReadiness.blockedReasons.includes('pending items remain'));
}

async function assertSuccessfulTxtUploadExtraction(handlers) {
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const approvedFilesBefore = snapshotFiles(realApprovedPacksDir);
  const response = await requestMultipart(handlers, '/uploads/extract', {
    fileName: 'teacher_force_notes.txt',
    contentType: 'text/plain',
    content: 'Balanced forces have a net force of zero.\nUnbalanced forces change motion.\n'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.originalFileName, 'teacher_force_notes.txt');
  assert.equal(response.body.data.fileType, 'txt');
  assert.ok(response.body.data.characterCount > 20);
  assert.equal(response.body.data.sectionsCount, 1);
  assert.equal(response.body.data.tablesCount, 0);
  assert.ok(response.body.data.storedFileName.endsWith('.txt'));
  assert.ok(!response.body.data.storedFileName.includes('teacher_force_notes'));
  assert.ok(response.body.data.extractionJsonFileName.endsWith('_extraction.json'));

  const storedPath = path.join(uploadIncomingDir, response.body.data.storedFileName);
  const extractionPath = path.join(uploadExtractedDir, response.body.data.extractionJsonFileName);
  assert.equal(fs.existsSync(storedPath), true, 'Upload source should be stored safely.');
  assert.equal(fs.readFileSync(storedPath, 'utf8').includes('Balanced forces'), true);
  assert.equal(fs.existsSync(extractionPath), true, 'Extraction JSON should be created.');
  const extractionJson = JSON.parse(fs.readFileSync(extractionPath, 'utf8'));
  assert.equal(extractionJson.success, true);
  assert.equal(extractionJson.upload.originalFileName, 'teacher_force_notes.txt');
  assert.ok(extractionJson.text.includes('Unbalanced forces'));

  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'upload extraction should not create or modify draft packs');
  assert.deepEqual(snapshotFiles(realApprovedPacksDir), approvedFilesBefore, 'upload extraction should not modify real approved packs');
}

async function assertUnsupportedUploadExtensionFails(handlers) {
  const incomingBefore = snapshotFiles(uploadIncomingDir);
  const extractedBefore = snapshotFiles(uploadExtractedDir);
  const response = await requestMultipart(handlers, '/uploads/extract', {
    fileName: 'slides.pptx',
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    content: 'PowerPoint is not supported in this phase.'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('Unsupported upload file type')));
  assert.deepEqual(snapshotFiles(uploadIncomingDir), incomingBefore, 'unsupported source should not be stored');
  assert.deepEqual(snapshotFiles(uploadExtractedDir), extractedBefore, 'unsupported extraction JSON should not be created');
}

async function assertUnsafeUploadFilenameIsSanitized(handlers) {
  const response = await requestMultipart(handlers, '/uploads/extract', {
    fileName: '../unsafe/../../teacher path traversal.txt',
    contentType: 'text/plain',
    content: 'Path traversal names should be reduced to a harmless basename.\n'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.originalFileName, 'teacher path traversal.txt');
  assert.match(response.body.data.storedFileName, /^[a-f0-9-]+\.txt$/);
  assert.equal(path.dirname(path.join(uploadIncomingDir, response.body.data.storedFileName)), uploadIncomingDir);
}

async function assertApprovedEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/approved');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.approvedPacks.length >= 1);
  const approvedPack = response.body.data.approvedPacks.find((pack) => pack.packId === 'route-approved-pack');
  assert.equal(approvedPack.packId, 'route-approved-pack');
  assert.ok(response.body.data.indexedCounts.vocabularyTerms >= 1);
}

async function assertPromoteDraftEndpointSucceeds(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-ready-pack',
    title: 'Route Promote Ready Pack'
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-ready-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, 'route-promote-ready-pack');
  assert.equal(response.body.data.message, 'Draft promoted to approved knowledge pack.');
  assert.equal(response.body.data.approved.packId, 'route-promote-ready-pack');
  assert.equal(response.body.data.dashboard.approvedPacks, 2);
  assert.ok(response.body.data.outputPath.startsWith(approvedPacksDir));
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-promote-ready-pack', 'knowledge_pack.json')), true);
}

async function assertPromoteBlocksPendingItems(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-pending-pack',
    vocabulary: [makeVocabularyItem('pending-term', 'pending')]
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-pending-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('pending teacher review')));
  assert.equal(response.body.promotionReadiness.ready, false);
  assert.ok(response.body.promotionReadiness.blockedReasons.includes('pending items remain'));
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-promote-pending-pack', 'knowledge_pack.json')), false);
}

async function assertPromoteBlocksRejectedItems(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-rejected-pack',
    concepts: [makeConceptItem('rejected-concept', 'rejected')]
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-rejected-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('has been rejected')));
  assert.ok(response.body.promotionReadiness.blockedReasons.includes('rejected items remain'));
}

async function assertPromoteBlocksInvalidFormulaSolverStatus(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-formula-pack',
    referenceFormulas: [
      {
        ...makeReferenceFormula('force-reference', 'approved'),
        solverStatus: 'science_formula_rules'
      }
    ]
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-formula-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('solver support')));
  assert.ok(response.body.promotionReadiness.blockedReasons.includes('formula solverStatus is not reference_only'));
}

async function assertPromoteDoesNotOverwriteWithoutForce(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-approved-pack',
    title: 'Draft Copy Of Existing Approved Pack'
  }));
  const before = readKnowledgePack(approvedPacksDir, 'route-approved-pack');

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('already exists')));
  assert.equal(readKnowledgePack(approvedPacksDir, 'route-approved-pack').title, before.title);
}

async function assertPromoteOverwritesWithForce(handlers) {
  const response = await request(handlers, 'POST', '/drafts/:packId/promote', { force: true }, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(readKnowledgePack(approvedPacksDir, 'route-approved-pack').title, 'Draft Copy Of Existing Approved Pack');
}

async function assertInvalidPromotePathTraversalRejected(handlers) {
  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: '../route-promote-ready-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
}

async function assertApproveDraftItemEndpoint(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'approved'
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.update.after, 'approved');
  assert.equal(readKnowledgePack(draftPacksDir, 'route-draft-pack').vocabulary[0].reviewStatus, 'approved');
  assert.equal(response.body.data.report.draftPack.reviewCountsBySection.vocabulary.approved, 2);
}

async function assertRejectDraftItemEndpoint(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'rejected'
  }, {
    packId: 'route-draft-pack',
    section: 'concepts',
    index: '0'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(readKnowledgePack(draftPacksDir, 'route-draft-pack').concepts[0].reviewStatus, 'rejected');
}

async function assertEditDraftItemEndpoint(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index', {
    field: 'studentDefinition',
    value: 'Updated draft-only student definition.'
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  const pack = readKnowledgePack(draftPacksDir, 'route-draft-pack');
  assert.equal(pack.vocabulary[0].studentDefinition, 'Updated draft-only student definition.');
  assert.equal(pack.vocabulary[0].sourceFile, 'teacher_force_notes.txt');
  assert.equal(response.body.data.report.draftPack.packId, 'route-draft-pack');
}

async function assertDisallowedEditFails(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index', {
    field: 'aliases',
    value: ['force']
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /not editable/);
}

async function assertInvalidPatchPathTraversalRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'approved'
  }, {
    packId: '../route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
}

async function assertInvalidSectionRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'approved'
  }, {
    packId: 'route-draft-pack',
    section: 'router',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /section/);
}

async function assertInvalidIndexRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'approved'
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '9'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /No item found/);
}

async function assertInvalidReviewStatusRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'promoted'
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /reviewStatus/);
}

async function assertSolverStatusEditRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index', {
    field: 'solverStatus',
    value: 'ready'
  }, {
    packId: 'route-draft-pack',
    section: 'referenceFormulas',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /not editable/);
  assert.equal(readKnowledgePack(draftPacksDir, 'route-draft-pack').referenceFormulas[0].solverStatus, 'reference_only');
}

async function assertMissingDraftReportEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, {
    packId: 'missing-draft-pack'
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.length > 0);
}

async function assertPathTraversalRejected(handlers) {
  const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, {
    packId: '../route-draft-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
}

function assertRealApprovedPacksAreNotModified() {
  assert.deepEqual(
    snapshotFiles(realApprovedPacksDir),
    approvedPacksBefore,
    'real knowledge/approved-packs should not be modified'
  );
}

function assertNoRouterOrStudentModulesImported() {
  assert.deepEqual(
    snapshotRouterAndStudentFiles(),
    routerStudentFilesBefore,
    'router/student files should not be touched'
  );

  const importedPaths = Object.keys(require.cache).map((filePath) => path.relative(projectRoot, filePath));
  const forbidden = importedPaths.filter((filePath) => {
    return filePath.startsWith('lib/router/')
      || filePath === 'lib/questionRouter.js'
      || filePath.startsWith('routes/student')
      || filePath === 'lib/server/questionAnswerService.js';
  });

  assert.deepEqual(forbidden, [], `teacher content routes should not import router/student modules: ${forbidden.join(', ')}`);
}

function createApp(handlers) {
  return {
    get(route, handler) {
      handlers.set(`GET ${route}`, handler);
    },
    patch(route, handler) {
      handlers.set(`PATCH ${route}`, handler);
    },
    post(route, handler) {
      handlers.set(`POST ${route}`, handler);
    }
  };
}

async function request(handlers, method, route, body = {}, params = {}) {
  const handler = handlers.get(`${method} ${route}`);
  assert.ok(handler, `Missing handler: ${method} ${route}`);

  const req = { body, params, query: {}, headers: {} };
  const res = createResponse();
  await handler(req, res);
  return res;
}

async function requestMultipart(handlers, route, file) {
  const handler = handlers.get(`POST ${route}`);
  assert.ok(handler, `Missing handler: POST ${route}`);

  const boundary = `test-boundary-${Date.now()}`;
  const rawBody = makeMultipartBody(boundary, file);
  const req = {
    body: {},
    params: {},
    query: {},
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(rawBody.length)
    },
    rawBody
  };
  const res = createResponse();
  await handler(req, res);
  return res;
}

function makeMultipartBody(boundary, file) {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="sourceFile"; filename="${file.fileName}"\r\n`),
    Buffer.from(`Content-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`),
    Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content || '')),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function writeKnowledgePack(rootDir, pack) {
  const packDir = path.join(rootDir, pack.packId);
  const packPath = path.join(packDir, 'knowledge_pack.json');
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  return packPath;
}

function readKnowledgePack(rootDir, packId) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, packId, 'knowledge_pack.json'), 'utf8'));
}

function makePack(overrides = {}) {
  return {
    packId: 'route-pack',
    title: 'Route Pack',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [
      {
        fileName: 'teacher_force_notes.txt',
        fileType: 'txt',
        reviewStatus: 'approved',
        confidence: 'high',
        notes: 'Teacher uploaded notes.'
      }
    ],
    vocabulary: [makeVocabularyItem('net-force', 'approved')],
    concepts: [makeConceptItem('balanced-forces', 'approved')],
    referenceFormulas: [makeReferenceFormula('force-reference', 'approved')],
    problemBank: [makeProblemItem('balanced-force-problem', 'approved')],
    standardsMap: [makeStandardsMapItem('SAMPLE.PS.FORCES.1', 'approved')],
    smokeTests: [makeSmokeTest('approved')],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-14T00:00:00.000Z'
    },
    ...overrides
  };
}

function makeVocabularyItem(term, reviewStatus) {
  return {
    term,
    aliases: [],
    studentDefinition: 'Net force is the total force on an object.',
    teacherDefinition: 'Net force is the vector sum of forces acting on an object.',
    misconception: 'Students may think balanced forces always mean no forces exist.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Force is a push or pull.'
  };
}

function makeConceptItem(conceptId, reviewStatus) {
  return {
    conceptId,
    title: 'Balanced Forces',
    aliases: [],
    studentExplanation: 'Balanced forces do not change motion.',
    keyIdeas: ['Balanced forces do not change motion.'],
    examples: ['Equal pushes from opposite sides.'],
    nonExamples: ['A stronger push from one side.'],
    commonMisconceptions: ['Balanced forces mean no forces exist.'],
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeReferenceFormula(formulaId, reviewStatus) {
  return {
    formulaId,
    title: 'Net Force Reference',
    equation: 'net force = sum of forces',
    variables: [],
    solverStatus: 'reference_only',
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Net force is the sum of forces.'
  };
}

function makeProblemItem(problemId, reviewStatus) {
  return {
    problemId,
    question: 'A box has equal forces from both sides. What happens to its motion?',
    expectedAnswer: 'The balanced forces do not change its motion.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeStandardsMapItem(standardId, reviewStatus) {
  return {
    standardId,
    description: 'Describe how balanced and unbalanced forces affect motion.',
    relatedVocabulary: ['net-force'],
    relatedConcepts: ['balanced-forces'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium'
  };
}

function makeSmokeTest(reviewStatus) {
  return {
    question: 'What do balanced forces do?',
    expectedAnswer: 'They do not change motion.',
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium'
  };
}

function makeStandardsBank() {
  return {
    standardsBankId: 'sample_physical_science_standards',
    title: 'Sample Physical Science Standards Bank',
    version: '0.1.0',
    subject: 'Physical Science',
    gradeLevel: '8',
    jurisdiction: 'Local Sample',
    sourceFiles: [],
    standards: [
      {
        standardId: 'SAMPLE.PS.FORCES.1',
        code: 'PS.FORCES.1',
        title: 'Balanced and Unbalanced Forces',
        officialText: 'Describe how balanced and unbalanced forces affect motion.',
        studentFriendlyText: 'I can explain how balanced and unbalanced forces change motion.',
        strand: 'Physical Science',
        topic: 'Forces and Motion',
        keywords: ['balanced forces'],
        questionTriggers: ['net force'],
        prerequisiteStandards: [],
        relatedStandards: [],
        reviewStatus: 'approved',
        confidence: 'high',
        sourceFile: 'sample_standards_source.pdf',
        sourceLocation: 'p. 1',
        sourceTextSnippet: 'Describe how balanced and unbalanced forces affect motion.'
      }
    ],
    metadata: {}
  };
}

function snapshotFiles(rootDir) {
  const snapshot = {};
  walkFiles(rootDir).forEach((filePath) => {
    snapshot[path.relative(rootDir, filePath)] = fs.readFileSync(filePath, 'utf8');
  });
  return snapshot;
}

function snapshotRouterAndStudentFiles() {
  const files = walkFiles(projectRoot).filter((filePath) => {
    const relativePath = path.relative(projectRoot, filePath);
    return relativePath.startsWith('lib/router/')
      || relativePath === 'lib/questionRouter.js'
      || relativePath.startsWith('routes/student')
      || relativePath === 'lib/server/questionAnswerService.js';
  });

  const snapshot = {};
  files.forEach((filePath) => {
    const stat = fs.statSync(filePath);
    snapshot[path.relative(projectRoot, filePath)] = {
      size: stat.size,
      mtimeMs: stat.mtimeMs
    };
  });
  return snapshot;
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  fs.readdirSync(rootDir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      results.push(entryPath);
    }
  });
  return results.sort();
}

function cleanupTempRoot() {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
