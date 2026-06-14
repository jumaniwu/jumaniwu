# BRICKX Admin Panel — separate, protected deployment

This panel is deployed as its **own Vercel project**, isolated from the public
site, so its URL is not part of the main frontend and not guessable from it.

## Deploy
1. Vercel → **New Project** → import this repo.
2. **Root Directory: `brickx/admin`** (serves `index.html` at `/`).
3. Deploy. You get a `*.vercel.app` URL that works immediately (no DNS needed).

## Lock it down (two layers)
1. **Vercel → Settings → Deployment Protection → Password Protection: ON.**
   Anyone hitting the URL must enter the Vercel password first.
2. The panel itself still requires login with an `is_admin` account (JWT).

## Optional private custom domain
- Namecheap → Advanced DNS → CNAME: Host = `<your-secret-name>`, Value = `cname.vercel-dns.com`
- Vercel → this project → Settings → Domains → add `<your-secret-name>.brickxprotocol.io`
- Pick an unguessable name and keep it out of any public document.

## Notes
- The panel talks to the API via `window.BRICKX_API_URL` (defaults to
  `https://api.brickxprotocol.io`), so it works from any domain.
- No secrets live here — all keys stay in the backend (Railway) env.
- `noindex, nofollow` is set so search engines never list it.
