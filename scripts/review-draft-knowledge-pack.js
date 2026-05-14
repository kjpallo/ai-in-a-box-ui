#!/usr/bin/env node

const {
  SAFE_EDIT_FIELDS,
  listReviewableDraftItems,
  updateDraftItemReviewStatus,
  editDraftItemField
} = require('../lib/knowledge/reviewDraftKnowledgePack');

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.pack) {
    fail(['Missing required --pack <packId-or-path>.']);
  }

  if (args.list) {
    const result = listReviewableDraftItems(args.pack, { status: args.status });
    printHeader(result, args.pack);
    if (!result.success) fail(result.errors);
    printList(result.items);
    printWarnings(result.warnings);
    return;
  }

  if (!args.section || args.index === undefined) {
    fail(['Missing required --section and --index for review updates.']);
  }

  if (args.status) {
    const result = updateDraftItemReviewStatus(args.pack, args.section, args.index, args.status);
    printHeader(result, args.pack);
    if (!result.success) fail(result.errors);
    console.log(`${args.section}[${Number(args.index)}] reviewStatus: ${result.before} -> ${result.after}`);
    console.log(`Saved: ${result.savedPath}`);
    printWarnings(result.warnings);
    return;
  }

  const setEntries = Object.entries(args.set || {});
  if (setEntries.length === 1) {
    const [fieldName, value] = setEntries[0];
    const result = editDraftItemField(args.pack, args.section, args.index, fieldName, value);
    printHeader(result, args.pack);
    if (!result.success) fail(result.errors);
    console.log(`${args.section}[${Number(args.index)}] changed ${result.changedField}:`);
    console.log(`  Before: ${formatValue(result.before)}`);
    console.log(`  After:  ${formatValue(result.after)}`);
    console.log(`Saved: ${result.savedPath}`);
    printWarnings(result.warnings);
    return;
  }

  if (setEntries.length > 1) {
    fail(['Only one --set field=value edit is allowed per command.']);
  }

  fail([
    'No review action requested. Use --list, --status <pending|approved|rejected>, or --set field=value.',
    `Editable fields: ${formatEditableFields()}`
  ]);
}

function parseArgs(argv) {
  const args = {
    set: {}
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--list') {
      args.list = true;
      continue;
    }

    if (!arg.startsWith('--')) continue;

    const withoutPrefix = arg.slice(2);
    const equalsIndex = withoutPrefix.indexOf('=');
    if (equalsIndex === -1) {
      const nextValue = argv[index + 1];
      if (nextValue && !nextValue.startsWith('--')) {
        if (withoutPrefix === 'set') {
          addSetArg(args, nextValue);
        } else {
          args[withoutPrefix] = nextValue;
        }
        index += 1;
      } else {
        args[withoutPrefix] = true;
      }
      continue;
    }

    const key = withoutPrefix.slice(0, equalsIndex);
    const value = withoutPrefix.slice(equalsIndex + 1);
    if (key === 'set') {
      addSetArg(args, value);
      continue;
    }

    args[key] = value;
  }

  return args;
}

function addSetArg(args, value) {
  const fieldEqualsIndex = value.indexOf('=');
  if (fieldEqualsIndex === -1) {
    args.set[value] = '';
    return;
  }
  args.set[value.slice(0, fieldEqualsIndex)] = value.slice(fieldEqualsIndex + 1);
}

function printHeader(result, requestedPack) {
  console.log('Draft Knowledge Pack Review');
  console.log('===========================');
  console.log(`Requested pack: ${requestedPack}`);
  if (result && result.draftPackPath) console.log(`Draft pack path: ${result.draftPackPath}`);
  if (result && result.packId) console.log(`Pack ID: ${result.packId}`);
  console.log('');
}

function printList(items) {
  if (!items || items.length === 0) {
    console.log('No matching reviewable items.');
    return;
  }

  items.forEach((item) => {
    console.log(`- ${item.section}[${item.index}] ${item.reviewStatus} confidence=${item.confidence}`);
    const label = item.title || item.term || item.question || item.formula || item.standardId;
    if (label) console.log(`  ${label}`);
    if (item.sourceFile) console.log(`  Source file: ${item.sourceFile}`);
    if (item.sourceLocation) console.log(`  Source location: ${item.sourceLocation}`);
    if (item.sourceTextSnippet) console.log(`  Source text: ${item.sourceTextSnippet}`);
  });
}

function printWarnings(warnings) {
  if (!warnings || warnings.length === 0) return;
  console.log('');
  console.log('Warnings');
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(' | ');
  if (value === undefined) return '';
  return String(value);
}

function formatEditableFields() {
  return Object.entries(SAFE_EDIT_FIELDS)
    .map(([sectionName, fields]) => `${sectionName}: ${Array.from(fields).join(', ')}`)
    .join('; ');
}

function fail(errors) {
  (errors || ['Unknown review helper failure.']).forEach((error) => console.error(error));
  process.exit(1);
}

main();
