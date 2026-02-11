import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { YtDlp, type PlaylistInfo, type VideoInfo as YtdlpVideoInfo } from 'ytdlp-nodejs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectPlatform, isSupportedUrl, urlSchema } from '$lib/utils/validators';
import { ensureYtDlp } from '$lib/server/ytdlp';
import { resolveYtAuth } from '$lib/server/ytAuth';

let baseYtDlp: YtDlp | null = null;
const EXTRA_ARGS = ['--extractor-args', 'youtube:player_client=android,web'];

export const POST: RequestHandler = async ({ request }) => {
	let cleanupAuth: (() => Promise<void>) | null = null;
	try {
		const { url, formatId, cookies: userCookies, cookiesFromBrowser: userCookiesFromBrowser } = await request.json();
		const parsedUrl = urlSchema.parse(url);
		const auth = await resolveYtAuth({
			cookies: typeof userCookies === 'string' ? userCookies : '',
			cookiesFromBrowser: typeof userCookiesFromBrowser === 'string' ? userCookiesFromBrowser : ''
		});
		cleanupAuth = auth.cleanup;

		if (!isSupportedUrl(parsedUrl)) {
			return json({ error: 'Only YouTube, Instagram or Facebook links are supported.' }, { status: 400 });
		}

		if (!formatId || typeof formatId !== 'string') {
			return json({ error: 'Missing formatId.' }, { status: 400 });
		}

		const { binaryPath, ffmpegPath } = await ensureYtDlp();
		if (!baseYtDlp) {
			baseYtDlp = new YtDlp({ binaryPath, ffmpegPath });
		} else {
			baseYtDlp.binaryPath = binaryPath;
			baseYtDlp.ffmpegPath = ffmpegPath;
		}

		const rawInfo = await baseYtDlp.getInfoAsync(parsedUrl, {
			cookies: auth.cookies,
			cookiesFromBrowser: auth.cookiesFromBrowser
		});
		if (!isVideoInfo(rawInfo)) {
			return json({ error: 'Playlists are not supported. Please use a single video URL.' }, { status: 400 });
		}

		const info = rawInfo;
		const target = info.formats?.find((f) => String(f.format_id) === formatId);

		if (!target) {
			return json({ error: 'Selected format is unavailable.' }, { status: 404 });
		}

		const ext = target.ext || 'mp4';
		const extra = target as unknown as Record<string, unknown>;
		const mime =
			(extra.mime_type as string | undefined) ||
			(target.vcodec && target.vcodec !== 'none' ? `video/${ext}` : `audio/${ext === 'mp3' ? 'mpeg' : ext}`);

		const filenameBase = info.title ? sanitizeFileName(info.title) : detectPlatform(parsedUrl);
		const filename = `${filenameBase || 'lumy'}-${formatId}.${ext}`;

		const headers: Record<string, string> = {
			'Content-Type': mime,
			'Content-Disposition': `attachment; filename="${filename}"`
		};

		// If the selected format already has audio, just download that stream.
		if (target.acodec && target.acodec !== 'none') {
			const buffer = await baseYtDlp
				.stream(parsedUrl)
				.addArgs(...EXTRA_ARGS)
				.addArgs('-f', formatId)
				.addArgs(...auth.rawArgs)
				.toBuffer();
			headers['Content-Length'] = String(buffer.length);
			return new Response(new Uint8Array(buffer), { headers });
		}

		// Otherwise merge best audio with chosen video-only format using ffmpeg.
		const mergeDeps = await ensureYtDlp();
		if (!mergeDeps.ffmpegPath) {
			return json({ error: 'FFmpeg missing in runtime.' }, { status: 500 });
		}

		const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'lumy-'));
		const outPath = path.join(tmpDir, `${Date.now()}-${formatId}.mp4`);

		try {
			const merger = new YtDlp({ binaryPath: mergeDeps.binaryPath, ffmpegPath: mergeDeps.ffmpegPath || undefined });

			await merger.execAsync(parsedUrl, {
				cookies: auth.cookies,
				cookiesFromBrowser: auth.cookiesFromBrowser,
				rawArgs: [
					...EXTRA_ARGS,
					...auth.rawArgs,
					'-f',
					`${formatId}+bestaudio/best`,
					'--merge-output-format',
					'mp4',
					'-o',
					outPath
				]
			});

			const fileBuffer = await readFile(outPath);
			headers['Content-Length'] = String(fileBuffer.length);
			return new Response(new Uint8Array(fileBuffer), { headers });
		} catch (mergeError) {
			const message =
				mergeError instanceof Error ? mergeError.message : 'Merge failed (ffmpeg / format compatibility issue).';
			return json({ error: `Failed to merge audio/video: ${message}` }, { status: 502 });
		} finally {
			rm(outPath).catch(() => {});
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Download failed.';
		return json({ error: message }, { status: 502 });
	} finally {
		if (cleanupAuth) {
			await cleanupAuth();
		}
	}
};

function sanitizeFileName(name: string): string {
	// Remove characters illegal for filenames and strip non-ASCII to keep HTTP headers happy
	const ascii = name
		.normalize('NFKD')
		.replace(/[^\x20-\x7E]/g, '') // strip non-ASCII printable
		.replace(/[\\/:*?"<>|]+/g, '')
		.trim()
		.slice(0, 80);
	return ascii || 'lumy';
}


function isVideoInfo(info: YtdlpVideoInfo | PlaylistInfo): info is YtdlpVideoInfo {
	return (info as YtdlpVideoInfo)._type === 'video';
}
