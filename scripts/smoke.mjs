// Post-deploy smoke test: the deployment is only "done" if the live service answers correctly.
// Usage: node scripts/smoke.mjs <base-url>
import { readFileSync } from 'node:fs'

const bait = JSON.parse(readFileSync(new URL('../examples/sample_listings.json', import.meta.url), 'utf8'))

export async function check(base) {
  const problems = []
  // A fresh deploy can take a few seconds to propagate.
  let health
  for (let i = 0; i < 10 && !health?.ok; i++) {
    health = await fetch(`${base}/api/health`).then((r) => r.json()).catch(() => null)
    if (!health?.ok) await new Promise((r) => setTimeout(r, 3000))
  }
  if (!health?.ok) problems.push('health endpoint not ok')
  const site = await fetch(base).catch(() => null)
  if (!site?.ok) problems.push(`site returned ${site?.status ?? 'no response'}`)
  const scan = await fetch(`${base}/api/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bait) }).then((r) => r.json()).catch(() => null)
  if (scan?.verdict !== 'high_risk') problems.push(`canary scan expected high_risk, got ${scan?.verdict ?? 'no response'}`)
  const clean = await fetch(`${base}/api/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' }).then((r) => r.json()).catch(() => null)
  if (clean?.verdict !== 'clear') problems.push(`empty scan expected clear, got ${clean?.verdict ?? 'no response'}`)
  return { health, problems }
}

if (process.argv[1]?.endsWith('smoke.mjs')) {
  const base = process.argv[2]
  if (!base) { console.error('usage: smoke.mjs <url>'); process.exit(2) }
  const { health, problems } = await check(base)
  console.log(JSON.stringify({ base, version: health?.version, problems }, null, 1))
  process.exit(problems.length ? 1 : 0)
}
