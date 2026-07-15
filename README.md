# SlateHub 🎬

A digital slate and shot list manager that syncs with Google Sheets.

Designed for indie filmmakers, small crews, and solo shooters who want one place to manage shots, mark takes, and track progress.

## Features

- **Shot List** — View all shots from your Google Sheet in a clean card layout
- **Digital Slate** — Tap any shot for a full-screen slate with take counter
- **Take Logging** — Mark good/NG takes, circle selects, add notes
- **Filters & Sorting** — Filter by type, location, status; sort by any column
- **Dashboard** — Track completion progress, view breakdowns by type and location
- **Write-Back** — Optionally write take data back to your Google Sheet

## Quick Start

### 1. Create your shot list in Google Sheets

Use any columns you want. SlateHub auto-detects these column names:

| Column | Purpose |
|---|---|
| `type` | Scene type (audio, pickup, scene, etc.) |
| `description` | What the shot is |
| `sub shot` | Sub-shot identifier |
| `location` | Where it's being shot |
| `setup` | Camera/audio setup notes |
| `notes` | General notes |
| `reference link` | URL to reference material |
| `shoot day` | Which production day |
| `shoot order` | Order within the day |
| `done y/n` | Completion status |

### 2. Publish your sheet

`File → Share → Publish to web → Entire Document as CSV`

Copy the published URL.

### 3. Open SlateHub

Paste the URL and click **Connect Sheet**.

### 4. Start shooting

- Browse shots, filter by type/location/status
- Tap a shot to open the digital slate
- Mark takes as good or no good
- Track your progress on the Dashboard

## Write-Back Setup (Optional)

To write take data back to your sheet:

1. In your Google Sheet: `Extensions → Apps Script`
2. Paste the code from `apps-script/Code.gs`
3. `Deploy → New Deployment → Web App`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the Web App URL and paste it into SlateHub's settings

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # production build
npm run preview  # preview production build
```

## Tech

React + TypeScript + Vite. Zero external runtime dependencies.
