'use strict';
/* Produces electron/app/ from the single-file index.html at the repo root,
   with the native shim injected ahead of the app script. */
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT  = path.join(__dirname, 'app');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// the web page's manifest, worker and icons do not exist beside the app copy
html = html.replace(/\n?[ \t]*<link rel="manifest"[^>]*>/g, '')
           .replace(/\n?[ \t]*<link rel="apple-touch-icon"[^>]*>/g, '');

const tag = '<script src="./shim.js"></script>';
if (!html.includes('</head>')) throw new Error('index.html has no </head>');
html = html.replace('</head>', tag + '\n</head>');

fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.copyFileSync(path.join(__dirname, 'shim.js'), path.join(OUT, 'shim.js'));

console.log('built electron/app/index.html  (%d KB) + shim.js', Math.round(Buffer.byteLength(html) / 1024));
