# Lumy – SvelteKit video & audio downloader

> For personal and educational use only. Please respect copyright and each platform's terms of service.

## Stack
- SvelteKit + Vite + TypeScript (strict)
- Tailwind CSS (utility-first, v4)
- `ytdlp-nodejs` – manages the yt-dlp binary in-project (no Python/global installs)
- Zod for request validation

## Getting started
```bash
npm install
npm run dev -- --open
```

### First run
The first call to `/api/info` or `/api/download` triggers `ytdlp-nodejs` to download the correct `yt-dlp` binary into the project cache. No extra setup is required.

## Available scripts
- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run preview` – preview production build
- `npm run check` – type and Svelte checks
- `npm run lint` – prettier + eslint

## API
- `POST /api/info` → `{ title, thumbnail, videoFormats[], audioFormats[] }` for a given `{ url }`
- `POST /api/download` → streams the selected format. Body: `{ url, formatId }`

## Project structure
```
src/
  lib/
    types.ts               # shared TS types
    stores/video.ts        # UI stores
    utils/validators.ts    # URL validation helpers
  routes/
    +layout.svelte
    layout.css
    +page.svelte           # main UI
    api/
      info/+server.ts      # metadata endpoint
      download/+server.ts  # streaming endpoint
```

## Notes
- Only progressive video formats (audio+video) are offered to avoid FFmpeg requirements.
- Audio tab surfaces the best available audio-only option.
- Errors (invalid/unsupported/private links) are surfaced with friendly messages.
