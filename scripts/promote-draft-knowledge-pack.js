const path = require('node:path');

const { promoteDraftKnowledgePack } = require('../lib/knowledge/promoteDraftKnowledgePack');

const args = parseArgs(process.argv.slice(2));

if (!args.pack) {
  console.error('Usage: node scripts/promote-draft-knowledge-pack.js --pack <draft-pack-id-or-path> [--force] [--standards-bank <path>]');
  process.exit(1);
}

console.log(`Promoting draft knowledge pack: ${args.pack}`);
if (args.standardsBank) {
  console.log(`Using standards bank: ${path.resolve(args.standardsBank)}`);
}

const result = promoteDraftKnowledgePack(args.pack, {
  force: args.force,
  standardsBank: args.standardsBank
});

console.log(`Validation passed: ${result.validationPassed ? 'yes' : 'no'}`);

if (result.warnings.length > 0) {
  console.log('Warnings:');
  result.warnings.forEach((warning) => console.log(`- ${warning}`));
}

if (!result.success) {
  console.error('Promotion blocked.');
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Promotion succeeded.');
console.log(`Approved pack written to: ${result.outputPath}`);

function parseArgs(argv) {
  const parsed = {
    force: false,
    pack: null,
    standardsBank: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--force') {
      parsed.force = true;
      continue;
    }

    if (arg === '--pack') {
      parsed.pack = argv[index + 1] || null;
      index += 1;
      continue;
    }

    if (arg === '--standards-bank') {
      parsed.standardsBank = argv[index + 1] || null;
      index += 1;
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }

  return parsed;
}
