# Public-data-search

Zero-dependency Node.js API that searches niamonx breaches and returns **only HiTeckGroop.in** records.

## Usage

```
GET /search?number=9635592709
```

Automatically searches `+91 9635592709` and returns a clean array.

## Response format

```json
[
  {
    "number": "9*********09",
    "name": "T***k C*****a P***a",
    "fname": "K*****************a",
    "address": "*** T**** C****** ...",
    "id": "2**********5",
    "email": null
  },
  {
    "number": ["7*******76", "9*********09"],
    "name": "...",
    "fname": "...",
    "address": "...",
    "id": "...",
    "email": "s*****@****m"
  }
]
```

### Field mapping
| Source              | Output   |
|---------------------|----------|
| TELEPHONE           | number   |
| FULL NAME           | name     |
| THE NAME OF THE FATHER | fname |
| ADRES               | address  |
| PASSPORT / DOCUMENT | id       |
| EMAIL               | email    |

- Multiple telephones → `number` becomes an array
- `█` is replaced with `*`
- REGION and record labels are removed

## Deploy
Connect this repo to Railway → Deploy. No env vars needed.
