import React, { useState, useEffect, useMemo } from 'react';
import {
  Terminal,
  Sun,
  Moon,
  Search,
  ExternalLink,
  Github,
  ArrowUpRight,
  Globe,
  Layers,
  Bot,
  Cpu,
  ShieldCheck,
  SlidersHorizontal,
  Menu,
  X,
  Copy,
  Check,
  User
} from 'lucide-react';
import {
  api,
  isStaticHost,
  isSecretAdminHash,
  resolveAssetUrl,
  safeHref,
  CATEGORY_LABELS,
  STATUS_META
} from './api.js';
import { createClientAuth } from './clientAuth.js';
import ProjectModal from './components/ProjectModal.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import ClientCabinet from './components/ClientCabinet.jsx';
import CookieBanner, { setCookie } from './components/CookieBanner.jsx';
import PrivacyModal from './components/PrivacyModal.jsx';

const SECRET_HASH_SESSION_KEY = 'tanj1ns_secret_hash_cache';

const portfolioClientAuth = createClientAuth({
  prefix: 'tanj1ns',
  demoSeed: {
    name: 'Дмитрий Соколов',
    email: 'client@tanj1ns.dev',
    phone: '+7 (925) 710-38-14',
    password: 'client12345',
    meta: {
      company: 'ООО «Вектор»',
      telegram: '@dsokolov_vec',
      briefs: [
        {
          id: 1,
          code: 'BRF-104',
          title: 'Интернет-магазин с личным кабинетом и СДЭК',
          budget: '140 000 ₽',
          status: 'В разработке · Этап 2/4',
          createdAt: '2026-11-20'
        }
      ]
    }
  }
});

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [secretAdminRoute, setSecretAdminRoute] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState(null);
  const [cabinetView, setCabinetView] = useState(false);

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [cookieForceOpen, setCookieForceOpen] = useState(false);

  async function fetchPortfolio() {
    const res = await api('/api/portfolio');
    setData(res);
    setLoading(false);
  }

  async function checkSecretHash() {
    const match = await isSecretAdminHash(window.location.hash);
    if (match) {
      sessionStorage.setItem(SECRET_HASH_SESSION_KEY, window.location.hash);
    }
    setSecretAdminRoute(match);
  }

  useEffect(() => {
    checkSecretHash();
    fetchPortfolio().catch(() => setLoading(false));
    portfolioClientAuth
      .me()
      .then((res) => setClient(res.client || null))
      .catch(() => {});
    const onPop = () => {
      setRoute(window.location.pathname);
      checkSecretHash();
    };
    const onHash = () => checkSecretHash();
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => {
    const list = data?.projects || [];
    if (!list.length) return;
    const checkProjectHash = () => {
      const m = window.location.hash.match(/^#project=([^&]+)/);
      if (!m) return;
      const target = decodeURIComponent(m[1]);
      const found = list.find((p) => p.slug === target || String(p.id) === target);
      if (found) setSelectedProject(found);
    };
    checkProjectHash();
    window.addEventListener('hashchange', checkProjectHash);
    return () => window.removeEventListener('hashchange', checkProjectHash);
  }, [data?.projects]);

  function navigate(path) {
    if (isStaticHost()) {
      if (path === '/admin') {
        const cached = sessionStorage.getItem(SECRET_HASH_SESSION_KEY);
        if (cached) {
          window.location.hash = cached;
          setSecretAdminRoute(true);
        }
      } else {
        if (window.location.hash) {
          window.history.pushState({}, '', window.location.pathname + window.location.search);
        }
        setSecretAdminRoute(false);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (path !== route) {
      window.history.pushState({}, '', path);
      setRoute(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    setCookie('tanj1ns_theme', next);
    try {
      localStorage.setItem('tanj1ns_theme', next);
    } catch {
      // ignore
    }
  }

  const projects = data?.projects || [];
  const profile = data?.profile || {};
  const categories = data?.categories || [];

  const categoryCounts = useMemo(() => {
    const counts = { all: projects.length };
    projects.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      const catOk = activeCategory === 'all' || p.category === activeCategory;
      const haystack = `${p.title} ${p.subtitle} ${p.description} ${(p.stack || []).join(' ')}`.toLowerCase();
      return catOk && (!q || haystack.includes(q));
    });
  }, [projects, activeCategory, search]);

  const isAdminRoute = (!isStaticHost() && route === '/admin') || secretAdminRoute;

  return (
    <>
      <header className="header">
        <div className="container header__inner">
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              setCabinetView(false);
              navigate('/');
            }}
          >
            <span className="brand__icon" aria-hidden="true">
              <Terminal size={16} />
            </span>
            <span>{profile.display_name || 'TanJ1ns'}</span>
          </a>

          {!isAdminRoute && (
            <nav className={`nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Навигация">
              <a href="#projects" className="nav__link" onClick={() => { setCabinetView(false); setMobileNavOpen(false); }}>Проекты</a>
              <a href="#workflow" className="nav__link" onClick={() => { setCabinetView(false); setMobileNavOpen(false); }}>Как работаю</a>
              <a href="#about" className="nav__link" onClick={() => { setCabinetView(false); setMobileNavOpen(false); }}>Направления и стек</a>
              <a href="#contacts" className="nav__link" onClick={() => { setCabinetView(false); setMobileNavOpen(false); }}>Фриланс-площадки</a>
              <a
                href="#cabinet"
                className={`nav__link ${cabinetView ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setCabinetView(true);
                  setMobileNavOpen(false);
                }}
              >
                Личный кабинет
              </a>
            </nav>
          )}

          <div className="header__right">
            {!isAdminRoute && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setMobileNavOpen(false);
                  setCabinetView((v) => !v);
                }}
                aria-label="Личный кабинет"
                title="Личный кабинет заказчика"
              >
                <User size={16} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Сменить тему"
              title="Сменить светлую / тёмную тему"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {!isAdminRoute && (
              <button
                type="button"
                className="icon-btn mobile-menu-btn"
                onClick={() => setMobileNavOpen((o) => !o)}
                aria-label={mobileNavOpen ? 'Закрыть меню' : 'Открыть меню'}
                aria-expanded={mobileNavOpen}
              >
                {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            )}

            {(isAdminRoute || data?.user) && (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => navigate(isAdminRoute ? '/' : '/admin')}
              >
                <SlidersHorizontal size={14} />
                {isAdminRoute ? 'Витрина' : (
                  <>
                    <span className="admin-label-full">Админ-панель</span>
                    <span className="admin-label-short">Админ</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {loading ? (
          <div className="container" style={{ padding: '96px 24px', color: 'var(--text-muted)' }}>
            Загрузка портфолио...
          </div>
        ) : isAdminRoute ? (
          <AdminPanel
            user={data?.user}
            onAuthChange={async (nextUser, reloadAll) => {
              if (reloadAll || nextUser !== undefined) {
                await fetchPortfolio();
              }
            }}
            onBackHome={() => navigate('/')}
          />
        ) : cabinetView ? (
          <ClientCabinet
            client={client}
            clientAuth={portfolioClientAuth}
            onClientChange={setClient}
            onBackToShowcase={() => setCabinetView(false)}
            onOpenPrivacy={() => setPrivacyOpen(true)}
          />
        ) : (
          <>
            {/* HERO */}
            <section className="hero">
              <div className="container hero__grid">
                <div className="hero__main">
                  <div className="hero__status">
                    <span className="status-dot" />
                    <span>{profile.availability || 'Принимаю заказы на фриланс-биржах'}</span>
                  </div>

                  <h1 className="hero__title">
                    {profile.headline || 'Делаю сайты, веб-приложения и Telegram-ботов под задачи бизнеса'}
                  </h1>

                  <p className="hero__bio">{profile.bio}</p>

                  <div className="hero__actions">
                    <a href="#projects" className="btn btn--primary">
                      Смотреть проекты ({projects.length})
                    </a>
                    <a
                      href="https://github.com/tanj1ns"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--outline"
                    >
                      <Github size={16} />
                      GitHub
                    </a>
                    <a href="#contacts" className="btn btn--ghost">
                      Фриланс-площадки →
                    </a>
                  </div>

                  {profile.focus_note && (
                    <p className="hero__note">
                      <ShieldCheck size={16} color="var(--success)" />
                      <span>{profile.focus_note}</span>
                    </p>
                  )}
                </div>

                <aside className="hero-spec" aria-label="Инженерный профиль">
                  <div className="hero-spec__head">
                    <span className="mono">SYS // TANJ1NS.DEV</span>
                    <span className="mono">RU-PROD</span>
                  </div>
                  <div className="hero-spec__list">
                    <div className="hero-spec__row">
                      <span>Витрина</span>
                      <strong className="mono">{projects.length} live-проектов</strong>
                    </div>
                    <div className="hero-spec__row">
                      <span>Стек</span>
                      <strong className="mono">React · Node.js · SQLite · Bot API</strong>
                    </div>
                    <div className="hero-spec__row">
                      <span>Деплой</span>
                      <strong className="mono">GitHub Pages + Docker РФ</strong>
                    </div>
                    <div className="hero-spec__row">
                      <span>Защита</span>
                      <strong className="mono">152-ФЗ · CSP · Anti-bot</strong>
                    </div>
                  </div>
                  <div className="hero-spec__foot mono">0 .map files · SameSite=Lax · WebP</div>
                </aside>
              </div>
            </section>

            {/* УНИВЕРСАЛЬНАЯ ВИТРИНА ПРОЕКТОВ */}
            <section className="section" id="projects">
              <div className="container">
                <div className="section-head">
                  <div>
                    <span className="section-eyebrow">Витрина работ</span>
                    <h2 className="section-title">Реализованные проекты</h2>
                  </div>
                  <p className="section-desc">
                    Сайты, веб-приложения, Telegram-боты, Mini Apps и инструменты автоматизации. Нажмите на проект, чтобы посмотреть детали и скриншоты.
                  </p>
                </div>

                <div className="toolbar">
                  <div className="tabs" role="tablist">
                    {categories
                      .filter((cat) => cat.id === 'all' || (categoryCounts[cat.id] || 0) > 0)
                      .map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          role="tab"
                          aria-selected={activeCategory === cat.id}
                          className={`tab ${activeCategory === cat.id ? 'is-active' : ''}`}
                          onClick={() => setActiveCategory(cat.id)}
                        >
                          <span>{cat.label}</span>
                          <span className="tab__count">{categoryCounts[cat.id] || 0}</span>
                        </button>
                      ))}
                  </div>

                  <div className="search-wrap">
                    <Search size={15} className="search-wrap__icon" />
                    <input
                      type="search"
                      className="search-input"
                      placeholder="Поиск по проектам и стеку..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="projects-grid">
                  {filteredProjects.length === 0 ? (
                    <div className="empty-state">
                      <p style={{ marginBottom: 8 }}>В этой категории пока нет опубликованных проектов.</p>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => {
                          setActiveCategory('all');
                          setSearch('');
                        }}
                      >
                        Показать все проекты
                      </button>
                    </div>
                  ) : (
                    filteredProjects.map((project) => {
                      const st = STATUS_META[project.status] || STATUS_META.live;
                      return (
                        <article key={project.id} className="project-card">
                          <div className="project-card__chrome" onClick={() => setSelectedProject(project)}>
                            <span className="chrome-dots" aria-hidden="true"><i /><i /><i /></span>
                            <span className="chrome-url mono">tanj1ns.github.io/{project.slug}</span>
                          </div>
                          <div className="project-card__media" onClick={() => setSelectedProject(project)}>
                            {project.coverImage ? (
                              <img src={resolveAssetUrl(project.coverImage)} alt={project.title} loading="lazy" draggable={false} />
                            ) : (
                              <div className="project-card__placeholder">
                                <Layers size={28} />
                                <span>{CATEGORY_LABELS[project.category] || 'Проект'}</span>
                              </div>
                            )}
                          </div>

                          <div className="project-card__body">
                            <div className="project-card__meta">
                              <span className="project-card__cat">
                                {CATEGORY_LABELS[project.category] || project.category} · <span className="mono">{project.year}</span>
                              </span>
                              <span className={`status-pill ${st.cls}`}>{st.label}</span>
                            </div>

                            <h3 className="project-card__title" onClick={() => setSelectedProject(project)}>
                              {project.title}
                            </h3>

                            <p className="project-card__subtitle">{project.subtitle}</p>

                            {project.stack?.length > 0 && (
                              <div className="tags-row">
                                {project.stack.map((tech, i) => (
                                  <span key={i} className="tag">{tech}</span>
                                ))}
                              </div>
                            )}

                            <div className="project-card__actions">
                              <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                onClick={() => setSelectedProject(project)}
                              >
                                Подробнее
                              </button>
                              {project.demoUrl && (
                                <a
                                  href={safeHref(project.demoUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn--outline btn--sm"
                                >
                                  <ExternalLink size={14} />
                                  {project.demoLabel || 'Демо'}
                                </a>
                              )}
                              {project.repoUrl && (
                                <a
                                  href={safeHref(project.repoUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn--ghost btn--sm"
                                >
                                  <Github size={14} />
                                  GitHub
                                </a>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {/* КАК СТРОИТСЯ РАБОТА */}
            <section className="section" id="workflow">
              <div className="container">
                <div className="section-head">
                  <div>
                    <span className="section-eyebrow">Процесс</span>
                    <h2 className="section-title">Как строится работа над проектом</h2>
                  </div>
                  <p className="section-desc">
                    Понятные этапы без воды: от оценки задачи до рабочего демо-стенда и передачи чистого кода.
                  </p>
                </div>

                <ol className="workflow-grid">
                  <li className="workflow-step">
                    <span className="workflow-step__num mono">01</span>
                    <h3>Задача и точная оценка</h3>
                    <p>Фиксируем состав страниц, интеграции, сроки и стоимость до старта разработки.</p>
                  </li>
                  <li className="workflow-step">
                    <span className="workflow-step__num mono">02</span>
                    <h3>Прототип и архитектура</h3>
                    <p>Собираем чистую структуру интерфейса, схему базы данных и базовые меры безопасности.</p>
                  </li>
                  <li className="workflow-step">
                    <span className="workflow-step__num mono">03</span>
                    <h3>Разработка и демо-стенд</h3>
                    <p>Показываю живую ссылку на каждом этапе — можно сразу кликать с компьютера и телефона.</p>
                  </li>
                  <li className="workflow-step">
                    <span className="workflow-step__num mono">04</span>
                    <h3>Деплой и передача</h3>
                    <p>Разворачиваю проект на сервере с доступом из РФ без VPN и передаю все исходники.</p>
                  </li>
                </ol>
              </div>
            </section>

            {/* НАПРАВЛЕНИЯ И СТЕК */}
            <section className="section section--alt" id="about">
              <div className="container">
                <div className="section-head">
                  <div>
                    <span className="section-eyebrow">Специализация</span>
                    <h2 className="section-title">Какие форматы разрабатываю</h2>
                  </div>
                  <p className="section-desc">
                    Постепенно пополняю витрину новыми форматами — от коммерческих сайтов до ботов и прикладных сервисов.
                  </p>
                </div>

                <div className="directions-grid">
                  <div className="direction-item">
                    <Globe size={20} className="direction-item__icon" />
                    <h3>Сайты и лендинги</h3>
                    <p>Многостраничные сайты, адаптивная вёрстка, быстрая загрузка, SEO и удобная админка.</p>
                  </div>
                  <div className="direction-item">
                    <Layers size={20} className="direction-item__icon" />
                    <h3>Веб-приложения</h3>
                    <p>React-интерфейсы, Node.js бэкенд, SQLite/PostgreSQL, роли пользователей и личные кабинеты.</p>
                  </div>
                  <div className="direction-item">
                    <Bot size={20} className="direction-item__icon" />
                    <h3>Telegram-боты и Mini Apps</h3>
                    <p>Приём заявок, каталоги, онлайн-запись и интерактивные веб-приложения прямо внутри Telegram.</p>
                  </div>
                  <div className="direction-item">
                    <Cpu size={20} className="direction-item__icon" />
                    <h3>Приложения и скрипты</h3>
                    <p>Интеграции с API, автоматизация рутинных процессов и прикладные утилиты под задачи бизнеса.</p>
                  </div>
                </div>

                {profile.skills?.length > 0 && (
                  <div>
                    <span className="section-eyebrow" style={{ marginBottom: 14 }}>Технологический стек</span>
                    <div className="skills-wrap">
                      {profile.skills.map((skill, idx) => (
                        <span key={idx} className="skill-chip">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ПЛОЩАДКИ И КОНТАКТЫ (БЕЗ ФОРМЫ ЗАКАЗОВ) */}
            <section className="section" id="contacts">
              <div className="container">
                <div className="section-head">
                  <div>
                    <span className="section-eyebrow">Связь и площадки</span>
                    <h2 className="section-title">Где меня найти</h2>
                  </div>
                  <p className="section-desc">
                    Работаю через проверенные фриланс-биржи или напрямую. Выберите удобную площадку для связи.
                  </p>
                </div>

                <div className="links-grid">
                  {(profile.links || []).map((lnk, idx) => {
                    const href = safeHref(lnk.url);
                    const isMailOrTel = href.startsWith('mailto:') || href.startsWith('tel:');
                    return (
                      <a
                        key={idx}
                        href={href}
                        target={isMailOrTel ? undefined : '_blank'}
                        rel={isMailOrTel ? undefined : 'noopener noreferrer'}
                        className="link-card"
                      >
                        <div>
                          <span className="link-card__label">{lnk.label}</span>
                          <span className="link-card__handle mono">{lnk.handle}</span>
                        </div>
                        <ArrowUpRight size={18} color="var(--text-muted)" />
                      </a>
                    );
                  })}
                </div>

                {(() => {
                  const emailLnk = (profile.links || []).find((l) => String(l.url || '').startsWith('mailto:'))
                    || { handle: 'shozenhaya@gmail.com' };
                  return (
                    <div className="contacts-actions">
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(emailLnk.handle);
                            setCopiedEmail(true);
                            setTimeout(() => setCopiedEmail(false), 2000);
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        {copiedEmail ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        {copiedEmail ? `Скопировано: ${emailLnk.handle}` : `Скопировать Email (${emailLnk.handle})`}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <span>© {new Date().getFullYear()} {profile.display_name || 'TanJ1ns'} · {profile.role_title || 'Full-Stack разработчик'}</span>
          <span className="footer__meta">
            <span>React + Vite + Node.js + SQLite</span>
            <span aria-hidden="true">·</span>
            <button type="button" className="link-inline" onClick={() => setPrivacyOpen(true)}>Политика cookie</button>
            <span aria-hidden="true">·</span>
            <button type="button" className="link-inline" onClick={() => setCookieForceOpen(true)}>Настройки cookie</button>
          </span>
        </div>
      </footer>

      {selectedProject && (
        <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
      )}

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}

      <CookieBanner
        prefix="tanj1ns"
        forceOpen={cookieForceOpen}
        onCloseForce={() => setCookieForceOpen(false)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
      />
    </>
  );
}
