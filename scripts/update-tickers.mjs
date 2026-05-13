#!/usr/bin/env node
/**
 * Fetch live market data from Yahoo Finance and upsert into market_tickers.
 *
 * Yahoo's v8 chart endpoint is unauthenticated, CORS-restricted, and reliable
 * server-side. We hit it once per symbol in parallel, parse meta.regularMarketPrice
 * and meta.previousClose, and upsert.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/update-tickers.mjs
 *
 * Schedule it:
 *   - Linux/Mac cron:  *\/2 * * * *  node /path/to/update-tickers.mjs   (every 2 min)
 *   - Windows Task Scheduler
 *   - GitHub Actions cron workflow (free, every 5 min)
 *   - Supabase Edge Function (Deno equivalent in supabase/functions/)
 *
 * Frontend ticker auto-refreshes from market_tickers every 60s — no page reload.
 */

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

// Global coverage: India, USA, UK, Germany, France, Sweden, Japan, HK + FX + gold.
const SYMBOLS = [
  // India
  { yahoo: '^NSEI',    symbol: 'NIFTY 50',  display: 'Nifty 50',        order: 1 },
  { yahoo: '^BSESN',   symbol: 'SENSEX',    display: 'Sensex',          order: 2 },
  { yahoo: '^NSEBANK', symbol: 'BANKNIFTY', display: 'Bank Nifty',      order: 3 },
  // USA
  { yahoo: '^GSPC',    symbol: 'SPX',       display: 'S&P 500',         order: 4 },
  { yahoo: '^IXIC',    symbol: 'NDX',       display: 'Nasdaq Comp.',    order: 5 },
  { yahoo: '^DJI',     symbol: 'DJI',       display: 'Dow Jones',       order: 6 },
  // Europe
  { yahoo: '^FTSE',    symbol: 'FTSE100',   display: 'FTSE 100',        order: 7 },
  { yahoo: '^GDAXI',   symbol: 'DAX',       display: 'DAX',             order: 8 },
  { yahoo: '^FCHI',    symbol: 'CAC40',     display: 'CAC 40',          order: 9 },
  { yahoo: '^OMX',     symbol: 'OMX30',     display: 'OMX Stockholm 30', order: 10 },
  // Asia
  { yahoo: '^N225',    symbol: 'NIKKEI',    display: 'Nikkei 225',      order: 11 },
  { yahoo: '^HSI',     symbol: 'HSI',       display: 'Hang Seng',       order: 12 },
  // FX
  { yahoo: 'INR=X',    symbol: 'USDINR',    display: 'USD / INR',       order: 13 },
  { yahoo: 'EURUSD=X', symbol: 'EURUSD',    display: 'EUR / USD',       order: 14 },
  { yahoo: 'GBPUSD=X', symbol: 'GBPUSD',    display: 'GBP / USD',       order: 15 },
  { yahoo: 'SEK=X',    symbol: 'USDSEK',    display: 'USD / SEK',       order: 16 },
  // Commodities
  { yahoo: 'GC=F',     symbol: 'GOLD',      display: 'Gold (USD/oz)',   order: 17 },
  { yahoo: 'CL=F',     symbol: 'WTI',       display: 'WTI Crude',       order: 18 },
];

async function fetchSymbol(s) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.yahoo)}?interval=1d&range=2d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KarostartupBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { console.warn(`  · ${s.symbol.padEnd(10)} HTTP ${r.status}`); return null; }
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta) { console.warn(`  · ${s.symbol.padEnd(10)} no meta`); return null; }
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose;
    if (price == null || prev == null) { console.warn(`  · ${s.symbol.padEnd(10)} missing price`); return null; }
    const change = price - prev;
    const pct = prev ? (change / prev) * 100 : 0;
    return {
      symbol: s.symbol,
      display_name: s.display,
      value: Number(price.toFixed(4)),
      change_value: Number(change.toFixed(4)),
      change_percent: Number(pct.toFixed(2)),
      order_index: s.order,
      updated_at: new Date().toISOString(),
    };
  } catch (e) {
    console.warn(`  · ${s.symbol.padEnd(10)} error: ${e.message}`);
    return null;
  }
}

(async () => {
  console.log(`Fetching ${SYMBOLS.length} symbols from Yahoo Finance…`);
  const results = (await Promise.all(SYMBOLS.map(fetchSymbol))).filter(Boolean);
  console.log(`Got ${results.length}/${SYMBOLS.length}`);
  if (!results.length) { console.error('No data fetched — aborting upsert.'); process.exit(2); }

  const r = await fetch(`${BASE}/rest/v1/market_tickers?on_conflict=symbol`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(results),
  });
  if (!r.ok) { console.error('Upsert failed:', r.status, await r.text()); process.exit(1); }
  const updated = await r.json();
  console.log(`\nUpdated ${updated.length} tickers:\n`);
  console.log('  ' + 'symbol'.padEnd(12) + 'display'.padEnd(22) + 'value'.padStart(12) + 'change'.padStart(14));
  console.log('  ' + '─'.repeat(60));
  for (const t of updated.sort((a, b) => a.order_index - b.order_index)) {
    const dir = t.change_percent >= 0 ? '▲' : '▼';
    const valStr = Number(t.value).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const chgStr = `${dir} ${Math.abs(t.change_percent).toFixed(2)}%`;
    console.log('  ' + t.symbol.padEnd(12) + (t.display_name || '').padEnd(22) + valStr.padStart(12) + chgStr.padStart(14));
  }
})().catch((e) => { console.error(e); process.exit(1); });
