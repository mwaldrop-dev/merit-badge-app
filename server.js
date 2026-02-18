'use strict';

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const slugify  = require('slugify');
const { parseBadgePage } = require('./src/html-parser');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BADGES_DIR = path.join(DATA_DIR, 'badges');

fs.mkdirSync(BADGES_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Multer — HTML upload in memory ───────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'text/html' ||
      file.originalname.toLowerCase().endsWith('.html') ||
      file.originalname.toLowerCase().endsWith('.htm');
    cb(ok ? null : new Error('Only HTML files are accepted.'), ok);
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

function uploadMiddleware(req, res, next) {
  upload.single('html')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// ── Path helper ───────────────────────────────────────────────────────────────

function badgePath(slug) { return path.join(BADGES_DIR, `${slug}.json`); }

// ── API routes ────────────────────────────────────────────────────────────────

// Allow cross-origin requests from the bookmarklet (running on scouting.org)
app.options('/api/badges/upload', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

/**
 * POST /api/badges/upload
 * Multipart form: html (file, required) — saved scouting.org merit badge page
 */
app.post('/api/badges/upload', uploadMiddleware, async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!req.file) {
    return res.status(400).json({ error: 'No HTML file received.' });
  }

  try {
    const html   = req.file.buffer.toString('utf8');
    const parsed = parseBadgePage(html);

    if (parsed.requirements.length === 0) {
      return res.status(400).json({
        error:
          'Could not find any requirements in this HTML file. ' +
          'Make sure you saved the full merit badge requirements page from scouting.org.',
      });
    }

    const slug  = slugify(parsed.name, { lower: true, strict: true });
    const badge = {
      name:        parsed.name,
      slug,
      source:      'html',
      sourceUrl:   parsed.sourceUrl,
      pamphletUrl: parsed.pamphletUrl,
      lastUpdated: new Date().toISOString(),
      requirements: parsed.requirements,
    };

    fs.writeFileSync(badgePath(slug), JSON.stringify(badge, null, 2));

    console.log(
      `[server] Saved "${badge.name}" — ${badge.requirements.length} requirements` +
      (badge.pamphletUrl ? ', pamphlet link found' : '')
    );
    res.json(badge);
  } catch (err) {
    console.error('[server] Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/badges
 * Returns summary list of all stored badges.
 */
app.get('/api/badges', (_req, res) => {
  try {
    const files  = fs.readdirSync(BADGES_DIR).filter((f) => f.endsWith('.json'));
    const badges = files.map((file) => {
      const data = JSON.parse(fs.readFileSync(path.join(BADGES_DIR, file), 'utf8'));
      return {
        name:             data.name,
        slug:             data.slug,
        lastUpdated:      data.lastUpdated,
        requirementCount: data.requirements.length,
        sourceUrl:        data.sourceUrl   || '',
        pamphletUrl:      data.pamphletUrl || '',
      };
    });
    badges.sort((a, b) => a.name.localeCompare(b.name));
    res.json(badges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/badges/:slug
 * Returns the full badge JSON.
 */
app.get('/api/badges/:slug', (req, res) => {
  const file = badgePath(req.params.slug);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Badge not found.' });
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/badges/:slug/pdf
 * Body: { savedData: { "scout-name": "…", "req-camping-1": "…", … } }
 * Returns a fillable PDF pre-populated with savedData values.
 */
app.post('/api/badges/:slug/pdf', express.json(), async (req, res) => {
  const file = badgePath(req.params.slug);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Badge not found.' });
  try {
    const badge      = JSON.parse(fs.readFileSync(file, 'utf8'));
    const savedData  = (req.body && req.body.savedData) || {};
    const { generateWorksheetPdf } = require('./src/pdf-generator');
    const pdfBytes   = await generateWorksheetPdf(badge, savedData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${badge.slug}-worksheet.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('[server] PDF error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/badges/:slug
 * Removes the requirements JSON.
 */
app.delete('/api/badges/:slug', (req, res) => {
  const file = badgePath(req.params.slug);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Badge not found.' });
  try {
    fs.unlinkSync(file);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Merit Badge Form Generator running at http://localhost:${PORT}`);
});
