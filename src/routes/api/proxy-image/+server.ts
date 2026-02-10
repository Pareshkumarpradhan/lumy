import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const target = url.searchParams.get('url');
	if (!target) {
		return new Response('Missing url', { status: 400 });
	}

	try {
		const upstream = await fetch(target);
		if (!upstream.ok) {
			return new Response('Upstream fetch failed', { status: upstream.status });
		}

		const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
		return new Response(upstream.body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Proxy failed';
		return new Response(message, { status: 502 });
	}
};
