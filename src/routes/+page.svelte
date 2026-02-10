<script lang="ts">
	import { onMount } from 'svelte';
	import type { FormatOption, VideoInfo } from '$lib/types';
	import { detectPlatform, isSupportedUrl } from '$lib/utils/validators';

	let url = $state('');
let info = $state<VideoInfo | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);
let tab = $state<'video' | 'audio'>('video');
let progress = $state<Record<string, number>>({});

	const placeholders = [
		'https://youtu.be/dQw4w9WgXcQ',
		'https://www.instagram.com/reel/...',
		'https://fb.watch/...'
	];

	onMount(() => {
		url = placeholders[0];
	});

	const formatBytes = (bytes?: number): string => {
		if (!bytes || Number.isNaN(bytes)) return 'Unknown size';
		const units = ['B', 'KB', 'MB', 'GB'];
		const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / 1024 ** i;
		return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
	};

	function pickTabAfterFetch(data: VideoInfo) {
		if (data.videoFormats.length) {
			tab = 'video';
		} else if (data.audioFormats.length) {
			tab = 'audio';
		}
	}

	async function fetchInfo(event?: Event) {
		event?.preventDefault();
		error = null;
		progress = {};

		if (!url.trim()) {
			error = 'Please paste a video link.';
			return;
		}

		if (!isSupportedUrl(url.trim())) {
			error = 'Only YouTube, Instagram or Facebook links are supported.';
			return;
		}

		loading = true;
		info = null;
		try {
			const response = await fetch('/api/info', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: url.trim() })
			});

			if (!response.ok) {
				const { error: message } = await response.json();
				error = message ?? 'Unable to fetch video details.';
				return;
			}

			const data = (await response.json()) as VideoInfo;
			info = data;
			pickTabAfterFetch(data);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	}

	function filenameFor(option: FormatOption) {
		if (!info) return `lumy-${option.id}.${option.ext}`;
		const safeTitle = info.title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80);
		return `${safeTitle || info.platform}-${option.id}.${option.ext}`;
	}

	async function startDownload(option: FormatOption) {
		if (!info) return;
		progress[option.id] = 2;

		try {
			const response = await fetch('/api/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: info.url, formatId: option.id })
			});

			if (!response.ok) {
				const { error: message } = await response.json();
				throw new Error(message ?? 'Failed to start download.');
			}

			const reader = response.body?.getReader();
			let blob: Blob;

			if (reader) {
				const chunks: BlobPart[] = [];
				const total = Number(response.headers.get('content-length')) || 0;
				let received = 0;

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (value) {
						chunks.push(value.slice());
						received += value.byteLength;
						if (total > 0) {
							progress[option.id] = Math.min(99, Math.round((received / total) * 100));
						}
					}
				}
				blob = new Blob(chunks);
			} else {
				blob = await response.blob();
			}
			const blobUrl = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = blobUrl;
			anchor.download = filenameFor(option);
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(blobUrl);
			progress[option.id] = 100;
			setTimeout(() => {
				delete progress[option.id];
				progress = { ...progress };
			}, 1500);
		} catch (err) {
			delete progress[option.id];
			progress = { ...progress };
			error = err instanceof Error ? err.message : 'Download failed.';
		}
	}
</script>

<svelte:head>
	<title>Lumy | Video & Audio Downloader</title>
	<meta
		name="description"
		content="Download YouTube, Instagram, and Facebook videos or audio easily with Lumy."
	/>
</svelte:head>

