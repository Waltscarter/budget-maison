module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ ok: false, error: 'KV non configuré' });

  const kvGet = async (key) => {
    const r = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const j = await r.json();
    if (!j.result) return null;
    try { return JSON.parse(j.result); } catch { return null; }
  };

  const kvSet = async (key, value) => {
    await fetch(`${KV_URL}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(value))
    });
  };

  if (req.method === 'GET') {
    const [settings, budgets, transactions, selectedMonth, monthBalances, savedAt] = await Promise.all([
      kvGet('budget:settings'),
      kvGet('budget:budgets'),
      kvGet('budget:transactions'),
      kvGet('budget:selectedMonth'),
      kvGet('budget:monthBalances'),
      kvGet('budget:savedAt'),
    ]);

    if (!settings && !transactions) {
      return res.status(200).json({ ok: false });
    }

    return res.status(200).json({
      ok: true,
      data: { settings, budgets, transactions, selectedMonth, monthBalances, _savedAt: savedAt }
    });
  }

  if (req.method === 'POST') {
    const { settings, budgets, transactions, selectedMonth, monthBalances } = req.body || {};
    const savedAt = Date.now();

    await Promise.all([
      settings      !== undefined && kvSet('budget:settings', settings),
      budgets       !== undefined && kvSet('budget:budgets', budgets),
      transactions  !== undefined && kvSet('budget:transactions', transactions),
      selectedMonth !== undefined && kvSet('budget:selectedMonth', selectedMonth),
      monthBalances !== undefined && kvSet('budget:monthBalances', monthBalances),
      kvSet('budget:savedAt', savedAt),
    ].filter(Boolean));

    return res.status(200).json({ ok: true, savedAt });
  }

  return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });
};
