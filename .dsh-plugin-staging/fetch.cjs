const fs = require('fs');
const path = require('path');
const out = process.argv[2];
const urls = [
  'https://api.github.com/repos/Ebony-Vinyl/dsh-our-free-model/tarball/main',
  'https://github.com/Ebony-Vinyl/dsh-our-free-model/archive/refs/heads/main.tar.gz',
  'https://ghproxy.net/https://github.com/Ebony-Vinyl/dsh-our-free-model/archive/refs/heads/main.tar.gz'
];
(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(120000), redirect: 'follow', headers: { 'user-agent': 'dsh-install' } });
      if (!r.ok) { console.log('HTTP', r.status, u); continue; }
      const b = Buffer.from(await r.arrayBuffer());
      await fs.promises.writeFile(out, b);
      console.log('SAVED', b.length, 'from', u);
      return;
    } catch (e) { console.log('ERR', e.name, e.message.slice(0, 80), u); }
  }
  console.log('ALL FAILED');
  process.exit(1);
})();
