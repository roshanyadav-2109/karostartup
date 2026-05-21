#!/usr/bin/env node
/**
 * Fetch ~90 days of daily closes for each tracked symbol from Yahoo Finance
 * and upsert into the `ticker_history` table. Designed to run once a day
 * after IST market close (~12:00 UTC; we run at 13:00 UTC to be safe).
 *
 * The frontend reads this table to render a real 30-day sparkline for
 * NIFTY 50 (and a multi-symbol overview), replacing the previous mocked
 * SVG + TradingView embed.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/update-history.mjs
 */

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

// Symbols we want history for. Stored under the same `symbol` value the
// frontend uses to look them up (matches market_tickers.symbol).
const SYMBOLS = [
  { yahoo: '^NSEI',    symbol: 'NIFTY 50' },
  { yahoo: '^BSESN',   symbol: 'SENSEX' },
  { yahoo: '^NSEBANK', symbol: 'BANKNIFTY' },
  { yahoo: 'INR=X',    symbol: 'USDINR' },
  { yahoo: 'GC=F',     symbol: 'GOLD' },
  { yahoo: '^GSPC',    symbol: 'SPX' },
  { yahoo: '^IXIC',    symbol: 'NDX' },
  { yahoo: '^DJI',     symbol: 'DJI' },
  { yahoo: '^N225',    symbol: 'NIKKEI' },
  { yahoo: '^HSI',     symbol: 'HSI' },
];

async function fetchHistory(s) {
  // range=3mo gives ~63 trading days; interval=1d for daily closes.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.yahoo)}?interval=1d&range=3mo`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KarostartupBot/1.0)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) { console.warn(`  · ${s.symbol.padEnd(10)} HTTP ${r.status}`); return []; }
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  if (!result) { console.warn(`  · ${s.symbol.padEnd(10)} no result`); return []; }
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const rows = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    rows.push({
      symbol: s.symbol,
      close_date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close_value: Number(close.toFixed(6)),
    });
  }
  return rows;
}

(async () => {
  console.log(`Fetching 3-month history for ${SYMBOLS.length} symbols…`);
  const all = (await Promise.all(SYMBOLS.map(fetchHistory))).flat();
  console.log(`Got ${all.length} (symbol, date) rows`);
  if (!all.length) { console.error('No data — aborting upsert.'); process.exit(2); }

  // Upsert in chunks of 500 to keep the request body bounded.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < all.length; i += CHUNK) {
    const slice = all.slice(i, i + CHUNK);
    const r = await fetch(`${BASE}/rest/v1/ticker_history?on_conflict=symbol,close_date`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(slice),
    });
    if (!r.ok) { console.error('Upsert failed:', r.status, await r.text()); process.exit(1); }
    inserted += slice.length;
  }
  console.log(`Upserted ${inserted} rows.`);

  // Print latest close per symbol for sanity.
  console.log('\nLatest close per symbol:');
  const bySym = {};
  for (const row of all) {
    if (!bySym[row.symbol] || row.close_date > bySym[row.symbol].close_date) bySym[row.symbol] = row;
  }
  for (const s of SYMBOLS) {
    const r = bySym[s.symbol];
    if (r) console.log(`  ${r.symbol.padEnd(10)} ${r.close_date}  ${r.close_value}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
