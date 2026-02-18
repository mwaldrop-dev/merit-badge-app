'use strict';

const cheerio = require('cheerio');

// ── Badge name ────────────────────────────────────────────────────────────────

function extractBadgeName($) {
  // "<title>Chess Merit Badge | Scouting America</title>"
  const titleText = $('title').text().trim();
  const titleMatch = titleText.match(/^(.+?)\s+Merit Badge/i);
  if (titleMatch) return titleMatch[1].trim();

  // Fallback: first h2 containing "Merit Badge"
  let name = '';
  $('h2').each((_, el) => {
    const t = $(el).text();
    const m = t.match(/^(.+?)\s+Merit Badge/i);
    if (m) { name = m[1].trim(); return false; }
  });
  return name || 'Merit Badge';
}

// ── Safe HTML extraction ──────────────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Walk a cheerio DOM node, returning a safe HTML string that preserves only
// <a href="https://..."> links. All other markup is stripped to plain text.
function nodeToSafeHtml($, el) {
  let result = '';
  $(el).contents().each((_, node) => {
    if (node.type === 'text') {
      result += escHtml(node.data);
    } else if (node.type === 'tag' && node.name === 'a') {
      const href = (node.attribs && node.attribs.href) || '';
      const linkText = escHtml($(node).text());
      if (/^https?:\/\//i.test(href)) {
        const safeHref = href.replace(/"/g, '%22');
        result += `<a href="${safeHref}" target="_blank" rel="noopener">${linkText}</a>`;
      } else {
        result += linkText;
      }
    } else if (node.type === 'tag') {
      result += nodeToSafeHtml($, node);
    }
  });
  return result;
}

// ── Requirements parsing ──────────────────────────────────────────────────────

function parseRequirements($) {
  const requirements = [];

  $('.mb-requirement-item').each((_, item) => {
    const parentEl = $(item).find('> .mb-requirement-parent').first();
    if (!parentEl.length) return;

    // Number: "1." → "1"
    const listnumText = parentEl.find('.mb-requirement-listnumber').text().trim();
    const id = listnumText.replace(/[.\s)]/g, '').trim();
    if (!id || !/^\d+$/.test(id)) return;

    // Requirement text (parent minus the number span), preserving links
    const parentClone = parentEl.clone();
    parentClone.find('.mb-requirement-listnumber').remove();
    const text = nodeToSafeHtml($, parentClone[0]).replace(/\s+/g, ' ').trim();

    // Sub-requirements: "(a) text…"
    const children = [];
    $(item)
      .find('> ul.mb-requirement-children-list > li.mb-requirement-child')
      .each((_, child) => {
        const raw = $(child).text().replace(/\s+/g, ' ').trim();
        // Matches "(a) ..." or "a. ..." or "a) ..."
        const subMatch = raw.match(/^\(([a-z])\)\s*/i)
                      || raw.match(/^([a-z])[.)]\s*/i);
        if (subMatch) {
          // Clone and strip the leading identifier from the first text node
          const childClone = $(child).clone();
          let stripped = false;
          childClone.contents().each((_, node) => {
            if (!stripped && node.type === 'text') {
              node.data = node.data.replace(/^\s*\(?[a-z]\)?[.)]\s*/i, '');
              stripped = true;
              return false;
            }
          });
          children.push({
            id:       `${id}${subMatch[1].toLowerCase()}`,
            text:     nodeToSafeHtml($, childClone[0]).replace(/\s+/g, ' ').trim(),
            type:     'item',
            children: [],
          });
        }
      });

    requirements.push({
      id,
      text,
      type:     children.length > 0 ? 'group' : 'item',
      children,
    });
  });

  return requirements;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a saved scouting.org merit badge page HTML into structured badge data.
 *
 * @param {string|Buffer} html
 * @returns {{ name, sourceUrl, pamphletUrl, requirements }}
 */
function parseBadgePage(html) {
  const $ = cheerio.load(html);

  const name = extractBadgeName($);

  // Canonical URL → the original scouting.org requirements page
  const sourceUrl = $('link[rel="canonical"]').attr('href') || '';

  // First filestore PDF link on the page = the pamphlet
  let pamphletUrl = '';
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('filestore.scouting.org') && href.toLowerCase().endsWith('.pdf')) {
      pamphletUrl = href;
      return false; // break
    }
  });

  const requirements = parseRequirements($);

  return { name, sourceUrl, pamphletUrl, requirements };
}

module.exports = { parseBadgePage };
