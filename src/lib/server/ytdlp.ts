import { chmod, mkdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

let cachedBinaryPath: string | null = null;
let ensurePromise: Promise<string> | null = null;

const YT_DLP_URL_LINUX = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
const YT_DLP_URL_WIN = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const YT_DLP_URL_MAC = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';

export async function ensureYtDlp(): Promise<{ binaryPath: string; ffmpegPath: string | undefined }> {
	if (cachedBinaryPath) return { binaryPath: cachedBinaryPath, ffmpegPath: ffmpegPath || undefined };
	if (ensurePromise) {
		const binaryPath = await ensurePromise;
		return { binaryPath, ffmpegPath: ffmpegPath || undefined };
	}

	ensurePromise = (async () => {
		const cacheDir = path.join(os.tmpdir(), 'lumy-cache');
		await mkdir(cacheDir, { recursive: true });

		const isWin = process.platform === 'win32';
		const isMac = process.platform === 'darwin';
		const binaryPath = path.join(
			cacheDir,
			isWin ? 'yt-dlp.exe' : isMac ? 'yt-dlp_macos' : 'yt-dlp_linux'
		);
		const url = isWin ? YT_DLP_URL_WIN : isMac ? YT_DLP_URL_MAC : YT_DLP_URL_LINUX;

		try {
			const stats = await stat(binaryPath);
			if (stats.size > 0) {
				cachedBinaryPath = binaryPath;
				return binaryPath;
			}
		} catch {
			// not found, continue to download
		}

		const res = await fetch(url);
		if (!res.ok || !res.body) {
			throw new Error(`Failed to download yt-dlp binary: ${res.status} ${res.statusText}`);
		}

		const buffer = Buffer.from(await res.arrayBuffer());
		await writeFile(binaryPath, buffer);
		if (!isWin) {
			await chmod(binaryPath, 0o755);
		}

		cachedBinaryPath = binaryPath;
		return binaryPath;
	})();

	const binaryPath = await ensurePromise;
	return { binaryPath, ffmpegPath: ffmpegPath || undefined };
}
