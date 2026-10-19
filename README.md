# Public-data-search

Zero-dependency Node.js proxy that searches `dash.niamonx.io/breaches_search` and returns **only HiTeckGroop.in** results in a clean JSON shape.

## Deploy on Railway

1. Connect this GitHub repo to Railway
2. Deploy (Railway runs `npm start` automatically)
3. Use the public URL

## Usage

```
GET /search?number=9635592709
```

This automatically becomes an internal search for `+91 9635592709` and returns only HiTeckGroop.in records.

Also supported:
- `GET /search?q=+91%209635592709`
- `POST /search` with body `{ "number": "9635592709" }` or `{ "query": "+91 9635592709" }`

## Example response

```json
{
  "count": 3,
  "results": [
    {
      "row_id": "336087181",
      "_id": "00000000000000001408488d",
      "mobile": "9*********09",
      "name": "T***k C*****a P***a",
      "fname": "K*****************a",
      "address": "*** T**** C****** P********************************** B************",
      "alt": null,
      "circle": "J****B",
      "id": "2**********5",
      "email": null,
      "raw": { ... }
    }
  ]
}
```

- Sensitive characters are shown as `*`
- `fname` = name of the father
- Multiple records appear as separate objects in `results`

## Updating cookies

When the session expires, edit the `COOKIES` array in `server.js` with fresh values from your browser.
