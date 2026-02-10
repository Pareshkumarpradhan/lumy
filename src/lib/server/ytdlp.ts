import { chmod, mkdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

let cachedBinaryPath: string | null = null;
let ensurePromise: Promise<string> | null = null;

const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

export async function ensureYtDlp(): Promise<{ binaryPath: string; ffmpegPath: string | undefined }> {
	if (cachedBinaryPath) return { binaryPath: cachedBinaryPath, ffmpegPath: ffmpegPath || undefined };
	if (ensurePromise) {
		const binaryPath = await ensurePromise;
		return { binaryPath, ffmpegPath: ffmpegPath || undefined };
	}

	ensurePromise = (async () => {
		const cacheDir = path.join(os.tmpdir(), 'lumy-cache');
		await mkdir(cacheDir, { recursive: true });
		const binaryPath = path.join(cacheDir, 'yt-dlp');

		try {
			const stats = await stat(binaryPath);
			if (stats.size > 0) {
				cachedBinaryPath = binaryPath;
				return binaryPath;
			}
		} catch {
			// not found, proceed to download
		}

		const res = await fetch(YT_DLP_URL);
		if (!res.ok || !res.body) {
			throw new Error(`Failed to download yt-dlp binary: ${res.status} ${res.statusText}`);
		}
		const buffer = Buffer.from(await res.arrayBuffer());
		await writeFile(binaryPath, buffer);
		await chmod(binaryPath, 0o755);

		cachedBinaryPath = binaryPath;
		return binaryPath;
	})();

	const binaryPath = await ensurePromise;
	return { binaryPath, ffmpegPath: ffmpegPath || undefined };
}
