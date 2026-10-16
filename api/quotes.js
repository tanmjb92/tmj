// Vercel serverless function: GET /api/quotes?s=O39.SI,U11.SI,...
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';

async function one(sym, errs) {
  for (const h of HOSTS) {
    try {
      const r = await fetch('https://' + h + '/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=1d',
        { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) { errs[sym] = 'HTTP ' + r.status; continue; }
      const m = (await r.json()).chart.result[0].meta;
      if (m.regularMarketPrice > 0) { delete errs[sym]; return { p: m.regularMarketPrice, t: m.regularMarketTime }; }
      errs[sym] = 'no price';
    } catch (e) { errs[sym] = String(e).slice(0, 60); }
  }
  return null;
}

module.exports = async (req, res) => {
  const ok = s => /^[A-Za-z0-9.=^-]{1,15}$/.test(s);
  const syms = String(req.query.s || '').split(',').filter(ok).slice(0, 20);
  const all = [...new Set([...syms, 'USDSGD=X', 'HKDSGD=X'])];
  const out = {}, errs = {};
  await Promise.all(all.map(async s => { const q = await one(s, errs); if (q) out[s] = q; }));
  if (Object.keys(errs).length) out._err = errs;
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json(out);
};
