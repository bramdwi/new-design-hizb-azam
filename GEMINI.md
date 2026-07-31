# Mukhtashar Al-Hizbul A'zham & Sholawat 40 — PWA

## What This App Is

A **Progressive Web App (PWA)** for reading the Islamic book *Mukhtashar Al-Hizb Al-A'zam* (a curated collection of daily prayers/doa from the original Al-Hizb Al-A'zam by Imam Abu Hanifah), compiled by Muhammad Iqbal of Madinah Munawwarah. The app also includes *Sholawat 40* (40 hadith about salawat upon the Prophet ﷺ).

The book is divided into **7 daily hizb** (one per day of the week: Jumat through Kamis) plus the Sholawat 40 section. Each section is stored as a separate PDF file that is rendered in-app using PDF.js.

**Key features:**
- 100% offline-capable after first visit (all PDFs precached)
- Installable as a native-like app on Android and iOS
- Hamburger menu sidebar with table of contents
- Resume reading from last position (localStorage)
- Royal blue + gold Islamic-themed design
- Mobile-first, responsive layout

**Live URL:** Deployed via GitHub Pages from `https://github.com/bramdwi/amalan-harian.git`

---

## Project Structure

```
hizb-azam-final/
├── index.html          # Single-page app with 3 views (Beranda, Bagian, Baca)
├── style.css           # All styles — CSS variables, components, responsive
├── app.js              # All app logic — PDF rendering, navigation, SW registration
├── sw.js               # Service Worker — precaching & cache-first strategy
├── manifest.json       # PWA manifest (name, icons, theme, orientation)
├── icon-512.png        # App icon (512x512, blue mosque design)
├── lib/
│   ├── pdf.min.mjs     # PDF.js library (v4.5.136, local copy)
│   └── pdf.worker.min.mjs  # PDF.js worker (local copy)
├── Jumat.pdf           # Hizb 1 — Friday
├── Sabtu.pdf           # Hizb 2 — Saturday
├── Ahad.pdf            # Hizb 3 — Sunday
├── Senin.pdf           # Hizb 4 — Monday
├── Selasa.pdf          # Hizb 5 — Tuesday
├── Rabu.pdf            # Hizb 6 — Wednesday
├── Kamis.pdf           # Hizb 7 — Thursday
└── Sholawat 40.pdf     # 40 Hadith about Salawat
```

---

## Architecture

### No Build Tools
This is a **vanilla HTML/CSS/JS** app with zero dependencies and no build step. Just serve the directory with any static file server. PDF.js is the only library, stored locally in `lib/`.

### Three Views (SPA-style)
The app uses a single `index.html` with three `<section>` views toggled via JS:

| View ID | Tab | Purpose |
|---------|-----|---------|
| `view-home` | Beranda | Book summary, resume reading card |
| `view-sections` | Bagian | List of all 8 sections (7 hizb + sholawat) |
| `view-reader` | Baca | Full PDF reader with page navigation |

Navigation is handled by a **bottom tab bar** (`#bottom-nav`) and a **hamburger sidebar** (`#sidebar`).

### PDF Rendering Pipeline
1. User clicks a section → `openPDF(filename, name)` is called
2. PDF is fetched as full `ArrayBuffer` via `fetch()` (with 3x auto-retry)
3. Downloaded data is cached in-memory (`pdfDataCache` Map) to avoid re-fetching
4. `pdfjsLib.getDocument({ data })` parses the PDF
5. All pages are rendered sequentially into `<canvas>` elements in `#pdf-container`
6. Reading position is saved to `localStorage` on every page scroll

### Service Worker Strategy
- **Install:** Precaches all app files + all 8 PDFs + PDF.js library
- **Fetch:** Cache-first for same-origin requests; network-first with cache fallback for external (Google Fonts)
- **Activate:** Deletes old cache versions automatically
- **Cache name:** `hizb-azam-v7` — **bump this when making changes** to force cache refresh

### State Management
All state is in `localStorage`:
- `lastRead` → `{ pdf, name, page }` for resume reading
- Service Worker handles cache independently

---

## Design System

### Color Palette (Royal Blue Theme)
Originally green, migrated to blue to match the PDF content's aesthetic.

