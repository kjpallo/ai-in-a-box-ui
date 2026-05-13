const fs = require('node:fs');
const path = require('node:path');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const motionForce = require('../lib/knowledge/physics/motion-force');

const repoRoot = path.join(__dirname, '..');
const vocabDir = path.join(repoRoot, 'lib', 'vocab');
const formulasDir = path.join(repoRoot, 'lib', 'formulas');
const routerPath = path.join(repoRoot, 'lib', 'router', 'questionRouter.js');
const routerTestsPath = path.join(repoRoot, 'scripts', 'test-router.js');

const vocabSource = readJsSources(vocabDir);
const formulaSource = readJsSources(formulasDir);
const routerSource = fs.readFileSync(routerPath, 'utf8');
const routerTestsSource = fs.readFileSync(routerTestsPath, 'utf8');

const vocabOverlaps = motionForce.vocabulary
  .filter((entry) => appearsInSource(entry.term, vocabSource) || entry.aliases?.some((alias) => appearsInSource(alias, vocabSource)))
  .map((entry) => ({
    id: entry.id,
    term: entry.term,
    matchedBy: appearsInSource(entry.term, vocabSource) ? entry.term : entry.aliases.find((alias) => appearsInSource(alias, vocabSource))
  }));

const formulaOverlaps = motionForce.formulas
  .map((entry) => ({
    id: entry.id,
    name: entry.name,
    equation: entry.equation,
    matchedBy: formulaMatch(entry)
  }))
  .filter((entry) => entry.matchedBy.length > 0);

const conceptRoutes = motionForce.concepts.map((entry) => ({
  id: entry.id,
  concept: entry.concept,
  handledBy: conceptHandlers(entry)
}));

const gaps = [
  {
    area: 'Graph interpretation',
    support: 'Distance-time and velocity-time slope/flat-line explanations now route through motion_force_knowledge.'
  },
  {
    area: 'Scenario law identification',
    support: 'Newton law identification for swimmer/action-reaction examples now has a direct local answer.'
  },
  {
    area: 'Air resistance and terminal velocity concepts',
    support: 'Flat vs crumpled paper and terminal velocity are covered by the Motion/Force pack.'
  },
  {
    area: 'Unit-specific comparisons',
    support: 'Speed vs velocity and inertia ranking are available without weakening general vocab.'
  }
];

const keepTestOrTutorOnly = [
  'Numeric Motion/Force formula rows in lib/knowledge/physics/motion-force/formulas.js should remain reference/audit data; lib/formulas remains the solver source of truth.',
  'problemBank.js items should remain test-practice content until a guided tutoring phase explicitly uses them.',
  'smokeTests.js should remain validation data, not routing behavior.',
  'Runner lab, balloon rocket lab, and simple momentum-transfer rows should stay out of direct routing until they have dedicated solver coverage or tutor flow.'
];

console.log('Motion/Force Overlap Audit');
console.log('==========================');
console.log('');

printSection('Vocab terms already present in lib/vocab', vocabOverlaps, (entry) => `${entry.term} (${entry.id}) via "${entry.matchedBy}"`);
printSection('Formulas already solved or represented in lib/formulas', formulaOverlaps, (entry) => `${entry.name} (${entry.id}) -> ${entry.matchedBy.join(', ')}`);
printSection('Concepts already handled by existing router logic', conceptRoutes.filter((entry) => entry.handledBy.length), (entry) => `${entry.concept} (${entry.id}) -> ${entry.handledBy.join(', ')}`);
printSection('Gaps where the new pack adds useful support', gaps, (entry) => `${entry.area}: ${entry.support}`);
printSection('Items that should remain test-only or tutor-only for now', keepTestOrTutorOnly, (entry) => entry);

