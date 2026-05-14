const path = require('node:path');
const { validateKnowledgePackFile } = require('../lib/knowledge/validateKnowledgePack');

const defaultPackPath = path.join(
  __dirname,
  '..',
  'knowledge',
  'approved-packs',
  '_example',
  'knowledge_pack.json'
);

const packPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPackPath;
const result = validateKnowledgePackFile(packPath);

if (result.valid) {
  console.log(`Knowledge pack validation passed: ${packPath}`);
  if (result.warnings.length) {
    console.log('Warnings:');
    result.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
  process.exit(0);
}

console.error(`Knowledge pack validation failed: ${packPath}`);
result.errors.forEach((error) => console.error(`- ${error}`));
if (result.warnings.length) {
  console.error('Warnings:');
  result.warnings.forEach((warning) => console.error(`- ${warning}`));
}
process.exit(1);
