export type SupportedPlatform = 'youtube' | 'instagram' | 'facebook';

export interface FormatOption {
	id: string;
	qualityLabel?: string;
	ext: string;
	mimeType?: string;
	approxSize?: number;
	isAudio: boolean;
	hasVideo: boolean;
	hasAudio: boolean;
}

export interface VideoInfo {
	title: string;
	thumbnail?: string;
	duration?: number;
	videoFormats: FormatOption[];
	audioFormats: FormatOption[];
	platform: SupportedPlatform;
	url: string;
}

export interface DownloadRequest {
	url: string;
	formatId: string;
}

export interface DownloadResponse {
	filename: string;
	mimeType: string;
}
