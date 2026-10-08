export interface Env {
	BACKUPS: R2Bucket;
	UPLOAD_SECRET: string;
}

const MAX_BYTES = 90 * 1024 * 1024;

function isAuthorised(request: Request, env: Env): boolean {
	const header = request.headers.get('authorization') || '';
	const token = header.replace(/^Bearer\s+/i, '');
	return Boolean(env.UPLOAD_SECRET) && token === env.UPLOAD_SECRET;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (!isAuthorised(request, env)) {
			return new Response('forbidden', { status: 403 });
		}

		if (request.method === 'POST') {
			const declared = Number(request.headers.get('content-length') || 0);
			if (declared > MAX_BYTES) {
				return new Response('payload too large', { status: 413 });
			}
			const body = await request.arrayBuffer();
			if (body.byteLength > MAX_BYTES) {
				return new Response('payload too large', { status: 413 });
			}
			const key =
				url.searchParams.get('key') ||
				request.headers.get('x-object-key') ||
				`meili-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;
			await env.BACKUPS.put(key, body, {
				httpMetadata: { contentType: 'application/gzip' },
			});
			return Response.json({ ok: true, key, bytes: body.byteLength });
		}

		if (request.method === 'GET') {
			const key = url.searchParams.get('key');
			if (!key) {
				const prefix = url.searchParams.get('prefix') || '';
				const listed = await env.BACKUPS.list({ prefix });
				return Response.json({
					objects: listed.objects.map((object) => ({
						key: object.key,
						bytes: object.size,
						uploaded: object.uploaded,
					})),
				});
			}
			const object = await env.BACKUPS.get(key);
			if (!object) return new Response('not found', { status: 404 });
			return new Response(object.body, {
				headers: {
					'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
					'Content-Length': String(object.size),
				},
			});
		}

		if (request.method === 'DELETE') {
			const key = url.searchParams.get('key');
			if (!key) return new Response('key diperlukan', { status: 400 });
			await env.BACKUPS.delete(key);
			return Response.json({ ok: true, key });
		}

		return new Response('tukuk-backup', { status: 405 });
	},
} satisfies ExportedHandler<Env>;
