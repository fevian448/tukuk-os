#!/usr/bin/env node
/**
 * Tukuk-OS MCP Server (stdio).
 *
 * MCP = Model Context Protocol. Protokol ini membolehkan pelanggan AI
 * (Kilo, Claude Desktop, dll.) memanggil kebolehan Tukuk-OS sebagai "tools".
 *
 * Protokol: JSON-RPC 2.0 ke atas stdin/stdout. Setiap baris = satu requestsatu.
 *
 * Jalankan:
 *   node mcp/server.js
 *   tukuk-os mcp
 *
 * Fail config Kilo:
 *   ~/.config/kilo/kilo.jsonc
 *   { "mcp": { "tukuk-os": { "type": "local", "command": ["tukuk-os", "mcp"] } } }
 */

const readline = require('readline');
const config = require('../src/config');
const { client } = require('../src/meili');
const crawler = require('../src/crawler');
const rag = require('../src/brain/rag');
const brain = require('../src/brain/provider');
const knowledge = require('../src/brain/knowledge');
const net = require('../src/net');

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'tukuk-os', version: '2.0.0' };
const index = client.index(config.indexName);

function logToStderr(...args) {
  process.stderr.write(`[tukuk-os-mcp] ${args.join(' ')}\n`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: '2.0', id, result: value });
}

function failure(id, code, message, data) {
  send({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
}

function text(value, extra = {}) {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
    isError: Boolean(extra.isError),
    ...(extra.structuredContent ? { structuredContent: extra.structuredContent } : {})
  };
}

const TOOLS = [
  {
    name: 'tukuk_search',
    description:
      'Cari web melalui enjin Tukuk-OS. Sokong penapis host, bahasa, jenis, susunan, facet. ' +
      'Guna alat ini apabila pengguna tanya tentang topik yang mungkin ada dalam index.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Kata kunci carian' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        host: { type: 'string', description: 'Tapis satu domain' },
        lang: { type: 'string', description: 'Tapis bahasa, cth. ms, en' },
        sort: { type: 'string', enum: ['newest', 'oldest', 'longest', 'shortest'] }
      },
      required: ['q']
    }
  },
  {
    name: 'tukuk_ask',
    description:
      'Tanya soalan dalam Bahasa Melayu. Otak Tukuk-OS akan retrieve dokumen daripada index ' +
      'lalu jana jawapan yang bersumber. Sentiasa semak medan "sources".',
    inputSchema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'Soalan untuk dijawab' } },
      required: ['question']
    }
  },
  {
    name: 'tukuk_crawl',
    description: 'Rantau (crawl) satu URL dan indekskan kandungannya. Hormati robots.txt.',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL untuk dirantau' } },
      required: ['url']
    }
  },
  {
    name: 'tukuk_stats',
    description: 'Statistik Tukuk-OS: bilangan dokumen, status otak, status internet, tetapan.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'tukuk_knowledge',
    description: 'Dapatkan rekod pengetahuan kendiri tentang Tukuk-OS (laluan, konfigurasi, had).',
    inputSchema: {
      type: 'object',
      properties: { section: { type: 'string', description: 'Seksyen tertentu, cth. routes' } }
    }
  },
  {
    name: 'tukuk_offline_status',
    description: 'Status sambungan internet dan sama ada mod offline aktif.',
    inputSchema: { type: 'object', properties: {} }
  }
];

