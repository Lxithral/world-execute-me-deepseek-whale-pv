// usage: node fetch2.cjs <url> <outfile>
const fs = require('fs');
const url = process.argv[2];
const out = process.argv[3];
(async () => {
  const r = await fetch(url, { signal: AbortSignal.timeout(180000), redirect: 'follow', headers: { 'user-agent': 'dsh-install' } });
  if (!r.ok) { console.log('HTTP', r.status, url); process.exit(1); }
  const b = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(out, b);
  console.log('SAVED', b.length, 'from', url);
})().catch(e => { console.log('ERR', e.name, e.message); process.exit(1); });
