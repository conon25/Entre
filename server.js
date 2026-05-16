const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const app     = express();
const PORT    = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── 헬퍼 ── */
function dataPath(filename) {
  return path.join(DATA_DIR, filename);
}

function readDb(filename) {
  const fp = dataPath(filename);
  if (!fs.existsSync(fp)) return { data: [] };
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return { data: [] }; }
}

function writeDb(filename, db) {
  fs.writeFileSync(dataPath(filename), JSON.stringify(db, null, 2), 'utf8');
}

/* ── API: sessions ── */
app.get('/tables/sessions', (req, res) => {
  const db    = readDb('sessions.json');
  const limit = parseInt(req.query.limit) || 200;
  res.json({ data: db.data.slice(0, limit) });
});

app.post('/tables/sessions', (req, res) => {
  const db  = readDb('sessions.json');
  const row = { id: uuidv4(), created_at: new Date().toISOString(), ...req.body };
  db.data.push(row);
  writeDb('sessions.json', db);
  res.status(201).json(row);
});

app.patch('/tables/sessions/:id', (req, res) => {
  const db  = readDb('sessions.json');
  const idx = db.data.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  db.data[idx] = { ...db.data[idx], ...req.body };
  writeDb('sessions.json', db);
  res.json(db.data[idx]);
});

app.delete('/tables/sessions/:id', (req, res) => {
  const db  = readDb('sessions.json');
  const idx = db.data.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  db.data.splice(idx, 1);
  writeDb('sessions.json', db);
  res.json({ ok: true });
});

/* ── API: applications ── */
app.get('/tables/applications', (req, res) => {
  const db    = readDb('applications.json');
  const limit = parseInt(req.query.limit) || 500;
  res.json({ data: db.data.slice(0, limit) });
});

app.post('/tables/applications', (req, res) => {
  const db  = readDb('applications.json');
  const row = { id: uuidv4(), created_at: new Date().toISOString(), ...req.body };
  db.data.push(row);
  writeDb('applications.json', db);
  res.status(201).json(row);
});

app.patch('/tables/applications/:id', (req, res) => {
  const db  = readDb('applications.json');
  const idx = db.data.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '신청을 찾을 수 없습니다.' });
  db.data[idx] = { ...db.data[idx], ...req.body };
  writeDb('applications.json', db);
  res.json(db.data[idx]);
});

/* ── API: photos ── */
app.get('/tables/photos', (req, res) => {
  const db    = readDb('photos.json');
  const limit = parseInt(req.query.limit) || 200;
  // 용량 절약: photo_data 필드 제외하고 반환
  const safe  = db.data.slice(0, limit).map(({ photo_data, ...rest }) => rest);
  res.json({ data: safe });
});

app.get('/tables/photos/:id', (req, res) => {
  const db  = readDb('photos.json');
  const row = db.data.find(r => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
  res.json(row);
});

app.post('/tables/photos', (req, res) => {
  const db  = readDb('photos.json');
  const row = { id: uuidv4(), created_at: new Date().toISOString(), ...req.body };
  db.data.push(row);
  writeDb('photos.json', db);
  res.status(201).json({ id: row.id, application_id: row.application_id, created_at: row.created_at });
});

/* ── 시작 ── */
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ENTRE 서버 실행 중: 포트 ${PORT}에서 모든 IP 접속 허용 (0.0.0.0)\n`);
  });