async function handle(name, args = {}) {
  switch (name) {
    case 'tukuk_search': {
      const params = {
        limit: Math.min(Number(args.limit) || 10, 50),
        attributesToCrop: ['content'],
        cropLength: 30,
        attributesToHighlight: ['title', 'description'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>'
      };
      if (args.host) params.filter = `host = "${String(args.host).replace(/"/g, '')}"`;
      else if (args.lang) params.filter = `lang = "${String(args.lang).replace(/"/g, '')}"`;
      if (args.sort === 'newest') params.sort = ['crawledAt:desc'];
      else if (args.sort === 'longest') params.sort = ['wordCount:desc'];

      const found = await index.search(String(args.q || ''), params);
      const lines = found.hits.map((hit, position) => {
        const snippet = hit._formatted?.content
          ? hit._formatted.content.replace(/<\/?mark>/g, '')
          : hit.description || '';
        return `[${position + 1}] ${hit.title}\n    ${hit.url}\n    ${snippet.slice(0, 200)}`;
      });
      const header = `${found.estimatedTotalHits ?? found.hits.length} hasil untuk "${args.q}" (${found.processingTimeMs}ms)`;
      return text([header, ...lines].join('\n'), {
        structuredContent: {
          total: found.estimatedTotalHits ?? found.hits.length,
          hits: found.hits.map((hit) => ({
            url: hit.url, title: hit.title, siteName: hit.siteName, description: hit.description
          }))
        }
      });
    }

    case 'tukuk_ask': {
      const answer = await rag.ask(args.question);
      const sources = answer.sources.map((source) => `[${source.ref}] ${source.title} — ${source.url}`).join('\n');
      return text(
        [`${answer.answer}`, '', sources ? `SUMBER:\n${sources}` : 'SUMBER: (tiada)', '', `mod: ${answer.mode} | model: ${answer.model} | ${answer.tookMs}ms`].join('\n'),
        { structuredContent: { answer: answer.answer, mode: answer.mode, sources: answer.sources } }
      );
    }

    case 'tukuk_crawl': {
      crawler.setIndex(index);
      const [outcome] = await crawler.crawlBatch([String(args.url)]);
      if (outcome.status === 'failed') {
        return text(`Gagal merayau: ${outcome.error}`, { isError: true });
      }
      return text(`Status: ${outcome.status}\nURL: ${outcome.url || args.url}\nID: ${outcome.id || '-'}`);
    }

    case 'tukuk_stats': {
      const [stats, brainHealth, network] = await Promise.all([
        index.getStats(),
        brain.health(),
        net.check()
      ]);
      return text({
        documents: stats.numberOfDocuments,
        indexSize: stats.indexSize,
        brain: { online: brainHealth.online, model: brainHealth.model, models: brainHealth.models },
        network: network.status,
        crawler: crawler.snapshot(),
        mcp: { server: SERVER_INFO.name, version: SERVER_INFO.version, tools: TOOLS.length }
      });
    }

    case 'tukuk_knowledge': {
      if (args.section && knowledge.knowledge[args.section]) {
        return text(knowledge.knowledge[args.section]);
      }
      return text(knowledge.asPrompt());
    }

    case 'tukuk_offline_status':
      return text(await net.check());

    default:
      return text(`Alat tidak dikenali: ${name}`, { isError: true });
  }
}

async function dispatch(message) {
  const { id, method, params } = message;

  if (method === 'initialize') {
    return result(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO
    });
  }

  if (method === 'notifications/initialized') return undefined;

  if (method === 'tools/list') {
    return result(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    if (id === undefined) return undefined;
    try {
      const payload = await handle(params?.name, params?.arguments);
      return result(id, payload);
    } catch (error) {
      return result(id, text(`Ralat: ${error.message}`, { isError: true }));
    }
  }

  if (id === undefined) return undefined;

  if (method === 'ping') return result(id, {});

  return failure(id, -32601, `Kaedah tidak disokong: ${method}`);
}

function main() {
  logToStderr(`dimulakan — versi ${SERVER_INFO.version}, ${TOOLS.length} alat`);

  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  let pending = 0;
  let closing = false;

  async function finish(message) {
    try {
      await dispatch(message);
    } catch (error) {
      logToStderr('ralat:', error.message);
      if (message.id !== undefined) failure(message.id, -32603, error.message);
    } finally {
      pending -= 1;
      // Jangan keluar sehingga semua request selesai.
      if (closing && pending === 0) process.exit(0);
    }
  }

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      return failure(null, -32700, 'JSON tidak sah');
    }

    pending += 1;
    finish(message);
  });

  // Tunggu request yang sedang berjalan sebelum tutup.
  rl.on('close', () => {
    closing = true;
    if (pending === 0) process.exit(0);
  });

  process.on('SIGTERM', () => {
    closing = true;
    if (pending === 0) process.exit(0);
  });
  process.on('SIGINT', () => process.exit(0));
}

if (require.main === module) main();

module.exports = { TOOLS, handle, dispatch };