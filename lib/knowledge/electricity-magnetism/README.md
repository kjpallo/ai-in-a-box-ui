# Charlemagne Electricity & Magnetism Knowledge Pack

This pack is designed for the local/offline Charlemagne / AI-in-a-Box classroom tutor.

## What is included

- `electricity_magnetism_vocab.csv` — trusted local vocabulary and definitions.
- `electricity_magnetism_concepts.csv` — relationship/concept answers and common misconceptions.
- `electricity_magnetism_formulas.csv` — deterministic formula targets for Ohm's Law, series resistance, parallel resistance, batteries in series, and power extensions.
- `electricity_magnetism_problem_bank.csv` — paraphrased practice questions with answers and work.
- `electricity_magnetism_circuit_diagrams.csv` — diagram intent data, tutor questions, and diagram checklists.
- `electricity_magnetism_smoke_tests.csv` — tests to add before and after router upgrades.
- `electricityMagnetismKnowledgePack.js` — CommonJS export of the same data for direct Node import.
- `schema.json` — field definitions and recommended router order.

## Important design choice

Keep this content separate from formula files:

```txt
lib/formulas/electricity.js      -> calculations only
lib/vocab/electricityVocab.js    -> definitions and concept facts
lib/knowledge/electricity/       -> imported CSV knowledge pack data
lib/diagrams/circuitDiagramBuilder.js -> future circuit drawing logic
```

## Router recommendation

1. Numeric formula parser first for Ohm's Law and circuit calculations.
2. Vocab lookup for definitions.
3. Concept lookup for relationships and explanations.
4. Circuit diagram intent detection.
5. Guided tutor mode for drawing circuits.
6. AI fallback only if intentionally enabled.

## Source note

The content was created from the uploaded Electricity and Magnetism Honors packet and the worksheet photos provided in the chat. Items are paraphrased and structured for local classroom tutoring rather than copied as a replacement worksheet.
