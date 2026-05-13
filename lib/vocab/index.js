const { tryAmbiguousVocab } = require('./ambiguousVocab');
const { tryElectricityVocab } = require('./electricityVocab');
const { tryFreeBodyForces } = require('./freeBodyForces');
const { tryPhysicsForcesVocab } = require('./physicsForces');

module.exports = {
  tryAmbiguousVocab,
  tryElectricityVocab,
  tryFreeBodyForces,
  tryPhysicsForcesVocab
};
