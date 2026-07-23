const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const dist = path.join(projectRoot, 'dist');

if (!fs.existsSync(dist)) {
  throw new Error('dist is missing. Run the build before syncing public files.');
}

for (const entry of fs.readdirSync(dist)) {
  fs.cpSync(path.join(dist, entry), path.join(projectRoot, entry), {
    recursive: true,
    force: true
  });
}

console.log('synced public files from dist');
