// Stamps toy-town-new.html with a hash of the new town's modules so a browser never mixes a cached old module with new page code.
// The page's import map points every module at `<file>?v=<hash>`; change any module and the hash changes, so the browser fetches fresh copies.
// Run this after editing anything under assets/town2 (the logic test fails if the stamp is stale).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.join(__dirname, '..'), dir = path.join(root, 'assets/town2'), page = path.join(root, 'toy-town-new.html');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort();
const hash = () => { const h = crypto.createHash('sha1'); for (const f of files) { h.update(f); h.update(fs.readFileSync(path.join(dir, f))); } return h.digest('hex').slice(0, 10); };
function stamp() {
  const v = hash(), map = files.filter(f => f !== 'main.mjs').map(f => `  "./assets/town2/${f}":"./assets/town2/${f}?v=${v}"`).join(',\n');
  let html = fs.readFileSync(page, 'utf8');
  html = html.replace(/<script type="importmap"[^>]*>[\s\S]*?<\/script>/, `<script type="importmap" data-stamp="${v}">\n{"imports":{\n  "three":"https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js",\n  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/",\n${map}\n}}\n</script>`);
  html = html.replace(/import\('\.\/assets\/town2\/main\.mjs\?v=[^']*'\)/, `import('./assets/town2/main.mjs?v=${v}')`);
  fs.writeFileSync(page, html); return v;
}
if (require.main === module) console.log('stamped toy-town-new.html with', stamp());
module.exports = {hash, stamp, files};
