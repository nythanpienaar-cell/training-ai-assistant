// The REFRESH training-manual template — the single source of truth for the
// STRUCTURE, PEDAGOGY, and OUTPUT SHAPE that every generated manual is poured
// into.
//
// This is the "essence" of the REFRESH manual (see Template/ REFRESH PDF):
// the layout skeleton, the KNOW/DO/BECOME learning model, the Experience →
// Reflect → Truth → Apply → Demonstrate session rhythm, and the activity-card
// format — with the biblical/discipleship CONTENT stripped out so the same
// shell works for any training topic.
//
// The visual palette that pairs with this structure (for a future styled
// export) is recorded in TEMPLATE_DESIGN below. Only the STRUCTURE feeds the
// generator today.

(function (root) {
  'use strict';

  // ── Visual design tokens (sampled from the REFRESH PDF) ──────────────────
  // Not used by the generator yet — kept here so the look can be applied later
  // to the styled/PDF export without re-deriving it from the source document.
  const TEMPLATE_DESIGN = {
    page:  { format: 'letter', font: 'Helvetica, Arial, sans-serif' },
    type:  { title: 22, sectionHeader: 14, body: 10, small: 9 },
    color: {
      band:     '#A6A096',  // taupe title / session bands
      bar:      '#000000',  // black section bars & tags
      text:     '#000000',
      subtitle: '#555555',
      accent:   '#1F3864',  // navy
      know:     '#D6E4F0',  // Learning Outcomes — KNOW (Head), blue
      do:       '#C4D4BE',  // Learning Outcomes — DO (Hands), green
      become:   '#F4E5C8'   // Learning Outcomes — BECOME (Heart), tan
    },
    // Full token set mirroring docs/design.md, in the units the jsPDF
    // renderer consumes directly (mm for spacing, pt for font sizes).
    // This is the single source of truth for the PDF export's look —
    // the renderer must read from here, never hardcode colours/sizes.
    colors: {
      primary:          '#A6A096',
      onPrimary:        '#FFFFFF',
      surface:          '#FFFFFF',
      surfaceSubtle:    '#FAF8F3',
      onSurface:        '#000000',
      onSurfaceMuted:   '#555555',
      bar:              '#000000',
      onBar:            '#FFFFFF',
      accent:           '#1F3864',
      accentMuted:      '#9EA5B0',
      know:             '#D6E4F0',
      do:               '#C4D4BE',
      become:           '#F4E5C8',
      highlight:        '#DBCCA6',
      border:           '#EAEAEA'
    },
    typography: {
      display:       { size: 34, weight: 'bold',   tracking: 0 },
      displaySub:    { size: 20, weight: 'bold',   tracking: 0 },
      sessionTitle:  { size: 17, weight: 'bold',   tracking: 0 },
      sectionHeader: { size: 12, weight: 'bold',   tracking: 0.04 },
      calloutHeader: { size: 10, weight: 'bold',   tracking: 0.06 },
      label:         { size: 10, weight: 'bold',   tracking: 0 },
      body:          { size: 10, weight: 'normal', tracking: 0 },
      caption:       { size: 9,  weight: 'normal', tracking: 0 },
      eyebrow:       { size: 9,  weight: 'bold',   tracking: 0.15 }
    },
    rounded:  { none: 0, sm: 0.7 },
    spacing:  { xs: 1.4, sm: 2.8, md: 4.2, lg: 5.6, xl: 8.5, '2xl': 11.3, page: 18 }
  };

  // ── Structural + pedagogical spec fed to the model ───────────────────────
  // Describes the skeleton every manual must follow and the exact markdown
  // shape to emit (so the app's title extraction, manual detection, and PDF
  // export all parse it cleanly).
  const REFRESH_TEMPLATE_SPEC = `TRAINING-MANUAL TEMPLATE ("REFRESH" style)

Every training manual you produce follows this fixed skeleton and teaching
philosophy, whatever the topic. The topic supplies the content; this template
supplies the shape. Never drop, rename, or reorder these sections.

PEDAGOGY (applies throughout — bake it into the content, don't just describe it):
- NOT lecture-based. HIGHLY participatory, STORY-driven, EXPERIENTIAL.
- Built for oral learners / mixed literacy / cross-cultural contexts.
- Every session follows the rhythm: Experience -> Reflect -> Truth -> Apply -> Demonstrate.
- Keep teaching SHORT and repeatable. Simple and true beats polished and complicated.
- The goal is REPRODUCIBILITY: a participant who learns it can teach it.

OUTPUT SHAPE — emit clean markdown in exactly this order:

# <MANUAL TITLE>
*<one-line tagline>*
<N> SESSIONS  ·  PARTICIPATORY | STORY-DRIVEN | REPRODUCIBLE

## HOW THIS TRAINING WORKS
### Learning Philosophy
- (4-5 bullets naming the approach: not lecture-based, participatory, story-driven, experiential, and the Experience -> Reflect -> Truth -> Apply -> Demonstrate pattern)
### Oral Learning Principles
- (5-6 bullets: use stories, use repetition, use group discussion, use physical movement, use simple language, break into small chunks)

Then, for EACH session:

## SESSION <n> — <Session Name>
*<Session theme / subtitle>*

### TRAINING OVERVIEW
- **Training Title:** <the overall training name>
- **Theme:** <this session's theme>
- **Audience:** <who this is for>

### PURPOSE — Why This Session Exists
<2-3 sentences on why the session exists and what it lays a foundation for>

### LEARNING OUTCOMES
**KNOW (Head)**
- (what participants will understand — cognitive)
**DO (Hands)**
- (what participants will practise / act out — behavioural)
**BECOME (Heart)**
- (who participants become / how identity shifts — transformational)

### TRANSFORMATION GOAL
<2-3 sentences on the inner change this session aims for>

### SESSION FRAMEWORK
Number the stages and keep this progression (adapt wording to the topic, keep the arc):
1. **Welcome & Connection** — relational entry; open with a question that draws people in
2. **Engage — Experience First** — an activity or open discussion; do NOT explain yet, let them explore
3. **Reflect — Draw Out Discovery** — What did you see? What happened? How did it feel? Let them interpret first
4. **Reveal Truth — Short Teaching** — the key truth, kept short; anchor with a concrete bridge/analogy
5. **Demonstrate — Model It** — show it with an object lesson or example
6. **Practice — Participatory** — participants try it themselves (roleplay, exercise)
7. **Share & Multiply** — groups present; others give feedback; builds ownership
8. **Teaching Point** — name why the activity worked and the truth it carries
9. **Application — Personal & Contextual** — "How will you use this?"; make it personal
10. **Activation / Response** — a moment of decision or response
11. **Recap — Oral Retention** — repeat the one key idea together; use rhythm and repetition
Under each stage, add 1-4 bullets of concrete facilitator guidance, questions to ask, or scripture/reference where relevant.

### ACTIVITY DESIGN
For each hands-on activity in the session, output a card:
**Activity: <Activity Name>**
- **Goal:** <what it helps participants understand>
- **Type:** <Object lesson | Roleplay / skit | Physical / experiential | Discussion>
- **Materials:** <what's needed, or "None">
- **Instructions:**
  1. <step>
  2. <step>
- **Facilitator Notes:** <how to guide it well; what to be careful of>
- **Teaching Point:** <the one truth the activity anchors>

FINAL SESSION ONLY — after its Recap, add:
### FINAL ACTIVATION — Real-Life Application Plan
Each participant answers:
- **WHO** will I train/disciple using what I have learned?
- **WHEN and WHERE** will I start?
- **WHAT** is one activity or truth I will use first?
- **HOW** will I keep accountability?

RULES:
- Use "-" for bullets and keep section HEADINGS exactly as written above (## and ###).
- Fill every section with real, topic-specific content — never leave a placeholder.
- Default to 8 sessions unless the user asks for a different number.`;

  // Assembles the full system prompt used for a generation turn: the Project 54
  // assistant framing plus the REFRESH template. Every manual runs through this,
  // which is what makes the template "copied over" into all of them.
  function buildManualSystemPrompt() {
    return `You are a helpful assistant for Project 54, an organisation operating across Africa.

You can have normal conversations AND create professional training manuals.

CONVERSATION RULES:
- For greetings, small talk, or general questions: respond naturally and helpfully. Keep it short and friendly.
- For requests to create a training manual, or when the user provides notes/topics/documents: produce a full training manual using the template below.
- For follow-up messages after creating a manual: refine or adjust it as requested, keeping the same template structure.

When creating a manual, follow this template exactly:

${REFRESH_TEMPLATE_SPEC}

Tone: professional but warm and approachable.`;
  }

  // ── parseManual: pure "understand the manual text" seam ──────────────────
  // Reads the markdown a manual is stored as (see OUTPUT SHAPE above) and
  // returns a structured ManualDoc. No jsPDF, DOM, or globals — safe to run
  // in Node for unit tests. Sections this ticket doesn't parse yet fall back
  // to the raw markdown so the renderer can still show them as plain text.
  function parseManual(markdown) {
    const text  = typeof markdown === 'string' ? markdown : '';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const titleLine = lines.find(l => /^#\s+/.test(l));
    const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : (lines[0] || 'Training Manual');

    const taglineLine = lines.find(l => /^\*[^*]+\*$/.test(l));
    const tagline = taglineLine ? taglineLine.replace(/^\*|\*$/g, '').trim() : null;

    const sessionLine = lines.find(l => /^\d+\s+SESSIONS\b/i.test(l));
    let sessionCount = null;
    let descriptors  = [];
    if (sessionLine) {
      sessionCount = parseInt(sessionLine.match(/^(\d+)\s+SESSIONS\b/i)[1], 10);
      const afterDot = sessionLine.split('·')[1];
      if (afterDot) {
        descriptors = afterDot.split('|').map(d => d.trim()).filter(Boolean);
      }
    }

    const sessions = parseSessions(text);

    return {
      cover: { title, tagline, sessionCount, descriptors },
      sessions,
      raw: text
    };
  }

  // Splits the manual on "## SESSION N — Name" headings and pulls each
  // session's theme, Training Overview rows, and Purpose body out of its
  // slice of the source markdown. Missing parts parse to empty/null rather
  // than throwing, so an incomplete or hand-edited manual still renders.
  function parseSessions(text) {
    const headingRe = /^##\s+SESSION\s+\d+\s*[—\-]\s*(.+)$/gim;
    const matches = [...text.matchAll(headingRe)];

    return matches.map((match, i) => {
      const name = match[1].trim();
      const start = match.index + match[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const body = text.slice(start, end);

      return {
        name,
        theme: extractTheme(body),
        overview: extractOverview(body),
        purpose: extractPurpose(body),
        // Whatever this ticket doesn't structure yet (framework, activities,
        // final activation) so the renderer can still show it as plain text.
        remainder: stripStructuredParts(body)
      };
    });
  }

  function stripStructuredParts(body) {
    return body
      .replace(/^\*[^*]+\*$/m, '')
      .replace(/###\s+TRAINING OVERVIEW[\s\S]*?(?=\n###|$)/i, '')
      .replace(/###\s+PURPOSE[^\n]*\n[\s\S]*?(?=\n###|$)/i, '')
      .trim();
  }

  function extractTheme(body) {
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    const taglineLine = lines.find(l => /^\*[^*]+\*$/.test(l));
    return taglineLine ? taglineLine.replace(/^\*|\*$/g, '').trim() : null;
  }

  function extractOverviewField(body, label) {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, 'i');
    const match = body.match(re);
    return match ? match[1].trim() : null;
  }

  function extractOverview(body) {
    const sectionMatch = body.match(/###\s+TRAINING OVERVIEW([\s\S]*?)(?=\n###|$)/i);
    const section = sectionMatch ? sectionMatch[1] : '';
    return {
      title:    extractOverviewField(section, 'Training Title'),
      theme:    extractOverviewField(section, 'Theme'),
      audience: extractOverviewField(section, 'Audience')
    };
  }

  function extractPurpose(body) {
    const sectionMatch = body.match(/###\s+PURPOSE[^\n]*\n([\s\S]*?)(?=\n###|$)/i);
    if (!sectionMatch) return null;
    const purpose = sectionMatch[1].trim();
    return purpose || null;
  }

  root.REFRESH_TEMPLATE_SPEC   = REFRESH_TEMPLATE_SPEC;
  root.TEMPLATE_DESIGN         = TEMPLATE_DESIGN;
  root.buildManualSystemPrompt = buildManualSystemPrompt;
  root.parseManual             = parseManual;
})(typeof window !== 'undefined' ? window : (typeof module !== 'undefined' ? (module.exports = {}) : this));
