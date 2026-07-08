# Refactor Map

This map is for cleanup/refactor prep. It documents current structure only; it is not permission to change behavior.

## Active frontend entry points

- `public/index.html` is the teacher console entry page.
- `public/login.html` and `public/login.js` are the teacher login flow.
- `public/student.html` and `public/student/student-ui.js` are the student-facing classroom flow.
- `public/app.js`, `public/question-input.js`, `public/answer-renderer.js`, `public/recent-questions.js`, `public/profile.js`, `public/system-health.js`, `public/ai-improvement.js`, `public/blade-ui.js`, `public/api-client.js`, and `public/ui-state.js` are active teacher console modules loaded by `public/index.html`.
- `public/voice/voice-input.js`, `public/voice/voice-commands.js`, `public/voice/voice-status.js`, and `public/voice/tts-player.js` are the active browser voice modules.
- `public/teacher-content-ui.js` is an active loader for the split teacher-content frontend modules in `public/teacher-content/`.
- `public/teacher-content/index.js` is active but oversized; it coordinates the teacher content dashboard after the loader brings in the supporting modules.

## Active backend routes

- `server.js` is the Express application entry point and route wiring.
- `routes/authRoutes.js` owns `/api/auth/*`.
- `routes/whisperRoutes.js` owns `/api/whisper/*`.
- `routes/voiceRoutes.js` owns `/api/voices`.
- `routes/healthRoutes.js` owns `/api/health` and `/api/system-health`.
- `routes/questionRoutes.js` owns `/api/router-test` and `/api/chat`.
- `routes/aiImprovementRoutes.js` owns `/api/ai-improvement/*`.
- `routes/profileRoutes.js` owns `/api/profile/*`, including Google/Gmail profile hooks and standards summary.
- `routes/classroomControlsRoutes.js` owns `/api/classroom-controls`.
- `routes/teacherContentRoutes.js` is mounted under `/api/teacher-content` and owns dashboard, upload, draft, review, approved-pack, and standards-bank endpoints.
- `routes/studentRoutes.js` owns `/api/student/*`.

## Active knowledge and upload modules

- `lib/router/questionRouter.js` is the active local question router. The root `lib/questionRouter.js` file is a compatibility wrapper.
- `lib/formulas/` contains the active formula parser, registry, formatter, and formula-family modules. The root `lib/scienceFormulaTools.js` file is a compatibility wrapper.
- `lib/knowledge/teacherKnowledge.js`, `loadEnabledApprovedKnowledgeItems.js`, `loadApprovedKnowledgePacks.js`, `loadDraftKnowledgePacks.js`, `promoteDraftKnowledgePack.js`, `reviewDraftKnowledgePack.js`, `validateKnowledgePack.js`, and related helpers are legacy teacher upload / approved-pack modules. They are parked and out of scope for built-in curriculum packet unification.
- `lib/knowledge/chemistryTools.js` and `lib/knowledge/periodicTableTools.js` are active chemistry/periodic table tools. The root `lib/chemistryTools.js` and `lib/periodicTableTools.js` files are compatibility wrappers.
- `lib/uploads/` owns upload type detection, text extraction, draft pack generation, import reports, source manifests, and teacher content adapters.
- `knowledge/packs/`, `knowledge/schema/`, `knowledge/standards/`, and `knowledge/standards-banks/` are review-safe knowledge definition areas.
- `knowledge/approved-packs/`, `knowledge/deleted-approved-packs/`, `knowledge/draft-packs/`, and `knowledge/uploads/` are legacy teacher upload / approved-pack leftovers. They are parked, out of scope for built-in curriculum packet unification, and should not be counted as packet completeness sources.

## Known large files for later splitting

- `public/teacher-content/index.js`
- `public/voice/voice-input.js`
- `public/student.html`
- `lib/standards/standardsFollowUp.js`
- `lib/knowledge/electricity-magnetism/electricityMagnetismKnowledgePack.js`
- `lib/uploads/draftPackNormalizer.js`
- `routes/studentRoutes.js`
- Large regression fixtures/scripts: `tests/routerTestBank.js`, `scripts/test-router.js`, `scripts/test-teacher-content-routes.js`, `scripts/test-generate-draft-knowledge-pack.js`
- Large data files: `knowledge/standards/missouri_science_6_12_standards.json`, `knowledge/teacher_facts.json`, `standards_metadata_overlay.phase7a3.json`
- `package-lock.json` is generated dependency metadata and is expected to exceed the source-line threshold.

These files are intentionally documented instead of split during final audit cleanup because splitting them can change module load order, route coverage, fixtures, or knowledge data review behavior. Future splits should move one behavior area at a time with matching regression coverage.

## Compatibility wrappers and duplicate-looking files

- `lib/questionRouter.js` -> `lib/router/questionRouter.js`
- `lib/scienceFormulaTools.js` -> `lib/formulas/scienceFormulaTools.js`
- `lib/chemistryTools.js` -> `lib/knowledge/chemistryTools.js`
- `lib/periodicTableTools.js` -> `lib/knowledge/periodicTableTools.js`
- `public/voice-input.js` is a compatibility loader for the canonical `public/voice/voice-input.js`; the active teacher page loads `/voice/voice-input.js`.
- `knowledge/approved-packs/_example/knowledge_pack.json` and `knowledge/draft-packs/_example/knowledge_pack.json` share a basename but represent legacy teacher upload / approved-pack example states.
- `lib/server/utils.js` and `public/teacher-content/utils.js` share a basename but live on opposite sides of the app boundary.

## Protected areas

- Router behavior: `lib/router/`, `lib/formulas/`, `routes/questionRoutes.js`, and router tests.
- Teacher content behavior: `routes/teacherContentRoutes.js`, `public/teacher-content-ui.js`, `public/teacher-content/`, `lib/uploads/`, and knowledge pack review/promote modules. Teacher upload / approved-pack flows are parked legacy behavior for packet unification work.
- Voice behavior: `public/voice/`, `routes/voiceRoutes.js`, `routes/whisperRoutes.js`, `lib/tts/piper.js`, and `lib/whisper/transcribe.js`.
- Standards behavior: `lib/standards/`, `knowledge/standards/`, `knowledge/standards-banks/`, and standards logging/reporting modules.
- Built-in curriculum packet behavior: built-in modules under `lib/knowledge/`, plus `knowledge/schema/` and `knowledge/packs/` where they describe repo-owned curriculum data. Legacy `knowledge/approved-packs/`, draft, upload, and activation flows are out of scope for packet unification work.
- Auth and local state: `lib/auth/teacherAuth.js`, `routes/authRoutes.js`, `routes/profileRoutes.js`, `logs/`, `.env*`, upload artifacts, and OAuth/Gmail files.
