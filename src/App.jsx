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
  SlidersHorizontal
} from 'lucide-react';
import { api, CATEGORY_LABELS, STATUS_META } from './api.js';
import ProjectModal from './components/ProjectModal.jsx';
import AdminPanel from './pages/AdminPanel.jsx';

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);

  async function fetchPortfolio() {
    const res = await api('/api/portfolio');
    setData(res);
    setLoading(false);
  }

  useEffect(() => {
    fetchPortfolio().catch(() => setLoading(false));
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(path) {
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
    localStorage.setItem('tanj1ns_theme', next);
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

  const isAdminRoute = route === '/admin';

  return (
    <>
      <header className="header">
        <div className="container header__inner">
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            <span className="brand__icon" aria-hidden="true">
              <Terminal size={16} />
            </span>
            <span>{profile.display_name || 'TanJ1ns'}</span>
          </a>

          {!isAdminRoute && (
            <nav className="nav" aria-label="Навигация">
              <a href="#projects" className="nav__link">Проекты</a>
              <a href="#about" className="nav__link">Направления и стек</a>
              <a href="#contacts" className="nav__link">Фриланс-площадки</a>
            </nav>
          )}

          <div className="header__right">
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Сменить тему"
              title="Сменить светлую / тёмную тему"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => navigate(isAdminRoute ? '/' : '/admin')}
            >
              <SlidersHorizontal size={14} />
              {isAdminRoute ? 'Витрина' : data?.user ? 'Админ-панель' : 'Админ'}
            </button>
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
        ) : (
          <>
            {/* HERO */}
            <section className="hero">
              <div className="container">
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
                    {categories.map((cat) => (
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
                          <div className="project-card__media" onClick={() => setSelectedProject(project)}>
                            {project.coverImage ? (
                              <img src={project.coverImage} alt={project.title} loading="lazy" />
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
                                  href={project.demoUrl}
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
                                  href={project.repoUrl}
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
                    Работаю через проверенные фриланс-биржи или напрямую. Ссылки можно обновлять в любой момент через админ-панель.
                  </p>
                </div>

                <div className="links-grid">
                  {(profile.links || []).map((lnk, idx) => (
                    <a
                      key={idx}
                      href={lnk.url}
                      target={lnk.url.startsWith('mailto:') ? undefined : '_blank'}
                      rel={lnk.url.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                      className="link-card"
                    >
                      <div>
                        <span className="link-card__label">{lnk.label}</span>
                        <span className="link-card__handle mono">{lnk.handle}</span>
                      </div>
                      <ArrowUpRight size={18} color="var(--text-muted)" />
                    </a>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <span>© {new Date().getFullYear()} {profile.display_name || 'TanJ1ns'} · {profile.role_title || 'Full-Stack разработчик'}</span>
          <span>React + Vite + Node.js + SQLite</span>
        </div>
      </footer>

      {selectedProject && (
        <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
      )}
    </>
  );
}
