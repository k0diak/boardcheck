// Scheduled production monitor. Runs the same checks as the post-deploy smoke test against
// production; on failure it opens (or updates) an `incident` issue, which the triage agent picks up —
// closing the loop from Monitor back to Plan.
import { check } from './smoke.mjs'

const url = process.env.PRODUCTION_URL
const { health, problems } = await check(url)
console.log(JSON.stringify({ url, version: health?.version, problems }, null, 1))
if (!problems.length) process.exit(0)

const token = process.env.GITLAB_BOT_TOKEN
if (token) {
  const api = `${process.env.CI_API_V4_URL}/projects/${process.env.CI_PROJECT_ID}`
  const H = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }
  const open = await fetch(`${api}/issues?state=opened&labels=incident&per_page=1`, { headers: H }).then((r) => r.json())
  const body = `Production check failed at ${new Date().toISOString()} (pipeline ${process.env.CI_PIPELINE_URL}):\n\n${problems.map((p) => `- ${p}`).join('\n')}`
  if (open.length) await fetch(`${api}/issues/${open[0].iid}/notes`, { method: 'POST', headers: H, body: JSON.stringify({ body }) })
  else await fetch(`${api}/issues`, { method: 'POST', headers: H, body: JSON.stringify({ title: `Incident: production check failing`, description: body, labels: 'incident,triage' }) })
}
process.exit(1)
