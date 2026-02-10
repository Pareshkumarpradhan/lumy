import { json } from '@sveltejs/kit';
import { YtDlp, type PlaylistInfo, type VideoInfo as YtdlpVideoInfo } from 'ytdlp-nodejs';
import type { RequestHandler } from './$types';
import type { FormatOption, VideoInfo } from '$lib/types';
import { detectPlatform, isSupportedUrl, urlSchema } from '$lib/utils/validators';
import { ensureYtDlp } from '$lib/server/ytdlp';

let ytdlp: YtDlp | null = null;
const EXTRA_ARGS = ['--extractor-args', 'youtube:player_client=android'];
const DEFAULT_COOKIES = '';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const parsedUrl = urlSchema.parse(body.url);

		if (!isSupportedUrl(parsedUrl)) {
			return json({ error: 'Only YouTube, Instagram or Facebook links are supported.' }, { status: 400 });
		}

		if (!ytdlp) {
			const { binaryPath, ffmpegPath } = await ensureYtDlp();
			ytdlp = new YtDlp({ binaryPath, ffmpegPath });
		}

		const rawInfo = await ytdlp.getInfoAsync(parsedUrl, { cookies: DEFAULT_COOKIES });
		if (!isVideoInfo(rawInfo)) {
			return json({ error: 'Playlists are not supported. Please use a single video URL.' }, { status: 400 });
		}

		const info = rawInfo;

		const formats = Array.isArray(info.formats) ? info.formats : [];
		const videoFormats: FormatOption[] = [];
		const audioFormats: FormatOption[] = [];

		for (const format of formats) {
			const id = String(format.format_id ?? '');
			if (!id) continue;

			const hasVideo = Boolean(format.vcodec && format.vcodec !== 'none');
			const hasAudio = Boolean(format.acodec && format.acodec !== 'none');
			const isAudioOnly = !hasVideo && hasAudio;
			const isVideoWithAudio = hasVideo && hasAudio;
			const isVideoOnly = hasVideo && !hasAudio;

			const extra = format as unknown as Record<string, unknown>;
			const option: FormatOption = {
				id,
				qualityLabel: format.format_note || (format.height ? `${format.height}p` : undefined),
				ext: format.ext || 'mp4',
				mimeType: extra.mime_type as string | undefined,
				approxSize: format.filesize ?? (extra.filesize_approx as number | undefined),
				isAudio: isAudioOnly,
				hasVideo: hasVideo,
				hasAudio: hasAudio
			};

			if (isAudioOnly) {
				audioFormats.push(option);
			} else if (isVideoWithAudio || isVideoOnly) {
				videoFormats.push(option);
			}
		}

		// pick best audio only one
		audioFormats.sort((a, b) => (b.qualityLabel ?? '').localeCompare(a.qualityLabel ?? ''));
		videoFormats.sort((a, b) => {
			const getHeight = (opt: FormatOption) => Number(opt.qualityLabel?.replace(/\D/g, '')) || 0;
			return getHeight(b) - getHeight(a);
		});

		const payload: VideoInfo = {
			title: info.title ?? 'Unknown title',
			thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
			duration: info.duration,
			videoFormats,
			audioFormats: audioFormats.length ? [audioFormats[0]] : [],
			platform: detectPlatform(parsedUrl),
			url: parsedUrl
		};

		return json(payload);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to extract video information.';
		const status = message.includes('Unsupported URL') || message.includes('Invalid URL') ? 400 : 502;
		return json({ error: message }, { status });
	}
};

function isVideoInfo(info: YtdlpVideoInfo | PlaylistInfo): info is YtdlpVideoInfo {
	return (info as YtdlpVideoInfo)._type === 'video';
}
