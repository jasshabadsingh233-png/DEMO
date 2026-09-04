# Ranjit Industries — Parts Catalogue

A static parts catalogue website for Ranjit Industries. Plain HTML, CSS and
JavaScript. No database, no build tools, no frameworks. The site reads
`parts.csv` directly so you can update parts by editing the spreadsheet.

## What's in this folder

| File           | What it does                                       |
| -------------- | -------------------------------------------------- |
| `index.html`   | Homepage — company intro, capabilities, parts grid |
| `part.html`    | Part detail page (opens automatically when clicking a card) |
| `about.html`   | About the company                                  |
| `contact.html` | Contact page with enquiry form                     |
| `styles.css`   | All styling (navy + brass gold theme)              |
| `app.js`       | Loads the CSV, filters/searches, opens the quote form |
| `parts.csv`    | **The parts data. This is the file you edit.**     |

## How to view it on your computer

**Option 1 — quickest for a preview.** Double-click `index.html`. Some
browsers (Chrome, Edge) block reading local CSV files for security. If the
catalogue shows a "Could not load parts.csv" message, use option 2.

**Option 2 — reliable.** Open a terminal in this folder and run one of:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. When you're done, press
`Ctrl + C` in the terminal to stop.

On Windows without Python, install [Node.js](https://nodejs.org) and run
`npx serve` in this folder instead.

Once the site is live on the internet (see below), no local server is
needed — visitors just open the URL.

## How to put it online for free

You have several good options. GitHub Pages is the simplest.

### Option A — GitHub Pages (recommended)

1. Sign up at [github.com](https://github.com) (free) if you don't already have an account.
2. Create a new **public** repository — call it `ranjit-catalogue` for example.
3. Upload every file from this folder into the repository (drag-and-drop on GitHub works).
4. In the repository, click **Settings → Pages**.
5. Under **Source**, choose **Deploy from a branch**, pick `main` (or `master`), folder `/ (root)`, and click **Save**.
6. Wait about a minute. GitHub will give you a URL like `https://yourname.github.io/ranjit-catalogue/`.

To connect your own domain (e.g. `www.ranjitindustries.com`), see
GitHub's [custom domain guide](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site).

### Option B — Netlify (drag and drop)

1. Sign up at [netlify.com](https://netlify.com) (free).
2. On the dashboard, drag this whole folder into the "deploy" area.
3. Netlify gives you a live URL within seconds. You can connect your own domain from the site settings.

### Option C — Cloudflare Pages

1. Sign up at [pages.cloudflare.com](https://pages.cloudflare.com) (free).
2. Upload this folder or connect it from a GitHub repository.
3. Cloudflare gives you a fast global URL immediately.

All three are free for a business site of this size.

## How to edit parts.csv

`parts.csv` is a plain spreadsheet file. You can open it in **Microsoft
Excel**, **Google Sheets**, or **LibreOffice Calc**. When you save,
**always save as CSV (comma-separated values)**, not as `.xlsx`.

### The columns (in order)

| Column              | What to put                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `part_id`           | Your internal part number, e.g. `RI-1001`. Must be unique.                   |
| `name`              | Descriptive name, e.g. `Male Hex Nipple 1/2" BSP`.                           |
| `category`          | e.g. `Pipe Fittings`, `Electrical Components`, `Moulding Inserts`.           |
| `material`          | Brass grade, e.g. `CW614N`, `CW617N`, `CW724R`.                              |
| `standard`          | Manufacturing standard, e.g. `BS EN 12165`, `DIN 16903`.                     |
| `thread_size`       | e.g. `1/2" BSP`, `M6 x 1.0`, `PG13.5`.                                       |
| `key_dimensions`    | Free-text summary, e.g. `L 40mm x Hex 24mm`.                                  |
| `finish`            | e.g. `Natural Brass`, `Nickel Plated`, `Chrome Plated`.                      |
| `application`       | What the part is used for, e.g. `Plumbing and water supply lines`.           |
| `min_order_qty`     | A number, e.g. `500`.                                                         |
| `lead_time_weeks`   | A number, e.g. `3`.                                                           |

### Tips

- **Values with a comma inside** (e.g. `Fitting, brass, elbow`) must be wrapped in double quotes: `"Fitting, brass, elbow"`. Excel and Google Sheets do this automatically when you save as CSV.
- **Don't rename the column headers.** The site looks for exactly those names in the first row.
- **Add as many rows as you like** — the grid, filters and search all update automatically.
- **After editing**, re-upload `parts.csv` to wherever the site is hosted. The change appears immediately.

### Tips for Excel users

1. Open `parts.csv` in Excel.
2. Excel will show columns nicely. Edit or add rows normally.
3. `File → Save As → CSV UTF-8 (Comma delimited) (.csv)`. Keep the filename `parts.csv`.

### Tips for Google Sheets users

1. Upload `parts.csv` to Google Drive, open with Google Sheets.
2. Edit or add rows.
3. `File → Download → Comma-separated values (.csv)`. Rename the downloaded file to `parts.csv` and re-upload it to your website host.

## The quote and contact forms

For a truly static site (no backend), the built-in "Request a Quote" and
contact forms currently open the visitor's email application with the
enquiry pre-filled. When you're ready to receive submissions directly to
your inbox without visitors having to send an email themselves, connect
the forms to a free service such as:

- [Formspree](https://formspree.io) (free tier available)
- [Netlify Forms](https://docs.netlify.com/forms/setup/) (free if hosted on Netlify)
- [Getform](https://getform.io)

Each provider gives you a small snippet to paste into the form — no
coding required. If you'd like help wiring one in, let us know your
preferred provider and email address.

## Colours and branding

The colour scheme lives at the top of `styles.css` in the `:root` block:

```css
--navy: #0f2340;         /* main dark blue */
--brass: #b8860b;        /* brass gold accent */
--brass-light: #d4a534;  /* highlights and hover */
```

Change those three values and the whole site updates.
