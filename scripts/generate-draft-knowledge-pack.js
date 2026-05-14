const path = require('node:path');

const {
  DEFAULT_OLLAMA_KEEP_ALIVE,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  DEFAULT_MODEL,
  generateDraftKnowledgePack
} = require('../lib/uploads/generateDraftKnowledgePack');

main().catch((error) => {
  console.error(`Draft generation failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    console.error('Usage: node scripts/generate-draft-knowledge-pack.js --input knowledge/uploads/extracted/example_extraction.json [--standards-bank knowledge/standards-banks/_example/standards_bank.json] [--model gemma4:e2b] [--out knowledge/draft-packs] [--timeout-ms 300000] [--keep-alive 10m] [--retry-invalid-json]');
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  const standardsBankPath = args.standardsBank ? path.resolve(args.standardsBank) : undefined;
  const outputDraftDir = args.out ? path.resolve(args.out) : undefined;
  const model = args.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const timeoutMs = args.timeoutMs || DEFAULT_OLLAMA_TIMEOUT_MS;
  const keepAlive = args.keepAlive || DEFAULT_OLLAMA_KEEP_ALIVE;

  console.log(`Input extraction file: ${inputPath}`);
  console.log(`Model: ${model}`);
  console.log(`Timeout: ${timeoutMs} ms`);
  console.log(`Ollama keep_alive: ${keepAlive}`);
  console.log(`Standards bank: ${standardsBankPath || '(none)'}`);

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: inputPath,
    standardsBankPath,
    outputDraftDir,
    model,
    timeoutMs,
    keepAlive,
    retryInvalidJson: args.retryInvalidJson === true
  });

  console.log(`Validation passed: ${result.validationPassed ? 'yes' : 'no'}`);

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((warning) => console.log(`- ${warning}`));
  }

  if (!result.success) {
    console.error('Errors:');
    result.errors.forEach((error) => console.error(`- ${error}`));
    if (result.rawModelResponsePath) {
      console.error(`Raw model response: ${result.rawModelResponsePath}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Draft pack ID: ${result.packId}`);
  console.log(`Output path: ${result.outputPath}`);
  console.log('Draft was not promoted.');
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      args.input = argv[index + 1];
      index += 1;
    } else if (arg === '--standards-bank') {
      args.standardsBank = argv[index + 1];
      index += 1;
    } else if (arg === '--model') {
      args.model = argv[index + 1];
      index += 1;
    } else if (arg === '--out') {
      args.out = argv[index + 1];
      index += 1;
    } else if (arg === '--timeout-ms') {
      args.timeoutMs = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--keep-alive') {
      args.keepAlive = argv[index + 1];
      index += 1;
    } else if (arg === '--retry-invalid-json') {
      args.retryInvalidJson = true;
    }
  }

  return args;
}
