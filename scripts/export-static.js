'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { initDatabase, getProfile, mapProject, DATA_DIR } = require('../server/db');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PUBLIC_UPLOADS = path.join(PUBLIC_DIR, 'uploads');
const RUNTIME_UPLOADS = path.join(DATA_DIR, 'uploads');

const CATEGORIES = [
  { id: 'all', label: 'Все проекты' },
  { id: 'website', label: 'Сайты' },
  { id: 'webapp', label: 'Веб-приложения' },
  { id: 'telegram_bot', label: 'Telegram-боты' },
  { id: 'mini_app', label: 'Mini Apps' },
  { id: 'desktop_mobile', label: 'Приложения' },
  { id: 'automation', label: 'Автоматизация' }
];

function exportStatic(dbInstance) {
  const db = dbInstance || initDatabase();
  const profile = getProfile(db);
  const rows = db
    .prepare('SELECT * FROM projects WHERE published = 1 ORDER BY featured DESC, sort_order ASC, id DESC')
    .all();

  fs.mkdirSync(PUBLIC_UPLOADS, { recursive: true });
  if (fs.existsSync(RUNTIME_UPLOADS)) {
    for (const file of fs.readdirSync(RUNTIME_UPLOADS)) {
      const src = path.join(RUNTIME_UPLOADS, file);
      const dst = path.join(PUBLIC_UPLOADS, file);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dst);
      }
    }
  }

  const payload = {
    ok: true,
    staticMode: true,
    profile,
    categories: CATEGORIES,
    projects: rows.map(mapProject),
    user: null
  };

  const outPath = path.join(PUBLIC_DIR, 'portfolio-data.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  return outPath;
}

if (require.main === module) {
  const out = exportStatic();
  console.log('Exported static snapshot:', out);
}

module.exports = { exportStatic };
