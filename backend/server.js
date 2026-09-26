import express from 'express';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { initialize, connect } from './db.js';
import * as inv from './inventory.js';
import * as sec from './security.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.join(ROOT, 'frontend');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.STOCKSENSE_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  next();
});

function sendJson(res, status, data) { res.status(status).json(data); }
function sendError(res, status, message) { res.status(status).json({ error: message }); }

function requireUser(req, res) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) { sendError(res, 401, 'Please sign in to continue.'); return null; }
  const userId = sec.readToken(auth.slice(7));
  if (!userId) { sendError(res, 401, 'Your session has expired. Please sign in again.'); return null; }
  return userId;
}

app.options('/api/*', (req,res) => res.sendStatus(204));

app.get('/api/health', (req,res) => sendJson(res, 200, { status: 'ok', app: 'StockSense' }));

app.post('/api/auth/signup', (req,res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || name.length < 2 || name.length > 80) return sendError(res, 400, 'Name must be between 2 and 80 characters.');
    const e = String(email||'').trim().toLowerCase();
    if (!/[^@\s]+@[^@\s]+\.[^@\s]+/.test(e)) return sendError(res, 400, 'Enter a valid email address.');
    if (!password || password.length < 8 || password.length > 128) return sendError(res, 400, 'Password must be between 8 and 128 characters.');
    const db = connect();
    try {
      const hash = sec.hashPassword(password);
      const stmt = db.prepare('INSERT INTO users(name, email, password_hash) VALUES (?, ?, ?)');
      const info = stmt.run(name, e, hash);
      const user = { id: info.lastInsertRowid, name, email: e };
      sendJson(res, 201, { token: sec.issueToken(user.id), user });
    } catch (err) {
      if (String(err.message).includes('UNIQUE') || String(err.code).includes('SQLITE_CONSTRAINT')) return sendError(res, 409, 'An account with this email already exists.');
      console.error(err); sendError(res, 500, 'Could not create account.');
    } finally { db.close(); }
  } catch (e) { sendError(res, 400, 'Invalid signup data.'); }
});

app.post('/api/auth/login', (req,res) => {
  try {
    const email = String(req.body.email||'').trim().toLowerCase();
    const password = String(req.body.password||'');
    const db = connect();
    try {
      const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (!user || !sec.verifyPassword(password, user.password_hash)) return sendError(res, 401, 'Email or password is incorrect.');
      sendJson(res, 200, { token: sec.issueToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
    } finally { db.close(); }
  } catch (e) { sendError(res, 400, 'Invalid login request.'); }
});

app.post('/api/auth/forgot-password', (req,res) => {
  const email = String(req.body.email||'').trim().toLowerCase();
  const code = String(Math.floor(Math.random()*1_000_000)).padStart(6,'0');
  const digest = crypto.createHash('sha256').update(code).digest('hex');
  const db = connect();
  try {
    const user = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if (user) {
      db.prepare(`INSERT INTO password_resets(email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
        ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0`).run(email, digest, Math.floor(Date.now()/1000)+600);
      console.log(`Password reset code for ${email}: ${code}`);
    }
    sendJson(res, 200, { message: 'If that account exists, a reset code has been issued. In local development, check the API terminal.' });
  } finally { db.close(); }
});

app.post('/api/auth/reset-password', (req,res) => {
  try {
    const email = String(req.body.email||'').trim().toLowerCase();
    const code = String(req.body.code||'').trim();
    const password = String(req.body.password||'');
    if (!password || password.length < 8 || password.length > 128) return sendError(res, 400, 'Password must be between 8 and 128 characters.');
    const db = connect();
    try {
      const reset = db.prepare('SELECT * FROM password_resets WHERE email=?').get(email);
      const now = Math.floor(Date.now()/1000);
      if (!reset || reset.expires_at < now || reset.attempts >= 5) return sendError(res, 400, 'Reset code is invalid or expired.');
      const submitted = crypto.createHash('sha256').update(code).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(reset.code_hash))) {
        db.prepare('UPDATE password_resets SET attempts=attempts+1 WHERE email=?').run(email);
        return sendError(res, 400, 'Reset code is invalid or expired.');
      }
      db.prepare('UPDATE users SET password_hash=? WHERE email=?').run(sec.hashPassword(password), email);
      db.prepare('DELETE FROM password_resets WHERE email=?').run(email);
      sendJson(res, 200, { message: 'Password updated. You can now sign in.' });
    } finally { db.close(); }
  } catch (e) { sendError(res, 400, 'Invalid request.'); }
});

// Protected routes and API
app.get('/api/bootstrap', (req,res) => {
  const userId = requireUser(req,res); if (!userId) return;
  try { const result = inv.bootstrap(userId); sendJson(res, 200, result); } catch (err) { console.error(err); sendError(res, 500, 'Server error'); }
});

