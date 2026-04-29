import { createServer }   from 'node:http';
import { createHash }     from 'node:crypto';
import { readFileSync }   from 'node:fs';
import { fileURLToPath }  from 'node:url';
import { join, dirname }  from 'node:path';

import express   from 'express';
import cors      from 'cors';
import rateLimit from 'express-rate-limit';

const __dir = dirname(fileURLToPath(import.meta.url));

/* ── Carrega .env ── */
try {
  for (const line of readFileSync(join(__dir, '.env'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  }
} catch { /* .env opcional — usa vars do sistema */ }

const {
  PORT             = '3001',
  META_API_VERSION = 'v22.0',
} = process.env;

/* ── Carrega clients.json ──
   Formato: [{ slug, pixel_id, token, origins?, test_event_code? }]
   Adicionar novo cliente: inserir objeto no array e reiniciar o container. */
let rawClients;
try {
  rawClients = JSON.parse(readFileSync(join(__dir, 'clients.json'), 'utf8'));
} catch (err) {
  console.error('[FATAL] clients.json não encontrado ou inválido:', err.message);
  process.exit(1);
}

const clientMap = new Map();
for (const c of rawClients) {
  const { slug, pixel_id, token, origins = '', test_event_code = '' } = c;
  if (!slug || !pixel_id || !token) {
    console.warn(`[WARN] cliente ignorado (slug/pixel_id/token ausente):`, c.slug ?? '?');
    continue;
  }
  clientMap.set(slug, {
    pixel_id,
    token,
    test_event_code,
    origins: origins.split(',').map(o => o.trim()).filter(Boolean),
    capiUrl: `https://graph.facebook.com/${META_API_VERSION}/${pixel_id}/events`,
  });
  console.log(`[CAPI] cliente: ${slug}  pixel: ${pixel_id}`);
}

if (clientMap.size === 0) {
  console.error('[FATAL] nenhum cliente válido em clients.json');
  process.exit(1);
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

function sha256(v) {
  if (v === null || v === undefined || v === '') return null;
  return createHash('sha256').update(String(v).toLowerCase().trim()).digest('hex');
}

function normalizePhone(raw) {
  const d = raw.replace(/\D/g, '');
  return (d.length === 10 || d.length === 11) ? '55' + d : d;
}

function splitName(nome = '') {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  return { fn: parts[0] || null, ln: parts.slice(1).join(' ') || null };
}

function getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.ip || ''
  ).trim();
}

function buildUserData(body, req) {
  const { nome, telefone, email, fbp, fbc, client_user_agent } = body;
  const { fn, ln } = splitName(nome);
  const ud = {
    client_ip_address: getClientIp(req),
    client_user_agent: client_user_agent || req.headers['user-agent'] || '',
    country:           [sha256('br')],
  };
  if (telefone) ud.ph  = [sha256(normalizePhone(telefone))];
  if (fn)       ud.fn  = [sha256(fn)];
  if (ln)       ud.ln  = [sha256(ln)];
  if (email)    ud.em  = [sha256(email)];
  if (fbp)      ud.fbp = fbp;
  if (fbc)      ud.fbc = fbc;
  return ud;
}

function buildCustomData(body) {
  const { utm_source, utm_medium, utm_campaign, utm_content, utm_term, pagina, variant } = body;
  const cd = {};
  if (utm_source)   cd.utm_source   = utm_source;
  if (utm_medium)   cd.utm_medium   = utm_medium;
  if (utm_campaign) cd.utm_campaign = utm_campaign;
  if (utm_content)  cd.utm_content  = utm_content;
  if (utm_term)     cd.utm_term     = utm_term;
  if (pagina)       cd.pagina       = pagina;
  if (variant)      cd.variant      = variant;
  return Object.keys(cd).length ? cd : null;
}

async function sendToMeta(client, events) {
  const body = { data: events, access_token: client.token };
  if (client.test_event_code) body.test_event_code = client.test_event_code;

  const res  = await fetch(client.capiUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error('Meta CAPI error');
    err.status = res.status;
    err.detail = json;
    throw err;
  }
  return json;
}

const ALLOWED_EVENTS = new Set(['PageView', 'ViewContent', 'Contact', 'FormStart', 'Lead']);

function buildEvent(body, req) {
  const { event_name, event_id, event_time, event_source_url } = body;
  const cd = buildCustomData(body);
  return {
    event_name,
    event_time:       event_time || Math.floor(Date.now() / 1000),
    event_id,
    event_source_url: event_source_url || '',
    action_source:    'website',
    user_data:        buildUserData(body, req),
    ...(cd && { custom_data: cd }),
  };
}

/* ══════════════════════════════════════════
   EXPRESS
══════════════════════════════════════════ */

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb' }));

/* Rate limit: 30 req/min por IP × slug */
const limiter = rateLimit({
  windowMs:       60_000,
  max:            30,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'too_many_requests' },
  keyGenerator:   req => `${req.params.slug ?? 'global'}_${req.ip}`,
});
app.use('/api/:slug', limiter);

