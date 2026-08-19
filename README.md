# DEMO — India Residency Calculator (frontend)

Static React page mirrored from
[jasshabadsingh233-png/NM](https://github.com/jasshabadsingh233-png/NM)'s
`frontend/` directory. React 18 + Babel Standalone via CDN — no build step.

## Deploy

Serve `index.html` from any static host. GitHub Pages works: enable
Pages on the branch you want to serve, and open the root URL.

The page has an **API base URL** field at the top; it's remembered in
`localStorage`. Point it at a running instance of the FastAPI backend
from the NM repo (`uvicorn app.main:app` from `NM/backend`), or your
own deployment of it.

## Local

```
python -m http.server 5173
# then open http://localhost:5173
```