app.get('/api/profile', (req,res) => { const userId = requireUser(req,res); if (!userId) return; const db = connect(); try { const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id=?').get(userId); sendJson(res, 200, user); } finally { db.close(); } });

app.patch('/api/profile', (req,res) => { const userId = requireUser(req,res); if (!userId) return; const name = String(req.body.name||'').trim(); if (name.length < 2 || name.length > 80) return sendError(res, 400, 'Name must be between 2 and 80 characters.'); const db = connect(); try { db.prepare('UPDATE users SET name=? WHERE id=?').run(name, userId); const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id=?').get(userId); sendJson(res, 200, user); } finally { db.close(); } });

app.get('/api/products', (req,res) => { const userId = requireUser(req,res); if (!userId) return; try { sendJson(res, 200, inv.products()); } catch (e) { console.error(e); sendError(res, 500, 'DB error'); } });
app.put('/api/products', (req,res) => { const userId = requireUser(req,res); if (!userId) return; try { const id = inv.createProduct(req.body); sendJson(res, 201, inv.products().find(p => p.id === id)); } catch (e) { if (String(e.message).includes('UNIQUE') || String(e.code).includes('SQLITE_CONSTRAINT')) sendError(res, 409, 'That SKU, category, or warehouse code already exists.'); else sendError(res, 400, 'Invalid data submitted.'); } });
app.patch('/api/products/:id', (req,res) => { const userId = requireUser(req,res); if (!userId) return; const id = Number(req.params.id); try { inv.updateProduct(id, req.body); sendJson(res, 200, inv.products().find(p => p.id === id)); } catch (e) { sendError(res, 400, 'Invalid product data.'); } });

app.get('/api/categories', (req,res) => { const userId = requireUser(req,res); if (!userId) return; const db = connect(); try { sendJson(res, 200, db.prepare('SELECT * FROM categories ORDER BY name').all()); } finally { db.close(); } });
app.put('/api/categories', (req,res) => { const userId = requireUser(req,res); if (!userId) return; try { const id = inv.createCategory(String(req.body.name||'').trim()); sendJson(res, 201, { id, name: req.body.name }); } catch (e) { sendError(res, 400, 'Invalid category'); } });

app.get('/api/warehouses', (req,res) => { const userId = requireUser(req,res); if (!userId) return; try { sendJson(res, 200, inv.warehouses()); } catch (e) { sendError(res, 500, 'DB error'); } });
app.put('/api/warehouses', (req,res) => { const userId = requireUser(req,res); if (!userId) return; try { const id = inv.createWarehouse(req.body); sendJson(res, 201, inv.warehouses().find(w => w.id === id)); } catch (e) { if (String(e.message).includes('UNIQUE')||String(e.code).includes('SQLITE_CONSTRAINT')) sendError(res, 409, 'That SKU, category, or warehouse code already exists.'); else sendError(res, 400, 'Invalid data submitted.'); } });

app.get('/api/operations', (req,res) => { const userId = requireUser(req,res); if (!userId) return; try { sendJson(res, 200, inv.listOperations()); } catch (e) { console.error(e); sendError(res, 500, 'DB error'); } });
app.post('/api/operations', (req,res) => { const userId = requireUser(req,res); if (!userId) return; try { const opId = inv.createOperation(userId, req.body); sendJson(res, 201, inv.operationDetail(opId)); } catch (e) { if (e.code === 404) sendError(res, 404, e.message); else sendError(res, 400, e.message); } });
app.post('/api/operations/:id/validate', (req,res) => { const userId = requireUser(req,res); if (!userId) return; const id = Number(req.params.id); try { inv.validateOperation(id, userId); sendJson(res, 200, inv.operationDetail(id)); } catch (e) { if (e.code === 404) sendError(res, 404, e.message); else if (e.code === 409) sendError(res, 409, e.message); else { console.error(e); sendError(res, 500, 'The database request could not be completed.'); } } });
app.post('/api/operations/:id/status', (req,res) => { const userId = requireUser(req,res); if (!userId) return; const id = Number(req.params.id); try { inv.setOperationStatus(id, req.body.status); sendJson(res, 200, inv.operationDetail(id)); } catch (e) { if (e.code === 404) sendError(res, 404, e.message); else if (e.code === 409) sendError(res, 409, e.message); else sendError(res, 400, e.message); } });
app.get('/api/operations/:id', (req,res) => { const userId = requireUser(req,res); if (!userId) return; const id = Number(req.params.id); const op = inv.operationDetail(id); if (!op) return sendError(res, 404, 'Operation not found.'); sendJson(res, 200, op); });

app.get('/api/ledger', (req,res) => { const userId = requireUser(req,res); if (!userId) return; try { sendJson(res, 200, inv.ledger()); } catch (e) { sendError(res, 500, 'DB error'); } });

// Serve frontend static files
app.use(express.static(WEB_ROOT));
app.get('*', (req,res) => { res.sendFile(path.join(WEB_ROOT, 'index.html')); });

function main() {
  initialize();
  const host = process.env.STOCKSENSE_HOST || '127.0.0.1';
  const port = process.env.PORT || process.env.STOCKSENSE_PORT || 8000;
  app.listen(port, host, () => {
    console.log(`StockSense (Node) running at http://${host}:${port}`);
    if (!process.env.STOCKSENSE_SECRET) console.warn('Warning: set STOCKSENSE_SECRET to a strong secret before deployment.');
  });
}

if (process.argv[1].endsWith('server.js') || import.meta.url === `file://${process.argv[1]}`) {
  main();
}
