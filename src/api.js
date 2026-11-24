const SECRET_ROUTE_SALT = 'tanj1ns-route-v1:';
const SECRET_ROUTE_HASH = 'c3c9f528e20ebda98b45f68ef7e3a90ed40538909ea6a421a0a6638130177670';

const ADMIN_EMAIL = 'admin@tanj1ns.dev';
const ADMIN_PASS_SALT = 'tanj1ns-adm-v1:';
const DEFAULT_ADMIN_PASS_HASH = '1f908563b0fd366c903a0ac83605723b9aba2241b1b20246fc35a2cf3e517b79';

const STATIC_DB_KEY = 'tanj1ns_static_cms_v2';
const STATIC_SESSION_KEY = 'tanj1ns_static_admin_session_v1';
const STATIC_PASS_HASH_KEY = 'tanj1ns_static_admin_hash_v1';
const LOGIN_GUARD_KEY = 'tanj1ns_login_guard_v1';
const GH_TOKEN_KEY = 'tanj1ns_gh_publish_token_v1';

let staticModeFlag = null;

export function isStaticHost() {
  if (staticModeFlag !== null) return staticModeFlag;
  return window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
}

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str || '')));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isSecretAdminHash(hashStr) {
  const clean = String(hashStr || '')
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim();
  if (!clean) return false;
  const digest = await sha256Hex(SECRET_ROUTE_SALT + clean);
  return digest === SECRET_ROUTE_HASH;
}

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:|\.\.?\/)/i.test(url)) return url;
  if (url.startsWith('/')) return `.${url}`;
  return url;
}

export function safeHref(url) {
  const s = String(url || '').trim();
  if (!s) return '#';
  return /^(https?:\/\/|mailto:|tel:|#|\.\.?\/|\/(?!\/))/i.test(s) ? s : '#';
}

async function fetchBaseSnapshot() {
  const res = await fetch('./portfolio-data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Не удалось загрузить данные портфолио');
  return res.json();
}

async function loadStaticStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATIC_DB_KEY) || 'null');
    if (saved && saved.adminModified === true && saved.profile && Array.isArray(saved.projects)) {
      return saved;
    }
  } catch {
    // ignore corrupt storage
  }
  const base = await fetchBaseSnapshot();
  return {
    profile: base.profile || {},
    categories: base.categories || [],
    projects: base.projects || [],
    nextId: Math.max(10, ...(base.projects || []).map((p) => Number(p.id) || 0)) + 1
  };
}

function saveStaticStore(store) {
  store.adminModified = true;
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(store));
}

function getStaticAdminUser() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATIC_SESSION_KEY) || 'null');
    if (raw && raw.role === 'admin' && raw.expiresAt > Date.now()) {
      return { id: 1, name: raw.name || 'TanJ1ns', email: raw.email || ADMIN_EMAIL, role: 'admin' };
    }
  } catch {
    // ignore
  }
  return null;
}

function getStoredAdminPassHash() {
  return localStorage.getItem(STATIC_PASS_HASH_KEY) || DEFAULT_ADMIN_PASS_HASH;
}