/* CORS dinâmico por slug */
app.use('/api/:slug', (req, res, next) => {
  const client = clientMap.get(req.params.slug);
  if (!client) return next();

  const origin  = req.headers.origin || '';
  const allowed = client.origins;

  if (!allowed.length || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ── Middleware: resolve cliente pelo slug ── */
function resolveClient(req, res, next) {
  const client = clientMap.get(req.params.slug);
  if (!client) return res.status(404).json({ error: 'cliente não encontrado' });
  req.capiClient = client;
  next();
}

/* ══════════════════════════════════════════
   ROTAS
══════════════════════════════════════════ */

/**
 * POST /api/:slug/event
 * Evento único. O browser envia; o servidor faz hashing e encaminha para a Meta.
 */
app.post('/api/:slug/event', resolveClient, async (req, res) => {
  const { event_name, event_id } = req.body;

  if (!event_name || !ALLOWED_EVENTS.has(event_name))
    return res.status(400).json({ error: 'event_name inválido' });
  if (!event_id)
    return res.status(400).json({ error: 'event_id obrigatório' });

  try {
    const result = await sendToMeta(req.capiClient, [buildEvent(req.body, req)]);
    return res.json({ ok: true, events_received: result.events_received ?? 0 });
  } catch (err) {
    console.error(`[CAPI ${req.params.slug}]`, err.message, JSON.stringify(err.detail ?? {}));
    return res.status(502).json({ error: 'upstream_error' });
  }
});

/**
 * POST /api/:slug/events/batch
 * Lote de até 1 000 eventos (limite da Meta por chamada).
 */
app.post('/api/:slug/events/batch', resolveClient, async (req, res) => {
  const { events: raw } = req.body;

  if (!Array.isArray(raw) || raw.length === 0)
    return res.status(400).json({ error: 'events deve ser array não vazio' });
  if (raw.length > 1000)
    return res.status(400).json({ error: 'máximo 1000 eventos por lote' });

  const events = raw
    .filter(e => ALLOWED_EVENTS.has(e.event_name) && e.event_id)
    .map(e => buildEvent(e, req));

  if (!events.length)
    return res.status(400).json({ error: 'nenhum evento válido no lote' });

  try {
    const result = await sendToMeta(req.capiClient, events);
    return res.json({ ok: true, events_received: result.events_received ?? 0 });
  } catch (err) {
    console.error(`[CAPI batch ${req.params.slug}]`, err.message);
    return res.status(502).json({ error: 'upstream_error' });
  }
});

/**
 * GET /api/:slug/health
 * Health check por cliente.
 */
app.get('/api/:slug/health', resolveClient, (req, res) => {
  const c = req.capiClient;
  res.json({
    ok:        true,
    slug:      req.params.slug,
    pixel_id:  c.pixel_id,
    api_ver:   META_API_VERSION,
    test_mode: !!c.test_event_code,
    ts:        Date.now(),
  });
});

/**
 * GET /health
 * Health check global — lista todos os slugs ativos.
 */
app.get('/health', (_req, res) => {
  res.json({ ok: true, clients: [...clientMap.keys()], ts: Date.now() });
});

/* ══════════════════════════════════════════
   START
══════════════════════════════════════════ */

createServer(app).listen(Number(PORT), () => {
  console.log(`[CAPI] porta ${PORT}  clientes: ${[...clientMap.keys()].join(', ')}`);
});
