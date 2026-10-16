// Vercel serverless function: GET/PUT /api/state  (optional sync, needs an Upstash Redis database + PIN env var)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

module.exports = async (req, res) => {
  if (!URL_ || !TOKEN) return res.status(501).send('{}');
  if (process.env.PIN && req.headers['x-pin'] !== process.env.PIN) return res.status(401).send('pin');
  const auth = { Authorization: 'Bearer ' + TOKEN };
  try {
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (body.length > 200000) return res.status(413).send('too big');
      await fetch(URL_ + '/set/ledger-state', { method: 'POST', headers: auth, body });
      return res.status(200).send('ok');
    }
    const r = await fetch(URL_ + '/get/ledger-state', { headers: auth });
    const j = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(j.result || '{}');
  } catch (e) {
    return res.status(500).send('{}');
  }
};