async function staticCmsApi(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
  const user = getStaticAdminUser();

  if (method === 'GET' && url === '/api/portfolio') {
    const store = await loadStaticStore();
    return {
      ok: true,
      staticMode: true,
      profile: store.profile,
      categories: store.categories,
      projects: (store.projects || []).filter((p) => p.published !== false),
      user
    };
  }

  if (method === 'POST' && url === '/api/auth/login') {
    const now = Date.now();
    let guard = { attempts: 0, firstAt: now, lockedUntil: 0 };
    try {
      const savedGuard = JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY) || 'null');
      if (savedGuard && typeof savedGuard === 'object') guard = savedGuard;
    } catch {
      // ignore
    }

    await new Promise((r) => setTimeout(r, 450));

    if (guard.lockedUntil && guard.lockedUntil > now) {
      throw new Error('Слишком много попыток входа. Повторите через несколько минут.');
    }

    if (!guard.firstAt || now - guard.firstAt > 600_000) {
      guard = { attempts: 0, firstAt: now, lockedUntil: 0 };
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const digest = await sha256Hex(ADMIN_PASS_SALT + password);
    if (email !== ADMIN_EMAIL || digest !== getStoredAdminPassHash()) {
      guard.attempts = (guard.attempts || 0) + 1;
      if (guard.attempts >= 5) {
        guard.lockedUntil = Date.now() + 5 * 60 * 1000;
      }
      localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(guard));
      if (guard.lockedUntil > Date.now()) {
        throw new Error('Слишком много попыток входа. Доступ временно заблокирован на 5 минут.');
      }
      throw new Error('Неверный email или пароль');
    }

    localStorage.removeItem(LOGIN_GUARD_KEY);
    const session = {
      name: 'TanJ1ns',
      email: ADMIN_EMAIL,
      role: 'admin',
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14
    };
    localStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: { id: 1, name: session.name, email: session.email, role: 'admin' } };
  }

  if (method === 'POST' && url === '/api/auth/logout') {
    localStorage.removeItem(STATIC_SESSION_KEY);
    return { ok: true };
  }

  if (url.startsWith('/api/admin/')) {
    if (!user || user.role !== 'admin') {
      throw new Error('Требуется авторизация администратора');
    }

    if (method === 'GET' && url === '/api/admin/overview') {
      const store = await loadStaticStore();
      return {
        ok: true,
        staticMode: true,
        profile: store.profile,
        categories: store.categories,
        projects: store.projects
      };
    }

    if (method === 'PUT' && url === '/api/admin/profile') {
      const store = await loadStaticStore();
      const allowed = ['display_name', 'role_title', 'availability', 'headline', 'bio', 'focus_note'];
      for (const k of allowed) {
        if (body[k] !== undefined) store.profile[k] = String(body[k]);
      }
      if (Array.isArray(body.skills)) {
        store.profile.skills = body.skills.map((s) => String(s).trim()).filter(Boolean);
      }
      if (Array.isArray(body.links)) {
        store.profile.links = body.links;
      }
      saveStaticStore(store);
      return { ok: true, profile: store.profile };
    }

    if (method === 'PUT' && url === '/api/admin/password') {
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 6) throw new Error('Новый пароль должен быть не короче 6 символов');
      const curHash = await sha256Hex(ADMIN_PASS_SALT + currentPassword);
      if (curHash !== getStoredAdminPassHash()) throw new Error('Текущий пароль указан неверно');
      const nextHash = await sha256Hex(ADMIN_PASS_SALT + newPassword);
      localStorage.setItem(STATIC_PASS_HASH_KEY, nextHash);
      return { ok: true };
    }

    if (method === 'POST' && url === '/api/admin/upload') {
      const dataUrl = String(body.dataUrl || '');
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(dataUrl)) {
        throw new Error('Поддерживаются только PNG, JPG или WEBP');
      }
      return { ok: true, url: dataUrl };
    }

    if (method === 'POST' && url === '/api/admin/projects') {
      const store = await loadStaticStore();
      const title = String(body.title || '').trim();
      if (!title) throw new Error('Укажите название проекта');
      const gallery = Array.isArray(body.gallery) ? body.gallery.filter(Boolean) : [];
      const cover = String(body.coverImage || gallery[0] || '').trim();
      const created = {
        id: ++store.nextId,
        slug: `project-${Date.now()}`,
        title,
        subtitle: String(body.subtitle || '').trim(),
        category: String(body.category || 'website').trim(),
        status: String(body.status || 'live').trim(),
        description: String(body.description || '').trim(),
        features: Array.isArray(body.features) ? body.features.filter(Boolean) : [],
        stack: Array.isArray(body.stack) ? body.stack.filter(Boolean) : [],
        coverImage: cover,
        gallery: gallery.length ? gallery : cover ? [cover] : [],
        demoUrl: String(body.demoUrl || '').trim(),
        demoLabel: String(body.demoLabel || 'Открыть демо').trim(),
        repoUrl: String(body.repoUrl || '').trim(),
        year: String(body.year || new Date().getFullYear()).trim(),
        featured: Boolean(body.featured),
        published: body.published !== false,
        sortOrder: Number(body.sortOrder) || 0,
        createdAt: new Date().toISOString()
      };
      store.projects.unshift(created);
      saveStaticStore(store);
      return { ok: true, project: created };
    }

    const projMatch = url.match(/^\/api\/admin\/projects\/(\d+)$/);
    if (projMatch) {
      const id = Number(projMatch[1]);
      const store = await loadStaticStore();
      if (method === 'PUT') {
        const idx = store.projects.findIndex((p) => Number(p.id) === id);
        if (idx === -1) throw new Error('Проект не найден');
        const gallery = Array.isArray(body.gallery) ? body.gallery.filter(Boolean) : [];
        const cover = String(body.coverImage || gallery[0] || '').trim();
        store.projects[idx] = {
          ...store.projects[idx],
          title: String(body.title || '').trim(),
          subtitle: String(body.subtitle || '').trim(),
          category: String(body.category || 'website').trim(),
          status: String(body.status || 'live').trim(),
          description: String(body.description || '').trim(),
          features: Array.isArray(body.features) ? body.features.filter(Boolean) : [],
          stack: Array.isArray(body.stack) ? body.stack.filter(Boolean) : [],
          coverImage: cover,
          gallery: gallery.length ? gallery : cover ? [cover] : [],
          demoUrl: String(body.demoUrl || '').trim(),
          demoLabel: String(body.demoLabel || 'Открыть демо').trim(),
          repoUrl: String(body.repoUrl || '').trim(),
          year: String(body.year || '2026').trim(),
          featured: Boolean(body.featured),
          published: body.published !== false,
          sortOrder: Number(body.sortOrder) || 0
        };
        saveStaticStore(store);
        return { ok: true, project: store.projects[idx] };
      }
      if (method === 'DELETE') {
        store.projects = store.projects.filter((p) => Number(p.id) !== id);
        saveStaticStore(store);
        return { ok: true };
      }
    }
  }

  throw new Error('Маршрут не найден');
}

