import { z } from 'zod';
import type { SupportedPlatform } from '$lib/types';

const SUPPORTED_HOSTS = [
	'youtube.com',
	'www.youtube.com',
	'youtu.be',
	'instagram.com',
	'www.instagram.com',
	'facebook.com',
	'www.facebook.com',
	'fb.watch'
] as const;

export const urlSchema = z
	.string()
	.url({ message: 'Please enter a valid URL.' })
	.refine((value) => isSupportedUrl(value), { message: 'Only YouTube, Instagram or Facebook links are supported.' });

export function isSupportedUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return SUPPORTED_HOSTS.includes(parsed.hostname as (typeof SUPPORTED_HOSTS)[number]);
	} catch {
		return false;
	}
}

export function detectPlatform(url: string): SupportedPlatform {
	const hostname = new URL(url).hostname;
	if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
	if (hostname.includes('instagram')) return 'instagram';
	return 'facebook';
}