console.log('Routing spot checks');
console.log('-------------------');
[
  'what is friction',
  'what does slope mean on a velocity time graph',
  'why does a flat paper fall slower than crumpled paper',
  'what is speed if I go 36 meters in 6 seconds',
  'force for 12 kg accelerating at 4 m/s2',
  'momentum of 60 kg skateboarder going 5 m/s'
].forEach((question) => {
  const route = routeStudentQuestion(question, []);
  console.log(`- "${question}" -> ${route.type} [${route.toolsUsed.join(', ') || 'none'}]`);
});

function conceptHandlers(entry) {
  const text = [
    entry.concept,
    entry.learningTarget,
    entry.studentFriendlyRule,
    ...(entry.needsRouterSupport || [])
  ].join(' ').toLowerCase();

  const handlers = [];
  if (/speed|velocity|acceleration|weight|momentum|force|displacement|distance/.test(text) && /tryScienceFormula|science_formula_rules/.test(routerSource + formulaSource)) {
    handlers.push('lib/formulas via science_formula_rules for numeric/formula cases');
  }
  if (/net force|balanced|unbalanced|force diagram|right\/left|up\/down/.test(text) && /tryNetForce|tryFreeBodyForces/.test(formulaSource + routerSource)) {
    handlers.push('net-force/free-body local rules');
  }
  if (/friction|inertia|newton|distance|displacement/.test(text) && /tryPhysicsForcesVocab/.test(routerSource)) {
    handlers.push('lib/vocab physics forces definitions');
  }
  if (/periodic|gravity-near-earth/.test(text) && /tryGravityConstant|tryWeight/.test(formulaSource)) {
    handlers.push('gravity/weight formula rules');
  }
  if (routerTestsSource.includes(entry.id) || routerTestsSource.toLowerCase().includes(entry.concept.toLowerCase())) {
    handlers.push('scripts/test-router.js coverage');
  }

  return [...new Set(handlers)];
}

function formulaMatch(entry) {
  const matches = [];
  const haystack = formulaSource.toLowerCase();
  const id = entry.id.toLowerCase();
  const name = entry.name.toLowerCase();
  const equation = normalizeEquation(entry.equation);

  if (haystack.includes(id.replace(/_/g, ' ')) || haystack.includes(id)) matches.push('matching id/name text');
  if (haystack.includes(name)) matches.push('matching formula name');

  if (/speed|distance_from_speed|time_from_distance/.test(id) && /trymotion|speed_distance_time/.test(haystack)) matches.push('motion speed-distance-time solver');
  if (/velocity/.test(id) && /trymotion|tryaccelerationfromvelocity/.test(haystack)) matches.push('motion/acceleration velocity solver');
  if (/displacement/.test(id) && /trydisplacement|two_dimensional_displacement/.test(haystack)) matches.push('displacement solver');
  if (/acceleration|final_velocity/.test(id) && /tryaccelerationfromvelocity|acceleration_velocity_time/.test(haystack)) matches.push('acceleration solver');
  if (/newton_s_2nd_law|balloon_rocket_force/.test(id) && /force_mass_acceleration|tryforce/.test(haystack)) matches.push('Newton second law solver');
  if (/weight/.test(id) && /weight_mass_gravity|tryweight/.test(haystack)) matches.push('weight solver');
  if (/momentum/.test(id) && /momentum_mass_velocity|trymomentum/.test(haystack)) matches.push('momentum solver');
  if (/net_force/.test(id) && /formulaid: 'net_force'|trynetforce/.test(haystack)) matches.push('net force solver');
  if (equation && haystack.includes(equation)) matches.push('equation text');

  return [...new Set(matches)];
}

function readJsSources(dir) {
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
    .join('\n')
    .toLowerCase();
}

function appearsInSource(term, source) {
  const normalized = String(term || '').toLowerCase();
  if (!normalized) return false;
  return source.includes(normalized) || source.includes(normalized.replace(/-/g, ' '));
}

function normalizeEquation(equation) {
  return String(equation || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function printSection(title, rows, format) {
  console.log(title);
  console.log('-'.repeat(title.length));
  if (!rows.length) {
    console.log('- None found.');
  } else {
    rows.forEach((row) => console.log(`- ${format(row)}`));
  }
  console.log('');
}
