export async function api(url, options = {}) {
  const opts = {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({ ok: false, error: 'Ошибка ответа сервера' }));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
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
