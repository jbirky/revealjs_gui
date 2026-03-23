# Slides Editor

A self-hostable WYSIWYG presentation editor powered by [reveal.js](https://revealjs.com/). Build and present slides in the browser — no account, no cloud, no tracking.

## Features

- **WYSIWYG editing** — click and type directly on slides with TipTap rich text
- **Rich formatting** — headings, bold/italic/underline/strikethrough, text color, font family, font size, alignment, lists, tables, code blocks, links, images
- **Multi-select** — shift-click to select multiple elements, move or delete them together
- **Align & distribute** — align selected elements left/center/right/top/middle/bottom, or distribute evenly
- **Element controls** — resize, reposition, lock, z-order, drop shadow, aspect-ratio lock (hold Shift while resizing)
- **Image tools** — upload or URL, crop, pan, brightness/contrast/grayscale filters
- **Shapes** — rectangle, circle, triangle, arrow, star, and more with fill/stroke/opacity controls
- **Code blocks** — syntax-highlighted code with 10 themes (Monokai, GitHub Dark, Tokyo Night, etc.)
- **LaTeX math** — inline and display KaTeX math rendering
- **HTML embeds** — arbitrary HTML/CSS/JS or D3 visualizations in iframes
- **Slide management** — add from templates (blank, title, two-column, image+text), duplicate, drag-to-reorder, delete
- **Slide backgrounds** — solid color, CSS gradient, or image per slide
- **Slide templates** — starter layouts to speed up slide creation
- **Fragments** — per-element appear animations with configurable order
- **Themes** — all 11 reveal.js themes (black, white, league, beige, sky, night, serif, simple, solarized, moon, dracula)
- **Transitions** — none, fade, slide, convex, concave, zoom
- **Footer & page numbers** — configurable font, size, color; shown on every slide
- **Speaker notes** — per-slide notes shown in reveal.js speaker view (press `S` in presentation)
- **Present mode** — full-screen reveal.js presentation maximized to fill the display
- **Export HTML** — download as a self-contained HTML file (no server needed to share)
- **Export PDF** — print-ready HTML layout, one page per slide
- **Undo / Redo** — Ctrl+Z / Ctrl+Y with 50-step history
- **Clipboard** — Ctrl+C/X/V and Ctrl+D to copy/cut/paste/duplicate elements
- **Auto-save** — debounced saves to server every 1.5 s

---

## Self-Hosting

### Option A — Docker (recommended)

The easiest way to run the app. Requires [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/).

#### 1. Clone the repository

```bash
git clone https://github.com/jbirky/revealjs_gui.git
cd revealjs_gui
```

#### 2. Start with Docker Compose

```bash
docker compose up -d
```

This will:
- Build the React frontend and bundle it with the Express server
- Start the container on port **3002**
- Create two named Docker volumes to persist your data across restarts:
  - `revealjs-data` — presentation JSON (`server/data/presentations.json`)
  - `revealjs-uploads` — uploaded images (`server/uploads/`)

Open `http://localhost:3002` in your browser.

#### Useful commands

```bash
# View logs
docker compose logs -f

# Stop the container
docker compose down

# Rebuild after pulling new source changes
docker compose up -d --build

# Remove containers AND volumes (deletes all presentations and uploads)
docker compose down -v
```

#### Run on a custom port

Edit `docker-compose.yml` and change the host port (left side of the mapping):

```yaml
ports:
  - "8080:3002"   # now accessible at http://localhost:8080
```

#### Build and run without Compose

```bash
docker build -t slides-editor .
docker run -d \
  -p 3002:3002 \
  -v slides-data:/app/server/data \
  -v slides-uploads:/app/server/uploads \
  --name slides-editor \
  slides-editor
```

---

### Option B — Node.js / npm from source

Requires **Node.js 18+** and npm 8+.

#### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

#### 2. Install dependencies

```bash
npm install
```

This installs dependencies for the root workspace, the React client, and the Express server in one command.

#### 3a. Development mode

Runs the Vite dev server and the Express API server concurrently with hot-reload:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend (Express API) | http://localhost:3002 |

Open `http://localhost:5173`. The Vite dev server proxies `/api` and `/uploads` to the Express server automatically.

#### 3b. Production mode

Build the frontend, then serve everything from the Express server on a single port:

```bash
npm run build   # compiles React → client/dist/
npm start       # serves client/dist/ + API on port 3002
```

Open `http://localhost:3002`.

#### Run on a custom port

Set the `PORT` environment variable before starting:

```bash
PORT=8080 npm start
```

---

## Data & Persistence

| Path | Contents |
|------|----------|
| `server/data/presentations.json` | All presentation data (slides, elements, settings) |
| `server/uploads/` | Uploaded image files |

Both locations are created automatically on first run. Back them up to preserve your work.

**Docker:** data lives in named volumes (`revealjs-data`, `revealjs-uploads`). To back up or migrate:

```bash
# Copy presentations JSON out of the volume
docker run --rm \
  -v revealjs-data:/data \
  -v $(pwd):/backup \
  alpine cp /data/presentations.json /backup/presentations.json

# Copy it back
docker run --rm \
  -v revealjs-data:/data \
  -v $(pwd):/backup \
  alpine cp /backup/presentations.json /data/presentations.json
```

---

## Reverse Proxy (optional)

To expose the app on a domain with HTTPS, put Nginx or Caddy in front of the container.

**Nginx example** (`/etc/nginx/sites-available/slides`):

```nginx
server {
    listen 80;
    server_name slides.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name slides.example.com;

    ssl_certificate     /etc/letsencrypt/live/slides.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/slides.example.com/privkey.pem;

    # Allow large image uploads
    client_max_body_size 20M;

    location / {
        proxy_pass         http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

**Caddy example** (`Caddyfile`):

```
slides.example.com {
    reverse_proxy localhost:3002
}
```

Caddy handles HTTPS automatically via Let's Encrypt.

---

## Requirements

| Method | Requirement |
|--------|-------------|
| Docker | Docker 20.10+ and Docker Compose v2+ |
| Node.js | Node.js 18+ and npm 8+ |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| Rich text editor | TipTap 2 |
| Presentation engine | reveal.js 5 |
| Math rendering | KaTeX |
| Syntax highlighting | highlight.js |
| Backend | Node.js, Express 4 |
| Storage | JSON file + local filesystem |
