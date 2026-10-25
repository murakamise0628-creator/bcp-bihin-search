function totalPowerWatts(loads) {
  let total = 0;
  for (const load of loads) {
    const watts = String(load.watts ?? '').trim();
    const count = String(load.count ?? '').trim();
    if (!watts && (!count || count === '1')) continue;
    if (!/^\d+$/.test(watts) || !/^\d+$/.test(count)) return null;
    const w = Number(watts);
    const n = Number(count);
    if (!Number.isSafeInteger(w) || !Number.isSafeInteger(n) || w < 1 || n < 1 || n > 1000) return null;
    total += w * n;
    if (!Number.isSafeInteger(total) || total > 100000) return null;
  }
  return total > 0 ? total : null;
}

module.exports = { totalPowerWatts };
