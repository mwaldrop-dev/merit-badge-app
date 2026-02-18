'use strict';

// ─── Eagle Scout required badges ─────────────────────────────────────────────
// All badges that can satisfy an Eagle requirement (includes alternatives).

const EAGLE_REQUIRED = new Set([
  'camping',
  'citizenship-in-the-community',
  'citizenship-in-the-nation',
  'citizenship-in-society',
  'citizenship-in-the-world',
  'communication',
  'cooking',
  'cycling',               // alt: Swimming / Hiking / Cycling
  'emergency-preparedness',// alt: Emergency Preparedness / Lifesaving
  'environmental-science', // alt: Environmental Science / Sustainability
  'family-life',
  'first-aid',
  'hiking',                // alt
  'lifesaving',            // alt
  'personal-fitness',
  'personal-management',
  'sustainability',        // alt
  'swimming',              // alt
]);

// ─── SVG icons ────────────────────────────────────────────────────────────────

const ICON_WORKSHEET = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>`;
const ICON_EXTERNAL  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const ICON_DOWNLOAD  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_TRASH     = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

// ─── Shared utilities ────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function showStatus(el, message, type = 'info') {
  el.textContent = message;
  el.className   = `status-message status-${type}`;
  el.hidden      = false;
}

// ─── Shared badge list ────────────────────────────────────────────────────────

function renderBadgeRow(b, showDelete) {
  const isEagle = EAGLE_REQUIRED.has(b.slug);
  return `
  <div class="badge-row${isEagle ? ' eagle-row' : ''}" data-slug="${b.slug}">
    <div class="badge-info">
      <span class="badge-name">
        ${b.sourceUrl
          ? `<a href="${b.sourceUrl}" target="_blank" rel="noopener">${b.name}</a>`
          : b.name}
        ${isEagle ? '<img src="/eagle-required.png" class="eagle-icon" alt="Eagle Scout Required" title="Eagle Scout Required" />' : ''}
      </span>
      <span class="badge-meta">${b.requirementCount} req&nbsp;·&nbsp;${formatDate(b.lastUpdated)}</span>
    </div>
    <div class="badge-actions">
      <a href="/form.html?badge=${b.slug}" class="btn btn-sm btn-primary">Worksheet</a>
      ${b.sourceUrl
        ? `<a href="${b.sourceUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-ghost">Requirements</a>`
        : ''}
      ${b.pamphletUrl
        ? `<a href="${b.pamphletUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-ghost">Pamphlet</a>`
        : ''}
      ${showDelete
        ? `<button class="btn btn-icon btn-danger delete-btn" data-slug="${b.slug}" title="Delete badge">${ICON_TRASH}</button>`
        : ''}
    </div>
  </div>`;
}

async function loadBadgeList(badgesList, badgeCount, { emptyMessage, showDelete }) {
  try {
    const res    = await fetch('/api/badges');
    const badges = await res.json();

    if (badges.length === 0) {
      badgesList.innerHTML   = `<p class="empty-state">${emptyMessage}</p>`;
      badgeCount.textContent = '';
      return;
    }

    // Eagle-required badges first, then alphabetical within each group
    badges.sort((a, b) => {
      const ae = EAGLE_REQUIRED.has(a.slug) ? 0 : 1;
      const be = EAGLE_REQUIRED.has(b.slug) ? 0 : 1;
      if (ae !== be) return ae - be;
      return a.name.localeCompare(b.name);
    });

    function render(list) {
      badgeCount.textContent = `(${list.length})`;
      badgesList.innerHTML   = list.length
        ? list.map((b) => renderBadgeRow(b, showDelete)).join('')
        : `<p class="empty-state">No badges match your search.</p>`;
    }

    render(badges);

    const searchInput = document.getElementById('badge-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        render(q ? badges.filter((b) => b.name.toLowerCase().includes(q)) : badges);
      });
    }
  } catch (err) {
    badgesList.innerHTML = `<p class="error-state">Failed to load badges: ${err.message}</p>`;
  }
}

// ─── Browse page (index.html) ─────────────────────────────────────────────────

if (document.body.classList.contains('page-index')) {
  const badgesList = document.getElementById('badges-list');
  const badgeCount = document.getElementById('badge-count');

  loadBadgeList(badgesList, badgeCount, {
    emptyMessage: 'No badges available.',
    showDelete:   false,
  });
}

// ─── Admin page (admin.html) ──────────────────────────────────────────────────

if (document.body.classList.contains('page-admin')) {
  const uploadForm   = document.getElementById('upload-form');
  const uploadBtn    = document.getElementById('upload-btn');
  const uploadStatus = document.getElementById('upload-status');
  const badgesList   = document.getElementById('badges-list');
  const badgeCount   = document.getElementById('badge-count');
  const dropZone     = document.getElementById('drop-zone');
  const fileInput    = document.getElementById('upload-file');
  const dropText     = document.getElementById('drop-text');

  function reload() {
    loadBadgeList(badgesList, badgeCount, {
      emptyMessage: 'No badges yet — add one above.',
      showDelete:   true,
    });
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file && (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm'))) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      dropText.textContent = file.name;
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) dropText.textContent = fileInput.files[0].name;
  });

  // ── Upload form ────────────────────────────────────────────────────────────
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showStatus(uploadStatus, 'Uploading and parsing requirements…', 'info');
    uploadBtn.disabled = true;

    try {
      const formData = new FormData(uploadForm);
      const res  = await fetch('/api/badges/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        showStatus(uploadStatus, `Error: ${data.error}`, 'error');
        return;
      }

      showStatus(
        uploadStatus,
        `✓ "${data.name} Merit Badge" saved — ${data.requirements.length} requirements parsed.`,
        'success'
      );
      uploadForm.reset();
      dropText.textContent = 'Choose HTML file or drag & drop';
      reload();
    } catch (err) {
      showStatus(uploadStatus, `Error: ${err.message}`, 'error');
    } finally {
      uploadBtn.disabled = false;
    }
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  badgesList.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (!deleteBtn) return;

    const slug = deleteBtn.dataset.slug;
    const name = deleteBtn.closest('.badge-row').querySelector('.badge-name').textContent;
    if (!confirm(`Delete "${name.trim()}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/badges/${slug}`, { method: 'DELETE' });
      if (res.ok) {
        reload();
      } else {
        const data = await res.json();
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });

  reload();
}

