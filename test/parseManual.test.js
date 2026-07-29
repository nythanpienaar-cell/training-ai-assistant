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

test('parseManual models each session\'s name, theme, overview, and purpose', () => {
  const markdown = `# Conflict Resolution Basics
*Turning friction into growth*
2 SESSIONS  ·  PARTICIPATORY | STORY-DRIVEN | REPRODUCIBLE

## SESSION 1 — Naming the Conflict
*Learning to see friction clearly*

### TRAINING OVERVIEW
- **Training Title:** Conflict Resolution Basics
- **Theme:** Naming what's really going on
- **Audience:** Small-group facilitators

### PURPOSE — Why This Session Exists
This session exists to help participants notice conflict before it escalates. It lays the foundation for every later session.

## SESSION 2 — Responding Well
*From reaction to response*

### TRAINING OVERVIEW
- **Training Title:** Conflict Resolution Basics
- **Theme:** Choosing a healthy response
- **Audience:** Small-group facilitators

### PURPOSE — Why This Session Exists
This session builds the skill of pausing before reacting.
`;

  const doc = parseManual(markdown);

  assert.equal(doc.sessions.length, 2);

  const s1 = doc.sessions[0];
  assert.equal(s1.name, 'Naming the Conflict');
  assert.equal(s1.theme, 'Learning to see friction clearly');
  assert.deepEqual(s1.overview, {
    title: 'Conflict Resolution Basics',
    theme: "Naming what's really going on",
    audience: 'Small-group facilitators'
  });
  assert.equal(s1.purpose, "This session exists to help participants notice conflict before it escalates. It lays the foundation for every later session.");

  const s2 = doc.sessions[1];
  assert.equal(s2.name, 'Responding Well');
  assert.equal(s2.theme, 'From reaction to response');
  assert.equal(s2.overview.theme, 'Choosing a healthy response');
  assert.equal(s2.purpose, 'This session builds the skill of pausing before reacting.');
});

test('parseManual gives sessions missing overview/purpose empty/null fields rather than throwing', () => {
  const markdown = `# Bare Bones Manual
## SESSION 1 — Just a Name
`;

  const doc = parseManual(markdown);

  assert.equal(doc.sessions.length, 1);
  const s1 = doc.sessions[0];
  assert.equal(s1.name, 'Just a Name');
  assert.equal(s1.theme, null);
  assert.deepEqual(s1.overview, { title: null, theme: null, audience: null });
  assert.equal(s1.purpose, null);
});

test('parseManual returns an empty sessions array for off-template input', () => {
  const doc = parseManual('Sure, happy to help with that!');

  assert.deepEqual(doc.sessions, []);
});

test('parseManual models a session\'s learning outcomes triad and transformation goal', () => {
  const markdown = `# Conflict Resolution Basics
## SESSION 1 — Naming the Conflict
*Learning to see friction clearly*

### LEARNING OUTCOMES
**KNOW (Head)**
- Recognise the early signs of conflict
- Understand the cost of avoidance
**DO (Hands)**
- Practise naming a conflict out loud
**BECOME (Heart)**
- People who face friction instead of hiding from it

### TRANSFORMATION GOAL
Participants move from avoiding conflict to naming it early and calmly.

### SESSION FRAMEWORK
1. **Welcome & Connection** — open with a question
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.deepEqual(s1.outcomes, {
    know: ['Recognise the early signs of conflict', 'Understand the cost of avoidance'],
    do: ['Practise naming a conflict out loud'],
    become: ['People who face friction instead of hiding from it']
  });
  assert.equal(s1.transformationGoal, 'Participants move from avoiding conflict to naming it early and calmly.');
});

test('parseManual gives sessions missing outcomes/transformation goal empty arrays and null rather than throwing', () => {
  const markdown = `# Bare Bones Manual
## SESSION 1 — Just a Name
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.deepEqual(s1.outcomes, { know: [], do: [], become: [] });
  assert.equal(s1.transformationGoal, null);
});

test('parseManual strips LEARNING OUTCOMES and TRANSFORMATION GOAL from a session\'s remainder', () => {
  const markdown = `# Conflict Resolution Basics
## SESSION 1 — Naming the Conflict

### LEARNING OUTCOMES
**KNOW (Head)**
- Recognise the early signs of conflict

### TRANSFORMATION GOAL
Participants move from avoiding conflict to naming it early.

### SESSION FRAMEWORK
1. **Welcome & Connection** — open with a question
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.ok(!s1.remainder.includes('LEARNING OUTCOMES'));
  assert.ok(!s1.remainder.includes('Recognise the early signs of conflict'));
  assert.ok(!s1.remainder.includes('TRANSFORMATION GOAL'));
  assert.ok(!s1.remainder.includes('Participants move from avoiding conflict to naming it early.'));
  assert.ok(s1.remainder.includes('SESSION FRAMEWORK'));
});
