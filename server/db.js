'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'portfolio.db');

function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profile_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'website',
      status TEXT NOT NULL DEFAULT 'live',
      description TEXT NOT NULL,
      features_json TEXT NOT NULL DEFAULT '[]',
      stack_json TEXT NOT NULL DEFAULT '[]',
      cover_image TEXT DEFAULT '',
      gallery_json TEXT NOT NULL DEFAULT '[]',
      demo_url TEXT DEFAULT '',
      demo_label TEXT DEFAULT 'Открыть демо',
      repo_url TEXT DEFAULT '',
      year TEXT DEFAULT '2026',
      featured INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  seed(db);
  return db;
}

function seed(db) {
  const now = new Date().toISOString();

  // Администратор портфолио (логин/пароль можно переопределить через переменные окружения)
  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  if (userCount === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@tanj1ns.dev').trim().toLowerCase();
    const pass = process.env.ADMIN_PASSWORD || 'admin12345';
    db.prepare(
      'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('TanJ1ns', email, hashPassword(pass), 'admin', now);
  }

  // Профиль разработчика и ссылки на площадки
  const defaultProfile = {
    display_name: 'TanJ1ns',
    role_title: 'Веб-разработчик · Full-Stack',
    availability: 'Принимаю заказы на фриланс-биржах',
    headline: 'Делаю сайты, веб-приложения и Telegram-ботов под задачи бизнеса',
    bio: 'Проектирую и запускаю понятные цифровые продукты: от многостраничных коммерческих сайтов с админ-панелями до веб-сервисов, ботов и автоматизации. Здесь собраны мои живые проекты, скриншоты и ссылки на исходный код.',
    focus_note: 'Все проекты разворачиваются на серверах, стабильно доступных из РФ без VPN.',
    skills_json: JSON.stringify([
      'React',
      'Vite',
      'JavaScript (ES2024)',
      'Node.js',
      'SQLite',
      'REST API',
      'HTML5 / CSS3',
      'Telegram Bot API',
      'Git / GitHub'
    ]),
    links_json: JSON.stringify([
      { label: 'GitHub', handle: 'github.com/tanj1ns', url: 'https://github.com/tanj1ns', kind: 'github' },
      { label: 'Email', handle: 'shozenhaya@gmail.com', url: 'mailto:shozenhaya@gmail.com', kind: 'email' },
      { label: 'Kwork', handle: 'kwork.ru', url: 'https://kwork.ru', kind: 'freelance' },
      { label: 'Telegram', handle: 'Написать в Telegram', url: 'https://t.me', kind: 'telegram' }
    ])
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO profile_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaultProfile)) {
    insertSetting.run(k, String(v));
  }

  // Первый реальный проект — АПЕКС АВТО
  const projCount = db.prepare('SELECT COUNT(*) AS cnt FROM projects').get().cnt;
  if (projCount === 0) {
    db.prepare(
      `INSERT INTO projects (
        slug, title, subtitle, category, status, description,
        features_json, stack_json, cover_image, gallery_json,
        demo_url, demo_label, repo_url, year, featured, published, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'apex-auto-service',
      'АПЕКС АВТО — Многостраничный сайт автосервиса (CMS + CRM)',
      'Полноценное веб-приложение техцентра с прайс-листом, калькулятором сметы, личным кабинетом клиента, админ-панелью и заявками в Telegram.',
      'webapp',
      'live',
      'Коммерческий проект автосервиса полного цикла с разделением ролей (клиент и администратор). Реализованы отдельные страницы разделов, сквозная смета с синхронизацией между прайс-листом и калькулятором, хранение заявок и контента в SQLite, загрузка фотографий выполненных работ и безопасная серверная отправка уведомлений в Telegram-бота.',
      JSON.stringify([
        'Многостраничная структура: главная, прайс-лист с умным поиском, кейсы, калькулятор, запись, контакты',
        'Регистрация и авторизация на scrypt + HttpOnly-сессии с разделением ролей USER и ADMIN',
        'Личный кабинет клиента с профилем авто и живыми статусами ремонта',
        'Админ-панель (CMS + CRM): управление заявками, услугами, кейсами, отзывами, FAQ, настройками и ролями',
        'Серверная интеграция с Telegram Bot API без утечки токена на фронтенд',
        'Светлая и тёмная темы, адаптив под мобильные устройства и печать сметы'
      ]),
      JSON.stringify(['Node.js', 'SQLite', 'JavaScript', 'HTML / CSS', 'REST API', 'Telegram Bot API']),
      '/uploads/apex-home.png',
      JSON.stringify(['/uploads/apex-home.png', '/uploads/apex-admin.png']),
      process.env.APEX_DEMO_URL || 'https://tanj1ns.github.io/apex-auto-service/',
      'Открыть живое демо',
      'https://github.com/tanj1ns/apex-auto-service',
      '2026',
      1,
      1,
      1,
      now
    );
  }
}

function getProfile(db) {
  const rows = db.prepare('SELECT key, value FROM profile_settings').all();
  const obj = {};
  rows.forEach((r) => {
    obj[r.key] = r.value;
  });
  let skills = [];
  let links = [];
  try { skills = JSON.parse(obj.skills_json || '[]'); } catch { skills = []; }
  try { links = JSON.parse(obj.links_json || '[]'); } catch { links = []; }
  return { ...obj, skills, links };
}

function mapProject(row) {
  const safeParse = (s) => {
    try { return JSON.parse(s || '[]'); } catch { return []; }
  };
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    status: row.status,
    description: row.description,
    features: safeParse(row.features_json),
    stack: safeParse(row.stack_json),
    coverImage: row.cover_image || '',
    gallery: safeParse(row.gallery_json),
    demoUrl: row.demo_url || '',
    demoLabel: row.demo_label || 'Открыть демо',
    repoUrl: row.repo_url || '',
    year: row.year || '2026',
    featured: Boolean(row.featured),
    published: Boolean(row.published),
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at
  };
}

module.exports = { initDatabase, getProfile, mapProject, DATA_DIR };
