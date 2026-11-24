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

  // Актуальная витрина всех 6 живых проектов (upsert по slug сохраняет данные даже при существующей БД)
  const upsertProject = db.prepare(
    `INSERT INTO projects (
      slug, title, subtitle, category, status, description,
      features_json, stack_json, cover_image, gallery_json,
      demo_url, demo_label, repo_url, year, featured, published, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      category = excluded.category,
      status = excluded.status,
      description = excluded.description,
      features_json = excluded.features_json,
      stack_json = excluded.stack_json,
      cover_image = excluded.cover_image,
      gallery_json = excluded.gallery_json,
      demo_url = excluded.demo_url,
      demo_label = excluded.demo_label,
      repo_url = excluded.repo_url,
      year = excluded.year,
      featured = excluded.featured,
      published = excluded.published,
      sort_order = excluded.sort_order`
  );

  const showcaseProjects = [
    {
      slug: 'apex-auto-service',
      title: 'АПЕКС АВТО — Многостраничный сайт автосервиса (CMS + CRM)',
      subtitle: 'Полноценное веб-приложение техцентра с прайс-листом, калькулятором сметы, личным кабинетом клиента, админ-панелью и заявками в Telegram.',
      category: 'website',
      status: 'live',
      description: 'Коммерческий сайт автосервиса полного цикла с разделением ролей (клиент и администратор). Отдельные страницы разделов, сквозная смета с синхронизацией между прайс-листом и калькулятором, карта Яндекс, форма 152-ФЗ и защищённая серверная отправка заявок в Telegram.',
      features: [
        'Многостраничная структура: главная, прайс-лист с поиском, кейсы, калькулятор, запись, контакты с картой',
        'Авторизация на scrypt + HttpOnly-сессии и личный кабинет клиента с историей по номеру телефона',
        'Админ-панель (CMS + CRM): управление заявками, услугами, кейсами, отзывами, FAQ и настройками',
        'Безопасность: CSP, rate limiting, проверка CSRF Origin/Host, honeypot, согласие по 152-ФЗ'
      ],
      stack: ['Node.js', 'SQLite', 'JavaScript', 'HTML / CSS', 'Telegram Bot API'],
      coverImage: '/uploads/apex-home.webp',
      gallery: ['/uploads/apex-home.webp', '/uploads/apex-admin.webp'],
      demoUrl: process.env.APEX_DEMO_URL || 'https://tanj1ns.github.io/apex-auto-service/',
      repoUrl: 'https://github.com/tanj1ns/apex-auto-service',
      sortOrder: 1
    },
    {
      slug: 'forma-booking',
      title: 'ФОРМА — Сервис онлайн-записи и расписания мастеров',
      subtitle: 'Интерактивное бронирование услуг, барберов и свободных окон в реальном времени с переносом/отменой визита и закрытым кабинетом студии.',
      category: 'webapp',
      status: 'live',
      description: 'Веб-приложение записи для мужской студии: клиент выбирает услугу по категории, конкретного мастера или опцию «любой свободный», видит живую матрицу занятости по датам и получает код бронирования FRM-XXXX для самостоятельного переноса или отмены.',
      features: [
        'Пошаговая запись без звонков: фильтр услуг, профиль и рейтинг мастера, календарь слотов',
        'Проверка конфликтов расписания и автоподбор свободного мастера на сервере',
        'Управление существующей записью по коду (перенос даты/времени или отмена)',
        'Закрытый кабинет администратора: сетка слотов, блокировка перерывов и смена статусов'
      ],
      stack: ['React 19', 'Vite 6', 'Node.js', 'SQLite', 'REST API'],
      coverImage: '/uploads/forma-home.webp',
      gallery: ['/uploads/forma-home.webp'],
      demoUrl: 'https://tanj1ns.github.io/forma-booking/',
      repoUrl: 'https://github.com/tanj1ns/forma-booking',
      sortOrder: 2
    },
    {
      slug: 'sever-store',
      title: 'СЕВЕР — Интернет-магазин одежды с корзиной и трекером',
      subtitle: 'Минималистичный магазин технологичной одежды с фильтрами по категориям и размерам, выдвижной корзиной, промокодами и CMS заказов.',
      category: 'webapp',
      status: 'live',
      description: 'Полноценный интернет-магазин бренда городской одежды: быстрая фильтрация по размерам, поиск, карточка товара с характеристиками, расчёт доставки (ПВЗ СДЭК, курьер, самовывоз от 7 000 ₽ бесплатно), промокод SEVER10 и трекер статуса посылки по номеру.',
      features: [
        'Каталог с фильтрацией по категориям, размерам, сортировкой по цене и живым поиском',
        'Выдвижная корзина с расчётом скидки SEVER10 (−10%) и выбором способа доставки',
        'Серверный пересчёт стоимости, контроль складских остатков и трекер заказов по коду SVR-XXXX',
        'Закрытая панель управления: KPI выручки, смена статусов отгрузки и CRUD каталога'
      ],
      stack: ['React 19', 'Vite 6', 'Node.js', 'SQLite', 'REST API'],
      coverImage: '/uploads/sever-home.webp',
      gallery: ['/uploads/sever-home.webp'],
      demoUrl: 'https://tanj1ns.github.io/sever-store/',
      repoUrl: 'https://github.com/tanj1ns/sever-store',
      sortOrder: 3
    },
    {
      slug: 'potok-crm',
      title: 'ПОТОК CRM — Канбан-воронка сделок и аналитика выручки',
      subtitle: 'Быстрая CRM-система для малого бизнеса: канбан-доска с перетаскиванием, история заметок по клиентам и аналитика по каналам.',
      category: 'automation',
      status: 'live',
      description: 'Рабочее место отдела продаж: сделки распределяются по этапам «Новые → В работе → Оплачено → Завершено», перетаскиваются мышью или переводятся в один клик с мобильного, хранят хронологию комментариев и формируют аналитику конверсии и среднего чека.',
      features: [
        '4-этапная канбан-воронка с Drag-and-Drop и быстрым переводом этапов',
        'Карточка сделки с историей заметок и созданием новых заявок (152-ФЗ + антиспам)',
        'Вкладка аналитики: KPI выручки, конверсия в оплату и диаграммы по источникам лидов',
        'Закрытый кабинет администратора: выгрузка базы в CSV (UTF-8 BOM) и сброс демо-воронки'
      ],
      stack: ['React 19', 'Vite 6', 'Node.js', 'SQLite', 'HTML5 Drag & Drop'],
      coverImage: '/uploads/potok-home.webp',
      gallery: ['/uploads/potok-home.webp'],
      demoUrl: 'https://tanj1ns.github.io/potok-crm/',
      repoUrl: 'https://github.com/tanj1ns/potok-crm',
      sortOrder: 4
    },
    {
      slug: 'zerno-tma',
      title: 'ЗЕРНО — Telegram Mini App предзаказа спешелти-кофе',
      subtitle: 'Мини-приложение внутри Telegram для предзаказа напитков к нужному времени с выбором молока, объёма, сиропа и списанием бонусов.',
      category: 'mini_app',
      status: 'live',
      description: 'Мобильный интерфейс Telegram Mini App для спешелти-кофейни с интеграцией window.Telegram.WebApp: конструктор напитков, электронная карта гостя (списание бонусов до 30% чека), выбор кофейни и табло готовности на стойке.',
      features: [
        'Адаптивная оболочка Telegram Mini App с переключением компактного и широкого вида',
        'Конструктор напитка: объём (250/350/450 мл), альтернативное молоко и сиропы с расчётом цены',
        'Программа лояльности: начисление 7% и списание до 30% от суммы предзаказа',
        'Терминал бариста в закрытой админ-панели: очередь выдачи #ZRN-XXX и стоп-лист позиций'
      ],
      stack: ['React 19', 'Telegram WebApp', 'Node.js', 'SQLite', 'Vite 6'],
      coverImage: '/uploads/zerno-home.webp',
      gallery: ['/uploads/zerno-home.webp'],
      demoUrl: 'https://tanj1ns.github.io/zerno-tma/',
      repoUrl: 'https://github.com/tanj1ns/zerno-tma',
      sortOrder: 5
    },
    {
      slug: 'puls-tg-bot',
      title: 'ПУЛЬС — Telegram-бот поддержки, FAQ и рассылок + Пульт оператора',
      subtitle: 'Двухсторонняя связка Telegram Bot API и веб-консоли: интерактивный эмулятор бота, тикет-система, автоответы FAQ и сегментные рассылки.',
      category: 'telegram_bot',
      status: 'live',
      description: 'Платформа клиентского сервиса на базе Telegram Bot API: в левом окне доступен живой эмулятор бота с быстрыми кнопками и триггерами автоответов, а в правом — рабочее место оператора, где ответ сразу приходит в чат диалога.',
      features: [
        'Живой эмулятор @puls_support_bot с быстрыми командами (/start, статус заказа, возврат, тарифы)',
        'Пульт оператора: список входящих тикетов, шаблоны ответов, смена статусов и обратный звонок',
        'Нативный модуль Telegram Bot API на Node.js (long-polling getUpdates + sendMessage)',
        'Закрытые настройки бота: управление правилами автоответов FAQ и запуск рассылок по сегментам'
      ],
      stack: ['Node.js HTTPS Bot API', 'React 19', 'SQLite', 'Vite 6'],
      coverImage: '/uploads/puls-home.webp',
      gallery: ['/uploads/puls-home.webp'],
      demoUrl: 'https://tanj1ns.github.io/puls-tg-bot/',
      repoUrl: 'https://github.com/tanj1ns/puls-tg-bot',
      sortOrder: 6
    }
  ];

  for (const p of showcaseProjects) {
    upsertProject.run(
      p.slug,
      p.title,
      p.subtitle,
      p.category,
      p.status,
      p.description,
      JSON.stringify(p.features),
      JSON.stringify(p.stack),
      p.coverImage,
      JSON.stringify(p.gallery),
      p.demoUrl,
      'Открыть живое демо',
      p.repoUrl,
      '2026',
      1,
      1,
      p.sortOrder,
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
