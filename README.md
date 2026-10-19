# Breaches Search API

Simple zero-dependency proxy for `https://dash.niamonx.io/breaches_search`.

## Deploy on Railway

1. Create a new project on Railway
2. Deploy from this folder (or push to a GitHub repo and connect it)
3. Railway will auto-detect Node and run `npm start`
4. Your public URL will be something like `https://your-app.up.railway.app`

No environment variables needed (cookies are hardcoded).

## Usage

### POST /search
```bash
curl -X POST https://YOUR-RAILWAY-URL/search \
  -H "Content-Type: application/json" \
  -d '{"query": "+91 9635592709"}'
```

### GET /search
```bash
curl "https://YOUR-RAILWAY-URL/search?q=+91%209635592709"
```

### Health
```bash
curl https://YOUR-RAILWAY-URL/
```

## Updating cookies

When the session expires (you get auth errors), open `server.js` and replace the three cookie values in the `COOKIES` array with fresh ones from your browser.

## Notes

- Uses the exact headers + cookies you provided
- Returns the upstream JSON as-is
- Preview mode / plan limits come from the upstream site
