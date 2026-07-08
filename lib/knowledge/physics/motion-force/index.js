const vocabulary = require('./vocabulary');
const formulas = require('./formulas');
const concepts = require('./concepts');
const graphPatterns = require('./graphPatterns');
const problemBank = require('./problemBank');
const smokeTests = require('./smokeTests');
const { buildMotionForcePacket } = require('./motionForcePacketAdapter');

const MOTION_FORCE_PACKET = buildMotionForcePacket({
  vocabulary,
  formulas,
  concepts,
  graphPatterns,
  problemBank,
  smokeTests
});

module.exports = {
  vocabulary,
  formulas,
  concepts,
  graphPatterns,
  problemBank,
  smokeTests,
  MOTION_FORCE_PACKET
};
