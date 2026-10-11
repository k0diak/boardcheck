// boardcheck service: the static site (docs/) plus a JSON API over the same detector file the site
// and the parity tests use. One algorithm, three consumers — the Python reference stays canonical.
import bc from '../docs/boardcheck.js'

const VERSION = globalThis.BOARDCHECK_VERSION ?? 'dev'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
const json = (o, status = 200) => new Response(JSON.stringify(o, null, 1), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
const MAX_LISTINGS = 5000

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    if (url.pathname === '/api/health') return json({ ok: true, version: env.BOARDCHECK_VERSION ?? VERSION, environment: env.ENVIRONMENT ?? 'unknown' })
    if (url.pathname === '/api/thresholds') return json(bc.THRESHOLDS)

    if (url.pathname === '/api/scan') {
      if (req.method !== 'POST') return json({ error: 'POST a JSON array of listings (or {"listings": [...]})' }, 405)
      let body
      try { body = await req.json() } catch { return json({ error: 'body must be JSON' }, 400) }
      const listings = Array.isArray(body) ? body : body?.listings
      if (!Array.isArray(listings)) return json({ error: 'expected an array of listings' }, 400)
      if (listings.length > MAX_LISTINGS) return json({ error: `at most ${MAX_LISTINGS} listings per scan` }, 413)
      try { return json(bc.scan(listings)) } catch (e) { return json({ error: `scan failed: ${e.message}` }, 422) }
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404)
    return env.ASSETS.fetch(req)
  },
}
