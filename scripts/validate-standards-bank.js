const path = require('node:path');
const { validateStandardsBankFile } = require('../lib/standards/validateStandardsBank');

const defaultBankPath = path.join(
  __dirname,
  '..',
  'knowledge',
  'standards-banks',
  '_example',
  'standards_bank.json'
);

const bankPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultBankPath;
const result = validateStandardsBankFile(bankPath);

if (result.valid) {
  console.log(`Standards bank validation passed: ${bankPath}`);
  if (result.warnings.length) {
    console.log('Warnings:');
    result.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
  process.exit(0);
}

console.error(`Standards bank validation failed: ${bankPath}`);
result.errors.forEach((error) => console.error(`- ${error}`));
if (result.warnings.length) {
  console.error('Warnings:');
  result.warnings.forEach((warning) => console.error(`- ${warning}`));
}
process.exit(1);
