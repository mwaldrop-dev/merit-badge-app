'use strict';

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// ── Layout constants ──────────────────────────────────────────────────────────

const PAGE_W       = 612;
const PAGE_H       = 792;
const MARGIN       = 50;
const CONTENT_W    = PAGE_W - MARGIN * 2;   // 512
const LINE_H       = 14;
const FONT_SIZE    = 10;
const LABEL_SIZE   = 7;
const ITEM_FIELD_H = 60;   // response textarea for leaf requirements
const GROUP_FIELD_H = 30;  // overall-notes textarea for group requirements
const CB_SIZE      = 10;   // checkbox square
const GAP          = 10;   // vertical gap between requirements
const CHILD_INDENT = 18;   // extra left indent for sub-requirements

const COLOR_GREEN  = rgb(0.10, 0.27, 0.18);
const COLOR_GRAY   = rgb(0.35, 0.35, 0.35);
const COLOR_LIGHT  = rgb(0.78, 0.75, 0.69);
const COLOR_FIELD  = rgb(0.97, 0.97, 0.95);
const COLOR_TEXT   = rgb(0.11, 0.11, 0.11);

// ── Text helpers ──────────────────────────────────────────────────────────────

// Strip HTML tags; convert <a href="…">text</a> → "text (url)"
function toPlainText(html) {
  return html
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ');
}

// Normalize to Latin-1 so StandardFonts don't choke
function normalize(text) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\xFF]/g, '?');
}

// Word-wrap a string to fit maxWidth using pdf-lib font metrics
function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      // If a single word is wider than maxWidth, push it anyway
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// ── PDF generation ────────────────────────────────────────────────────────────

async function generateWorksheetPdf(badge, savedData) {
  const doc      = await PDFDocument.create();
  const font     = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form     = doc.getForm();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y    = PAGE_H - MARGIN;

  // ── Helpers that close over mutable `page` and `y` ──────────────────────────

  function ensureSpace(needed) {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y    = PAGE_H - MARGIN;
    }
  }

  function drawText(text, x, yPos, options = {}) {
    page.drawText(normalize(String(text)), {
      x,
      y:     yPos,
      font:  options.bold ? fontBold : font,
      size:  options.size  || FONT_SIZE,
      color: options.color || COLOR_TEXT,
    });
  }

  // ── Title block ──────────────────────────────────────────────────────────────

  drawText(`${badge.name} Merit Badge`, MARGIN, y, { bold: true, size: 18, color: COLOR_GREEN });
  y -= 24;
  drawText('Merit Badge Worksheet', MARGIN, y, { size: 11, color: COLOR_GRAY });
  y -= 16;

  page.drawLine({
    start:     { x: MARGIN, y },
    end:       { x: PAGE_W - MARGIN, y },
    thickness: 1.5,
    color:     rgb(0.32, 0.72, 0.53),
  });
  y -= 14;

  // ── Scout info ───────────────────────────────────────────────────────────────

  drawText('SCOUT INFORMATION', MARGIN, y, { bold: true, size: LABEL_SIZE, color: COLOR_GRAY });
  y -= 12;

  const infoFields = [
    { id: 'scout-name',      label: 'Scout Name',       x: MARGIN,       width: 240 },
    { id: 'troop-number',    label: 'Troop Number',      x: MARGIN + 260, width: 110 },
    { id: 'counselor-name',  label: 'Counselor Name',   x: MARGIN,       width: 240 },
    { id: 'form-date',       label: 'Date',              x: MARGIN + 260, width: 110 },
  ];

  const FIELD_ROW_H = 30;
  // Row 1
  for (const f of infoFields.slice(0, 2)) {
    drawText(f.label, f.x, y, { size: LABEL_SIZE, color: COLOR_GRAY });
    const tf = form.createTextField(`info_${f.id}`);
    tf.setText(savedData[f.id] || '');
    tf.addToPage(page, {
      x: f.x, y: y - FIELD_ROW_H + 10,
      width: f.width, height: 18,
      borderColor: COLOR_LIGHT,
      backgroundColor: COLOR_FIELD,
    });
  }
  y -= FIELD_ROW_H;

  // Row 2
  for (const f of infoFields.slice(2, 4)) {
    drawText(f.label, f.x, y, { size: LABEL_SIZE, color: COLOR_GRAY });
    const tf = form.createTextField(`info_${f.id}`);
    tf.setText(savedData[f.id] || '');
    tf.addToPage(page, {
      x: f.x, y: y - FIELD_ROW_H + 10,
      width: f.width, height: 18,
      borderColor: COLOR_LIGHT,
      backgroundColor: COLOR_FIELD,
    });
  }
  y -= FIELD_ROW_H + 6;

  // Separator
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5, color: COLOR_LIGHT,
  });
  y -= 14;

  // ── Requirements ─────────────────────────────────────────────────────────────

  const slug = badge.slug;

  function renderReq(req, indent) {
    const isGroup  = req.children && req.children.length > 0;
    const textX    = MARGIN + indent + CB_SIZE + 4;
    const textW    = CONTENT_W - indent - CB_SIZE - 4;
    const fieldH   = isGroup ? GROUP_FIELD_H : ITEM_FIELD_H;

    const plainText = normalize(toPlainText(req.text));
    const label     = `${req.id}.  ${plainText}`;
    const lines     = wrapText(label, font, FONT_SIZE, textW);
    const textH     = lines.length * LINE_H;

    // Estimate space needed for header text + (field or first child)
    const minNeeded = textH + CB_SIZE + (isGroup ? LINE_H * 2 : fieldH) + GAP;
    ensureSpace(minNeeded);

    // Checkbox
    const cbKey  = `done-${slug}-${req.id}`;
    const cbName = `done_${req.id.replace(/[^a-z0-9]/gi, '_')}`;
    const cb     = form.createCheckBox(cbName);
    cb.addToPage(page, {
      x: MARGIN + indent,
      y: y - CB_SIZE,
      width:  CB_SIZE,
      height: CB_SIZE,
      borderColor:     COLOR_LIGHT,
      backgroundColor: rgb(1, 1, 1),
    });
    if (savedData[cbKey] === 'true') cb.check();

    // Requirement text
    for (const line of lines) {
      drawText(line, textX, y);
      y -= LINE_H;
    }
    y -= 4;

    // Children (indented)
    if (isGroup) {
      for (const child of req.children) {
        renderReq(child, indent + CHILD_INDENT);
      }
    }

    // Response / notes label
    const fieldLabel = isGroup ? 'Overall Notes (optional)' : 'Response / Notes';
    ensureSpace(10 + fieldH + GAP);
    drawText(fieldLabel, textX, y, { size: LABEL_SIZE, color: COLOR_GRAY });
    y -= 10;

    // Response text field
    const tfKey  = `req-${slug}-${req.id}`;
    const tfName = `response_${req.id.replace(/[^a-z0-9]/gi, '_')}`;
    const tf     = form.createTextField(tfName);
    tf.setText(savedData[tfKey] || '');
    tf.enableMultiline();
    tf.addToPage(page, {
      x: textX,
      y: y - fieldH,
      width:  textW,
      height: fieldH,
      borderColor:     COLOR_LIGHT,
      backgroundColor: COLOR_FIELD,
    });
    y -= fieldH + GAP;
  }

  for (const req of badge.requirements) {
    renderReq(req, 0);
  }

  return doc.save();
}

module.exports = { generateWorksheetPdf };
