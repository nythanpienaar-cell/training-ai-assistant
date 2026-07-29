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

test('parseManual models a session\'s SESSION FRAMEWORK as numbered steps', () => {
  const markdown = `# Conflict Resolution Basics
## SESSION 1 — Naming the Conflict

### SESSION FRAMEWORK
1. **Welcome & Connection** — open with a question that draws people in
- Ask: "What's a small conflict you've had this week?"
- Let two or three people answer
2. **Engage — Experience First** — an activity or open discussion
- Do not explain yet, let them explore
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.equal(s1.framework.length, 2);
  assert.deepEqual(s1.framework[0], {
    n: 1,
    title: 'Welcome & Connection — open with a question that draws people in',
    bullets: ['Ask: "What\'s a small conflict you\'ve had this week?"', 'Let two or three people answer']
  });
  assert.deepEqual(s1.framework[1], {
    n: 2,
    title: 'Engage — Experience First — an activity or open discussion',
    bullets: ['Do not explain yet, let them explore']
  });
});

test('parseManual gives a session missing SESSION FRAMEWORK an empty array rather than throwing', () => {
  const markdown = `# Bare Bones Manual
## SESSION 1 — Just a Name
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.deepEqual(s1.framework, []);
});

test('parseManual models a session\'s ACTIVITY DESIGN cards', () => {
  const markdown = `# Conflict Resolution Basics
## SESSION 1 — Naming the Conflict

### ACTIVITY DESIGN
**Activity: Two Truths and a Tension**
- **Goal:** Help participants notice conflict signals
- **Type:** Discussion
- **Materials:** None
- **Instructions:**
  1. Pair up participants
  2. Each shares two truths and one tension
- **Facilitator Notes:** Keep it light and low-stakes
- **Teaching Point:** Conflict is often hiding in plain sight

**Activity: The Silent Circle**
- **Goal:** Practise noticing body language
- **Type:** Physical / experiential
- **Materials:** None
- **Instructions:**
  1. Stand in a circle
- **Facilitator Notes:** Watch for anyone uncomfortable
- **Teaching Point:** Tension shows up before words do
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.equal(s1.activities.length, 2);
  assert.deepEqual(s1.activities[0], {
    name: 'Two Truths and a Tension',
    goal: 'Help participants notice conflict signals',
    type: 'Discussion',
    materials: 'None',
    instructions: ['Pair up participants', 'Each shares two truths and one tension'],
    facilitatorNotes: 'Keep it light and low-stakes',
    teachingPoint: 'Conflict is often hiding in plain sight'
  });
  assert.equal(s1.activities[1].name, 'The Silent Circle');
  assert.deepEqual(s1.activities[1].instructions, ['Stand in a circle']);
});

test('parseManual gives a session missing ACTIVITY DESIGN an empty array rather than throwing', () => {
  const markdown = `# Bare Bones Manual
## SESSION 1 — Just a Name
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.deepEqual(s1.activities, []);
});

test('parseManual strips all structured sections from a session\'s remainder', () => {
  const markdown = `# Conflict Resolution Basics
## SESSION 1 — Naming the Conflict

### LEARNING OUTCOMES
**KNOW (Head)**
- Recognise the early signs of conflict

### TRANSFORMATION GOAL
Participants move from avoiding conflict to naming it early.

### SESSION FRAMEWORK
1. **Welcome & Connection** — open with a question

### ACTIVITY DESIGN
**Activity: Two Truths and a Tension**
- **Goal:** Notice conflict signals

### FINAL ACTIVATION — Real-Life Application Plan
- **WHO** will I train?
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.ok(!s1.remainder.includes('LEARNING OUTCOMES'));
  assert.ok(!s1.remainder.includes('Recognise the early signs of conflict'));
  assert.ok(!s1.remainder.includes('TRANSFORMATION GOAL'));
  assert.ok(!s1.remainder.includes('Participants move from avoiding conflict to naming it early.'));
  assert.ok(!s1.remainder.includes('SESSION FRAMEWORK'));
  assert.ok(!s1.remainder.includes('ACTIVITY DESIGN'));
  assert.ok(!s1.remainder.includes('FINAL ACTIVATION'));
});

test('parseManual models the "How This Training Works" front matter', () => {
  const markdown = `# Conflict Resolution Basics
*Turning friction into growth*
2 SESSIONS  ·  PARTICIPATORY | STORY-DRIVEN | REPRODUCIBLE

## HOW THIS TRAINING WORKS
### Learning Philosophy
- Not lecture-based
- Highly participatory
- Story-driven and experiential

### Oral Learning Principles
- Use stories
- Use repetition
- Use group discussion

## SESSION 1 — Naming the Conflict
`;

  const doc = parseManual(markdown);

  assert.deepEqual(doc.howItWorks, {
    learningPhilosophy: ['Not lecture-based', 'Highly participatory', 'Story-driven and experiential'],
    oralLearningPrinciples: ['Use stories', 'Use repetition', 'Use group discussion']
  });
});

test('parseManual gives howItWorks empty arrays rather than throwing when front matter is missing', () => {
  const doc = parseManual('Sure, happy to help with that!');

  assert.deepEqual(doc.howItWorks, { learningPhilosophy: [], oralLearningPrinciples: [] });
});

test('parseManual models the final session\'s Real-Life Application Plan', () => {
  const markdown = `# Conflict Resolution Basics
## SESSION 1 — Naming the Conflict
### PURPOSE — Why This Session Exists
First session.

## SESSION 2 — Responding Well
### PURPOSE — Why This Session Exists
Final session.

### FINAL ACTIVATION — Real-Life Application Plan
- **WHO** will I train/disciple using what I have learned?
- **WHEN and WHERE** will I start?
- **WHAT** is one activity or truth I will use first?
- **HOW** will I keep accountability?
`;

  const doc = parseManual(markdown);

  assert.deepEqual(doc.sessions[0].applicationPlan, []);
  assert.deepEqual(doc.sessions[1].applicationPlan, [
    { label: 'WHO', text: 'will I train/disciple using what I have learned?' },
    { label: 'WHEN and WHERE', text: 'will I start?' },
    { label: 'WHAT', text: 'is one activity or truth I will use first?' },
    { label: 'HOW', text: 'will I keep accountability?' }
  ]);
});

test('parseManual gives a session missing FINAL ACTIVATION an empty applicationPlan array', () => {
  const markdown = `# Bare Bones Manual
## SESSION 1 — Just a Name
`;

  const doc = parseManual(markdown);
  const s1 = doc.sessions[0];

  assert.deepEqual(s1.applicationPlan, []);
});
