import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const chromePath = process.platform === 'win32'
  ? path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
  : 'google-chrome';
const port = 9337;
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'bcp-browser-check-'));
const screenshotDir = path.join(projectRoot, 'artifacts', 'browser-check');
fs.mkdirSync(screenshotDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profilePath}`,
  'about:blank'
], { stdio: 'ignore', windowsHide: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function endpoint(pathname, options) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
      if (response.ok) return response.json();
      lastError = new Error(`CDP endpoint returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw lastError;
}

async function connectPage(targetUrl) {
  const target = await endpoint(`/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const browserErrors = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      browserErrors.push(message.params.exceptionDetails?.text || 'runtime exception');
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      browserErrors.push(message.params.args.map((item) => item.value || item.description || '').join(' '));
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  return { socket, send, browserErrors };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

const toiletPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'toilet-office.html')).href;
const homePage = pathToFileURL(path.join(projectRoot, 'dist', 'index.html')).href;
const { socket, send, browserErrors } = await connectPage(`${toiletPage}?staff=10&days=3&visitors=0`);

try {
  const widthResults = [];
  for (const width of [320, 375, 414, 768]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await send('Page.navigate', { url: `${toiletPage}?staff=10&days=3&visitors=0&audit=${width}` });
    await sleep(900);
    const result = await evaluate(send, `(() => {
      const rect = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      };
      const quick = [...document.querySelectorAll('.quick-picks [data-product-fit]')];
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        h1: rect('.hero h1'),
        primaryCta: rect('.hero-actions .button'),
        table: rect('.compare-table'),
        firstRow: rect('.compare-table tbody tr'),
        quickVisible: quick.filter((node) => !node.hidden).length,
        quickHidden: quick.filter((node) => node.hidden).length,
        productCards: document.querySelectorAll('#products .product').length,
        firstFit: document.querySelector('[data-fit-result]')?.textContent || '',
        positions: [...document.querySelectorAll('#products a[data-product-position]')].map((node) => Number(node.dataset.productPosition))
      };
    })()`);
    assert.ok(result.scrollWidth <= result.width + 1, `${width}px page overflow: ${result.scrollWidth}px`);
    assert.ok(result.h1 && result.h1.right <= result.width + 1, `${width}px heading is clipped`);
    assert.ok(result.primaryCta && result.primaryCta.right <= result.width + 1, `${width}px primary CTA is clipped`);
    if (width <= 760) {
      assert.ok(result.table && result.table.width <= result.width + 1, `${width}px comparison table is not mobile-sized`);
      assert.ok(result.firstRow && result.firstRow.width <= result.width + 1, `${width}px comparison card is clipped`);
    }
    assert.ok(result.quickVisible <= 3, `${width}px shows more than three quick picks`);
    assert.ok(result.productCards <= 6, `${width}px repeats more than six detailed cards`);
    assert.match(result.firstFit, /150回分/);
    assert.deepEqual(result.positions, result.positions.map((_, index) => index + 1), `${width}px CTA positions are stale`);
    widthResults.push(result);
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true
  });
  await send('Page.navigate', { url: `${toiletPage}?staff=0&days=3&visitors=0` });
  await sleep(900);
  const zeroPlan = await evaluate(send, `(() => {
    const text = document.querySelector('[data-fit-result]')?.textContent || '';
    return { text, hasUnitRecommendation: /1点|1セット/.test(text) };
  })()`);
  assert.match(zeroPlan.text, /1人以上/);
  assert.equal(zeroPlan.hasUnitRecommendation, false);

  const homeResults = [];
  for (const width of [320, 375, 414, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: width >= 1024 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await send('Page.navigate', { url: `${homePage}?audit=${width}` });
    await sleep(900);
    const result = await evaluate(send, `(() => {
      const rect = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      };
      const html = document.documentElement.innerHTML;
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        h1: rect('.hero-main h1'),
        primaryCta: rect('.hero-actions .button'),
        internalValueLeak: /data-affiliate-rate|data-estimated-commission|estimated_commission_before_caps|affiliate_rate/.test(html),
        personalSchema: /"@type"\\s*:\\s*"Person"/.test(html),
        publicEmail: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i.test(html)
      };
    })()`);
    assert.ok(result.scrollWidth <= result.width + 1, `${width}px home page overflow: ${result.scrollWidth}px`);
    assert.ok(result.h1 && result.h1.right <= result.width + 1, `${width}px home heading is clipped`);
    assert.ok(result.primaryCta && result.primaryCta.right <= result.width + 1, `${width}px home CTA is clipped`);
    assert.equal(result.internalValueLeak, false);
    assert.equal(result.personalSchema, false);
    assert.equal(result.publicEmail, false);
    homeResults.push(result);
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true
  });
  await send('Page.navigate', { url: `${homePage}?audit=screenshot` });
  await sleep(900);
  const homeScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(screenshotDir, 'home-mobile-cdp.png'), Buffer.from(homeScreenshot.data, 'base64'));

  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(' / ')}`);

  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(screenshotDir, 'toilet-mobile-cdp.png'), Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify({ status: 'PASS', widths: widthResults, zeroPlan, home: homeResults }, null, 2));
} finally {
  socket.close();
  chrome.kill();
}
