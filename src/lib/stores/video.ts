import { writable } from 'svelte/store';
import type { VideoInfo } from '$lib/types';

export const videoInfoStore = writable<VideoInfo | null>(null);
export const loadingStore = writable(false);
export const errorStore = writable<string | null>(null);
