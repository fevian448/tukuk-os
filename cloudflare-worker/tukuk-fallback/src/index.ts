import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

const ORIGIN = 'https://tukuk.org';

type Outcome = 'origin_ok' | 'origin_error' | 'fallback_served' | 'static_miss' | 'api_unavailable';

function track(env: any, outcome: Outcome, method: string, path: string, status?: number): void {
	try {
		const engine = (env as Record<string, any>)['tukuk-os_engine'];
		engine?.writeDataPoint({
			blobs: [outcome, method, path, String(status ?? '')],
			indexes: [outcome],
		});
	} catch (e) {
		// logging tidak boleh gagalkan permintaan
		console.error('writeDataPoint gagal', outcome, (e as Error)?.message);
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Try to proxy to main server first
		try {
			const originUrl = new URL(ORIGIN + path + url.search);
			const originResponse = await fetch(originUrl, {
				method: request.method,
				headers: {
					'Accept': request.headers.get('Accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
				},
			});

			if (originResponse.ok) {
				track(env, 'origin_ok', request.method, path, originResponse.status);
				return new Response(originResponse.body, {
					status: originResponse.status,
					headers: {
						'Content-Type': originResponse.headers.get('Content-Type') || 'text/html',
						'Cache-Control': 'no-cache',
					},
				});
			}
		} catch (e) {
			// Server down, fall through to static fallback
			track(env, 'origin_error', request.method, path);
		}

		// Fallback: serve static from R2
		if (path.startsWith('/api/') || path === '/search' || path === '/websearch' || path === '/suggest' || path === '/images' || path === '/videos' || path === '/health' || path === '/stats') {
			track(env, 'api_unavailable', request.method, path, 503);
			return new Response('API unavailable — server offline', { status: 503 });
		}

		try {
			const object = await env.FALLBACK_BUCKET.get(path === '/' ? 'index.html' : path);
			if (object) {
				track(env, 'fallback_served', request.method, path, 200);
				return new Response(object.body, {
					headers: {
						'Content-Type': object.httpMetadata?.contentType || 'text/html',
						'Cache-Control': 'public, max-age=300',
					},
				});
			}
		} catch (e) {
			// fall through
		}

		track(env, 'static_miss', request.method, path, 503);
		return new Response('Offline — static fallback not available', { status: 503 });
	},
} satisfies ExportedHandler<Env>;
