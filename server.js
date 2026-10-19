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
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) reject(new Error('Body too large')); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Health / info
  if (url.pathname === '/' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      message: 'Breaches Search API is running',
      endpoints: {
        'POST /search': 'Body: { "query": "+91 9635592709" }',
        'GET /search?q=...': 'Same search via query string'
      }
    });
  }

  // Search endpoints
  if (url.pathname === '/search') {
    try {
      let query = null;

      if (req.method === 'POST') {
        const body = await parseBody(req);
        query = body.query || body.q;
      } else if (req.method === 'GET') {
        query = url.searchParams.get('q') || url.searchParams.get('query');
      } else {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }

      if (!query || typeof query !== 'string' || !query.trim()) {
        return sendJson(res, 400, { error: 'Missing or empty "query" (or "q")' });
      }

      const result = await doSearch(query.trim());
      return sendJson(res, 200, result);
    } catch (err) {
      console.error('Search error:', err.message);
      return sendJson(res, 500, { error: err.message || 'Internal error' });
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Breaches Search API listening on port ${PORT}`);
});
