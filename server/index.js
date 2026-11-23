'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const { initDatabase, getProfile, mapProject, DATA_DIR } = require('./db');
const { exportStatic } = require('../scripts/export-static');
const {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getSessionUser,
  buildCookie
} = require('./auth');

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_UPLOADS = path.join(ROOT_DIR, 'public', 'uploads');
const RUNTIME_UPLOADS = path.join(DATA_DIR, 'uploads');

const db = initDatabase();

const CATEGORIES = [
  { id: 'all', label: 'Все проекты' },
  { id: 'website', label: 'Сайты' },
  { id: 'webapp', label: 'Веб-приложения' },
  { id: 'telegram_bot', label: 'Telegram-боты' },
  { id: 'mini_app', label: 'Mini Apps' },
  { id: 'desktop_mobile', label: 'Приложения' },
  { id: 'automation', label: 'Автоматизация' }
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function readJson(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Файл или запрос превышает лимит 8 МБ'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некорректный JSON'));
      }
    });
    req.on('error', reject);
  });
}

function slugify(str) {
  const base = String(str || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `project-${crypto.randomBytes(2).toString('hex')}`;
}

function requireAdmin(res, user) {
  if (!user || user.role !== 'admin') {
    sendJson(res, 401, { ok: false, error: 'Требуется авторизация администратора' });
    return false;
  }
  return true;
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res, pathname) {
  const method = req.method;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'tanj1ns-portfolio' });
  }

  const user = getSessionUser(db, req);

  // Публичные данные витрины
  if (method === 'GET' && pathname === '/api/portfolio') {
    const profile = getProfile(db);
    const rows = db
      .prepare('SELECT * FROM projects WHERE published = 1 ORDER BY featured DESC, sort_order ASC, id DESC')
      .all();
    return sendJson(res, 200, {
      ok: true,
      profile,
      categories: CATEGORIES,
      projects: rows.map(mapProject),
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null
    });
  }

  // Авторизация администратора
  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return sendJson(res, 401, { ok: false, error: 'Неверный email или пароль' });
    }
    const token = createSession(db, row.id);
    return sendJson(
      res,
      200,
      { ok: true, user: { id: row.id, name: row.name, email: row.email, role: row.role } },
      { 'Set-Cookie': buildCookie(token) }
    );
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (user && user.token) deleteSession(db, user.token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildCookie('', true) });
  }

  // ==================== АДМИН API ====================
  if (pathname.startsWith('/api/admin/')) {
    if (!requireAdmin(res, user)) return;

    if (method === 'GET' && pathname === '/api/admin/overview') {
      const profile = getProfile(db);
      const rows = db.prepare('SELECT * FROM projects ORDER BY featured DESC, sort_order ASC, id DESC').all();
      return sendJson(res, 200, {
        ok: true,
        profile,
        categories: CATEGORIES,
        projects: rows.map(mapProject)
      });
    }

    // Обновление профиля и ссылок на биржи
    if (method === 'PUT' && pathname === '/api/admin/profile') {
      const body = await readJson(req);
      const allowed = ['display_name', 'role_title', 'availability', 'headline', 'bio', 'focus_note'];
      const stmt = db.prepare(
        'INSERT INTO profile_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      );
      for (const key of allowed) {
        if (body[key] !== undefined) stmt.run(key, String(body[key]));
      }
      if (Array.isArray(body.skills)) {
        stmt.run('skills_json', JSON.stringify(body.skills.map((s) => String(s).trim()).filter(Boolean)));
      }
      if (Array.isArray(body.links)) {
        stmt.run('links_json', JSON.stringify(body.links));
      }
      try { exportStatic(db); } catch {}
      return sendJson(res, 200, { ok: true, profile: getProfile(db) });
    }

    // Смена пароля администратора
    if (method === 'PUT' && pathname === '/api/admin/password') {
      const body = await readJson(req);
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 6) {
        return sendJson(res, 400, { ok: false, error: 'Новый пароль должен быть не короче 6 символов' });
      }
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      if (!row || !verifyPassword(currentPassword, row.password_hash)) {
        return sendJson(res, 400, { ok: false, error: 'Текущий пароль указан неверно' });
      }
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
      return sendJson(res, 200, { ok: true });
    }

    // Создание проекта
    if (method === 'POST' && pathname === '/api/admin/projects') {
      const b = await readJson(req);
      const title = String(b.title || '').trim();
      if (!title) return sendJson(res, 400, { ok: false, error: 'Укажите название проекта' });

      let slug = slugify(b.slug || title);
      const dup = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug);
      if (dup) slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;

      const features = Array.isArray(b.features) ? b.features.filter(Boolean) : [];
      const stack = Array.isArray(b.stack) ? b.stack.filter(Boolean) : [];
      const gallery = Array.isArray(b.gallery) ? b.gallery.filter(Boolean) : [];
      const cover = String(b.coverImage || gallery[0] || '').trim();

      const info = db
        .prepare(
          `INSERT INTO projects (
            slug, title, subtitle, category, status, description,
            features_json, stack_json, cover_image, gallery_json,
            demo_url, demo_label, repo_url, year, featured, published, sort_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          slug,
          title,
          String(b.subtitle || '').trim(),
          String(b.category || 'website').trim(),
          String(b.status || 'live').trim(),
          String(b.description || '').trim(),
          JSON.stringify(features),
          JSON.stringify(stack),
          cover,
          JSON.stringify(gallery.length ? gallery : (cover ? [cover] : [])),
          String(b.demoUrl || '').trim(),
          String(b.demoLabel || 'Открыть демо').trim(),
          String(b.repoUrl || '').trim(),
          String(b.year || new Date().getFullYear()).trim(),
          b.featured ? 1 : 0,
          b.published === false ? 0 : 1,
          Number(b.sortOrder) || 0,
          new Date().toISOString()
        );

      const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(info.lastInsertRowid));
      try { exportStatic(db); } catch {}
      return sendJson(res, 201, { ok: true, project: mapProject(created) });
    }

    // Редактирование / удаление проекта
    const projMatch = pathname.match(/^\/api\/admin\/projects\/(\d+)$/);
    if (projMatch) {
      const id = Number(projMatch[1]);
      if (method === 'PUT') {
        const b = await readJson(req);
        const features = Array.isArray(b.features) ? b.features.filter(Boolean) : [];
        const stack = Array.isArray(b.stack) ? b.stack.filter(Boolean) : [];
        const gallery = Array.isArray(b.gallery) ? b.gallery.filter(Boolean) : [];
        const cover = String(b.coverImage || gallery[0] || '').trim();

        db.prepare(
          `UPDATE projects SET
            title = ?, subtitle = ?, category = ?, status = ?, description = ?,
            features_json = ?, stack_json = ?, cover_image = ?, gallery_json = ?,
            demo_url = ?, demo_label = ?, repo_url = ?, year = ?,
            featured = ?, published = ?, sort_order = ?
           WHERE id = ?`
        ).run(
          String(b.title || '').trim(),
          String(b.subtitle || '').trim(),
          String(b.category || 'website').trim(),
          String(b.status || 'live').trim(),
          String(b.description || '').trim(),
          JSON.stringify(features),
          JSON.stringify(stack),
          cover,
          JSON.stringify(gallery.length ? gallery : (cover ? [cover] : [])),
          String(b.demoUrl || '').trim(),
          String(b.demoLabel || 'Открыть демо').trim(),
          String(b.repoUrl || '').trim(),
          String(b.year || '2026').trim(),
          b.featured ? 1 : 0,
          b.published === false ? 0 : 1,
          Number(b.sortOrder) || 0,
          id
        );
        const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        try { exportStatic(db); } catch {}
        return sendJson(res, 200, { ok: true, project: mapProject(updated) });
      }

      if (method === 'DELETE') {
        db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        try { exportStatic(db); } catch {}
        return sendJson(res, 200, { ok: true });
      }
    }

    // Загрузка скриншотов проектов
    if (method === 'POST' && pathname === '/api/admin/upload') {
      const body = await readJson(req);
      const dataUrl = String(body.dataUrl || '');
      const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        return sendJson(res, 400, { ok: false, error: 'Поддерживаются только PNG, JPG или WEBP' });
      }
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const buf = Buffer.from(match[2], 'base64');
      fs.mkdirSync(RUNTIME_UPLOADS, { recursive: true });
      const fileName = `shot-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(RUNTIME_UPLOADS, fileName), buf);
      return sendJson(res, 201, { ok: true, url: `/uploads/${fileName}` });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'API маршрут не найден' });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsed.pathname;

    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname);
    }

    // Отдача загруженных скриншотов (сначала runtime DATA_DIR/uploads, затем public/uploads)
    if (pathname.startsWith('/uploads/')) {
      const safeName = path.basename(pathname);
      const runtimeFile = path.join(RUNTIME_UPLOADS, safeName);
      if (fs.existsSync(runtimeFile)) return serveFile(res, runtimeFile);
      return serveFile(res, path.join(PUBLIC_UPLOADS, safeName));
    }

    // Отдача собранного React-приложения из dist/
    if (fs.existsSync(DIST_DIR)) {
      const safeRel = path.normalize(pathname.replace(/^\/+/, '')).replace(/^(\.\.[/\\])+/, '');
      const candidate = path.join(DIST_DIR, safeRel || 'index.html');
      if (safeRel && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return serveFile(res, candidate);
      }
      return serveFile(res, path.join(DIST_DIR, 'index.html'));
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('React-приложение ещё не собрано. Выполните: npm run build');
  } catch (err) {
    console.error('[Portfolio Server Error]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Внутренняя ошибка сервера' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Портфолио TanJ1ns запущено на http://localhost:${PORT}`);
  console.log('Админ по умолчанию: admin@tanj1ns.dev / admin12345');
});
