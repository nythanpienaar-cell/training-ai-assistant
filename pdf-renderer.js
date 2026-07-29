// Draws a ManualDoc (see template.js parseManual) into a jsPDF document,
// following the REFRESH visual system recorded in window.TEMPLATE_DESIGN
// (mirrors docs/design.md). This module only draws — all "what does the
// manual text mean" work happens in parseManual, so the two can evolve and
// be verified independently (parser by unit test, renderer by eye).

(function (root) {
  'use strict';

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function fontStyle(weight) {
    return weight === 'bold' ? 'bold' : 'normal';
  }

  // jsPDF's built-in Helvetica uses WinAnsi encoding, which lacks arrows and a
  // few other glyphs a manual's text may contain (they otherwise render as
  // garbage with broken spacing). Map the common offenders to ASCII before any
  // measuring or drawing. Em dash (—) and middot (·) ARE in WinAnsi — left as is.
  function sanitize(s) {
    if (typeof s !== 'string') return s;
    return s
      .replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->')
      .replace(/[↑↓]/g, '|')
      .replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"')
      .replace(/…/g, '...')
      .replace(/[‐-–]/g, '-')             // hyphen/dash variants (— — kept)
      .replace(/[←-⇿]/g, '->')            // any other arrow
      .replace(/[∀-⏿①-➿]/g, '-'); // math / technical / dingbats
  }

  function setType(doc, tokens, styleKey, colorHex) {
    const style = tokens.typography[styleKey];
    doc.setFontSize(style.size);
    doc.setFont('helvetica', fontStyle(style.weight));
    doc.setTextColor(...hexToRgb(colorHex));
    return style;
  }

  // ── Cover page ─────────────────────────────────────────────────────────
  function drawCoverPage(doc, manualDoc, tokens) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const cover = manualDoc.cover;
    const black = hexToRgb(tokens.colors.bar);
    const taupe = hexToRgb(tokens.colors.primary);

    // Thin outer frame.
    const inset = 10;
    doc.setDrawColor(...black);
    doc.setLineWidth(0.5);
    doc.rect(inset, inset, pageW - inset * 2, pageH - inset * 2, 'S');

    // Left-offset taupe title band, with a black tagline sub-band under it.
    const bandW   = pageW * 0.80;
    const bandTop = pageH * 0.33;
    const bandH   = pageH * 0.18;
    const subH    = cover.tagline ? pageH * 0.06 : 0;
    const textX   = 24;

    doc.setFillColor(...taupe);
    doc.rect(0, bandTop, bandW, bandH, 'F');
    if (subH) {
      doc.setFillColor(...black);
      doc.rect(0, bandTop + bandH, bandW, subH, 'F');
    }

    // Title (wordmark) + "TRAINING MANUAL" eyebrow, black, left-aligned.
    setType(doc, tokens, 'display', tokens.colors.onSurface);
    const titleLines = doc.splitTextToSize(cover.title || 'Training Manual', bandW - textX - 8);
    const lineH = tokens.typography.display.size * 0.42;
    const blockH = titleLines.length * lineH + tokens.spacing.sm + tokens.typography.eyebrow.size * 0.5;
    let ty = bandTop + (bandH - blockH) / 2 + lineH * 0.8;
    for (const line of titleLines) {
      doc.text(line, textX, ty);
      ty += lineH;
    }
    setType(doc, tokens, 'eyebrow', tokens.colors.onSurface);
    doc.text('TRAINING MANUAL', textX, ty + tokens.spacing.xs);

    // Tagline: white italic on the black sub-band, shrunk to fit its width.
    if (cover.tagline) {
      const availW = bandW - textX - tokens.spacing.md;
      setType(doc, tokens, 'sessionTitle', tokens.colors.onBar);
      doc.setFont('helvetica', 'italic');
      let size = tokens.typography.sessionTitle.size;
      const tw = doc.getTextWidth(cover.tagline);
      if (tw > availW) { size = Math.max(9, size * availW / tw); doc.setFontSize(size); }
      doc.text(cover.tagline, textX, bandTop + bandH + subH / 2 + size * 0.18);
    }

    // Bottom: N SESSIONS (underlined) + descriptor row, centred.
    let by = pageH * 0.85;
    if (cover.sessionCount) {
      setType(doc, tokens, 'eyebrow', tokens.colors.onSurface);
      const sess = `${cover.sessionCount} SESSIONS`;
      doc.text(sess, pageW / 2, by, { align: 'center' });
      const w = doc.getTextWidth(sess);
      doc.setDrawColor(...black);
      doc.setLineWidth(0.4);
      doc.line(pageW / 2 - w / 2, by + 1.6, pageW / 2 + w / 2, by + 1.6);
      by += tokens.spacing.lg;
    }
    if (cover.descriptors && cover.descriptors.length) {
      setType(doc, tokens, 'eyebrow', tokens.colors.onSurface);
      doc.text(cover.descriptors.join('  |  '), pageW / 2, by, { align: 'center' });
    }
  }

  // ── Front matter: "How This Training Works" (Learning Philosophy + Oral
  // Learning Principles), drawn near the front, right after the cover ──────
  function drawBulletList(doc, tokens, heading, bullets, y, pageW, pageH, margin) {
    if (!bullets || !bullets.length) return y;

    setType(doc, tokens, 'sectionHeader', tokens.colors.onSurface);
    if (y + tokens.spacing.lg > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(heading, margin, y);
    y += tokens.spacing.lg;

    setType(doc, tokens, 'body', tokens.colors.onSurface);
    const textW = pageW - margin * 2 - tokens.spacing.md;
    for (const bullet of bullets) {
      const wrapped = doc.splitTextToSize(`• ${bullet}`, textW);
      for (const line of wrapped) {
        if (y + tokens.typography.body.size * 0.45 > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin + tokens.spacing.md, y);
        y += tokens.typography.body.size * 0.45;
      }
    }
    return y + tokens.spacing.lg;
  }

  function drawHowItWorks(doc, howItWorks, tokens) {
    if (!howItWorks) return;
    const hasAny = (howItWorks.learningPhilosophy && howItWorks.learningPhilosophy.length) ||
      (howItWorks.oralLearningPrinciples && howItWorks.oralLearningPrinciples.length);
    if (!hasAny) return;

    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = tokens.spacing.page;

    doc.addPage();
    let y = margin;

    setType(doc, tokens, 'displaySub', tokens.colors.onSurface);
    doc.text('HOW THIS TRAINING WORKS', margin, y);
    y += tokens.spacing.xl;

    y = drawBulletList(doc, tokens, 'Learning Philosophy', howItWorks.learningPhilosophy, y, pageW, pageH, margin);
    y = drawBulletList(doc, tokens, 'Oral Learning Principles', howItWorks.oralLearningPrinciples, y, pageW, pageH, margin);
  }

  // ── Final Activation: Real-Life Application Plan (WHO/WHEN&WHERE/WHAT/HOW) ─
  function measureApplicationPlanHeight(doc, tokens, textW, plan) {
    let h = tokens.spacing.md * 2 + tokens.typography.sectionHeader.size * 0.45;
    for (const item of plan) {
      setType(doc, tokens, 'body', tokens.colors.onSurface);
      const wrapped = doc.splitTextToSize(`${item.label}: ${item.text}`, textW - tokens.spacing.md * 2);
      h += wrapped.length * (tokens.typography.body.size * 0.45);
    }
    return h;
  }

  function drawApplicationPlan(doc, plan, tokens, y, pageW, pageH, margin) {
    if (!plan || !plan.length) return y;
    const textW = pageW - margin * 2;
    const boxH = measureApplicationPlanHeight(doc, tokens, textW, plan);

    if (y + boxH > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    setType(doc, tokens, 'sectionHeader', tokens.colors.onSurface);
    doc.text('FINAL ACTIVATION — REAL-LIFE APPLICATION PLAN', margin, y);
    y += tokens.spacing.lg;

    for (const item of plan) {
      setType(doc, tokens, 'label', tokens.colors.onSurface);
      const labelText = `${item.label}: `;
      doc.text(labelText, margin, y);
      const labelW = doc.getTextWidth(labelText);

      setType(doc, tokens, 'body', tokens.colors.onSurface);
      const wrapped = doc.splitTextToSize(item.text, textW - labelW);
      wrapped.forEach((line, i) => {
        doc.text(line, margin + (i === 0 ? labelW : 0), y);
        y += tokens.typography.body.size * 0.45;
      });
    }
    return y + tokens.spacing.md;
  }

  // ── Session opening: section-tag, session-band, theme, overview, purpose ──
  function drawSessionHeader(doc, session, index, tokens, y, pageW, margin) {
    const tagH = tokens.typography.eyebrow.size * 0.5 + tokens.spacing.sm * 2;
    doc.setFillColor(...hexToRgb(tokens.colors.bar));
    doc.rect(margin, y, pageW - margin * 2, tagH, 'F');
    setType(doc, tokens, 'eyebrow', tokens.colors.onBar);
    doc.text(`SESSION ${index + 1}`, margin + tokens.spacing.sm, y + tagH / 2 + tokens.typography.eyebrow.size * 0.18, { align: 'left' });
    y += tagH;

    const bandH = tokens.typography.sessionTitle.size * 0.5 + tokens.spacing.md * 2;
    doc.setFillColor(...hexToRgb(tokens.colors.primary));
    doc.rect(margin, y, pageW - margin * 2, bandH, 'F');
    setType(doc, tokens, 'sessionTitle', tokens.colors.onPrimary);
    doc.text(session.name || '', margin + tokens.spacing.sm, y + bandH / 2 + tokens.typography.sessionTitle.size * 0.18, { align: 'left' });
    y += bandH + tokens.spacing.sm;

    if (session.theme) {
      setType(doc, tokens, 'caption', tokens.colors.onSurfaceMuted);
      doc.text(session.theme, margin, y);
      y += tokens.spacing.lg;
    } else {
      y += tokens.spacing.sm;
    }

    return y;
  }

  function drawOverview(doc, overview, tokens, y, margin) {
    if (!overview) return y;
    const rows = [
      ['Training Title:', overview.title],
      ['Theme:', overview.theme],
      ['Audience:', overview.audience]
    ].filter(([, value]) => value);
    if (!rows.length) return y;

    // Place the value column past the widest label so they never overlap.
    setType(doc, tokens, 'label', tokens.colors.onSurface);
    let labelColW = 0;
    for (const [label] of rows) labelColW = Math.max(labelColW, doc.getTextWidth(label));
    labelColW += tokens.spacing.md;

    y += tokens.spacing.sm;
    for (const [label, value] of rows) {
      setType(doc, tokens, 'label', tokens.colors.onSurface);
      doc.text(label, margin, y);
      setType(doc, tokens, 'body', tokens.colors.onSurface);
      doc.text(value, margin + labelColW, y);
      y += tokens.spacing.lg;
    }
    return y + tokens.spacing.sm;
  }

  function drawPurpose(doc, purpose, tokens, y, pageW, margin) {
    if (!purpose) return y;
    const textW = pageW - margin * 2;

    const barH = tokens.typography.calloutHeader.size * 0.5 + tokens.spacing.sm * 2;
    doc.setFillColor(...hexToRgb(tokens.colors.bar));
    doc.rect(margin, y, textW, barH, 'F');
    setType(doc, tokens, 'calloutHeader', tokens.colors.onBar);
    doc.text('PURPOSE — WHY THIS SESSION EXISTS', margin + tokens.spacing.sm, y + barH / 2 + tokens.typography.calloutHeader.size * 0.18);
    y += barH;

    setType(doc, tokens, 'body', tokens.colors.onSurface);
    const wrapped = doc.splitTextToSize(purpose, textW - tokens.spacing.md * 2);
    const boxH = wrapped.length * (tokens.typography.body.size * 0.45) + tokens.spacing.md * 2;
    doc.setFillColor(...hexToRgb(tokens.colors.surface));
    doc.rect(margin, y, textW, boxH, 'F');
    let textY = y + tokens.spacing.md + tokens.typography.body.size * 0.35;
    for (const line of wrapped) {
      doc.text(line, margin + tokens.spacing.md, textY);
      textY += tokens.typography.body.size * 0.45;
    }
    return y + boxH + tokens.spacing.lg;
  }

  // ── Learning Outcomes triad (KNOW / DO / BECOME) ──────────────────────────
  function measureOutcomeBlockHeight(doc, tokens, colWidth, label, bullets) {
    setType(doc, tokens, 'label', tokens.colors.onSurface);
    let h = tokens.spacing.md * 2 + tokens.typography.label.size * 0.45;
    setType(doc, tokens, 'body', tokens.colors.onSurface);
    const innerW = colWidth - tokens.spacing.md * 2 - tokens.spacing.sm;
    for (const bullet of bullets) {
      const wrapped = doc.splitTextToSize(bullet, innerW);
      h += wrapped.length * (tokens.typography.body.size * 0.45);
    }
    return h;
  }

  function drawOutcomeBlock(doc, tokens, x, y, w, h, bgHex, label, bullets) {
    doc.setFillColor(...hexToRgb(bgHex));
    doc.rect(x, y, w, h, 'F');

    let textY = y + tokens.spacing.md + tokens.typography.label.size * 0.35;
    setType(doc, tokens, 'label', tokens.colors.onSurface);
    doc.text(label, x + tokens.spacing.md, textY);
    textY += tokens.typography.label.size * 0.45;

    setType(doc, tokens, 'body', tokens.colors.onSurface);
    const innerW = w - tokens.spacing.md * 2 - tokens.spacing.sm;
    for (const bullet of bullets) {
      const wrapped = doc.splitTextToSize(`• ${bullet}`, innerW);
      for (const line of wrapped) {
        doc.text(line, x + tokens.spacing.md, textY);
        textY += tokens.typography.body.size * 0.45;
      }
    }
  }

  // Renders KNOW/DO/BECOME as three equal side-by-side blocks, drawn as a
  // single unit so the triad never splits across a page break.
  function drawOutcomes(doc, outcomes, tokens, y, pageW, pageH, margin) {
    if (!outcomes) return y;
    const hasAny = (outcomes.know && outcomes.know.length) ||
      (outcomes.do && outcomes.do.length) ||
      (outcomes.become && outcomes.become.length);
    if (!hasAny) return y;

    const gap = tokens.spacing.sm;
    const colW = (pageW - margin * 2 - gap * 2) / 3;

    const blockH = Math.max(
      measureOutcomeBlockHeight(doc, tokens, colW, 'KNOW (Head)', outcomes.know || []),
      measureOutcomeBlockHeight(doc, tokens, colW, 'DO (Hands)', outcomes.do || []),
      measureOutcomeBlockHeight(doc, tokens, colW, 'BECOME (Heart)', outcomes.become || [])
    );

    if (y + blockH > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    drawOutcomeBlock(doc, tokens, margin, y, colW, blockH, tokens.colors.know, 'KNOW (Head)', outcomes.know || []);
    drawOutcomeBlock(doc, tokens, margin + colW + gap, y, colW, blockH, tokens.colors.do, 'DO (Hands)', outcomes.do || []);
    drawOutcomeBlock(doc, tokens, margin + (colW + gap) * 2, y, colW, blockH, tokens.colors.become, 'BECOME (Heart)', outcomes.become || []);

    return y + blockH + tokens.spacing.lg;
  }

  // ── Transformation Goal (gold-bordered goal-callout) ──────────────────────
  function drawTransformationGoal(doc, goal, tokens, y, pageW, pageH, margin) {
    if (!goal) return y;
    const textW = pageW - margin * 2;

    setType(doc, tokens, 'body', tokens.colors.onSurface);
    const wrapped = doc.splitTextToSize(goal, textW - tokens.spacing.md * 2);
    const boxH = wrapped.length * (tokens.typography.body.size * 0.45) + tokens.spacing.md * 2;

    if (y + boxH > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(...hexToRgb(tokens.colors.surface));
    doc.setDrawColor(...hexToRgb(tokens.colors.highlight));
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, textW, boxH, tokens.rounded.sm, tokens.rounded.sm, 'FD');

    let textY = y + tokens.spacing.md + tokens.typography.body.size * 0.35;
    setType(doc, tokens, 'body', tokens.colors.onSurface);
    for (const line of wrapped) {
      doc.text(line, margin + tokens.spacing.md, textY);
      textY += tokens.typography.body.size * 0.45;
    }
    return y + boxH + tokens.spacing.lg;
  }

  // ── Session Framework (numbered steps, black number square) ──────────────
  function measureFrameworkStepHeight(doc, tokens, textW, step) {
    const pad = tokens.spacing.md;
    setType(doc, tokens, 'sectionHeader', tokens.colors.onSurface);
    const titleLines = doc.splitTextToSize(step.title || '', textW);
    let contentH = titleLines.length * (tokens.typography.sectionHeader.size * 0.45);
    setType(doc, tokens, 'body', tokens.colors.onSurface);
    for (const bullet of step.bullets || []) {
      const wrapped = doc.splitTextToSize(`• ${bullet}`, textW);
      contentH += wrapped.length * (tokens.typography.body.size * 0.45);
    }
    // Full box height (content + padding), never shorter than the number column.
    return Math.max(contentH + pad * 2, tokens.spacing['2xl']);
  }

  function drawFrameworkStep(doc, tokens, step, y, pageW, margin) {
    const pad   = tokens.spacing.md;
    const numW  = tokens.spacing['2xl'];               // full-height black column
    const boxW  = pageW - margin * 2;
    const textX = margin + numW + pad;
    const textW = boxW - numW - pad * 2;
    const boxH  = measureFrameworkStepHeight(doc, tokens, textW, step);

    // Hairline box around the whole step, then the full-height black number
    // column flush to its left edge (matches the REFRESH template).
    doc.setDrawColor(...hexToRgb(tokens.colors.border));
    doc.setLineWidth(0.3);
    doc.rect(margin, y, boxW, boxH, 'S');
    doc.setFillColor(...hexToRgb(tokens.colors.bar));
    doc.rect(margin, y, numW, boxH, 'F');
    setType(doc, tokens, 'sessionTitle', tokens.colors.onBar);
    doc.text(String(step.n), margin + numW / 2, y + boxH / 2 + tokens.typography.sessionTitle.size * 0.18, { align: 'center' });

    // Title + bullets inside the box, to the right of the number column.
    let textY = y + pad + tokens.typography.sectionHeader.size * 0.35;
    setType(doc, tokens, 'sectionHeader', tokens.colors.onSurface);
    for (const line of doc.splitTextToSize(step.title || '', textW)) {
      doc.text(line, textX, textY);
      textY += tokens.typography.sectionHeader.size * 0.45;
    }
    setType(doc, tokens, 'body', tokens.colors.onSurface);
    for (const bullet of step.bullets || []) {
      for (const line of doc.splitTextToSize(`• ${bullet}`, textW)) {
        doc.text(line, textX, textY);
        textY += tokens.typography.body.size * 0.45;
      }
    }

    return y + boxH + tokens.spacing.md;
  }

  function drawFramework(doc, framework, tokens, y, pageW, pageH, margin) {
    if (!framework || !framework.length) return y;

    setType(doc, tokens, 'sectionHeader', tokens.colors.onSurface);
    doc.text('SESSION FRAMEWORK', margin, y);
    y += tokens.spacing.lg;

    const textW = pageW - margin * 2 - tokens.spacing['2xl'] - tokens.spacing.md * 2;
    for (const step of framework) {
      const stepH = measureFrameworkStepHeight(doc, tokens, textW, step);
      if (y + stepH > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      y = drawFrameworkStep(doc, tokens, step, y, pageW, margin);
    }
    return y + tokens.spacing.sm;
  }

  // ── Activity cards (hairline-bordered, stacked rows) ─────────────────────
  function activityRows(activity) {
    return [
      ['Goal', activity.goal],
      ['Type', activity.type],
      ['Materials', activity.materials],
      ['Instructions', (activity.instructions || []).map((s, i) => `${i + 1}. ${s}`).join('\n')],
      ['Facilitator Notes', activity.facilitatorNotes],
      ['Teaching Point', activity.teachingPoint]
    ].filter(([, value]) => value);
  }

  function measureActivityCardHeight(doc, tokens, textW, activity) {
    const innerW = textW - tokens.spacing.md * 2;
    const lineH  = tokens.typography.body.size * 0.45;
    let h = tokens.spacing.md * 2 + tokens.typography.label.size * 0.45; // "Activity:" line
    for (const [label, value] of activityRows(activity)) {
      setType(doc, tokens, 'label', tokens.colors.onSurface);
      const labelW = doc.getTextWidth(`${label}: `);
      setType(doc, tokens, 'body', tokens.colors.onSurface);
      let first = true;
      for (const seg of String(value).split('\n')) {
        const wrapped = doc.splitTextToSize(seg, innerW - (first ? labelW : 0));
        h += wrapped.length * lineH;
        first = false;
      }
      h += tokens.spacing.xs;
    }
    return h;
  }

  function drawActivityCard(doc, tokens, activity, y, pageW, margin) {
    const textW  = pageW - margin * 2;
    const innerW = textW - tokens.spacing.md * 2;
    const lineH  = tokens.typography.body.size * 0.45;
    const cardH  = measureActivityCardHeight(doc, tokens, textW, activity);

    doc.setDrawColor(...hexToRgb(tokens.colors.border));
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, textW, cardH, tokens.rounded.sm, tokens.rounded.sm, 'S');

    const x = margin + tokens.spacing.md;
    let textY = y + tokens.spacing.md + tokens.typography.label.size * 0.35;
    setType(doc, tokens, 'label', tokens.colors.onSurface);
    doc.text(`Activity: ${activity.name || ''}`, x, textY);
    textY += tokens.typography.label.size * 0.45;

    // Each row draws its bold label and value on the SAME line (value wraps
    // beneath), so label and value never collide.
    for (const [label, value] of activityRows(activity)) {
      const labelText = `${label}: `;
      setType(doc, tokens, 'label', tokens.colors.onSurface);
      doc.text(labelText, x, textY);
      const labelW = doc.getTextWidth(labelText);
      setType(doc, tokens, 'body', tokens.colors.onSurface);
      let first = true;
      for (const seg of String(value).split('\n')) {
        const wrapped = doc.splitTextToSize(seg, innerW - (first ? labelW : 0));
        wrapped.forEach((line, i) => {
          doc.text(line, (first && i === 0) ? x + labelW : x, textY);
          textY += lineH;
        });
        first = false;
      }
      textY += tokens.spacing.xs;
    }

    return y + cardH + tokens.spacing.lg;
  }

  function drawActivities(doc, activities, tokens, y, pageW, pageH, margin) {
    if (!activities || !activities.length) return y;

    setType(doc, tokens, 'sectionHeader', tokens.colors.onSurface);
    doc.text('ACTIVITY DESIGN', margin, y);
    y += tokens.spacing.lg;

    const textW = pageW - margin * 2;
    for (const activity of activities) {
      const cardH = measureActivityCardHeight(doc, tokens, textW, activity);
      if (y + cardH > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      y = drawActivityCard(doc, tokens, activity, y, pageW, margin);
    }
    return y;
  }

  // Draws each parsed session's opening (section-tag, session-band, theme,
  // Training Overview, Purpose, Learning Outcomes, Transformation Goal,
  // Session Framework, Activity Design) on its own page.
  function drawSessions(doc, sessions, tokens) {
    if (!sessions || !sessions.length) return;
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = tokens.spacing.page;

    sessions.forEach((session, i) => {
      doc.addPage();
      let y = margin;
      y = drawSessionHeader(doc, session, i, tokens, y, pageW, margin);
      y = drawOverview(doc, session.overview, tokens, y, margin);
      y = drawPurpose(doc, session.purpose, tokens, y, pageW, margin);
      y = drawOutcomes(doc, session.outcomes, tokens, y, pageW, pageH, margin);
      y = drawTransformationGoal(doc, session.transformationGoal, tokens, y, pageW, pageH, margin);
      y = drawFramework(doc, session.framework, tokens, y, pageW, pageH, margin);
      y = drawActivities(doc, session.activities, tokens, y, pageW, pageH, margin);
      if (session.remainder) y = drawFallbackText(doc, session.remainder, tokens, y, false);
      drawApplicationPlan(doc, session.applicationPlan, tokens, y, pageW, pageH, margin);
    });
  }

  // ── Plain-text fallback rendering (used for anything parseManual hasn't
  // structured yet, and for off-template input) ───────────────────────────
  // `startY`/`newPage` let callers continue on an already-open page (e.g.
  // a session's remainder, after its structured header/overview/purpose)
  // instead of always starting fresh.
  function drawFallbackText(doc, text, tokens, startY, newPage) {
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = tokens.spacing.page;
    const textW  = pageW - margin * 2;
    let y = startY != null ? startY : margin;

    if (newPage) doc.addPage();

    const lines = (text || '').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { y += tokens.spacing.sm; continue; }

      const isTitle   = /^#/.test(line);
      const isSection = /^[0-9]+\.\s/.test(line) || /^[A-Z][A-Z\s\-:]{4,}$/.test(line);
      const isBullet  = /^[-•*]\s/.test(line);

      let styleKey = 'body';
      let lineH    = 5.5;
      let indent   = margin;

      if (isTitle)        { styleKey = 'sessionTitle';  lineH = 8; }
      else if (isSection) { styleKey = 'sectionHeader';  lineH = 6.5; }
      else if (isBullet)  { indent = margin + tokens.spacing.md; }

      setType(doc, tokens, styleKey, tokens.colors.onSurface);

      const cleanLine = line.replace(/^#+\s*/, '').replace(/^[-•*]\s/, isBullet ? '• ' : '');
      const wrapped   = doc.splitTextToSize(cleanLine, isBullet ? textW - tokens.spacing.md : textW);

      for (const wl of wrapped) {
        if (y + lineH > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(wl, indent, y);
        y += lineH;
      }

      if (isTitle || isSection) y += tokens.spacing.xs;
    }

    return y;
  }

  function drawImages(doc, sessionImages, tokens) {
    if (!sessionImages || !sessionImages.length) return;
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = tokens.spacing.page;
    const textW  = pageW - margin * 2;

    for (const img of sessionImages) {
      try {
        doc.addPage();
        let y = margin;
        setType(doc, tokens, 'label', tokens.colors.onSurface);
        doc.text(`Reference: ${img.name}`, margin, y);
        y += tokens.spacing.lg;
        doc.addImage(img.dataUrl, img.format || 'JPEG', margin, y, textW, Math.min(pageH - y - margin, textW * 0.65));
      } catch (e) {
        console.warn('Image embed error:', e);
      }
    }
  }

  function drawPageNumbers(doc, tokens) {
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const total  = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      setType(doc, tokens, 'caption', tokens.colors.onSurfaceMuted);
      doc.text(`Page ${i} of ${total}`, pageW / 2, pageH - tokens.spacing.md, { align: 'center' });
    }
  }

  // Draws the whole manual (cover + fallback body + images + page numbers)
  // into an already-constructed jsPDF `doc`. Never throws — falls back to
  // plain text for anything parseManual didn't structure.
  function renderManualPDF(doc, manualDoc, sessionImages, tokens) {
    tokens = tokens || root.TEMPLATE_DESIGN;

    // Sanitize every string that gets measured or drawn (see sanitize()), so a
    // glyph jsPDF can't encode never reaches the page or throws off wrapping.
    const _text = doc.text.bind(doc);
    doc.text = function (t, ...a) {
      return _text(Array.isArray(t) ? t.map(sanitize) : sanitize(t), ...a);
    };
    const _split = doc.splitTextToSize.bind(doc);
    doc.splitTextToSize = function (t, ...a) { return _split(sanitize(t), ...a); };

    const raw = manualDoc.raw || '';
    const sessions = manualDoc.sessions || [];

    drawCoverPage(doc, manualDoc, tokens);

    if (sessions.length) {
      const firstSessionMatch = raw.match(/^##\s+SESSION\s+\d+/im);
      let frontMatter = firstSessionMatch ? raw.slice(0, firstSessionMatch.index) : raw;
      // Drop the front matter AND the cover lines (title / tagline / descriptor
      // row) — those already appear on the cover, so left in they render as a
      // redundant plain-text page.
      frontMatter = frontMatter
        .replace(/##\s+HOW THIS TRAINING WORKS[\s\S]*?(?=\n##\s|$)/i, '')
        .replace(/^#\s+.*$/m, '')
        .replace(/^\s*\*[^*]+\*\s*$/m, '')
        .replace(/^.*\bSESSIONS\b.*$/im, '')
        .trim();

      drawHowItWorks(doc, manualDoc.howItWorks, tokens);
      if (frontMatter) drawFallbackText(doc, frontMatter, tokens, null, true);
      drawSessions(doc, sessions, tokens);
    } else {
      drawFallbackText(doc, raw, tokens, null, true);
    }

    drawImages(doc, sessionImages, tokens);
    drawPageNumbers(doc, tokens);
  }

  root.renderManualPDF = renderManualPDF;
})(typeof window !== 'undefined' ? window : (typeof module !== 'undefined' ? (module.exports = {}) : this));
