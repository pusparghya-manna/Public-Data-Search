# Public-data-search

Zero-dependency Node.js API that searches niamonx breaches and returns **only HiTeckGroop.in** records.

## Usage

```
GET /search?number=9635592709
```

Automatically searches `+91 9635592709` and returns a clean array.

Also supported:
- `GET /search?q=+91%209635592709`
- `POST /search` with body `{ "number": "9635592709" }` or `{ "query": "+91 9635592709" }`

## Response format

```json
[
  {
    "number": "string",
    "name": "string",
    "fname": "string",
    "address": "string",
    "id": "string",
    "email": "string"
  }
]
```

- Multiple telephones → `number` becomes an array of strings
- `█` characters are replaced with `*`
- REGION and record labels are removed
- Missing values are `null`

## Deploy on Railway

1. Connect this GitHub repo to Railway
2. Deploy (Railway runs `npm start` automatically)
3. **Set the environment variable** (required):

| Variable | Value |
|----------|-------|
| `COOKIES` | Your full cookie string (see below) |

In Railway: Project → Variables → Add Variable → Name: `COOKIES`

Example value:
```
PHPSESSID=xxxxx; cf_clearance=yyyyy; sid=zzzzz
```

4. Redeploy after setting the variable

## How to get the cookies

1. Open https://dash.niamonx.io/breaches_search in your browser and log in
2. Open Developer Tools (F12 or long-press → Inspect)
3. Go to the **Network** tab
4. Perform any search on the page
5. Click the request named `breaches_search`
6. In **Request Headers**, find the `Cookie:` line
7. Copy the entire cookie value (it usually contains `PHPSESSID=...`, `cf_clearance=...`, and `sid=...`)
8. Paste that full string as the `COOKIES` environment variable on Railway

Cookies expire. When searches start failing with auth errors, repeat the steps above and update the variable.
