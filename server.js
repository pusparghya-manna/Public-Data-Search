const http = require('http');
const { URL } = require('url');

// Railway injects PORT automatically — do NOT hardcode 3000 in Railway settings
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Cookies must be set via environment variable COOKIES
const COOKIES = process.env.COOKIES || '';

const TARGET_URL = 'https://dash.niamonx.io/breaches_search';

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function maskValue(val) {
  if (val == null || val === '') return null;
  return String(val)
    .replace(/\u2588/g, '*')
    .replace(/█/g, '*')
    .replace(/■/g, '*')
    .replace(/▢/g, '*');
}

function normalizePhone(input) {
  if (!input) return null;
  let s = String(input).trim();
  if (/^\d{10}$/.test(s)) return `+91 ${s}`;
  if (s.startsWith('+91')) return s;
  if (/^91\d{10}$/.test(s)) return `+${s.slice(0, 2)} ${s.slice(2)}`;
  return s;
}

async function doSearch(query) {
  if (!COOKIES) {
    throw new Error('COOKIES environment variable is not set. See README for how to get and set cookies.');
  }

  const payload = JSON.stringify({ action: 'search', query });

  const response = await fetch(TARGET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Origin': 'https://dash.niamonx.io',
      'Referer': 'https://dash.niamonx.io/breaches_search',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': COOKIES
    },
    body: payload
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upstream ${response.status}: ${text.slice(0, 400)}`);
  }

  return response.json();
}

function extractHiTeckResults(upstream) {
  const result = upstream?.result || upstream;
  const blocks = result?.blocks || [];

  const hiteck = blocks.find(b => {
    const t = (b.title || '').toLowerCase();
    return t.includes('hiteck') || t.includes('hitech');
  });

  if (!hiteck) return [];

  const groups = hiteck.groups_normalized || [];
  const results = [];

  for (const group of groups) {
    const fields = group.fields || [];
    if (fields.length === 0) continue;

    const phones = [];
    let name = null;
    let fname = null;
    let address = null;
    let id = null;
    let email = null;

    for (const f of fields) {
      const key = (f.key || '').toLowerCase().trim();
      const val = maskValue(f.value);

      if (val == null) continue;

      if (key === 'telephone' || key === 'phone' || key === 'mobile') {
        phones.push(val);
      } else if (key === 'full_name' || key === 'name') {
        name = val;
      } else if (key === 'name_of_the_father' || key === 'fname' || key === 'father_name') {
        fname = val;
      } else if (key === 'adres' || key === 'address' || key === 'addr') {
        address = val;
      } else if (key === 'passport_number' || key === 'document_number' || key === 'id') {
        if (id == null) id = val;
      } else if (key === 'email') {
        email = val;
      }
    }

    let number = null;
    if (phones.length === 1) number = phones[0];
    else if (phones.length > 1) number = phones;

    if (number == null && name == null && fname == null && address == null && id == null && email == null) {
      continue;
    }

    results.push({
      number: number,
      name: name,
      fname: fname,
      address: address,
      id: id,
      email: email
    });
  }

  return results;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      message: 'Public Data Search API (HiTeckGroop only)',
      cookies_set: Boolean(COOKIES),
      usage: {
        'GET /search?number=9635592709': 'Auto +91, returns array of HiTeckGroop records',
        'GET /search?q=+91%209635592709': 'Same',
        'POST /search': '{ "number": "9635592709" } or { "query": "+91 9635592709" }'
      }
    });
  }

  if (url.pathname === '/search') {
    try {
      let query = null;

      if (req.method === 'POST') {
        const body = await parseBody(req);
        query = body.query || body.q || body.number;
      } else if (req.method === 'GET') {
        query = url.searchParams.get('number')
          || url.searchParams.get('q')
          || url.searchParams.get('query');
      } else {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }

      if (!query || typeof query !== 'string' || !query.trim()) {
        return sendJson(res, 400, {
          error: 'Missing parameter. Use ?number=9635592709 or ?q=+91 9635592709'
        });
      }

      const normalized = normalizePhone(query.trim());
      const upstream = await doSearch(normalized);
      const shaped = extractHiTeckResults(upstream);

      return sendJson(res, 200, shaped);
    } catch (err) {
      console.error('Search error:', err.message);
      return sendJson(res, 500, { error: err.message || 'Internal error' });
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Public Data Search API listening on http://${HOST}:${PORT}`);
  if (!COOKIES) {
    console.warn('WARNING: COOKIES env var is not set. /search will fail until you set it.');
  }
});
