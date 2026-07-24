import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const stricterPageCounts = new Map([
  ['toilet-office', 12],
  ['blackout-power', 12],
  ['water-food-stock', 12]
]);

export function auditRefreshData(data, options = {}) {
  const now = Number(options.now ?? Date.now());
  const maxAgeHours = Number(options.maxAgeHours ?? 12);
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const issues = [];

  if (Number(data?.schemaVersion || 0) < 2) {
    issues.push('products.json schemaVersion must be 2 or newer');
  }

  const pages = Array.isArray(data?.pages) ? data.pages : [];
  if (!pages.length) {
    issues.push('products.json contains no pages');
    return issues;
  }

  for (const page of pages) {
    const slug = String(page?.slug || 'unknown-page');
    const products = Array.isArray(page?.products) ? page.products : [];
    const requiredCount = stricterPageCounts.get(slug) || 8;

    if (page?.staleReason) {
      issues.push(`${slug}: fresh API data was not available (${page.staleReason})`);
    }
    if (products.length < requiredCount) {
      issues.push(`${slug}: only ${products.length} products; ${requiredCount} required`);
    }

    const seenIds = new Set();
    for (const product of products) {
      const id = String(product?.itemCode || '').trim();
      if (!id) {
        issues.push(`${slug}: product without itemCode`);
      } else if (seenIds.has(id)) {
        issues.push(`${slug}: duplicate itemCode ${id}`);
      } else {
        seenIds.add(id);
      }

      const fetchedAt = Date.parse(String(product?.fetchedAt || ''));
      if (!Number.isFinite(fetchedAt)) {
        issues.push(`${slug}: ${id || 'unknown product'} has invalid fetchedAt`);
        continue;
      }
      const ageMs = now - fetchedAt;
      if (ageMs < -5 * 60 * 1000) {
        issues.push(`${slug}: ${id || 'unknown product'} has a future fetchedAt`);
      } else if (ageMs > maxAgeMs) {
        issues.push(`${slug}: ${id || 'unknown product'} is older than ${maxAgeHours} hours`);
      }
    }
  }

  return issues;
}

function main() {
  const dataPath = path.join(projectRoot, 'data', 'products.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const maxAgeHours = Number(process.env.REFRESH_MAX_AGE_HOURS || 12);
  const issues = auditRefreshData(data, { maxAgeHours });

  if (issues.length) {
    console.error(issues.join('\n'));
    process.exit(1);
  }

  console.log(`Fresh product data verified: ${data.pages.length} pages, max age ${maxAgeHours} hours`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
