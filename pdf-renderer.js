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

  function setType(doc, tokens, styleKey, colorHex) {
    const style = tokens.typography[styleKey];
    doc.setFontSize(style.size);
    doc.setFont('helvetica', fontStyle(style.weight));
    doc.setTextColor(...hexToRgb(colorHex));
    return style;
  }

  // ── Cover page ─────────────────────────────────────────────────────────
  function drawCoverPage(doc, manualDoc, tokens) {
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = tokens.spacing.page;
    const cover  = manualDoc.cover;

    const bandH = pageH * 0.42;
    doc.setFillColor(...hexToRgb(tokens.colors.primary));
    doc.rect(0, 0, pageW, bandH, 'F');

    let y = bandH / 2;
    setType(doc, tokens, 'display', tokens.colors.onSurface);
    const titleLines = doc.splitTextToSize(cover.title || 'Training Manual', pageW - margin * 2);
    const titleBlockH = titleLines.length * (tokens.typography.display.size * 0.4);
    y -= titleBlockH / 2;
    for (const line of titleLines) {
      doc.text(line, pageW / 2, y, { align: 'center' });
      y += tokens.typography.display.size * 0.4;
    }

    if (cover.tagline) {
      y += tokens.spacing.md;
      setType(doc, tokens, 'displaySub', tokens.colors.onSurface);
      doc.setFont('helvetica', 'italic');
      doc.text(cover.tagline, pageW / 2, y, { align: 'center' });
    }

    let belowY = bandH + tokens.spacing['2xl'];
    if (cover.sessionCount || (cover.descriptors && cover.descriptors.length)) {
      const parts = [];
      if (cover.sessionCount) parts.push(`${cover.sessionCount} SESSIONS`);
      if (cover.descriptors && cover.descriptors.length) parts.push(cover.descriptors.join(' | '));
      setType(doc, tokens, 'eyebrow', tokens.colors.onSurfaceMuted);
      doc.text(parts.join('  ·  '), pageW / 2, belowY, { align: 'center' });
    }
  }

  // ── Plain-text fallback body (used for anything parseManual hasn't
  // structured yet, and for off-template input) ───────────────────────────
  function drawFallbackBody(doc, manualDoc, tokens) {
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = tokens.spacing.page;
    const textW  = pageW - margin * 2;
    let y = margin;

    doc.addPage();

    const lines = (manualDoc.raw || '').split('\n');
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
    drawCoverPage(doc, manualDoc, tokens);
    drawFallbackBody(doc, manualDoc, tokens);
    drawImages(doc, sessionImages, tokens);
    drawPageNumbers(doc, tokens);
  }

  root.renderManualPDF = renderManualPDF;
})(typeof window !== 'undefined' ? window : (typeof module !== 'undefined' ? (module.exports = {}) : this));
