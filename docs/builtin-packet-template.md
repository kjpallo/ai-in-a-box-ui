# Built-In Curriculum Packet Template

Built-in curriculum packets are checked-in curriculum data modules registered through `lib/knowledge/builtinPacketRegistry.js`. New packet-style units should export one packet object and register that export with `status: 'packet'` and `packetExportName`.

## Required Shape

Packet-shaped entries should provide:

- `packetId`
- `unit` or `unitTitle`
- `topic` in the packet or registry entry
- At least one knowledge body field:
  - `vocabulary`
  - `canonicalFacts` or `facts`
  - `concepts` or `conceptGroups`
  - `referenceFormulas` or `formulas`

## Recommended Shape

These fields can be missing during migration, but the schema report will call them out:

- `sourceMetadata`, `sourceRefs`, or `sourceFiles`
- `relationships`
- `comparisons`
- `examples`
- `conceptTutorHooks`
- `formulaTutorHooks`
- `smokeTests`
- `routeHints`, `routePreference`, or `boundaries`
- `commonMisconceptions`

Legacy built-in modules may remain registered with `status: 'legacy'` until they are converted. Legacy entries are reported as conversion gaps instead of packet validation failures.

## Readiness Checkpoint

As of the Bonding packet addition checkpoint, these entries are registered as packet-shaped built-in curriculum:

- Unit 1 Measurement/Data Quality
- Unit 1 Safety/Equipment
- Unit 1 Scientific Method
- Unit 1 Graphing/Data
- Unit 1 Conversions/Notation
- Unit 3 Energy
- Motion/Force
- Unit 5 Waves
- Unit 6 Matter
- Unit 7 Atomic Structure
- Unit 8 Bonding

`electricity-magnetism` remains intentionally registered as a legacy built-in packet module. It is still active curriculum support data, but it is not yet a direct-matcher packet and should stay a graph-normalizer skip until a focused conversion patch gives it the standard packet export.

The final new units should copy the Unit 5, Unit 6, or Unit 8 pattern: one checked-in knowledge module, one packet export registered in `builtinPacketRegistry.js`, route behavior preserved through the existing matcher/tutor paths, and focused unit regression tests. They should not copy teacher upload, draft-pack, approved-pack, or import-pipeline code.

Out of scope for packet normalization:

- teacher uploads, draft packs, approved packs, and teacher content approval
- using the graph normalizer as the answer engine
- broad router rewrites
- student UI, calculator, picket fence, or stair-step UI changes
- forcing support-only legacy modules to expose a matcher before they are deliberately converted
