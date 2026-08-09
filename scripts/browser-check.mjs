import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const chromeCandidates = process.platform === 'win32'
  ? [path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')]
  : [
      process.env.CHROME_PATH,
      process.env.CHROME_BIN,
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    ].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate)) || chromeCandidates[0] || 'google-chrome';
const port = 9337;
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'bcp-browser-check-'));
const screenshotDir = path.join(projectRoot, 'artifacts', 'browser-check');
fs.mkdirSync(screenshotDir, { recursive: true });

let chrome;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function endpoint(pathname, options) {
  let lastError;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
      if (response.ok) return response.json();
      lastError = new Error(`CDP endpoint returned ${response.status}`);
    } catch (error) {
      if (chrome?.exitCode !== null && chrome?.exitCode !== undefined) {
        throw new Error(`Chrome exited before CDP was ready (code ${chrome.exitCode}) at ${chromePath}`);
      }
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

async function navigateFresh(send, url) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(100);
  await send('Page.navigate', { url });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await evaluate(send, `document.readyState !== 'loading'`)) {
      await sleep(100);
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out while loading ${url}`);
}

const toiletPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'toilet-office.html')).href;
const officePage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'office-bichiku.html')).href;
const powerPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'portable-power-kaigo.html')).href;
const quantityPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'office-stockpile-quantity.html')).href;
const checklistPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'bcp-stockpile-checklist.html')).href;
const homePage = pathToFileURL(path.join(projectRoot, 'dist', 'index.html')).href;
let socket;
let send;
let browserErrors = [];

try {
  chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profilePath}`,
    'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  ({ socket, send, browserErrors } = await connectPage('about:blank'));
  const widthResults = [];
  for (const width of [320, 375, 414, 768]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${toiletPage}?staff=10&days=3&visitors=0&audit=${width}`);
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
        toiletEstimate: document.querySelector('#toiletEstimate')?.textContent || '',
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
    assert.match(result.toiletEstimate, /150回分/);
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
  await navigateFresh(send, `${toiletPage}?staff=0&days=3&visitors=0`);
  const zeroPlan = await evaluate(send, `(() => {
    const text = document.querySelector('[data-fit-result]')?.textContent || '';
    return { text, hasUnitRecommendation: /1点|1セット/.test(text) };
  })()`);
  assert.match(zeroPlan.text, /1人以上/);
  assert.equal(zeroPlan.hasUnitRecommendation, false);

  const powerResults = [];
  for (const width of [320, 375, 768]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${powerPage}?audit=power-${width}`);
    const result = await evaluate(send, `(() => {
      const first = document.querySelector('.compare-table tbody [data-product-fit]');
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        estimate: document.querySelector('#powerEstimate')?.textContent || '',
        fit: first?.querySelector('[data-fit-result]')?.textContent || '',
        cta: first?.querySelector('a[data-product-id]')?.textContent || '',
        powerWh: Number(first?.dataset.powerWh || 0),
        outputW: Number(first?.dataset.outputW || 0)
      };
    })()`);
    assert.ok(result.scrollWidth <= result.width + 1, `${width}px power page overflow: ${result.scrollWidth}px`);
    assert.equal(result.estimate, '1,500Wh以上');
    assert.ok(result.powerWh >= 1500, `${width}px first power candidate capacity is insufficient`);
    assert.ok(result.outputW >= 300, `${width}px first power candidate output is insufficient`);
    assert.match(result.fit, /1,500Wh以上・300W対応候補/);
    assert.match(result.cta, /1,500Wh以上・300W対応候補を楽天で確認/);
    powerResults.push(result);
  }

  const officeResults = [];
  for (const width of [320, 375, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: width >= 1024 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${officePage}?audit=office-${width}`);
    const result = await evaluate(send, `(() => {
      const quick = [...document.querySelectorAll('.quick-picks .quick-pick-candidate')];
      const visible = quick.filter((node) => !node.hidden);
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        heading: document.querySelector('#quick-picks-title')?.textContent || '',
        eyebrow: document.querySelector('.quick-picks .eyebrow')?.textContent || '',
        classes: visible.map((node) => node.querySelector('.pill')?.textContent || ''),
        images: visible.filter((node) => node.querySelector('img')).length,
        visible: visible.length,
        total: quick.length
      };
    })()`);
    assert.ok(result.scrollWidth <= result.width + 1, `${width}px office page overflow: ${result.scrollWidth}px`);
    assert.equal(result.heading, '買い方別に、最初の候補を確認');
    assert.equal(result.eyebrow, '個人配布・共有・補充');
    assert.equal(result.visible, 3, `${width}px office page must show three quick picks`);
    assert.ok(result.total >= 3, `${width}px office page has fewer than three candidates`);
    assert.equal(result.images, 3, `${width}px office quick pick is missing an image`);
    for (const label of ['従業員ごとの配布セット', '水・食料の共有備蓄', '不足品の補充']) {
      assert.ok(result.classes.includes(label), `${width}px office buying path missing: ${label}`);
    }
    officeResults.push(result);
  }

  const quantityResults = [];
  for (const width of [320, 375, 768]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${quantityPage}?audit=quantity-${width}`);
    const result = await evaluate(send, `(() => {
      window.__quantityEvents = [];
      window.gtag = (...args) => window.__quantityEvents.push(args);
      const cards = [...document.querySelectorAll('article.card.product')];
      const ids = cards.map((card) => card.querySelector('a[data-product-id]')?.dataset.productId || '');
      const firstCta = cards[0]?.querySelector('a[data-product-id]');
      firstCta?.addEventListener('click', (event) => event.preventDefault(), { once: true });
      firstCta?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      const html = document.documentElement.innerHTML;
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        cards: cards.length,
        uniqueIds: new Set(ids).size,
        images: cards.filter((card) => card.querySelector('img')).length,
        completeCards: cards.filter((card) => card.querySelector('.price') && card.querySelector('.facts') && card.querySelector('.spec-grid') && card.querySelector('a[data-product-id]')).length,
        itemListSchema: html.includes('"@type":"ItemList"'),
        productSchemaCount: (html.match(/"@type":"Product"/g) || []).length,
        events: window.__quantityEvents.map((args) => args[1])
      };
    })()`);
    assert.ok(result.scrollWidth <= result.width + 1, `${width}px quantity page overflow: ${result.scrollWidth}px`);
    assert.equal(result.cards, 6, `${width}px quantity page product count changed`);
    assert.equal(result.uniqueIds, 6, `${width}px quantity page contains duplicate products`);
    assert.equal(result.images, 6, `${width}px quantity page has a product without an image`);
    assert.equal(result.completeCards, 6, `${width}px quantity page has an incomplete product card`);
    assert.equal(result.itemListSchema, true);
    assert.equal(result.productSchemaCount, 6);
    assert.ok(result.events.includes('select_item'), `${width}px select_item event missing`);
    assert.ok(result.events.includes('rakuten_click'), `${width}px rakuten_click event missing`);
    quantityResults.push(result);
  }

  const homeResults = [];
  for (const width of [320, 375, 414, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: width >= 1024 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${homePage}?audit=${width}`);
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

  const checklistResults = [];
  for (const width of [320, 375, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: width >= 1024 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${checklistPage}?audit=${width}`);
    const result = await evaluate(send, `(() => {
      const firstCheck = document.querySelector('[data-stockpile-check]');
      firstCheck?.click();
      const facility = document.querySelector('#facilityType');
      if (facility) {
        facility.value = 'restaurant';
        facility.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        h1Right: document.querySelector('.hero h1')?.getBoundingClientRect().right || 0,
        water: document.querySelector('#waterEstimate')?.textContent || '',
        checked: document.querySelector('#stockpileCheckedCount')?.textContent || '',
        total: document.querySelector('#stockpileTotalCount')?.textContent || '',
        visibleFacilities: [...document.querySelectorAll('[data-facility-panel]')].filter((node) => !node.hidden).length,
        selectedFacility: facility?.value || '',
        csvHref: document.querySelector('[data-download-checklist]')?.href || '',
        productSchema: document.documentElement.innerHTML.includes('"@type":"Product"')
      };
    })()`);
    assert.ok(result.scrollWidth <= result.width + 1, `${width}px checklist overflow: ${result.scrollWidth}px`);
    assert.ok(result.h1Right <= result.width + 1, `${width}px checklist heading is clipped`);
    assert.equal(result.water, '90L');
    assert.equal(result.checked, '1');
    assert.equal(result.total, '22');
    assert.equal(result.visibleFacilities, 1);
    assert.equal(result.selectedFacility, 'restaurant');
    assert.match(result.csvHref, /jigyousho-bousai-checklist\.csv$/);
    assert.equal(result.productSchema, false);
    checklistResults.push(result);
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true
  });
  await navigateFresh(send, `${checklistPage}?audit=screenshot`);
  await sleep(700);
  const checklistScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(screenshotDir, 'checklist-mobile-cdp.png'), Buffer.from(checklistScreenshot.data, 'base64'));

  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true
  });
  await navigateFresh(send, `${homePage}?audit=screenshot`);
  await sleep(700);
  const homeScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(screenshotDir, 'home-mobile-cdp.png'), Buffer.from(homeScreenshot.data, 'base64'));

  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(' / ')}`);

  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(screenshotDir, 'toilet-mobile-cdp.png'), Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify({ status: 'PASS', widths: widthResults, zeroPlan, power: powerResults, office: officeResults, quantity: quantityResults, home: homeResults, checklist: checklistResults }, null, 2));
} catch (error) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const message = String(error?.message || error)
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A');
    console.error(`::error file=scripts/browser-check.mjs::${message}`);
  }
  throw error;
} finally {
  socket?.close();
  chrome?.kill();
}
