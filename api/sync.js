module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ ok: false, error: 'KV non configuré' });

  // Upstash REST API: SET key value
  const kvSet = async (key, value) => {
    // On envoie la valeur comme JSON stringifié une seule fois
    const encoded = encodeURIComponent(JSON.stringify(value));
    const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encoded}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    return r.json();
  };

  // Upstash REST API: GET key
  const kvGet = async (key) => {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const j = await r.json();
    if (j.result === null || j.result === undefined) return null;
    // result est la string stockée, on la parse une seule fois
    try { return JSON.parse(j.result); } catch { return j.result; }
  };

  // GET — retourne toutes les données
  if (req.method === 'GET') {
    const [settings, budgets, transactions, monthBalances, savedAt] = await Promise.all([
      kvGet('budget:settings'),
      kvGet('budget:budgets'),
      kvGet('budget:transactions'),
      kvGet('budget:monthBalances'),
      kvGet('budget:savedAt'),
    ]);

    if (!settings && !transactions) {
      return res.status(200).json({ ok: false });
    }

    return res.status(200).json({
      ok: true,
      data: {
        settings: settings || null,
        budgets: Array.isArray(budgets) ? budgets : null,
        transactions: Array.isArray(transactions) ? transactions : [],
        monthBalances: (monthBalances && typeof monthBalances === 'object') ? monthBalances : {},
        _savedAt: savedAt
      }
    });
  }

  // POST — sauvegarde toutes les données
  if (req.method === 'POST') {
    const { settings, budgets, transactions, monthBalances } = req.body || {};
    const savedAt = Date.now();

    await Promise.all([
      settings      !== undefined && kvSet('budget:settings', settings),
      budgets       !== undefined && kvSet('budget:budgets', budgets),
      transactions  !== undefined && kvSet('budget:transactions', transactions),
      monthBalances !== undefined && kvSet('budget:monthBalances', monthBalances),
      kvSet('budget:savedAt', savedAt),
    ].filter(Boolean));

    return res.status(200).json({ ok: true, savedAt });
  }

  return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });
};