// ─── Form page ────────────────────────────────────────────────────────────────

if (document.body.classList.contains('page-form')) {
  const container    = document.getElementById('form-container');
  const slug         = new URLSearchParams(window.location.search).get('badge');
  const sourceLink   = document.getElementById('source-link');
  const pamphletLink = document.getElementById('pamphlet-link');

  if (!slug) {
    container.innerHTML = '<p class="error-state">No badge specified. <a href="/">Go back</a>.</p>';
  } else {
    loadForm(slug);
  }

  document.getElementById('print-btn').addEventListener('click', () => window.print());

  document.getElementById('pdf-btn').addEventListener('click', async () => {
    const btn = document.getElementById('pdf-btn');
    btn.disabled = true;
    btn.textContent = 'Generating…';
    try {
      const savedData = {};
      const prefix = `mbfg:${slug}:`;
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => { savedData[k.slice(prefix.length)] = localStorage.getItem(k); });

      const res = await fetch(`/api/badges/${slug}/pdf`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ savedData }),
      });
      if (!res.ok) { alert('Failed to generate PDF. See server log for details.'); return; }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href:     url,
        download: `${slug}-worksheet.pdf`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Download Fillable PDF';
    }
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    if (!confirm('Clear all saved responses for this badge? This cannot be undone.')) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`mbfg:${slug}:`))
      .forEach((k) => localStorage.removeItem(k));
    loadForm(slug);
  });

  async function loadForm(badgeSlug) {
    container.innerHTML = '<div class="loading-state">Loading badge requirements…</div>';
    try {
      const res = await fetch(`/api/badges/${badgeSlug}`);
      if (!res.ok) {
        const data = await res.json();
        container.innerHTML = `<p class="error-state">Error: ${data.error} <a href="/">Go back</a>.</p>`;
        return;
      }
      const badge = await res.json();

      if (badge.sourceUrl) {
        sourceLink.href   = badge.sourceUrl;
        sourceLink.hidden = false;
      }
      if (badge.pamphletUrl) {
        pamphletLink.href   = badge.pamphletUrl;
        pamphletLink.hidden = false;
      }

      document.title = `${badge.name} Merit Badge — Worksheet`;
      renderForm(badge);
    } catch (err) {
      container.innerHTML = `<p class="error-state">Failed to load: ${err.message}</p>`;
    }
  }

  function storeKey(badgeSlug, fieldId) { return `mbfg:${badgeSlug}:${fieldId}`; }
  function save(badgeSlug, fieldId, val) { localStorage.setItem(storeKey(badgeSlug, fieldId), val); }
  function restore(badgeSlug, fieldId)   { return localStorage.getItem(storeKey(badgeSlug, fieldId)) || ''; }

  function renderForm(badge) {
    const savedTs = localStorage.getItem(`mbfg:${badge.slug}:_savedAt`);
    const staleWarn = savedTs && new Date(badge.lastUpdated) > new Date(savedTs)
      ? `<div class="stale-warning">
           ⚠ Requirements were updated since your last save. Some responses may no longer match current requirements.
         </div>`
      : '';

    container.innerHTML = `
      ${staleWarn}
      <div class="print-only">
        <div class="print-logo">⚜ Scouting America</div>
      </div>

      <div class="badge-title-block">
        <h1 class="badge-form-title">${badge.name} Merit Badge</h1>
        <p class="badge-updated no-print">Requirements last updated: ${formatDate(badge.lastUpdated)}</p>
      </div>

      <fieldset class="scout-info">
        <legend>Scout Information</legend>
        <div class="info-grid">
          <label>Scout Name<input type="text" id="scout-name" placeholder="Full name" autocomplete="name" /></label>
          <label>Troop Number<input type="text" id="troop-number" placeholder="e.g. Troop 42" /></label>
          <label>Counselor Name<input type="text" id="counselor-name" placeholder="Merit badge counselor" /></label>
          <label>Date<input type="date" id="form-date" /></label>
        </div>
      </fieldset>

      <div class="requirements-list">
        ${badge.requirements.map((req) => renderRequirement(req, badge.slug)).join('')}
      </div>

      <div class="form-footer no-print">
        <p class="source-note">Requirements from the official BSA ${badge.name} Merit Badge requirements page</p>
      </div>
    `;

    // Wire up autosave for every input and textarea
    container.querySelectorAll('input, textarea').forEach((el) => {
      if (!el.id) return;
      const saved = restore(badge.slug, el.id);
      if (el.type === 'checkbox') el.checked = saved === 'true';
      else el.value = saved;

      const persist = () => {
        const val = el.type === 'checkbox' ? String(el.checked) : el.value;
        save(badge.slug, el.id, val);
        localStorage.setItem(`mbfg:${badge.slug}:_savedAt`, new Date().toISOString());
      };
      el.addEventListener('input',  persist);
      el.addEventListener('change', persist);
    });
  }

  function renderRequirement(req, slug) {
    const hasChildren = req.children && req.children.length > 0;
    const fieldId = `req-${slug}-${req.id}`;
    const doneId  = `done-${slug}-${req.id}`;

    const childrenHtml = hasChildren
      ? `<div class="sub-requirements">
           ${req.children.map((c) => renderRequirement(c, slug)).join('')}
         </div>`
      : '';

    const responseHtml = hasChildren
      ? `<div class="response-area group-notes">
           <label class="response-label" for="${fieldId}">Overall Notes (optional)</label>
           <textarea id="${fieldId}" class="response-textarea" rows="2"
             placeholder="Any overall notes for this group…"></textarea>
         </div>`
      : `<div class="response-area">
           <label class="response-label" for="${fieldId}">Response / Notes</label>
           <textarea id="${fieldId}" class="response-textarea" rows="4"
             placeholder="Describe how you completed this requirement…"></textarea>
         </div>`;

    return `
      <div class="requirement-block">
        <div class="requirement-header">
          <span class="req-number">${req.id}.</span>
          <label class="req-done-label" title="Mark complete">
            <input type="checkbox" id="${doneId}" class="req-done" />
            <span class="sr-only">Completed</span>
          </label>
          <p class="req-text">${req.text}</p>
        </div>
        ${childrenHtml}
        ${responseHtml}
      </div>`;
  }

}
