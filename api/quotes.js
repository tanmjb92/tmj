// Vercel serverless function: GET /api/quotes?s=O39.SI,U11.SI,...
// Tries Yahoo first. If Yahoo fails and EODHD_KEY is set, falls back to EODHD.
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const KEY = process.env.EODHD_KEY;

async function yahoo(sym, errs) {
  for (const h of HOSTS) {
    try {
      const r = await fetch('https://' + h + '/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=1d',
        { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) { errs[sym] = 'Yahoo HTTP ' + r.status; continue; }
      const m = (await r.json()).chart.result[0].meta;
      if (m.regularMarketPrice > 0) return { p: m.regularMarketPrice, t: m.regularMarketTime, s: 'Yahoo' };
      errs[sym] = 'Yahoo no price';
    } catch (e) { errs[sym] = 'Yahoo ' + String(e).slice(0, 50); }
  }
  return null;
}

// Yahoo symbol -> EODHD symbol
function eod(sym) {
  if (/=X$/.test(sym)) return sym.replace('=X', '') + '.FOREX';
  if (/\.SI$/.test(sym)) return sym.replace(/\.SI$/, '.SG');
  if (/\.L$/.test(sym)) return sym.replace(/\.L$/, '.LSE');
  if (/\.HK$/.test(sym)) return sym;
  return sym.includes('.') ? sym : sym + '.US';
}

async function eodhd(sym, errs) {
  if (!KEY) return null;
  try {
    const r = await fetch('https://eodhd.com/api/real-time/' + encodeURIComponent(eod(sym)) + '?api_token=' + KEY + '&fmt=json');
    if (!r.ok) { errs[sym] = (errs[sym] || '') + ' | EODHD HTTP ' + r.status; return null; }
    const j = await r.json();
    const p = Number(j.close);
    if (p > 0) { delete errs[sym]; return { p, t: Number(j.timestamp) || Math.floor(Date.now() / 1000), s: 'EODHD' }; }
    errs[sym] = (errs[sym] || '') + ' | EODHD no price';
  } catch (e) { errs[sym] = (errs[sym] || '') + ' | EODHD ' + String(e).slice(0, 40); }
  return null;
}

module.exports = async (req, res) => {
  const ok = s => /^[A-Za-z0-9.=^-]{1,15}$/.test(s);
  const syms = String(req.query.s || '').split(',').filter(ok).slice(0, 20);
  const all = [...new Set([...syms, 'USDSGD=X', 'HKDSGD=X'])];
  const out = {}, errs = {};
  await Promise.all(all.map(async s => {
    let q = await yahoo(s, errs);
    if (q) delete errs[s]; else q = await eodhd(s, errs);
    if (q) out[s] = q;
  }));
  if (Object.keys(errs).length) out._err = errs;
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json(out);
};
