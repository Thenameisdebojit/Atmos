const path = require('path');
const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const PORT = process.env.PORT || 4000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'companies.json');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const adapter = new FileSync(DB_PATH);
const db = low(adapter);

db.defaults({ companies: [] }).write();

const isValidAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value || '');

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/companies/:wallet', (req, res) => {
  const walletAddress = req.params.wallet?.toLowerCase();
  if (!isValidAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const company = db
    .get('companies')
    .find({ walletAddress })
    .value();

  if (!company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  return res.json(company);
});

app.post('/companies', (req, res) => {
  const payload = req.body || {};
  const walletAddress = (payload.walletAddress || '').toLowerCase();

  if (!isValidAddress(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const now = Date.now();
  const registrationDate = Number(payload.registrationDate || now);

  const company = {
    walletAddress,
    name: payload.name || '',
    legalEntityId: payload.legalEntityId || '',
    email: payload.email || '',
    phone: payload.phone || '',
    scope1Emissions: String(payload.scope1Emissions ?? ''),
    scope2Emissions: String(payload.scope2Emissions ?? ''),
    scope3Emissions: String(payload.scope3Emissions ?? ''),
    registrationDate,
    updatedAt: now,
  };

  const existing = db.get('companies').find({ walletAddress });
  if (existing.value()) {
    existing.assign(company).write();
  } else {
    db.get('companies').push(company).write();
  }

  return res.json(company);
});

app.listen(PORT, () => {
  console.log(`ATMOS backend running on port ${PORT}`);
});
