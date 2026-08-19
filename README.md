# DEMO — India Residency Calculator (standalone)

Static React page. Runs **entirely in the browser** by default — no
backend needed. Enable "Backend API" mode in the page to talk to the
FastAPI service from
[jasshabadsingh233-png/NM](https://github.com/jasshabadsingh233-png/NM)
instead.

## Deploy

Serve `index.html` from any static host. GitHub Pages works: enable
Pages on the branch you want to serve, and open the root URL.

## Local run

```
python -m http.server 5173
# open http://localhost:5173
```

## Files

- `index.html` — page shell (React 18 + Babel Standalone via CDN)
- `calculator.js` — pure-JS port of the FastAPI backend's rule
  modules, day counter, and calculator composition. Runs the exact
  same statutory logic in the browser; identical thresholds cited to
  the same sections.
- `app.jsx` — the form, results table, and audit-trail UI. Uses
  `window.ResidencyCalc` in local mode; POSTs `/calculate` when in
  Backend API mode.

## Parity with the backend

The Node parity harness (not shipped) has verified against the same
canonical scenario as the pytest suite (returning long-term OCI, 2015
through 2025-26): identical `days_in_india`, `tax_status`,
`tax_section`, `fema_status`, `statuses_disagree`, and
`rnor_window_close_date` for every reported FY. Every rule-check
boundary (182/181, 60/365 vs 60/364, 729/730, 120/119, FEMA 182/183)
matches the Python tests.

If the backend's `app/constants.py` changes, mirror the change in
`calculator.js` at the top; the rest of the port is derivative of
those constants.