export async function exportStaticPortfolioPayload() {
  const store = await loadStaticStore();
  return {
    ok: true,
    staticMode: true,
    profile: store.profile,
    categories: store.categories,
    projects: (store.projects || []).filter((p) => p.published !== false),
    user: null
  };
}

export function resetStaticDrafts() {
  localStorage.removeItem(STATIC_DB_KEY);
}

export function getSavedGhToken() {
  return localStorage.getItem(GH_TOKEN_KEY) || '';
}

export async function publishStaticToGithub(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Укажите GitHub Personal Access Token с правом repo / contents:write');
  localStorage.setItem(GH_TOKEN_KEY, cleanToken);

  const payload = await exportStaticPortfolioPayload();
  const jsonStr = JSON.stringify(payload, null, 2);
  const bytes = new TextEncoder().encode(jsonStr);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  const contentBase64 = btoa(bin);

  async function updateFile(branch, filePath) {
    const apiUrl = `https://api.github.com/repos/tanj1ns/tanj1ns-portfolio/contents/${filePath}`;
    const headers = {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    let sha;
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'cms: update portfolio data from web admin',
        content: contentBase64,
        branch,
        ...(sha ? { sha } : {})
      })
    });
    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      throw new Error(errData.message || `Ошибка GitHub API (${putRes.status})`);
    }
  }

  await updateFile('gh-pages', 'portfolio-data.json');
  try {
    await updateFile('main', 'public/portfolio-data.json');
  } catch {
    // gh-pages уже обновлён
  }
  return { ok: true };
}

export async function api(url, options = {}) {
  if (isStaticHost()) {
    staticModeFlag = true;
    return staticCmsApi(url, options);
  }
  const opts = {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }
  try {
    const res = await fetch(url, opts);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json') && (res.status === 404 || res.status === 405)) {
      staticModeFlag = true;
      return staticCmsApi(url, options);
    }
    const data = await res.json().catch(() => ({ ok: false, error: 'Ошибка ответа сервера' }));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (err) {
    if (err && err.name === 'TypeError') {
      staticModeFlag = true;
      return staticCmsApi(url, options);
    }
    throw err;
  }
}

export const CATEGORY_LABELS = {
  all: 'Все проекты',
  website: 'Сайт',
  webapp: 'Веб-приложение',
  telegram_bot: 'Telegram-бот',
  mini_app: 'Mini App',
  desktop_mobile: 'Приложение',
  automation: 'Автоматизация'
};

export const STATUS_META = {
  live: { label: 'Запущен', cls: 'status--live' },
  demo: { label: 'Демо-стенд', cls: 'status--demo' },
  in_progress: { label: 'В разработке', cls: 'status--wip' },
  open_source: { label: 'Open Source', cls: 'status--oss' }
};