```css
--blue-darkest: #0b1326;   /* Body background */
--blue-dark:    #101c36;    /* Cards, surfaces */
--blue-deep:    #162e5c;    /* Header, sidebar */
--blue-mid:     #1d4482;    /* Accents */
--blue-light:   #2b5cac;    /* Active states */
--blue-subtle:  #3b72c9;    /* Hover states */

--gold:         #c49b3c;    /* Primary accent (ornaments, highlights) */
--gold-light:   #d4af5a;    /* Emphasis text */
--gold-dark:    #a37f2a;    /* Muted gold */

--cream:        #f5f0e6;    /* Primary text color */
```

> **Note:** The `--green-*` variables still exist as aliases to `--blue-*` for backward compatibility. They can be removed safely if no references remain.

### Typography
- **Main font:** `Inter` (Google Fonts) with system font fallbacks
- **Arabic font:** `Amiri` (Google Fonts) — used for Arabic script in PDFs
- Fonts are cached by SW for offline use; system fallbacks ensure graceful degradation

### Component Classes (BEM-style)
- `.intro-card` / `.intro-card--main` / `.intro-card--doa` / `.intro-card--hadits` — Beranda content cards
- `.verse-block` / `.verse-block__ayat` / `.verse-block__ref` — Quran verse blockquotes
- `.hadits-block` / `.hadits-block__matan` — Hadith quotation blocks
- `.toc-item` / `.toc-badge` — Sidebar table of contents items
- `.section-item` — Bagian view list items
- `.day-card` — **REMOVED** (was the old grid of day buttons on beranda)

---

## Key Decisions & History

1. **PDF.js moved from CDN to local** (`lib/`) — eliminates network dependency, enables true offline
2. **Full ArrayBuffer download before render** — fixes "Bad end offset" errors from partial PDF streams
3. **Auto-retry (3x) with progressive delay** — handles flaky connections gracefully
4. **Theme changed from green to royal blue** — to match the book's PDF border/frame colors
5. **Beranda redesigned** — removed day-card grid, replaced with book summary (Ringkasan Al-Hizb Al-A'zam), Hakikat Doa (Quran verses), and Hadits tentang Doa sections
6. **All beranda text is center-aligned** — per owner's preference
7. **No icons on Hakikat Doa and Hadits cards** — owner prefers clean text-only cards
8. **"BUKU SAKU AMALAN HARIAN" subtitle removed** — from both header and hero
9. **Honorific:** Maulana Muhammad Zakariyya is referred to as *Rahmatullah 'alaihi* (not *qaddasallahu sirrahu*)

---

## How to Run Locally

```bash
# Any static server works. Examples:
python3 -m http.server 8080
# or
npx serve .
# or
php -S localhost:8080
```

Then open `http://localhost:8080`.

---

## Making Changes — Important Notes

### When you change ANY file:
1. **Bump `CACHE_NAME`** in `sw.js` (e.g., `hizb-azam-v4` → `hizb-azam-v5`)
2. Without this, browsers will serve stale cached versions indefinitely

### Adding a new PDF section:
1. Add the PDF file to the project root
2. Add entry to `SECTIONS` array in `app.js` (line ~26)
3. Add `<button class="toc-item">` in sidebar (`index.html`)
4. Add `<button class="section-item">` in Bagian view (`index.html`)
5. Add the filename to `PRECACHE_URLS` in `sw.js`
6. Bump `CACHE_NAME`

### Modifying the Beranda content:
- Content lives in `index.html` inside `<div class="intro-section">` (around line 142)
- Three cards: `.intro-card--main`, `.intro-card--doa`, `.intro-card--hadits`
- Styles are in `style.css` under the `INTRO SECTION` comment block

### iOS PWA Notes:
- iOS requires Safari for "Add to Home Screen" (Chrome iOS cannot install PWAs)
- `<meta name="apple-mobile-web-app-capable" content="yes">` is already set
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` is set
- SW cache updates are slower on iOS Safari — users may need to close/reopen the app

---

## Git & Deployment

- **Repo:** `https://github.com/bramdwi/amalan-harian.git`
- **Branch:** `main`
- **Deploy:** Push to `main` → GitHub Pages serves automatically
- **Owner preference:** Sometimes asks to review locally before pushing. Always confirm before `git push` unless explicitly told to push.
