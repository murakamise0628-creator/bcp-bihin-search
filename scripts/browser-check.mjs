import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { amazonOfferFor } from './amazon-links.cjs';
import productTools from './fetch-products.js';
import waterContainerTools from './water-container-comparison.cjs';
import { procurementCandidates } from './procurement-candidates.cjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const amazonConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data/amazon-links.json'), 'utf8'));
const productData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data/products.json'), 'utf8'));
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
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*googletagmanager.com/*', '*google-analytics.com/*', '*analytics.google.com/*', '*hb.afl.rakuten.co.jp/*', '*amazon.co.jp/*', '*amzn.to/*', '*link.amazon/*', '*amzlinks.in/*'] });
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
    if (await evaluate(send, `window.location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`)) {
      await sleep(100);
      return;
    }
    await sleep(100);
  }
  throw new Error(`Timed out while loading ${url}`);
}

async function verifyPurchasePlans(send, width) {
  const plans = await evaluate(send, `(() => [...document.querySelectorAll('#purchase-units .procurement-card')].map(card => {
    const link=card.querySelector('a'); const box=link.getBoundingClientRect();
    return {...card.dataset, href:link.href, linkText:link.textContent, fits:box.left>=0&&box.right<=innerWidth+1};
  }))()`);
  assert.equal(plans.length, 3);
  const candidates = productData.pages.find(page => page.slug === 'toilet-office').products.filter(productTools.isToiletPurchaseCandidate);
  for (const [index, plan] of plans.entries()) {
    const needed = [150, 450, 750][index];
    const product = candidates.find(item => item.itemCode === plan.purchaseProduct);
    assert.ok(product);
    assert.equal(Number(plan.requiredUses), needed);
    assert.equal(Number(plan.suppliedUses), productTools.decisionFacts(product).toiletUses * Number(plan.purchasePackages));
    assert.ok(Number(plan.suppliedUses) >= needed);
    const minimum = Math.min(...candidates.map(item => Math.ceil(needed / productTools.decisionFacts(item).toiletUses) * Number(item.price)));
    assert.equal(Number(plan.purchaseCost), minimum);
    assert.equal(plan.href, new URL(product.url).href);
    assert.ok(plan.linkText.includes(plan.purchasePackages + '点分'));
    assert.ok(plan.fits, 'purchase CTA overflows at ' + width);
  }
  return plans;
}

async function verifyAmazonChoices(send, width, slug) {
  const products = productData.pages.find(page => page.slug === slug)?.products || [];
  const expectedAsins = [...new Set(products.map(product => amazonOfferFor(product, slug, amazonConfig)?.asin).filter(Boolean))].sort();
  const ui = await evaluate(send, `(() => {
    return [...document.querySelectorAll('a[data-affiliate-merchant="amazon"]')].map(link=>{
      const box=link.getBoundingClientRect();const url=new URL(link.href);
      return {asin:link.dataset.amazonAsin,placement:link.dataset.ctaLocation,host:url.hostname,path:url.pathname,
        visible:link.getClientRects().length>0,height:box.height,right:box.right,font:parseFloat(getComputedStyle(link).fontSize),
        source:link.closest('tr,.product').textContent.includes('楽天市場の価格・レビュー')};
    });
  })()`);
  assert.deepEqual([...new Set(ui.map(link => link.asin))].sort(), expectedAsins, slug + ': verified Amazon coverage');
  for (const link of ui) {
    assert.equal(link.host, 'www.amazon.co.jp');
    assert.equal(link.path, `/dp/${link.asin}`);
    assert.equal(link.source, true);
    if (!link.visible) continue;
    assert.ok(link.height >= 44 && link.font >= 16, slug + ': touch-sized Amazon CTA');
    if (link.placement !== 'comparison_table') assert.ok(link.right <= width + 1, slug + ': Amazon CTA overflow');
  }
  const events = await evaluate(send, `(() => {
    const links=[...document.querySelectorAll('a[data-affiliate-merchant="amazon"]')].filter(link=>link.getClientRects().length>0);
    const before=window.dataLayer.length;
    links.forEach(link=>{document.addEventListener('click',event=>event.preventDefault(),{capture:true,once:true});link.click();});
    return {links:links.length,events:window.dataLayer.slice(before).map(entry=>Array.from(entry)).filter(entry=>entry[0]==='event')};
  })()`);
  const clicks = events.events.filter(entry => entry[1] === 'amazon_click');
  assert.equal(clicks.length, events.links);
  assert.equal(events.events.filter(entry => entry[1] === 'rakuten_click').length, 0);
  for (const event of clicks) {
    assert.ok(expectedAsins.includes(event[2].product_id));
    assert.equal(event[2].affiliate_merchant, 'amazon');
    assert.equal(event[2].product_price, undefined);
    assert.equal(event[2].destination, `https://www.amazon.co.jp/dp/${event[2].product_id}`);
  }
  return { slug, width, verifiedProducts: expectedAsins.length, renderedLinks: ui.length, testedVisibleLinks: events.links };
}

const toiletPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'toilet-office.html')).href;
const officePage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'office-bichiku.html')).href;
const powerPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'portable-power-kaigo.html')).href;
const quantityPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'office-stockpile-quantity.html')).href;
const emergencyFoodPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'emergency-food-office.html')).href;
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
  const amazonResults = [];
  for (const width of [320, 375, 414, 768]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${toiletPage}?staff=10&days=3&visitors=0&audit=${width}`);
    await verifyPurchasePlans(send, width);
    amazonResults.push(await verifyAmazonChoices(send, width, 'toilet-office'));
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
        table: rect('#comparison .compare-table'),
        firstRow: rect('#comparison .compare-table tbody tr'),
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

  for (const slug of ['portable-power-kaigo', 'typhoon-office', 'blackout-power']) {
    for (const width of [320, 375, 414, 768, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      await navigateFresh(send, pathToFileURL(path.join(projectRoot, 'dist', 'pages', slug + '.html')).href);
      amazonResults.push(await verifyAmazonChoices(send, width, slug));
      assert.equal(await evaluate(send, 'document.documentElement.scrollWidth <= innerWidth + 1'), true, slug + ': page overflow');
      if (width === 375 || width === 1440) {
        const hasVisibleAmazon = await evaluate(send, `(() => {
          const link=[...document.querySelectorAll('.quick-picks a[data-affiliate-merchant="amazon"]')].find(link=>link.getClientRects().length>0);
          if(!link)return false;link.closest('.product').scrollIntoView({behavior:'instant',block:'start'});return true;
        })()`);
        if (hasVisibleAmazon) {
          await sleep(400);
          const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          fs.writeFileSync(path.join(screenshotDir, `amazon-${slug}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
        }
      }
    }
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

  const ineligiblePlan = await evaluate(send, `(() => {
    const source = document.querySelector('.compare-table tbody [data-product-fit]');
    const row = source.cloneNode(true);
    row.dataset.productKey = 'audit-unknown-contents';
    row.dataset.toiletPurchaseEligible = 'false';
    row.dataset.toiletUses = '100';
    row.dataset.unitPrice = '100';
    row.dataset.fitTier = 'preferred';
    source.parentNode.append(row);
    const staff = document.getElementById('staffCount');
    staff.value = '10';
    staff.dispatchEvent(new Event('input', { bubbles: true }));
    const result = {
      text: row.querySelector('[data-fit-result]')?.textContent || '',
      eligible: [...document.querySelectorAll('.compare-table tbody [data-product-fit]')]
        .filter(node => node.dataset.toiletPurchaseEligible === 'true')
        .map(node => node.querySelector('[data-fit-result]')?.textContent || '')
    };
    row.remove();
    return result;
  })()`);
  assert.match(ineligiblePlan.text, /同梱品・選択数量・価格を販売ページで確認/);
  assert.doesNotMatch(ineligiblePlan.text, /概算|を[0-9,]+点/);
  assert.ok(ineligiblePlan.eligible.some(text => /150回分の目安/.test(text)), 'eligible kits must retain quantity estimates');

  const powerResults = [];
  for (const width of [320, 375, 414, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${powerPage}?audit=power-${width}`);
    const result = await evaluate(send, `(() => {
      const first = document.querySelector('.compare-table tbody [data-product-fit]');
      const quick = [...document.querySelectorAll('#power-candidates .quick-pick-candidate')].filter(node => !node.hidden);
      const quantity = document.getElementById('quantity');
      const candidates = document.getElementById('power-candidates');
      const comparison = document.getElementById('comparison');
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        estimate: document.querySelector('#powerEstimate')?.textContent || '',
        fit: first?.querySelector('[data-fit-result]')?.textContent || '',
        cta: first?.querySelector('a[data-product-id]')?.textContent || '',
        powerWh: Number(first?.dataset.powerWh || 0),
        outputW: Number(first?.dataset.outputW || 0),
        visibleCandidates: quick.length,
        validCandidates: quick.every(node => Number(node.dataset.powerWh) >= 1500 && Number(node.dataset.outputW) >= 300 && node.dataset.fitMatched === 'true'),
        candidateImages: quick.filter(node => node.querySelector('img')).length,
        trackedSponsoredLinks: quick.every(node => node.querySelector('a[data-product-id][rel~="sponsored"]')),
        ordered: Boolean(quantity && candidates && comparison && (quantity.compareDocumentPosition(candidates) & Node.DOCUMENT_POSITION_FOLLOWING) && (candidates.compareDocumentPosition(comparison) & Node.DOCUMENT_POSITION_FOLLOWING)),
        primaryHref: document.querySelector('.hero-actions a')?.getAttribute('href'),
        powerHeaders: [...document.querySelectorAll('.compare-table th')].map(node => node.textContent),
        medicalCaution: document.body.textContent.includes('医療・生命維持機器の適合判定には使えません')
      };
    })()`);
    assert.ok(result.scrollWidth <= result.width + 1, `${width}px power page overflow: ${result.scrollWidth}px`);
    assert.equal(result.estimate, '1,500Wh以上');
    assert.ok(result.powerWh >= 1500, `${width}px first power candidate capacity is insufficient`);
    assert.ok(result.outputW >= 300, `${width}px first power candidate output is insufficient`);
    assert.match(result.fit, /1,500Wh以上・300W対応候補/);
    assert.match(result.cta, /1,500Wh以上・300W対応候補を楽天で確認/);
    assert.ok(result.visibleCandidates > 0 && result.visibleCandidates <= 3);
    assert.equal(result.validCandidates, true);
    assert.equal(result.candidateImages, result.visibleCandidates);
    assert.equal(result.trackedSponsoredLinks, true);
    assert.equal(result.ordered, true);
    assert.equal(result.primaryHref, '#quantity');
    assert.ok(result.powerHeaders.includes('容量（Wh）'));
    assert.ok(!result.powerHeaders.includes('対象人数の目安'));
    assert.equal(result.medicalCaution, true);
    await sleep(900);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDir, 'power-' + width + '.png'), Buffer.from(shot.data, 'base64'));
    const imageCheck = await evaluate(send, `(async () => {
      const candidates = document.getElementById('power-candidates');
      candidates.scrollIntoView({ block:'start', behavior:'instant' });
      const images = [...candidates.querySelectorAll('.quick-pick-candidate:not([hidden]) img')];
      images.forEach(image => { image.loading='eager'; });
      await Promise.race([Promise.all(images.map(image => image.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 8000))]);
      return images.every(image => image.complete && image.naturalWidth > 0);
    })()`);
    assert.equal(imageCheck, true, 'Power candidate images must load');
    const candidateShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDir, 'power-candidates-' + width + '.png'), Buffer.from(candidateShot.data, 'base64'));
    const states = await evaluate(send, `(() => {
      const set = (id, value) => { const input=document.getElementById(id); input.value=value; input.dispatchEvent(new Event('input', { bubbles:true })); };
      const visible = () => [...document.querySelectorAll('#power-candidates .quick-pick-candidate')].filter(node => !node.hidden).length;
      set('powerWatts', '100000'); set('powerHours', '168');
      const empty = { count:visible(), text:document.getElementById('powerMatchStatus').textContent };
      set('powerWatts', '-1');
      const invalid = { count:visible(), estimate:document.getElementById('powerEstimate').textContent };
      set('powerWatts', '100'); set('powerHours', '2');
      const restored = { count:visible(), estimate:document.getElementById('powerEstimate').textContent };
      set('powerMargin', '101');
      const invalidMargin = visible();
      set('powerMargin', '20'); set('powerWatts', '');
      const emptyInput = visible();
      return { empty, invalid, restored, invalidMargin, emptyInput };
    })()`);
    assert.equal(states.empty.count, 0);
    assert.match(states.empty.text, /合う先頭候補はありません/);
    assert.equal(states.invalid.count, 0);
    assert.match(states.invalid.estimate, /入力値を確認/);
    assert.ok(states.restored.count > 0);
    assert.equal(states.restored.estimate, '300Wh以上');
    assert.equal(states.invalidMargin, 0);
    assert.equal(states.emptyInput, 0);
    result.states = states;
    const loadHelper = await evaluate(send, `(() => {
      const tool=document.querySelector('[data-power-load-tool]');tool.open=true;
      const rows=[...tool.querySelectorAll('.power-load-row')];
      const set=(index,field,value)=>{const el=rows[index].querySelector(field);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
      const button=document.getElementById('powerLoadApply');
      const initialDisabled=button.disabled;
      set(0,'[data-load-watts]','10');set(0,'[data-load-count]','3');
      set(1,'[data-load-watts]','60');set(1,'[data-load-count]','2');
      const beforeApply=document.getElementById('powerWatts').value;
      const original=window.gtag;const events=[];window.gtag=function(){events.push(Array.from(arguments));};
      button.click();button.click();
      const applied={watts:document.getElementById('powerWatts').value,estimate:document.getElementById('powerEstimate').textContent,events:events.filter(e=>e[1]==='power_calculator_use')};
      set(0,'[data-load-watts]','-1');const invalidDisabled=button.disabled;
      const preserved=document.getElementById('powerWatts').value;
      set(0,'[data-load-watts]','');set(0,'[data-load-count]','1');set(1,'[data-load-watts]','');set(1,'[data-load-count]','1');
      const emptyDisabled=button.disabled;
      set(0,'[data-load-watts]','10');set(0,'[data-load-count]','3');set(1,'[data-load-watts]','60');set(1,'[data-load-count]','2');
      document.getElementById('powerWatts').value='99';document.getElementById('powerWatts').dispatchEvent(new Event('input',{bubbles:true}));
      set(0,'[data-load-count]','4');const manualPreserved=document.getElementById('powerWatts').value;
      set(0,'[data-load-count]','3');button.click();
      window.gtag=original;
      const rect=button.getBoundingClientRect();
      const fits=[...tool.querySelectorAll('input,button,summary')].every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;});
      return {initialDisabled,beforeApply,applied,invalidDisabled,preserved,emptyDisabled,manualPreserved,fits,buttonHeight:rect.height,overflow:document.documentElement.scrollWidth>innerWidth+1};
    })()`);
    assert.equal(loadHelper.initialDisabled,true);assert.equal(loadHelper.beforeApply,'');
    assert.equal(loadHelper.applied.watts,'150');assert.equal(loadHelper.applied.estimate,'400Wh以上');
    assert.equal(loadHelper.applied.events.length,1);
    assert.equal(loadHelper.applied.events[0][2].watts,150);
    assert.ok(!('device_count' in loadHelper.applied.events[0][2]));
    assert.equal(loadHelper.invalidDisabled,true);assert.equal(loadHelper.preserved,'150');
    assert.equal(loadHelper.emptyDisabled,true);assert.equal(loadHelper.manualPreserved,'99');
    assert.equal(loadHelper.fits,true);assert.equal(loadHelper.overflow,false);assert.ok(loadHelper.buttonHeight>=44);
    result.loadHelper=loadHelper;
    await evaluate(send, `document.querySelector('[data-power-load-tool]').scrollIntoView({block:'start',behavior:'instant'})`);
    const loadShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(screenshotDir,'power-load-'+width+'.png'),Buffer.from(loadShot.data,'base64'));
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

  const emergencyFoodResults = [];
  for (const width of [320, 375, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: width >= 1024 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${emergencyFoodPage}?staff=30&days=3&visitors=0&audit=food-${width}`);
    const result = await evaluate(send, `(() => {
      const html = document.documentElement.innerHTML;
      const ids = new Set([...document.querySelectorAll('[data-product-id]')].map((node) => node.dataset.productId));
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        h1: document.querySelector('h1')?.textContent || '',
        foodEstimate: document.querySelector('#foodEstimate')?.textContent || '',
        ids: ids.size,
        images: document.querySelectorAll('#products .product img').length,
        productSchemaCount: (html.match(/"@type":"Product"/g) || []).length,
        hasSponsoredCta: !!document.querySelector('a[rel="nofollow sponsored noopener"]')
      };
    })()`);
    assert.ok(result.scrollWidth <= result.width + 1, `${width}px emergency food page overflow: ${result.scrollWidth}px`);
    assert.match(result.h1, /非常食セット比較/);
    assert.match(result.foodEstimate, /270食/);
    assert.ok(result.ids >= 12, `${width}px emergency food page has fewer than 12 products`);
    assert.equal(result.images, 6, `${width}px emergency food detailed cards need six images`);
    assert.equal(result.productSchemaCount, 12);
    assert.equal(result.hasSponsoredCta, true);
    emergencyFoodResults.push(result);
  }

  const quantityResults = [];
  const quantityChoices = [
    ...procurementCandidates(productData.pages.find(p=>p.slug==='water-food-stock').products,'water'),
    ...procurementCandidates(productData.pages.find(p=>p.slug==='emergency-food-office').products,'food'),
    ...procurementCandidates(productData.pages.find(p=>p.slug==='toilet-office').products,'toilet')
  ];
  const expectedQuantityIds = new Set(quantityChoices.map(c=>c.product.itemCode).concat(productData.pages.find(p=>p.slug==='office-bichiku').products.filter(p=>p.productType==='disaster-set').slice(0,2).map(p=>p.itemCode)));
  for (const width of [320, 375, 414, 768]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await navigateFresh(send, `${quantityPage}?audit=quantity-${width}`);
    await sleep(1200);
    const quantityScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDir, 'quantity-' + width + '.png'), Buffer.from(quantityScreenshot.data, 'base64'));
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
    assert.equal(result.cards, expectedQuantityIds.size, `${width}px quantity page product count changed`);
    assert.equal(result.uniqueIds, expectedQuantityIds.size, `${width}px quantity page contains duplicate products`);
    assert.equal(result.images, expectedQuantityIds.size, `${width}px quantity page has a product without an image`);
    assert.equal(result.completeCards, expectedQuantityIds.size, `${width}px quantity page has an incomplete product card`);
    assert.equal(result.itemListSchema, true);
    assert.equal(result.productSchemaCount, expectedQuantityIds.size);
    assert.ok(result.events.includes('select_item'), `${width}px select_item event missing`);
    assert.ok(result.events.includes('rakuten_click'), `${width}px rakuten_click event missing`);
    quantityResults.push(result);
  }

  for(const width of [320,375,414,768,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await navigateFresh(send,quantityPage+'?staff=30&days=3&visitors=0');
    await sleep(900);
    const choices=await evaluate(send,`(async()=>{
      window.__candidateEvents=[];window.gtag=(...args)=>window.__candidateEvents.push(args);
      const records=[];
      for(const kind of ['water','food','toilet']){
        const row=document.querySelector('[data-procurement="'+kind+'"]');
        const select=row.querySelector('[data-procurement-select]');
        if(!select)continue;
        const initial={value:select.value,visible:row.querySelectorAll('[data-procurement-candidate]:not([hidden])').length};
        for(const option of [...select.options].filter(o=>o.value)){
          select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));
          const panel=[...row.querySelectorAll('[data-procurement-candidate]')].find(p=>!p.hidden);
          const image=panel.querySelector('img');if(image){image.loading='eager';await Promise.race([image.decode(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Candidate image timeout')),15000))]);if(!image.naturalWidth)throw new Error('Candidate image failed');}
          const link=panel.querySelector('a');const box=link.getBoundingClientRect();
          const before=window.__candidateEvents.length;
          link.addEventListener('click',e=>e.preventDefault(),{once:true});link.click();
          records.push({kind,id:option.value,initial,pack:Number(row.querySelector('[data-pack]').value),price:Number(row.querySelector('[data-price]').value),required:row.querySelector('[data-required]').textContent,count:row.querySelector('[data-packages]').textContent,cost:row.querySelector('[data-cost]').textContent,summary:panel.querySelector('[data-candidate-summary]').textContent,href:link.href,height:box.height,fits:box.left>=0&&box.right<=innerWidth,events:window.__candidateEvents.slice(before).filter(e=>['rakuten_click','amazon_click'].includes(e[1]))});
        }
      }
      const row=document.querySelector('[data-procurement="water"]'),select=row.querySelector('select');
      if(!select)return {records,events:[],overflow:document.documentElement.scrollWidth>innerWidth+1};
      const input=(selector,value)=>{const el=row.querySelector(selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
      input('[data-stock]','300');const enough={count:row.querySelector('[data-packages]').textContent,hidden:row.querySelector('[data-procurement-candidate]:not([hidden]) a').hidden};
      input('[data-stock]','30');const deducted=row.querySelector('[data-missing]').textContent;
      const staff=document.getElementById('staffCount');staff.value='50';staff.dispatchEvent(new Event('input',{bubbles:true}));const changed=row.querySelector('[data-missing]').textContent;
      input('[data-pack]','12');input('[data-price]','1800');const manual={choice:select.value,visible:row.querySelectorAll('[data-procurement-candidate]:not([hidden])').length,count:row.querySelector('[data-packages]').textContent,cost:row.querySelector('[data-cost]').textContent};
      select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));
      const cleared={pack:row.querySelector('[data-pack]').value,price:row.querySelector('[data-price]').value,visible:row.querySelectorAll('[data-procurement-candidate]:not([hidden])').length};
      select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));staff.value='0';staff.dispatchEvent(new Event('input',{bubbles:true}));const zero={count:row.querySelector('[data-packages]').textContent,hidden:row.querySelector('[data-procurement-candidate]:not([hidden]) a').hidden};
      staff.value='30';staff.dispatchEvent(new Event('input',{bubbles:true}));input('[data-stock]','0');
      row.querySelector('h3').scrollIntoView({behavior:'instant'});
      return {records,enough,deducted,changed,manual,cleared,zero,overflow:document.documentElement.scrollWidth>innerWidth+1,events:window.__candidateEvents.filter(e=>e[1]==='quantity_calculator_use'&&e[2].calculator_type==='procurement_candidate').map(e=>e[2])};
    })()`);
    assert.equal(choices.records.length,quantityChoices.length);
    for(const record of choices.records){
      const expected=quantityChoices.find(c=>c.product.itemCode===record.id);
      assert.deepEqual(record.initial,{value:'',visible:0});
      assert.equal(record.pack,expected.quantity);assert.equal(record.price,expected.product.price);
      const required=record.kind==='toilet'?450:270;
      const count=Math.ceil(required/expected.quantity);
      assert.equal(record.count,count.toLocaleString('ja-JP')+'点');assert.equal(record.cost,(count*expected.product.price).toLocaleString('ja-JP')+'円');
      assert.ok(record.summary.includes(count.toLocaleString('ja-JP')+'点'));assert.ok(record.summary.includes(record.cost));
      assert.equal(record.href,new URL(expected.product.url).href);assert.equal(record.fits,true);assert.ok(record.height>=44);
      assert.equal(record.events.length,1);assert.equal(record.events[0][1],'rakuten_click');assert.equal(record.events[0][2].product_id,record.id);assert.equal(record.events[0][2].cta_location,'procurement_candidate');
    }
    if(choices.records.some(r=>r.kind==='water')){
      assert.deepEqual(choices.enough,{count:'0点',hidden:true});assert.equal(choices.deducted,'240L');assert.equal(choices.changed,'420L');
      assert.deepEqual(choices.manual,{choice:'',visible:0,count:'35点',cost:'63,000円'});
      assert.deepEqual(choices.cleared,{pack:'',price:'',visible:0});assert.deepEqual(choices.zero,{count:'0点',hidden:true});
    }
    assert.equal(choices.overflow,false);
    assert.ok(choices.events.every(event=>!('stock' in event)&&!('price' in event)), 'Inventory and budgets must not be sent');
    if(width===375||width===1440){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(screenshotDir,'procurement-choice-'+width+'.png'),Buffer.from(shot.data,'base64'));}
  }

  await navigateFresh(send, quantityPage);
  const quantityPlan = await evaluate(send, `(() => {
    window.__planEvents = [];
    window.gtag = (...args) => window.__planEvents.push(args);
    for (const [id, value] of [['staffCount', '30'], ['daysCount', '7'], ['visitorCount', '5']]) {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const link = document.querySelector('[data-stock-plan=toilet]');
    link.addEventListener('click', e => e.preventDefault(), { once: true });
    link.click();
    return { href: link.href, water: document.getElementById('waterEstimate').textContent, toilet: document.getElementById('toiletEstimate').textContent, events: window.__planEvents.map(args => args[1]) };
  })()`);
  assert.equal(quantityPlan.water, '735L');
  assert.equal(quantityPlan.toilet, '1,225回分');
  const carriedPlan = new URL(quantityPlan.href);
  assert.equal(carriedPlan.searchParams.get('staff'), '30');
  assert.equal(carriedPlan.searchParams.get('days'), '7');
  assert.equal(carriedPlan.searchParams.get('visitors'), '5');
  assert.ok(quantityPlan.events.includes('stock_plan_compare_click'));
  assert.ok(quantityPlan.events.includes('quantity_calculator_use'));
  const foodPlan = await evaluate(send, `({ href: document.querySelector('[data-stock-plan=food]').href, label: document.getElementById('foodPlanLabel').textContent })`);
  const foodTarget = new URL(foodPlan.href);
  assert.equal(foodTarget.pathname, '/pages/emergency-food-office.html');
  assert.equal(foodTarget.search, carriedPlan.search);
  assert.equal(foodTarget.hash, '#comparison');
  assert.equal(foodPlan.label, '735食分の候補を比較');
  await navigateFresh(send, emergencyFoodPage + foodTarget.search);
  assert.equal(await evaluate(send, `document.getElementById('foodEstimate').textContent`), '735食');
  await navigateFresh(send, toiletPage + carriedPlan.search);
  assert.equal(await evaluate(send, `document.getElementById('toiletEstimate').textContent`), '1,225回分');
  await navigateFresh(send, quantityPage + carriedPlan.search);
  assert.equal(await evaluate(send, `document.getElementById('waterEstimate').textContent`), '735L');

  await navigateFresh(send, quantityPage + '?staff=30&days=3&visitors=0');
  const procurement = await evaluate(send, `(() => {
    window.__budgetEvents=[];
    window.gtag=(...args)=>window.__budgetEvents.push(args);
    const row=document.querySelector('[data-procurement="water"]');
    const read=()=>({missing:row.querySelector('[data-missing]').textContent, count:row.querySelector('[data-packages]').textContent,cost:row.querySelector('[data-cost]').textContent,total:document.getElementById('procurementTotal').textContent});
    const set=(id,value)=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    const initial=read();
    set('waterStock','30');set('waterPack','12');set('waterPrice','1800');
    const priced=read();
    set('waterPrice','');const unknown=read();
    set('waterStock','300');const enough=read();
    set('waterStock','30');set('waterPrice','1800');set('staffCount','50');
    const changed=read();
    return {initial,priced,unknown,enough,changed,events:window.__budgetEvents.filter(args=>args[1]==='quantity_calculator_use' && args[2]?.calculator_type==='procurement').map(args=>args[2])};
  })()`);
  assert.equal(procurement.initial.cost, '価格を確認');
  assert.equal(procurement.priced.missing, '240L');
  assert.equal(procurement.priced.count, '20点');
  assert.equal(procurement.priced.cost, '36,000円');
  assert.match(procurement.priced.total, /小計.*未入力/);
  assert.equal(procurement.unknown.cost, '価格を確認');
  assert.equal(procurement.enough.count, '0点');
  assert.equal(procurement.enough.cost, '0円');
  assert.equal(procurement.changed.missing, '420L');
  assert.equal(procurement.changed.count, '35点');
  assert.ok(procurement.events.length > 0);
  assert.ok(procurement.events.every(event=>!('stock' in event) && !('price' in event)), 'Do not transmit inventory or budgets to analytics');
  for (const width of [375,1440]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<768});
    await evaluate(send, `document.getElementById('procurement').scrollIntoView({behavior:'instant'})`);
    assert.ok(Math.abs(await evaluate(send, `document.getElementById('procurement').getBoundingClientRect().top`)) < 100);
    const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(screenshotDir,'procurement-'+width+'.png'),Buffer.from(screenshot.data,'base64'));
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

  const nurseryPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'hoikuen-bousai.html')).href;
  for (const slug of ['water-food-stock', 'emergency-food-office', 'toilet-office', 'portable-power-kaigo']) {
    for (const width of [320, 375, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:width<768 });
      await navigateFresh(send, pathToFileURL(path.join(projectRoot, 'dist', 'pages', slug+'.html')).href);
      const comparison = await evaluate(send, `(() => {
        const table=document.querySelector('#comparison table');
        const row=table.querySelector('tbody tr');
        table.scrollIntoView({behavior:'instant'});
        return { width:document.documentElement.scrollWidth, headers:table.querySelectorAll('th').length, visibleCells:[...row.cells].filter(cell=>getComputedStyle(cell).display!=='none').length, visibleCta:!![...row.querySelectorAll('a[data-product-id]')].find(link=>link.getBoundingClientRect().width>0), scrollable:table.parentElement.scrollWidth>table.parentElement.clientWidth, hasGuide:!!document.querySelector('#purchase-checks'), text:table.textContent };
      })()`);
      assert.ok(comparison.width<=width, slug+' page overflow '+width);
      assert.equal(comparison.visibleCta,true, slug+' purchase CTA hidden');
      if(slug!=='toilet-office') {
        assert.equal(comparison.visibleCells,comparison.headers,slug+' comparison cells hidden');
        assert.ok(await evaluate(send, `document.querySelector('#comparison tbody td').getBoundingClientRect().width>=200`),slug+' product name column too narrow');
      }
      if(width<768 && slug!=='toilet-office') assert.equal(comparison.scrollable,true);
      if(slug!=='portable-power-kaigo') assert.equal(comparison.hasGuide,true);
      if(['water-food-stock','emergency-food-office'].includes(slug)) assert.match(comparison.text,/1(?:L|食)あたり約/);
      await sleep(800);
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      fs.writeFileSync(path.join(screenshotDir,slug+'-comparison-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
  }
  const restaurantPage = pathToFileURL(path.join(projectRoot, 'dist', 'pages', 'restaurant-dansui.html')).href;
  const expectedRestaurant = waterContainerTools.restaurantGroups(productData.pages.find(page=>page.slug==='restaurant-dansui').products).flatMap(group=>group.products);
  for (const width of [320,375,414,768,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await navigateFresh(send,restaurantPage);
    await sleep(1000);
    const entry=await evaluate(send,`(() => {
      const comparison=document.getElementById('comparison');
      const rows=[...comparison.querySelectorAll('tr[data-restaurant-purpose]')];
      const graphs=[...document.querySelectorAll('script[type="application/ld+json"]')].map(el=>JSON.parse(el.textContent));
      return {overflow:document.documentElement.scrollWidth>innerWidth+1,h1:document.querySelectorAll('h1').length,primary:new URL(document.querySelector('.hero-actions a').href).hash,comparisonFirst:!!(comparison.compareDocumentPosition(document.getElementById('quantity'))&Node.DOCUMENT_POSITION_FOLLOWING),ids:rows.map(row=>row.dataset.productKey),purposes:rows.map(row=>row.dataset.restaurantPurpose),faq:graphs.find(g=>g['@type']==='FAQPage')?.mainEntity.length};
    })()`);
    assert.equal(entry.overflow,false,'restaurant overflow at '+width);
    assert.equal(entry.h1,1);
    assert.equal(entry.primary,'#comparison');
    assert.equal(entry.comparisonFirst,true);
    assert.equal(entry.faq,5);
    assert.deepEqual(entry.ids,expectedRestaurant.map(p=>p.itemCode));
    if(width===375||width===1440){
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      fs.writeFileSync(path.join(screenshotDir,'restaurant-entry-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
    await evaluate(send,`document.querySelector('.hero-actions a').click()`);
    await sleep(400);
    const purchase=await evaluate(send,`(async()=>{
      const table=document.querySelector('[data-water-comparison]');
      for(const image of table.querySelectorAll('img')){image.loading='eager';await Promise.race([image.decode(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Image timeout')),15000))]);if(!image.naturalWidth)throw new Error('Product image failed');}
      table.querySelector('tbody tr').scrollIntoView({behavior:'instant',block:'start'});
      const links=[...table.querySelectorAll('.table-product a')];
      const before=window.dataLayer.length;
      document.addEventListener('click',e=>e.preventDefault(),{capture:true,once:true});links[0].click();
      return {hash:location.hash,scrollable:table.scrollWidth>table.clientWidth,links:links.map(link=>{const box=link.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(link);return {id:link.dataset.productId,price:Number(link.dataset.productPrice),href:link.href,fits:box.left>=0&&box.right<=innerWidth,height:box.height,textLines:range.getClientRects().length};}),events:window.dataLayer.slice(before).map(e=>Array.from(e)).filter(e=>e[0]==='event'&&['rakuten_click','amazon_click'].includes(e[1]))};
    })()`);
    assert.equal(purchase.hash,'#comparison');
    if(width<768)assert.equal(purchase.scrollable,true);
    for(const link of purchase.links){
      const product=expectedRestaurant.find(p=>p.itemCode===link.id);
      assert.ok(product);
      assert.equal(link.price,product.price);
      assert.equal(link.href,new URL(product.url).href);
      assert.equal(link.fits,true,'restaurant purchase CTA hidden horizontally at '+width);
      assert.ok(link.height>=44);
      assert.equal(link.textLines,1,'restaurant purchase CTA wraps at '+width);
    }
    assert.equal(purchase.events.length,1);
    assert.equal(purchase.events[0][1],'rakuten_click');
    assert.equal(purchase.events[0][2].product_id,expectedRestaurant[0].itemCode);
    assert.equal(purchase.events[0][2].cta_location,'comparison_table');
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(screenshotDir,'restaurant-comparison-'+width+'.png'),Buffer.from(shot.data,'base64'));
  }
  for (const width of [320, 375, 414, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await navigateFresh(send, nurseryPage + '?staff=35&days=7&visitors=0');
    await sleep(1200);
    const purposes = await evaluate(send, `(() => {
      const rows=[...document.querySelectorAll('#comparison tr[data-nursery-purpose]')];
      const cards=[...document.querySelectorAll('#products .product[data-nursery-purpose]')];
      const foodRows=rows.filter(row=>row.dataset.nurseryPurpose==='food');
      const links=[...document.querySelectorAll('nav[aria-label="備蓄品の用途"] a')];
      return {foodFirst:rows.slice(0,foodRows.length).every(row=>row.dataset.nurseryPurpose==='food'),foodCards:foodRows.slice(0,6).every(row=>cards.some(card=>card.dataset.productKey===row.dataset.productKey)),links:links.map(link=>{const box=link.getBoundingClientRect();const target=document.querySelector(new URL(link.href).hash);const count=rows.filter(row=>row.dataset.nurseryPurpose===target?.dataset.nurseryPurpose).length;return {hash:new URL(link.href).hash,text:link.textContent,target:!!target,unique:document.querySelectorAll(new URL(link.href).hash).length,count,fits:box.left>=0&&box.right<=window.innerWidth};})};
    })()`);
    assert.equal(purposes.foodFirst, true);
    assert.equal(purposes.foodCards, true);
    const foodEntry = await evaluate(send, `(() => {
      const comparison=document.getElementById('comparison');
      const quantity=document.getElementById('quantity');
      const primary=document.querySelector('.hero-actions a');
      return {comparisonFirst:!!(comparison.compareDocumentPosition(quantity)&Node.DOCUMENT_POSITION_FOLLOWING),primaryTarget:new URL(primary.href).hash,title:document.querySelector('h1').textContent,images:comparison.querySelectorAll('tr[data-nursery-purpose="food"] img').length,preparation:comparison.textContent.includes('準備方法')};
    })()`);
    assert.equal(foodEntry.comparisonFirst, true);
    assert.equal(foodEntry.primaryTarget, '#comparison');
    assert.match(foodEntry.title, /保育園の非常食比較/);
    assert.ok(foodEntry.images > 0);
    assert.equal(foodEntry.preparation, true);
    assert.ok(purposes.links.length > 0);
    for (const link of purposes.links) {
      assert.equal(link.target, true);
      assert.equal(link.unique, 1);
      assert.ok(link.text.includes(link.count + '件'));
      assert.equal(link.fits, true, 'purpose chip overflow at ' + width);
      await evaluate(send, `document.querySelector('nav[aria-label="備蓄品の用途"] a[href="${link.hash}"]').click()`);
      await sleep(500);
      const destination = await evaluate(send, `({hash:location.hash,visible:document.querySelector('${link.hash}').getBoundingClientRect().height>0})`);
      assert.equal(destination.hash, link.hash);
      assert.equal(destination.visible, true);
    }
    await evaluate(send, `document.querySelector('.hero').scrollIntoView({behavior:'instant',block:'start'})`);
    const entryShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDir, 'nursery-entry-' + width + '.png'), Buffer.from(entryShot.data, 'base64'));
    await evaluate(send, `document.querySelector('.hero-actions a').click()`);
    await sleep(1000);
    const foodComparison = await evaluate(send, `(() => {
      const scroll=document.querySelector('#comparison .compare-scroll');
      const images=[...document.querySelectorAll('#comparison tr[data-nursery-purpose="food"] img')];
      const link=document.querySelector('#comparison tbody .table-product a');
      const box=link.getBoundingClientRect();
      return {hash:location.hash,scrollable:scroll.scrollWidth>scroll.clientWidth,loaded:images[0]?.complete&&images[0]?.naturalWidth>0,purchaseFits:box.left>=0&&box.right<=window.innerWidth};
    })()`);
    assert.equal(foodComparison.hash, '#comparison');
    if (width < 768) assert.equal(foodComparison.scrollable, true);
    assert.equal(foodComparison.loaded, true, 'actual food image must render at ' + width);
    assert.equal(foodComparison.purchaseFits, true, 'purchase link must not require horizontal scrolling at ' + width);
    const comparisonShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDir, 'nursery-food-comparison-' + width + '.png'), Buffer.from(comparisonShot.data, 'base64'));
    const nursery = await evaluate(send, `(() => {
      const graphs = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(el => { const data = JSON.parse(el.textContent); return data['@graph'] || [data]; });
      return { width: document.documentElement.scrollWidth, headings: document.querySelectorAll('h1').length, adultNote: document.querySelector('#quantity').textContent.includes('成人のみ'), faqCount: graphs.find(x => x['@type'] === 'FAQPage')?.mainEntity.length, affiliateLinks: [...document.querySelectorAll('a')].filter(a => a.href.includes('hb.afl.rakuten.co.jp')).length, summaryVisible: !document.getElementById('planSummary').hidden, summary: document.getElementById('planSummaryText').textContent, childState: document.getElementById('nursery-meal-total').dataset.state };
    })()`);
    assert.ok(nursery.width <= width, 'nursery page overflow at ' + width);
    assert.equal(nursery.headings, 1);
    assert.equal(nursery.adultNote, true);
    assert.equal(nursery.faqCount, 5);
    assert.ok(nursery.affiliateLinks >= 8);
    assert.equal(nursery.summaryVisible, true);
    assert.match(nursery.summary, /735食/);
    assert.equal(nursery.childState, 'empty', 'adult URL values must not initialize child meal counts');
    const mealPlan = await evaluate(send, `(() => {
      const children=document.getElementById('nursery-children');
      const servings=document.getElementById('nursery-servings');
      const result=document.getElementById('nursery-meal-total');
      const adultBefore=document.getElementById('waterEstimate').textContent;
      function set(people,times){
        children.value=people;servings.value=times;
        children.dispatchEvent(new Event('input',{bubbles:true}));
        servings.dispatchEvent(new Event('input',{bubbles:true}));
        return {text:result.textContent,state:result.dataset.state};
      }
      const cases=[set('30','2'),set('50','3'),set('0','2'),set('','2'),set('-1','2'),set('1.5','2'),set('3001','2'),set('30','101')];
      set('30','2');
      return {cases,adultUnchanged:document.getElementById('waterEstimate').textContent===adultBefore,comparisonTarget:new URL(document.getElementById('nursery-meal-comparison').href).hash,notice:document.getElementById('nursery-meal-note').textContent,controlsVisible:[children,servings,result,document.getElementById('nursery-meal-comparison')].every(el=>{const box=el.getBoundingClientRect();return box.width>0&&box.left>=0&&box.right<=window.innerWidth;})};
    })()`);
    assert.deepEqual(mealPlan.cases.slice(0, 3).map(item => item.text), ['60食（提供予定）', '150食（提供予定）', '0食（提供予定）']);
    assert.equal(mealPlan.cases[3].state, 'empty');
    assert.ok(mealPlan.cases.slice(4).every(item => item.state === 'invalid'));
    assert.equal(mealPlan.adultUnchanged, true);
    assert.equal(mealPlan.comparisonTarget, '#comparison');
    assert.match(mealPlan.notice, /1袋が園児1人の1食分とは限りません/);
    assert.equal(mealPlan.controlsVisible, true);
    await evaluate(send, `document.querySelector('[data-nursery-meal-plan]').scrollIntoView({ behavior: 'instant', block: 'start' })`);
    const mealShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDir, 'nursery-meal-' + width + '.png'), Buffer.from(mealShot.data, 'base64'));
    const purchaseChecks = await evaluate(send, `(() => {
      const rows = [...document.querySelectorAll('#comparison tbody tr')];
      const candy = rows.find(row => row.textContent.includes('補助食品（食事用とは別）'));
      const quick = document.querySelector('.quick-picks');
      const cards = [...document.querySelectorAll('#products .product')];
      return { candyWarning: !candy || candy.textContent.includes('のどに詰まるおそれ'), candyInQuick: quick?.textContent.includes('補助食品（食事用とは別）') || false, foodCheck: cards.some(card => card.textContent.includes('対象年齢・原材料・食べ方・調理用の水を確認')), facilityLabel: cards.every(card => !card.textContent.includes('向いている施設')), tableScrollable: document.querySelector('#comparison table').parentElement.scrollWidth > document.querySelector('#comparison table').parentElement.clientWidth, allColumnsVisible: rows.every(row => [...row.cells].every(cell => getComputedStyle(cell).display !== 'none')) };
    })()`);
    assert.equal(purchaseChecks.candyWarning, true);
    assert.equal(purchaseChecks.candyInQuick, false);
    assert.equal(purchaseChecks.foodCheck, true);
    assert.equal(purchaseChecks.facilityLabel, true);
    assert.equal(purchaseChecks.allColumnsVisible, true);
    if (width < 768) assert.equal(purchaseChecks.tableScrollable, true);
    await evaluate(send, `document.querySelector('#products').scrollIntoView({ behavior: 'instant', block: 'start' })`);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDir, 'nursery-' + width + '.png'), Buffer.from(shot.data, 'base64'));
  }

  for (const width of [375, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await navigateFresh(send, toiletPage);
    await verifyPurchasePlans(send, width);
    const amazonCard = await evaluate(send, `(() => {
      const link=document.querySelector('#products a[data-affiliate-merchant="amazon"]');
      if(!link)return false;
      link.closest('.product').scrollIntoView({behavior:'instant',block:'start'});
      return true;
    })()`);
    if (amazonCard) {
      await sleep(400);
      const amazonScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(screenshotDir, `amazon-choice-${width}.png`), Buffer.from(amazonScreenshot.data, 'base64'));
    }
    for (const section of ['purchase-units', 'comparison']) {
      await evaluate(send, `document.getElementById('${section}').scrollIntoView({ behavior: 'instant', block: 'start' })`);
      await sleep(400);
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(screenshotDir, `toilet-${section}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  }
  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(' / ')}`);
  console.log(JSON.stringify({ status: 'PASS', amazon: amazonResults, widths: widthResults, zeroPlan, power: powerResults, office: officeResults, emergencyFood: emergencyFoodResults, quantity: quantityResults, home: homeResults, checklist: checklistResults }, null, 2));
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
