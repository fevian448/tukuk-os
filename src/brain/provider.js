const http = require('http');
const config = require('../config');

/**
 * Provider LLM untuk "otak" Tukuk-OS.
 *
 * Default: smollm:135m (91 MB) — berjalan pada CPU, ~12 token/s.
 * Pengguna boleh tukar model; LLM_CHAIN memberi laluan failover.
 *
 * smollm:135m sangat kecil. Ia HANYA boleh bergantung kepada sumber yang
 * diberi (RAG). Tanpa konteks, jawapannya tidak boleh dipercayai.
 */

let activeModel = null;

function baseUrl() {
  const url = new URL(config.brain.ollamaHost);
  return {
    hostname: url.hostname,
    port: url.port || 11434,
    prefix: url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
  };
}

function request(path, { method = 'GET', body, timeout = config.brain.timeout } = {}) {
  const { hostname, port, prefix } = baseUrl();
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname,
        port,
        path: `${prefix}${path}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': payload.length } : {})
        },
        timeout
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(Object.assign(new Error(`ollama ${res.statusCode}: ${data.slice(0, 200)}`), {
              status: res.statusCode
            }));
          }
          try {
            return resolve(JSON.parse(data));
          } catch {
            return resolve(data);
          }
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('ollama timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function availableModels() {
  const result = await request('/api/tags', { timeout: 5000 });
  return (result?.models || []).map((model) => ({
    name: model.name,
    sizeMb: Math.round((model.size || 0) / 1048576),
    family: model.details?.family || null,
    parameters: model.details?.parameter_size || null
  }));
}

async function pickModel() {
  const installed = await availableModels();
  const names = installed.map((model) => model.name);

  for (const candidate of config.brain.chain) {
    if (names.includes(candidate)) {
      activeModel = candidate;
      return activeModel;
    }
  }
  throw new Error(`No model in LLM_CHAIN / ${config.brain.chain.join(', ')}. Available: ${names.join(', ') || '(none)'}`);
}

async function generate(prompt, { system, numPredict, temperature, model: forceModel, extraOptions } = {}) {
  const target = forceModel || activeModel || (await pickModel());
  if (!forceModel) activeModel = target;

  const body = {
    model: target,
    prompt,
    stream: false,
    options: {
      num_predict: numPredict ?? config.brain.maxTokens,
      temperature: temperature ?? config.brain.temperature,
      top_p: config.brain.topP,
      num_ctx: config.brain.contextWindow,
      ...(config.brain.seed ? { seed: config.brain.seed } : {}),
      ...(extraOptions || {})
    }
  };
  if (system) body.system = system;

  const result = await request('/api/generate', {
    method: 'POST',
    body,
    timeout: config.brain.timeout
  });
  result._model = target;
  return result;
}

async function health() {
  try {
    const models = await availableModels();
    return {
      online: true,
      model: activeModel,
      models,
      wanted: config.brain.chain,
      satisfied: config.brain.chain.some((name) => models.some((m) => m.name === name))
    };
  } catch (error) {
    return { online: false, model: null, error: error.message };
  }
}

function currentModel() {
  return activeModel || config.brain.chain[0];
}

module.exports = { generate, health, availableModels, pickModel, currentModel };