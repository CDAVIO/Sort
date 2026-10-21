'use strict';
/* electron-builder rewrites the .app after Electron's own ad-hoc signature was
   applied — renaming the binary, adding resources — which leaves that signature
   invalid. macOS on Apple Silicon reads a broken signature as a damaged app and
   refuses to open it at all, with no way past the dialog.
   Re-signing ad-hoc here, before the dmg is built, restores a valid signature.
   It is still not a Developer ID, so Gatekeeper asks on first launch — but
   right-click -> Open now works instead of being refused outright. */
const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const app = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  console.log('  • ad-hoc signing  ' + app);
  execFileSync('codesign', [
    '--force', '--deep', '--sign', '-', '--timestamp=none', app
  ], { stdio: 'inherit' });

  // fail the build here rather than ship something that cannot open
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
  console.log('  • signature verified');
};
