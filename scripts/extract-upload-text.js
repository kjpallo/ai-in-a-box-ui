const fs = require('node:fs');
const path = require('node:path');

const { detectUploadFileType } = require('../lib/uploads/detectUploadFileType');
const { extractTextFromFile } = require('../lib/uploads/extractTextFromFile');

main().catch((error) => {
  console.error(`Extraction failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    console.error('Usage: node scripts/extract-upload-text.js --input path/to/file [--out path/to/output.json]');
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  const detected = detectUploadFileType(inputPath);
  console.log(`Detected type: ${detected.type}`);
  console.log(`Extension: ${detected.extension || '(none)'}`);
  console.log(`MIME guess: ${detected.mimeGuess}`);

  const result = await extractTextFromFile(inputPath);
  console.log(`Character count: ${result.text.length}`);

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((warning) => console.log(`- ${warning}`));
  }

  if (!result.success) {
    console.error('Errors:');
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  if (args.out) {
    const outputPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Wrote extraction JSON: ${outputPath}`);
  }
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      args.input = argv[index + 1];
      index += 1;
    } else if (arg === '--out') {
      args.out = argv[index + 1];
      index += 1;
    }
  }

  return args;
}
