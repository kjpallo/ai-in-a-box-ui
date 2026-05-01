const formulaRegistry = [
  {
    id: 'motion',
    family: 'motion',
    formula: 'distance = speed * time',
    variables: ['distance', 'speed', 'time'],
    solveFor: ['distance', 'speed', 'time'],
    units: ['m', 'km', 'mile', 'ft', 'cm', 'm/s', 'ft/s', 'mph', 'km/hr', 's', 'min', 'hr'],
    examples: [
      'A car travels 72 meters in 12 seconds. What is its speed?',
      'A runner moves at 4 m/s for 6 seconds. What distance does the runner travel?'
    ]
  },
  {
    id: 'density',
    family: 'density',
    formula: 'density = mass / volume',
    variables: ['density', 'mass', 'volume'],
    solveFor: ['density', 'mass', 'volume'],
    units: ['g', 'kg', 'mL', 'L', 'cm^3', 'm^3', 'g/mL', 'g/cm^3', 'kg/m^3'],
    examples: [
      'A rock has a mass of 180 g and a volume of 30 mL. What is its density?',
      'A box is 4 m long, 2 m wide, and 3 m high with a mass of 96 kg. What is its density?'
    ]
  },
  {
    id: 'force',
    family: 'force',
    formula: 'force = mass * acceleration',
    variables: ['force', 'mass', 'acceleration'],
    solveFor: ['force', 'mass', 'acceleration'],
    units: ['N', 'kg', 'g', 'm/s^2', 'ft/s^2'],
    examples: [
      'A 10 kg object accelerates at 2 m/s^2. What force is needed?',
      'A 54 N force pulls an 18 kg wagon. What is its acceleration?'
    ]
  },
  {
    id: 'acceleration',
    family: 'acceleration',
    formula: 'acceleration = (final velocity - initial velocity) / time',
    variables: ['acceleration', 'final velocity', 'initial velocity', 'time'],
    solveFor: ['acceleration', 'final velocity', 'initial velocity', 'time'],
    units: ['m/s', 'ft/s', 'm/s^2', 'ft/s^2', 's', 'min'],
    examples: [
      'A cart starts at 4 m/s and reaches 12 m/s in 4 seconds. What is its acceleration?',
      'A cart starts at 6 m/s and accelerates at 3 m/s^2 for 5 seconds. What is its final velocity?'
    ]
  }
];

function getFormulaById(id) {
  return formulaRegistry.find((formula) => formula.id === id) || null;
}

module.exports = {
  formulaRegistry,
  getFormulaById
};
