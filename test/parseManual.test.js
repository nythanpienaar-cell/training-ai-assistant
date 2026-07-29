const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseManual } = require('../template.js');

test('parseManual extracts cover metadata from a full REFRESH manual', () => {
  const markdown = `# Conflict Resolution Basics
*Turning friction into growth*
6 SESSIONS  ·  PARTICIPATORY | STORY-DRIVEN | REPRODUCIBLE

## HOW THIS TRAINING WORKS
### Learning Philosophy
- Not lecture-based
`;

  const doc = parseManual(markdown);

  assert.equal(doc.cover.title, 'Conflict Resolution Basics');
  assert.equal(doc.cover.tagline, 'Turning friction into growth');
  assert.equal(doc.cover.sessionCount, 6);
  assert.deepEqual(doc.cover.descriptors, ['PARTICIPATORY', 'STORY-DRIVEN', 'REPRODUCIBLE']);
});

test('parseManual falls back gracefully on off-template/short input', () => {
  const doc = parseManual('Sure, happy to help with that!');

  assert.equal(doc.cover.title, 'Sure, happy to help with that!');
  assert.equal(doc.cover.tagline, null);
  assert.equal(doc.cover.sessionCount, null);
  assert.deepEqual(doc.cover.descriptors, []);
});

test('parseManual never throws on empty input', () => {
  const doc = parseManual('');

  assert.equal(doc.cover.title, 'Training Manual');
});
