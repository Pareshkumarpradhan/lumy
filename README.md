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

### Production auth for YouTube
YouTube may block anonymous requests with "Sign in to confirm you're not a bot". Configure one of these:

- `YT_COOKIES_FILE` - absolute path to a Netscape-format cookies file
- `YT_COOKIES` - Netscape-format cookies file content (multiline)
- `YT_COOKIES_B64` - base64 of full Netscape cookies content (single-line; easiest for free hosts)
- `YT_COOKIES_B64_GZIP` - gzip+base64 of full Netscape cookies content (best when provider env-size limits are strict)
- `YT_COOKIES_FROM_BROWSER` - browser spec for `--cookies-from-browser` (for environments where a logged-in browser profile exists)

Priority order is: request body values -> environment variables. For API requests, both `/api/info` and `/api/download` now accept:

- `cookies` - cookie file path or Netscape cookie file content
- `cookiesFromBrowser` - value for `--cookies-from-browser`

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