<main class="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
	<section class="max-w-5xl w-full mx-auto px-6 py-16 flex-1">
		<div class="text-center space-y-4 mb-10">
			<p class="inline-flex items-center gap-2 rounded-full bg-slate-900/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 border border-slate-800">
				Lumy · Smart Fetch
			</p>
			<h1 class="text-4xl font-semibold sm:text-5xl">Video & Audio Downloader</h1>
			<p class="text-slate-300 max-w-2xl mx-auto">
				Paste a YouTube, Instagram, or Facebook link to fetch available download options. Quick, private, and simple.
			</p>
		</div>

		<form class="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl shadow-black/30 p-6 space-y-4 backdrop-blur" onsubmit={fetchInfo}>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
				<label class="sr-only" for="video-url">Video URL</label>
				<div class="relative flex-1">
					<input
						id="video-url"
						name="url"
						type="url"
						placeholder="Paste YouTube, Instagram or Facebook video link..."
						class="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 pr-12 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60 transition"
						bind:value={url}
						aria-invalid={error ? 'true' : 'false'}
					/>
					{#if url}
						<button
							type="button"
							class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
							onclick={() => (url = '')}
							aria-label="Clear URL"
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="h-5 w-5">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M6 18L18 6" />
							</svg>
						</button>
					{/if}
				</div>
				<button
					class="shrink-0 rounded-xl bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center gap-2 cursor-pointer"
					type="submit"
					disabled={loading}
				>
					{#if loading}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
						Fetching...
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v12m0 0l-4-4m4 4l4-4m-9 8h10" />
						</svg>
						Get Options
					{/if}
				</button>
			</div>
			<div class="text-xs text-slate-400">
				Tip: Try something like <code class="bg-slate-800 px-1.5 py-0.5 rounded">{placeholders[0]}</code>
			</div>
			{#if error}
				<div class="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
					{error}
				</div>
			{/if}
		</form>

		{#if loading}
			<div class="mt-10 flex items-center justify-center gap-3 text-slate-300">
				<span class="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-indigo-400"></span>
				Fetching formats...
			</div>
		{:else if info}
			<section class="mt-10 space-y-6">
				<div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/30 flex flex-col md:flex-row gap-6">
					{#if info.thumbnail}
						<div class="md:w-56 overflow-hidden rounded-xl border border-slate-800 bg-slate-800/50">
							<img
								src={`/api/proxy-image?url=${encodeURIComponent(info.thumbnail)}`}
								alt={info.title}
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						</div>
					{/if}
					<div class="flex-1 space-y-3">
						<p class="text-sm uppercase tracking-[0.2em] text-indigo-300">{info.platform}</p>
						<h2 class="text-2xl font-semibold">{info.title}</h2>
						{#if info.duration}
							<p class="text-slate-400 text-sm">Duration: {Math.round(info.duration / 60)} min</p>
						{/if}
						<p class="text-xs text-slate-400">
							For personal and educational use only. Please respect copyright and each platform's terms of service.
						</p>
					</div>
				</div>

				<div class="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl shadow-black/30">
					<div class="flex border-b border-slate-800">
						<button
							class="flex-1 px-4 py-3 text-sm font-semibold transition cursor-pointer"
							class:bg-slate-800={tab === 'video'}
							onclick={() => (tab = 'video')}
							disabled={!info.videoFormats.length}
						>
							Video ({info.videoFormats.length})
						</button>
						<button
							class="flex-1 px-4 py-3 text-sm font-semibold transition cursor-pointer"
							class:bg-slate-800={tab === 'audio'}
							onclick={() => (tab = 'audio')}
							disabled={!info.audioFormats.length}
						>
							Audio ({info.audioFormats.length})
						</button>
					</div>

					{#if tab === 'video'}
						<div class="divide-y divide-slate-800">
							{#each info.videoFormats as option}
								<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
									<div class="space-y-2">
										<div class="flex items-center gap-2 text-base">
											<span class="font-semibold text-slate-50">{option.qualityLabel ?? 'Video'}</span>
											<span class="text-xs rounded-full border border-slate-700 px-2 py-0.5 uppercase tracking-wide text-slate-300">
												{option.ext}
											</span>
											<!-- {#if option.hasVideo && !option.hasAudio}
												<span class="text-[10px] rounded-full bg-amber-500/20 border border-amber-400/60 px-2 py-0.5 text-amber-100">
													video-only
												</span>
											{/if} -->
										</div>
										<p class="text-sm text-slate-400">
											{option.mimeType ?? 'video/*'} · {option.approxSize ? formatBytes(option.approxSize) : 'Size unavailable'}
										</p>
										{#if progress[option.id] !== undefined}
											<div class="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
												<div
													class="h-full bg-indigo-500 transition-[width] duration-150"
													style={`width:${progress[option.id]}%;`}
												></div>
											</div>
										{/if}
									</div>
									<button
										class="relative inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
										onclick={() => startDownload(option)}
										disabled={progress[option.id] !== undefined}
									>
										<span class="relative flex items-center gap-2">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v12m0 0l-4-4m4 4l4-4m-9 8h10" />
											</svg>
											{progress[option.id] ? `${progress[option.id]}%` : 'Download'}
										</span>
									</button>
								</div>
							{:else}
								<p class="p-6 text-sm text-slate-400">No progressive video formats found.</p>
							{/each}
						</div>
					{:else}
						<div class="divide-y divide-slate-800">
							{#each info.audioFormats as option}
								<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
									<div class="space-y-2">
										<div class="flex items-center gap-2 text-base">
											<span class="font-semibold text-slate-50">Best Audio</span>
											<span class="text-xs rounded-full border border-slate-700 px-2 py-0.5 uppercase tracking-wide text-slate-300">
												{option.ext}
											</span>
										</div>
										<p class="text-sm text-slate-400">
											{option.mimeType ?? 'audio/*'} · {option.approxSize ? formatBytes(option.approxSize) : 'Size unavailable'}
										</p>
										{#if progress[option.id] !== undefined}
											<div class="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
												<div
													class="h-full bg-indigo-500 transition-[width] duration-150"
													style={`width:${progress[option.id]}%;`}
												></div>
											</div>
										{/if}
									</div>
									<button
										class="relative inline-flex items-center justify-center rounded-lg cursor-pointer border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed"
										onclick={() => startDownload(option)}
										disabled={progress[option.id] !== undefined}
									>
										<span class="relative flex items-center gap-2">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v12m0 0l-4-4m4 4l4-4m-9 8h10" />
											</svg>
											{progress[option.id] ? `${progress[option.id]}%` : 'Download Audio'}
										</span>
									</button>
								</div>
							{:else}
								<p class="p-6 text-sm text-slate-400">No audio-only format found.</p>
							{/each}
						</div>
					{/if}
				</div>

			</section>
		{/if}
	</section>

	<footer class="py-6 text-center text-xs text-slate-400 border-t border-slate-900 space-y-1">
		<p>© {new Date().getFullYear()} Lumy. All rights reserved.</p>
		<p>For personal and educational use only. Please respect copyright and each platform's terms of service.</p>
	</footer>
</main>
