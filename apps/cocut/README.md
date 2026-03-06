# CO-EDIT by Content Co-op

Browser-based video editor powered by React and FFmpeg.wasm. Edit, trim, overlay, and export — all in the browser with no server-side processing.

## Features

- **Video Upload** — Import video, image, and audio files directly into the browser
- **Timeline Editing** — Multi-track timeline with drag, trim, split, and snap
- **Trim & Cut Controls** — Precision trim handles, blade tool, ripple/roll/slide/slip editing
- **Text Overlay** — Add styled text elements with animation support (13 animation types)
- **Export to MP4** — Render final video in-browser via FFmpeg.wasm (MP4 or WebM)
- **Cloud Storage** — Save and load projects from Supabase
- **Subtitle Editor** — Import/export SRT and VTT, auto-generate from speech
- **AI Assistant** — Layout suggestions and subtitle refinement
- **Keyboard Shortcuts** — Premiere Pro-inspired shortcuts (J/K/L, V/B, etc.)
- **Auth** — Supabase authentication (email/password + Google OAuth)

## Tech Stack

- React 19 + TypeScript
- Vite 7
- FFmpeg.wasm (in-browser video encoding)
- Zustand + Zundo (state management with undo/redo)
- Supabase (auth + cloud project storage)
- Tailwind CSS
- IndexedDB (local auto-save)

## Getting Started

```bash
git clone https://github.com/baileyeubanks/coedit.git
cd coedit
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_GOOGLE_API_KEY` | No | Google Gemini API key (AI features) |
| `VITE_ANTHROPIC_API_KEY` | No | Anthropic Claude API key (AI features) |
| `VITE_OPENAI_API_KEY` | No | OpenAI API key (AI fallback) |

## Supabase Setup

Create a `projects` table for cloud storage:

```sql
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Untitled Project',
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;

create policy "Users manage own projects" on projects
  for all using (auth.uid() = user_id);
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `K` | Pause |
| `J` / `L` | Shuttle reverse / forward |
| `Left` / `Right` | Step 1 frame |
| `Shift + Left/Right` | Step 5 frames |
| `Home` / `End` | Go to start / end |
| `V` | Select tool |
| `B` | Blade tool |
| `Q` / `W` | Trim left / right to playhead |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / Redo |
| `Cmd+S` | Save project |
| `Cmd+A` | Select all |
| `Delete` | Delete selected |
| `Cmd+D` | Duplicate selected |
| `G` | Toggle grid |
| `I` / `O` | Set loop in / out point |
| `+` / `-` | Timeline zoom in / out |

## Deployment

Deploy to Netlify:

```bash
npm run build
# Output in dist/
```

The `netlify.toml` is pre-configured. Connect your repo to Netlify and set the environment variables in the Netlify dashboard.

**Note:** FFmpeg.wasm requires `Cross-Origin-Embedder-Policy` headers. These are configured in both `vite.config.ts` (dev) and `netlify.toml` (prod).

## License

MIT
