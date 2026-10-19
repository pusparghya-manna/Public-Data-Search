const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

// ============ HARDCODED SESSION COOKIES (update when they expire) ============
const COOKIES = [
  'PHPSESSID=5rsrq4dqnpsueauoimrt74hc7m',
  'cf_clearance=0Q_SZIfTLTPtE4eCSn2EMYIt_jz.OWu8IvtCR7HfYZo-1792424594-1.2.1.1-uLIwo3a.HpcOml72uxtSFdQXxvUzCNt7hwUAkvIaXAFP715dpGOspBhPPPdOb6pfeP3kHD1BezERwwsQkGLJas8l2uOXQC4LCsIVaQV4cT4JMijq8cgoFQ.wiDqOuUDuRh3aND2aeTzQnTuc8rOxW3gZPr9QkGCE_eh28scQ3lS6dAhxlJVtVnC2F4mqf5E8BHNmJtfo3334pD03j2gp_1WhNjelzLNR8zHTurSRvB2BWnUs8ieBn5RpHev8kDEoKO1_u7jFSl4YnLO3ZzGR8epQ4CfzZFKobX.6guNeIPsctUNGqzUOcVPjQVba1WPcy3IuUj8adRZSjiJ_xLIw4Z_MYOdkqpbYJT_p8AHGtM9SPohUZ8pjmXwalyCqzSpV3ikSVCRHUH5ynX0n.UpsXdSogtNhFHDt5RAGCTXd84PaQKlikbSTUSd_dEosa5Q3sUyIOxkR.mZT61oF7FQdOw',
  'sid=268ccee3dee0b202df958f069d2eab9687a7e4eed406a66a2eda56393bc11dbd'
].join('; ');

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
  if (val == null) return null;
  // Replace black rectangle (█) and other common mask chars with *
  return String(val)
    .replace(/\u2588/g, '*')
    .replace(/█/g, '*')
    .replace(/■/g, '*')
    .replace(/▢/g, '*');
}

function normalizePhone(input) {
  if (!input) return null;
  let s = String(input).trim();
  // If only digits and length 10, prefix +91
  if (/^\d{10}$/.test(s)) {
    return `+91 ${s}`;
  }
  // Already has +91
  if (s.startsWith('+91')) return s;
  // Has 91 prefix without +
  if (/^91\d{10}$/.test(s)) return `+${s.slice(0, 2)} ${s.slice(2)}`;
  return s;
}

async function doSearch(query) {
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

  // Find HiTeckGroop / HiTechGroop block
  const hiteck = blocks.find(b => {
    const t = (b.title || '').toLowerCase();
    return t.includes('hiteck') || t.includes('hitech');
  });

  if (!hiteck) {
    return { count: 0, results: [], message: 'No HiTeckGroop.in data found for this query' };
  }

  const groups = hiteck.groups_normalized || [];
  const results = [];

  for (const group of groups) {
    const fields = group.fields || [];
    if (fields.length === 0) continue; // skip description-only groups

    // Collect fields into a map (handle multiple telephones)
    const map = {};
    const phones = [];

    for (const f of fields) {
      const key = (f.key || '').toLowerCase();
      const val = maskValue(f.value);

      if (key === 'telephone' || key === 'phone' || key === 'mobile') {
        if (val) phones.push(val);
      } else if (key === 'full_name' || key === 'name') {
        map.name = val;
      } else if (key === 'name_of_the_father' || key === 'fname' || key === 'father_name') {
        map.fname = val;
      } else if (key === 'adres' || key === 'address' || key === 'addr') {
        map.address = val;
      } else if (key === 'email') {
        map.email = val;
      } else if (key === '_region' || key === 'region' || key === 'circle') {
        map.circle = val;
      } else if (key === 'document_number' || key === 'passport_number' || key === 'id') {
        map.document = val;
      } else {
        // keep extras in raw later
        map[key] = val;
      }
    }

    // Prefer the phone that matches the searched number if possible, else first
    let mobile = phones[0] || null;
    if (phones.length > 1) {
      // keep first as primary
      mobile = phones[0];
    }

    // Generate stable-ish ids from content
    const seed = `${map.name || ''}|${mobile || ''}|${map.address || ''}|${group.index}`;
    const hash = simpleHash(seed);

    const row = {
      row_id: String(hash % 2000000000),
      _id: hash.toString(16).padStart(24, '0').slice(0, 24),
      mobile: mobile,
      name: map.name || null,
      fname: map.fname || null,
      address: map.address || null,
      alt: phones.length > 1 ? phones.slice(1).join(', ') : null,
      circle: map.circle || null,
      id: map.document || String(hash % 1000000000000),
      email: map.email || null,
      raw: {
        id: map.document || String(hash % 1000000000000),
        _id: { $oid: hash.toString(16).padStart(24, '0').slice(0, 24) },
        name: map.name || null,
        circle: map.circle || null,
        mobile: mobile,
        address: map.address || null,
        fname: map.fname || null,
        email: map.email || null,
        document: map.document || null,
        group_index: group.index,
        source: 'HiTeckGroop.in'
      }
    };

    results.push(row);
  }

  return {
    count: results.length,
    results
  };
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
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

  // Health
  if (url.pathname === '/' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      message: 'Public Data Search API (HiTeckGroop filter)',
      usage: {
        'GET /search?number=9635592709': 'Auto +91 prefix, returns only HiTeckGroop.in results',
        'GET /search?q=+91%209635592709': 'Same',
        'POST /search': 'Body: { "query": "+91 9635592709" } or { "number": "9635592709" }'
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
        // Prefer ?number= then ?q= / ?query=
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

      // Normalize: if 10-digit number, turn into +91 XXXXXXXXXX
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

server.listen(PORT, () => {
  console.log(`Public Data Search API listening on port ${PORT}`);
});
