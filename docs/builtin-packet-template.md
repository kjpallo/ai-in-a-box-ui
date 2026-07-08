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
