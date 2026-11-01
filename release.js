#!/usr/bin/env node
'use strict';
/* One command, one zip.

     node release.js            build the apps, then the site, then the zip
     node release.js --no-build reuse the installers already in electron/dist

   The version comes from electron/package.json. The zip in release/ is the
   whole site: drop it on Netlify (Deploys, drag and drop) and the website, the
   download buttons, the Terminal installers and every installed SORT that
   checks for updates all move to the new version together. */

const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = __dirname;
const EL = path.join(ROOT, 'electron');
const VER = require(path.join(EL, 'package.json')).version;
const OUT = path.join(ROOT, 'release');
const SITE = path.join(OUT, 'site');
const ZIP = path.join(OUT, `SORT-${VER}-netlify.zip`);
const run = (cmd, cwd = ROOT, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
const say = t => console.log('\n\x1b[1;33m› ' + t + '\x1b[0m');

// installers as electron-builder names them, and the plain names the site serves
const FILES = {
  'mac-arm':      [`SORT-${VER}-arm64.dmg`,     `SORT-${VER}-mac-arm64.dmg`],
  'mac-intel':    [`SORT-${VER}.dmg`,           `SORT-${VER}-mac-intel.dmg`],
  'win':          [`SORT Setup ${VER}.exe`,     `SORT-${VER}-windows-setup.exe`],
  'win-portable': [`SORT ${VER}.exe`,           `SORT-${VER}-windows-portable.exe`]
};
const WEB = ['index.html', '404.html', 'privacy.html', 'terms.html', 'legal.html', 'sw.js',
             'robots.txt', 'sitemap.xml', '__forms.html', 'install.sh', 'install.ps1'];

if (!fs.existsSync(path.join(EL, 'node_modules', '.bin', 'electron-builder'))) {
  say('First run: installing the build tools');
  run('npm install --no-audit --no-fund', EL);
}

if (!process.argv.includes('--no-build')) {
  say(`Building SORT ${VER} for macOS (Apple chip + Intel) and Windows (installer + portable)`);
  fs.rmSync(path.join(EL, 'dist'), { recursive: true, force: true });
  run('node build.js', EL);
  // no paid certificate: macOS gets an ad-hoc signature, which Apple chips need to launch it
  run('npx electron-builder --mac --win --publish never', EL, { CSC_IDENTITY_AUTO_DISCOVERY: 'false' });
}

say('Putting the site together');
fs.rmSync(SITE, { recursive: true, force: true });
fs.mkdirSync(path.join(SITE, 'download'), { recursive: true });
for (const f of WEB) fs.copyFileSync(path.join(ROOT, f), path.join(SITE, f));
fs.cpSync(path.join(ROOT, 'icons'), path.join(SITE, 'icons'), { recursive: true });
if (fs.existsSync(path.join(ROOT, 'readme'))) fs.cpSync(path.join(ROOT, 'readme'), path.join(SITE, 'readme'), { recursive: true });

// the page knows its own version before latest.json arrives
const short = VER.split('.').slice(0, 2).join('.');
let html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8')
  .replace(/const KNOWN_VER='[^']*'/, `const KNOWN_VER='${VER}'`)
  .replace(/(<span id="relV">)[^<]*/, `$1${short}`)
  .replace(/(<span id="heroV">)[^<]*/, `$1${short}`);
fs.writeFileSync(path.join(SITE, 'index.html'), html);
// a new worker cache name, so installed copies of the site refresh
const sw = path.join(SITE, 'sw.js');
fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/const CACHE = '[^']*'/, `const CACHE = 'sort-${VER}'`));

const manifest = { version: VER, date: new Date().toISOString().slice(0, 10), files: {} };
for (const [key, [built, served]] of Object.entries(FILES)) {
  const src = path.join(EL, 'dist', built);
  if (!fs.existsSync(src)) throw new Error(`missing ${built} in electron/dist. Run without --no-build.`);
  const dst = path.join(SITE, 'download', served);
  fs.copyFileSync(src, dst);
  const buf = fs.readFileSync(dst);
  manifest.files[key] = { name: served, size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
  console.log(`  ${served}  ${(buf.length / 1048576).toFixed(1)} MB`);
}
fs.writeFileSync(path.join(SITE, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');

// Netlify reads _headers from the uploaded folder: no build step is needed
fs.writeFileSync(path.join(SITE, '_headers'), `/latest.json
  Cache-Control: no-cache
  Access-Control-Allow-Origin: *

/install.sh
  Content-Type: text/plain; charset=utf-8
  Cache-Control: no-cache

/install.ps1
  Content-Type: text/plain; charset=utf-8
  Cache-Control: no-cache

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/sw.js
  Cache-Control: public, max-age=0, must-revalidate

/download/*
  Cache-Control: public, max-age=31536000, immutable
  Content-Disposition: attachment

/icons/*
  Cache-Control: public, max-age=604800

/readme/*
  Cache-Control: public, max-age=3600
  Access-Control-Allow-Origin: *
`);

say('Zipping');
fs.rmSync(ZIP, { force: true });
run(`zip -r -X -q "${ZIP}" .`, SITE);
console.log(`\n  ${ZIP}\n  ${(fs.statSync(ZIP).size / 1048576).toFixed(0)} MB. Drop it on Netlify: Deploys, then drag and drop.\n`);
