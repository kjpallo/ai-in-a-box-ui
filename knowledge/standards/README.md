# Missouri Science 6-12 Standards

Phase 7A adds a reusable standards bank and course profile configuration for standards matching. The app does not parse PDFs at runtime; this directory stores teacher-readable JSON data that can be selected and weighted by course.

## Standards bank

`missouri_science_6_12_standards.json` contains the `missouri_science_6_12` master bank. Each standard keeps the official Missouri label in `standardId` and `officialLabel`, plus teacher-friendly metadata such as `classroomArea`, `unit`, `keywords`, `questionTriggers`, `relatedFormulas`, and `courseTags`.

The `statement` field may contain concise summary text. Treat it as official Missouri wording only when `officialStatementVerified` is `true`; otherwise `statementType: "summary"` means the wording is a generated classroom-facing summary that still needs line-by-line verification against the official Missouri source. A future cleanup pass should replace or verify these statements from the source documents.

## Course profiles

`course_profiles.json` defines selectable course defaults. The initial `physical_science` profile treats high school PS1, PS2, PS3, and PS4 as core standards and high school ETS1 as supporting standards. Life science, earth and space science, and 6-8 prerequisite standards remain in the bank but are off/selectable by default for this course.

Future Phase 7B can add the teacher blade UI that toggles domains or individual standards on and off without changing student answer behavior.

## Phase 7A.2 metadata audit

Phase 7A.2 adds `npm run audit:standards-metadata` to check standards metadata quality, source-verification honesty, duplicate IDs, and invented standard IDs. It also narrows broad metadata in active high school physical science and engineering standards so single generic words such as force, mass, energy, wave, current, or design do not create primary standards matches by themselves.

This cleanup only affects standards metadata and standards scoring. Student answers, router behavior, formula behavior, expected answer text, sample pack fallback behavior, and the course profile system remain unchanged.
