/* Ranjit Industries — parts catalog logic
   Loads parts.csv, renders grid + filters + search, opens quote modal.
   Plain JS. No dependencies. */

(function () {
  'use strict';

  // ---------- CSV parsing (handles quoted fields) ----------
  function parseCSV(text) {
    const rows = [];
    let field = '';
    let row = [];
    let inQuotes = false;
    // normalise line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; }
        else { field += c; }
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    // drop empty trailing rows
    while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop();
    if (!rows.length) return [];
    const headers = rows.shift().map(h => h.trim());
    return rows.map(cols => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
      return obj;
    });
  }

  // ---------- CSV loading ----------
  async function loadParts() {
    try {
      const res = await fetch('parts.csv', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      return parseCSV(text);
    } catch (err) {
      throw err;
    }
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uniqSorted(values) {
    return Array.from(new Set(values.filter(v => v && v.trim()))).sort((a, b) => a.localeCompare(b));
  }
  function fillSelect(sel, values, allLabel) {
    if (!sel) return;
    sel.innerHTML = '<option value="">' + allLabel + '</option>' +
      values.map(v => '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>').join('');
  }
  function debounce(fn, ms) {
    let t; return function () { clearTimeout(t); const args = arguments; t = setTimeout(() => fn.apply(null, args), ms); };
  }
  function getQueryParam(name) {
    const m = new URLSearchParams(window.location.search).get(name);
    return m || '';
  }

  // ---------- Catalog page (index.html) ----------
  function initCatalog() {
    const grid = document.getElementById('parts-grid');
    if (!grid) return;

    const searchInput = document.getElementById('filter-search');
    const materialSel = document.getElementById('filter-material');
    const categorySel = document.getElementById('filter-category');
    const threadSel = document.getElementById('filter-thread');
    const applicationSel = document.getElementById('filter-application');
    const countEl = document.getElementById('results-count');
    const resetBtn = document.getElementById('filter-reset');

    grid.innerHTML = '<div class="loading">Loading parts</div>';

    loadParts().then(parts => {
      if (!parts.length) {
        grid.innerHTML = '<div class="no-results"><h3>No parts found in parts.csv</h3></div>';
        return;
      }

      fillSelect(materialSel, uniqSorted(parts.map(p => p.material)), 'All materials');
      fillSelect(categorySel, uniqSorted(parts.map(p => p.category)), 'All categories');
      fillSelect(threadSel, uniqSorted(parts.map(p => p.thread_size)), 'All thread sizes');
      fillSelect(applicationSel, uniqSorted(parts.map(p => p.application)), 'All applications');

      function render() {
        const q = (searchInput.value || '').toLowerCase().trim();
        const mat = materialSel.value;
        const cat = categorySel.value;
        const thr = threadSel.value;
        const app = applicationSel.value;

        const filtered = parts.filter(p => {
          if (mat && p.material !== mat) return false;
          if (cat && p.category !== cat) return false;
          if (thr && p.thread_size !== thr) return false;
          if (app && p.application !== app) return false;
          if (q) {
            const hay = (p.name + ' ' + p.part_id + ' ' + p.material + ' ' + p.standard + ' ' +
                         p.thread_size + ' ' + p.key_dimensions + ' ' + p.finish + ' ' +
                         p.application + ' ' + p.category).toLowerCase();
            if (hay.indexOf(q) === -1) return false;
          }
          return true;
        });

        countEl.textContent = filtered.length + ' of ' + parts.length + ' part' + (parts.length === 1 ? '' : 's');

        if (!filtered.length) {
          grid.innerHTML = '<div class="no-results"><h3>No matching parts</h3><p>Try clearing a filter or searching for something else.</p></div>';
          return;
        }

        grid.innerHTML = filtered.map(p => cardHTML(p)).join('');
      }

      function cardHTML(p) {
        const href = 'part.html?id=' + encodeURIComponent(p.part_id);
        return '' +
          '<a class="part-card" href="' + href + '">' +
            '<div class="part-id">' + escapeHtml(p.part_id) + '</div>' +
            '<div class="part-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="part-meta">' +
              '<span class="tag tag-material">' + escapeHtml(p.material) + '</span>' +
              '<span class="tag">' + escapeHtml(p.category) + '</span>' +
            '</div>' +
            '<div class="part-spec">' +
              '<span><strong>Thread:</strong> ' + escapeHtml(p.thread_size) + '</span>' +
              '<span><strong>Finish:</strong> ' + escapeHtml(p.finish) + '</span>' +
              '<span><strong>Application:</strong> ' + escapeHtml(p.application) + '</span>' +
            '</div>' +
          '</a>';
      }

      const rerender = debounce(render, 60);
      searchInput.addEventListener('input', rerender);
      materialSel.addEventListener('change', render);
      categorySel.addEventListener('change', render);
      threadSel.addEventListener('change', render);
      applicationSel.addEventListener('change', render);
      resetBtn.addEventListener('click', function () {
        searchInput.value = '';
        materialSel.value = '';
        categorySel.value = '';
        threadSel.value = '';
        applicationSel.value = '';
        render();
      });

      render();
    }).catch(err => {
      grid.innerHTML = errorBoxHTML(err);
    });
  }

  function errorBoxHTML(err) {
    return '' +
      '<div class="error-box">' +
        '<h3>Could not load parts.csv</h3>' +
        '<p>The catalog reads from <code>parts.csv</code> in the same folder as <code>index.html</code>.</p>' +
        '<p>If you opened this file directly from your computer, some browsers block reading local files. ' +
        'Run a small local server, then open <code>http://localhost:8000</code>:</p>' +
        '<p><code>python3 -m http.server 8000</code></p>' +
        '<p>When deployed to any web host (GitHub Pages, Netlify, your own server) this works with no extra setup.</p>' +
        '<p style="color:#a06600;font-size:0.85em;margin-top:12px;">Error detail: ' + escapeHtml(err && err.message) + '</p>' +
      '</div>';
  }

  // ---------- Detail page (part.html) ----------
  function initDetail() {
    const wrap = document.getElementById('detail-wrap');
    if (!wrap) return;

    const id = getQueryParam('id');
    wrap.innerHTML = '<div class="loading">Loading part</div>';

    loadParts().then(parts => {
      const p = parts.find(x => x.part_id === id);
      if (!p) {
        wrap.innerHTML = '' +
          '<div class="no-results">' +
            '<h3>Part not found</h3>' +
            '<p>We could not find part <strong>' + escapeHtml(id) + '</strong>. ' +
            '<a href="index.html">Back to catalogue</a>.</p>' +
          '</div>';
        return;
      }
      renderDetail(p);
    }).catch(err => {
      wrap.innerHTML = errorBoxHTML(err);
    });
  }

  function renderDetail(p) {
    // Update header
    const headEl = document.getElementById('detail-header-inner');
    if (headEl) {
      headEl.innerHTML = '' +
        '<div class="breadcrumb"><a href="index.html">Catalogue</a> &nbsp;/&nbsp; ' + escapeHtml(p.category) + '</div>' +
        '<div class="detail-id">' + escapeHtml(p.part_id) + '</div>' +
        '<h1 class="detail-name">' + escapeHtml(p.name) + '</h1>' +
        '<div class="part-meta">' +
          '<span class="tag tag-material">' + escapeHtml(p.material) + '</span>' +
          '<span class="tag">' + escapeHtml(p.category) + '</span>' +
          '<span class="tag">' + escapeHtml(p.finish) + '</span>' +
        '</div>';
    }
    document.title = p.part_id + ' — ' + p.name + ' | Ranjit Industries';

    const wrap = document.getElementById('detail-wrap');
    wrap.innerHTML = '' +
      '<a href="index.html" class="detail-back">&larr; Back to catalogue</a>' +
      '<div class="detail-layout">' +
        '<div>' +
          '<table class="spec-table" aria-label="Full specification">' +
            '<caption>Full Specification</caption>' +
            '<tbody>' +
              row('Part Number', p.part_id) +
              row('Name', p.name) +
              row('Category', p.category) +
              row('Material Grade', p.material + materialNote(p.material)) +
              row('Standard', p.standard) +
              row('Thread Size', p.thread_size) +
              row('Key Dimensions', p.key_dimensions) +
              row('Finish', p.finish) +
              row('Application', p.application) +
              row('Minimum Order Quantity', p.min_order_qty + ' pieces') +
              row('Lead Time', p.lead_time_weeks + ' week' + (p.lead_time_weeks === '1' ? '' : 's') + ' from order confirmation') +
            '</tbody>' +
          '</table>' +
        '</div>' +
        '<aside class="quote-panel">' +
          '<h3>Request a Quote</h3>' +
          '<p>Get pricing, packaging options and export documentation for <strong>' + escapeHtml(p.part_id) + '</strong>. We reply within one business day.</p>' +
          '<button class="btn btn-primary" id="btn-quote" type="button">Request a Quote</button>' +
          '<p class="form-note" style="margin-top:18px;">Minimum order: <strong>' + escapeHtml(p.min_order_qty) + ' pcs</strong><br>Typical lead time: <strong>' + escapeHtml(p.lead_time_weeks) + ' weeks</strong></p>' +
        '</aside>' +
      '</div>';

    document.getElementById('btn-quote').addEventListener('click', function () {
      openQuoteModal(p);
    });

    function row(label, value) {
      return '<tr><th scope="row">' + escapeHtml(label) + '</th><td>' + escapeHtml(value) + '</td></tr>';
    }
  }

  function materialNote(grade) {
    const notes = {
      'CW614N': ' — free-cutting brass, ideal for high-speed machining',
      'CW617N': ' — hot-forging brass, superior corrosion resistance',
      'CW724R': ' — low-lead / eco-brass, compliant with drinking water standards'
    };
    return notes[grade] || '';
  }

  // ---------- Quote modal ----------
  function openQuoteModal(part) {
    let modal = document.getElementById('quote-modal');
    if (!modal) {
      modal = buildModal();
      document.body.appendChild(modal);
    }
    modal.querySelector('#qm-part').value = part.part_id + ' — ' + part.name;
    modal.querySelector('#qm-quantity').value = part.min_order_qty || '';
    modal.querySelector('#qm-name').focus();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeQuoteModal() {
    const modal = document.getElementById('quote-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      // reset any success message on next open
      const success = modal.querySelector('.success-msg');
      if (success) success.remove();
      const form = modal.querySelector('form');
      if (form) form.hidden = false;
    }
  }

  function buildModal() {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'quote-modal';
    wrap.innerHTML = '' +
      '<div class="modal" role="dialog" aria-labelledby="qm-title" aria-modal="true">' +
        '<div class="modal-header">' +
          '<h3 id="qm-title">Request a Quote</h3>' +
          '<button class="modal-close" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<form id="quote-form" novalidate>' +
            '<div class="form-row">' +
              '<label for="qm-part">Part number</label>' +
              '<input id="qm-part" name="part" type="text" readonly>' +
            '</div>' +
            '<div class="form-row two-col">' +
              '<div class="form-row">' +
                '<label for="qm-name">Your name *</label>' +
                '<input id="qm-name" name="name" type="text" required>' +
              '</div>' +
              '<div class="form-row">' +
                '<label for="qm-company">Company *</label>' +
                '<input id="qm-company" name="company" type="text" required>' +
              '</div>' +
            '</div>' +
            '<div class="form-row two-col">' +
              '<div class="form-row">' +
                '<label for="qm-country">Country *</label>' +
                '<input id="qm-country" name="country" type="text" required>' +
              '</div>' +
              '<div class="form-row">' +
                '<label for="qm-email">Email *</label>' +
                '<input id="qm-email" name="email" type="email" required>' +
              '</div>' +
            '</div>' +
            '<div class="form-row">' +
              '<label for="qm-quantity">Quantity required *</label>' +
              '<input id="qm-quantity" name="quantity" type="number" min="1" required>' +
            '</div>' +
            '<div class="form-row">' +
              '<label for="qm-message">Message / specifications</label>' +
              '<textarea id="qm-message" name="message" placeholder="Packaging, finish, delivery port, drawings, target price…"></textarea>' +
            '</div>' +
            '<div class="form-actions">' +
              '<button type="button" class="btn btn-ghost" id="qm-cancel">Cancel</button>' +
              '<button type="submit" class="btn btn-primary">Send Request</button>' +
            '</div>' +
            '<p class="form-note">We reply within one business day (IST, Mon–Sat).</p>' +
          '</form>' +
        '</div>' +
      '</div>';

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) closeQuoteModal();
    });
    wrap.querySelector('.modal-close').addEventListener('click', closeQuoteModal);
    wrap.querySelector('#qm-cancel').addEventListener('click', closeQuoteModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeQuoteModal();
    });

    wrap.querySelector('#quote-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const form = e.currentTarget;
      // basic validation
      const required = form.querySelectorAll('[required]');
      let valid = true;
      required.forEach(el => {
        if (!el.value.trim()) { el.style.borderColor = '#c33'; valid = false; }
        else { el.style.borderColor = ''; }
      });
      if (!valid) return;

      const data = {
        part: form.part.value,
        name: form.name.value.trim(),
        company: form.company.value.trim(),
        country: form.country.value.trim(),
        email: form.email.value.trim(),
        quantity: form.quantity.value,
        message: form.message.value.trim()
      };

      // In production this would POST to a backend, Formspree, Netlify Forms, etc.
      // For a static site we log it and also open an email as a graceful fallback.
      console.log('Quote request:', data);

      const subject = 'Quote request: ' + data.part;
      const body =
        'Part: ' + data.part + '\n' +
        'Name: ' + data.name + '\n' +
        'Company: ' + data.company + '\n' +
        'Country: ' + data.country + '\n' +
        'Email: ' + data.email + '\n' +
        'Quantity: ' + data.quantity + '\n\n' +
        'Message:\n' + (data.message || '(none)');
      const mailto = 'mailto:sales@ranjitindustries.example?subject=' +
        encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

      form.hidden = true;
      const success = document.createElement('div');
      success.className = 'success-msg';
      success.innerHTML = '' +
        '<strong>Thank you, ' + escapeHtml(data.name) + '.</strong><br>' +
        'Your request for <strong>' + escapeHtml(data.part) + '</strong> has been prepared. ' +
        'We will reply to <strong>' + escapeHtml(data.email) + '</strong> within one business day.<br><br>' +
        '<a class="btn btn-primary" href="' + mailto + '">Open in your email app</a>';
      form.parentNode.insertBefore(success, form);
    });

    return wrap;
  }

  // ---------- Contact form (contact.html) ----------
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const status = document.getElementById('contact-status');
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();
      if (!name || !email || !message) {
        status.textContent = 'Please fill in your name, email, and message.';
        status.style.color = '#c33';
        return;
      }
      const subject = 'Website enquiry from ' + name;
      const body = 'Name: ' + name + '\nCompany: ' + (form.company.value || '') +
        '\nEmail: ' + email + '\n\n' + message;
      const mailto = 'mailto:info@ranjitindustries.example?subject=' +
        encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      window.location.href = mailto;
      status.innerHTML = 'Thank you. Your email client should open now. If not, please write to <a href="mailto:info@ranjitindustries.example">info@ranjitindustries.example</a>.';
      status.style.color = '';
    });
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', function () {
    initCatalog();
    initDetail();
    initContactForm();
  });
})();
