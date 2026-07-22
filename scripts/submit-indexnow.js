const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'data', 'indexnow.json'), 'utf8'));
const sitemapPath = fs.existsSync(path.join(root, 'dist', 'sitemap.xml'))
  ? path.join(root, 'dist', 'sitemap.xml')
  : path.join(root, 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const keyLocation = `https://${config.host}/${config.key}.txt`;
const deploymentStatus = JSON.parse(fs.readFileSync(path.join(path.dirname(sitemapPath), 'deploy-status.json'), 'utf8'));
const waitAttempts = Number(process.env.INDEXNOW_WAIT_ATTEMPTS || 60);
const waitMilliseconds = Number(process.env.INDEXNOW_WAIT_MS || 10000);

if (!/^[A-Za-z0-9-]{8,128}$/.test(config.key || '')) throw new Error('IndexNow key format is invalid.');
if (!config.host || !config.endpoint) throw new Error('IndexNow configuration is incomplete.');
if (!urls.length || urls.length > 10000) throw new Error(`IndexNow URL count is invalid: ${urls.length}`);
if (!deploymentStatus.buildId || !/^[a-f0-9]{64}$/.test(deploymentStatus.sitemapSha256 || '')) throw new Error('Deployment status is invalid.');
if (!Number.isInteger(waitAttempts) || waitAttempts < 1 || !Number.isFinite(waitMilliseconds) || waitMilliseconds < 0) throw new Error('IndexNow wait configuration is invalid.');
for (const url of urls) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== config.host) throw new Error(`IndexNow URL is outside the configured host: ${url}`);
}

async function waitForPublishedBuild() {
  const statusLocation = `https://${config.host}/deploy-status.json`;
  for (let attempt = 1; attempt <= waitAttempts; attempt += 1) {
    try {
      const response = await fetch(`${statusLocation}?v=${Date.now()}`, {
        headers: { 'user-agent': 'jigyousho-bousai-indexnow/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        const live = await response.json();
        if (live.buildId === deploymentStatus.buildId && live.sitemapSha256 === deploymentStatus.sitemapSha256) return;
      }
    } catch (_) {
      // GitHub Pages may still be publishing. Retry below.
    }
    if (attempt < waitAttempts) await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
  }
  throw new Error(`Published build did not match ${deploymentStatus.buildId} at ${statusLocation}`);
}

async function verifyKey() {
  const response = await fetch(`${keyLocation}?v=${Date.now()}`, {
    headers: { 'user-agent': 'jigyousho-bousai-indexnow/1.0' },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok || (await response.text()).trim() !== config.key) throw new Error(`IndexNow key file was not available at ${keyLocation}`);
}

async function submit() {
  await waitForPublishedBuild();
  await verifyKey();
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', 'user-agent': 'jigyousho-bousai-indexnow/1.0' },
    body: JSON.stringify({ host: config.host, key: config.key, keyLocation, urlList: urls }),
    signal: AbortSignal.timeout(20000)
  });
  if (![200, 202].includes(response.status)) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(`IndexNow submission failed (${response.status}): ${body}`);
  }
  console.log(`IndexNow accepted ${urls.length} URLs with status ${response.status}.`);
}

submit().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
