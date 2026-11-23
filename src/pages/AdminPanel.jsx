import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Upload, LogOut, ArrowLeft, ExternalLink, Star, EyeOff, Globe, Download, RotateCcw } from 'lucide-react';
import {
  api,
  isStaticHost,
  resolveAssetUrl,
  exportStaticPortfolioPayload,
  publishStaticToGithub,
  getSavedGhToken,
  resetStaticDrafts,
  CATEGORY_LABELS,
  STATUS_META
} from '../api.js';

const EMPTY_PROJECT = {
  title: '',
  subtitle: '',
  category: 'website',
  status: 'live',
  description: '',
  featuresText: '',
  stackText: '',
  coverImage: '',
  galleryText: '',
  demoUrl: '',
  demoLabel: 'Открыть демо',
  repoUrl: '',
  year: String(new Date().getFullYear()),
  featured: false,
  published: true,
  sortOrder: 0
};

export default function AdminPanel({ user, onAuthChange, onBackHome }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [profile, setProfile] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Редактор проекта
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_PROJECT);
  const [uploading, setUploading] = useState(false);

  // Редактор профиля и ссылок
  const [profForm, setProfForm] = useState({
    display_name: '',
    role_title: '',
    availability: '',
    headline: '',
    bio: '',
    focus_note: '',
    skillsText: '',
    links: []
  });

  // Смена пароля
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' });

  // Публикация в GitHub Pages (для статического хостинга)
  const [ghToken, setGhToken] = useState(() => getSavedGhToken());
  const [publishing, setPublishing] = useState(false);

  async function loadOverview() {
    const res = await api('/api/admin/overview');
    setProjects(res.projects || []);
    setProfile(res.profile || null);
    if (res.profile) {
      setProfForm({
        display_name: res.profile.display_name || '',
        role_title: res.profile.role_title || '',
        availability: res.profile.availability || '',
        headline: res.profile.headline || '',
        bio: res.profile.bio || '',
        focus_note: res.profile.focus_note || '',
        skillsText: (res.profile.skills || []).join(', '),
        links: res.profile.links || []
      });
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      loadOverview().catch((e) => setMsg({ type: 'err', text: e.message }));
    }
  }, [user]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setLoginErr('');
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      onAuthChange(res.user);
    } catch (err) {
      setLoginErr(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await api('/api/auth/logout', { method: 'POST' });
    onAuthChange(null);
  }

  function startNewProject() {
    setEditingId(null);
    setForm(EMPTY_PROJECT);
    setShowForm(true);
    setMsg({ type: '', text: '' });
  }

  function startEditProject(p) {
    setEditingId(p.id);
    setForm({
      title: p.title || '',
      subtitle: p.subtitle || '',
      category: p.category || 'website',
      status: p.status || 'live',
      description: p.description || '',
      featuresText: (p.features || []).join('\n'),
      stackText: (p.stack || []).join(', '),
      coverImage: p.coverImage || '',
      galleryText: (p.gallery || []).join('\n'),
      demoUrl: p.demoUrl || '',
      demoLabel: p.demoLabel || 'Открыть демо',
      repoUrl: p.repoUrl || '',
      year: p.year || '2026',
      featured: Boolean(p.featured),
      published: p.published !== false,
      sortOrder: p.sortOrder || 0
    });
    setShowForm(true);
    setMsg({ type: '', text: '' });
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api('/api/admin/upload', {
          method: 'POST',
          body: { dataUrl: reader.result }
        });
        setForm((prev) => {
          const existingGallery = prev.galleryText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
          if (!existingGallery.includes(res.url)) existingGallery.push(res.url);
          return {
            ...prev,
            coverImage: prev.coverImage || res.url,
            galleryText: existingGallery.join('\n')
          };
        });
        setMsg({ type: 'ok', text: `Скриншот загружен: ${res.url}` });
      } catch (err) {
        setMsg({ type: 'err', text: err.message });
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProject(e) {
    e.preventDefault();
    const payload = {
      title: form.title,
      subtitle: form.subtitle,
      category: form.category,
      status: form.status,
      description: form.description,
      features: form.featuresText.split('\n').map((x) => x.trim()).filter(Boolean),
      stack: form.stackText.split(',').map((x) => x.trim()).filter(Boolean),
      coverImage: form.coverImage.trim(),
      gallery: form.galleryText.split('\n').map((x) => x.trim()).filter(Boolean),
      demoUrl: form.demoUrl.trim(),
      demoLabel: form.demoLabel.trim() || 'Открыть демо',
      repoUrl: form.repoUrl.trim(),
      year: form.year.trim(),
      featured: form.featured,
      published: form.published,
      sortOrder: Number(form.sortOrder) || 0
    };

    try {
      if (editingId) {
        await api(`/api/admin/projects/${editingId}`, { method: 'PUT', body: payload });
        setMsg({ type: 'ok', text: 'Проект обновлён и сразу виден на витрине' });
      } else {
        await api('/api/admin/projects', { method: 'POST', body: payload });
        setMsg({ type: 'ok', text: 'Новый проект добавлен в портфолио' });
      }
      setShowForm(false);
      await loadOverview();
      onAuthChange(user, true);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleDeleteProject(p) {
    if (!window.confirm(`Удалить проект «${p.title}»?`)) return;
    try {
      await api(`/api/admin/projects/${p.id}`, { method: 'DELETE' });
      setMsg({ type: 'ok', text: 'Проект удалён' });
      await loadOverview();
      onAuthChange(user, true);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      await api('/api/admin/profile', {
        method: 'PUT',
        body: {
          display_name: profForm.display_name,
          role_title: profForm.role_title,
          availability: profForm.availability,
          headline: profForm.headline,
          bio: profForm.bio,
          focus_note: profForm.focus_note,
          skills: profForm.skillsText.split(',').map((s) => s.trim()).filter(Boolean),
          links: profForm.links.filter((l) => l.label && l.url)
        }
      });
      setMsg({ type: 'ok', text: 'Профиль и ссылки на площадки сохранены' });
      await loadOverview();
      onAuthChange(user, true);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    try {
      await api('/api/admin/password', { method: 'PUT', body: passForm });
      setPassForm({ currentPassword: '', newPassword: '' });
      setMsg({ type: 'ok', text: 'Пароль администратора успешно обновлён' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handlePublishGithub() {
    setPublishing(true);
    setMsg({ type: '', text: '' });
    try {
      await publishStaticToGithub(ghToken);
      setMsg({ type: 'ok', text: 'Опубликовано! GitHub Pages обновит сайт для всех посетителей через ~20–30 секунд.' });
    } catch (err) {
      setMsg({ type: 'err', text: `Ошибка публикации: ${err.message}` });
    } finally {
      setPublishing(false);
    }
  }

  async function handleDownloadJson() {
    const payload = await exportStaticPortfolioPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'portfolio-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ type: 'ok', text: 'Файл portfolio-data.json скачан' });
  }

  async function handleResetDrafts() {
    if (!window.confirm('Сбросить локальные черновики в этом браузере и загрузить опубликованную версию?')) return;
    resetStaticDrafts();
    await loadOverview();
    onAuthChange(user, true);
    setMsg({ type: 'ok', text: 'Локальные черновики сброшены' });
  }

  // Экран входа
  if (!user || user.role !== 'admin') {
    return (
      <div className="container admin-wrap">
        <div className="admin-login">
          <div>
            <span className="section-eyebrow">Закрытый доступ</span>
            <h1 style={{ fontSize: '1.45rem', marginBottom: 6 }}>Вход в панель портфолио</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Управляйте списком проектов (сайты, боты, приложения), скриншотами и ссылками на биржи.
            </p>
          </div>

          <form className="form" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="admEmail">Email</label>
              <input
                id="admEmail"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email администратора"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="admPass">Пароль</label>
              <input
                id="admPass"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {loginErr && <p className="status-msg status-msg--err">{loginErr}</p>}
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </form>

          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onBackHome}>
              <ArrowLeft size={14} /> На витрину
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container admin-wrap">
      <div className="admin-header">
        <div>
          <span className="section-eyebrow">CMS портфолио</span>
          <h1 style={{ fontSize: '1.6rem' }}>Управление проектами TanJ1ns</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onBackHome}>
            <ArrowLeft size={15} /> На сайт
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
            <LogOut size={15} /> Выйти
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button type="button" className={`tab ${tab === 'projects' ? 'is-active' : ''}`} onClick={() => setTab('projects')}>
          Проекты <span className="tab__count">{projects.length}</span>
        </button>
        <button type="button" className={`tab ${tab === 'profile' ? 'is-active' : ''}`} onClick={() => setTab('profile')}>
          Профиль и фриланс-биржи
        </button>
        <button type="button" className={`tab ${tab === 'security' ? 'is-active' : ''}`} onClick={() => setTab('security')}>
          Пароль
        </button>
      </div>

      {isStaticHost() && (
        <div className="panel" style={{ marginBottom: 18, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '0.94rem' }}>Публикация изменений на GitHub Pages</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Правки сразу сохраняются в вашем браузере. Чтобы их увидели все посетители сайта, нажмите «Опубликовать для всех» (нужен ваш GitHub Token, хранится только в этом браузере) или скачайте JSON.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--outline btn--sm" onClick={handleDownloadJson}>
                <Download size={14} /> Скачать JSON
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleResetDrafts}>
                <RotateCcw size={14} /> Сбросить черновик
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="password"
              className="input"
              style={{ flex: '1 1 260px', padding: '8px 12px', fontSize: '0.86rem' }}
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder="GitHub Personal Access Token (ghp_... / github_pat_...)"
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={handlePublishGithub} disabled={publishing}>
              <Globe size={14} /> {publishing ? 'Публикуем...' : 'Опубликовать для всех'}
            </button>
          </div>
        </div>
      )}

      {msg.text && (
        <p className={`status-msg ${msg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </p>
      )}

      {/* ВКЛАДКА 1: ПРОЕКТЫ */}
      {tab === 'projects' && (
        <div className="panel">
          {!showForm ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem' }}>Все опубликованные и черновые проекты</h2>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                    Добавляйте сюда любые новые работы: сайты, веб-приложения, Telegram-боты, Mini Apps и скрипты.
                  </p>
                </div>
                <button type="button" className="btn btn--primary btn--sm" onClick={startNewProject}>
                  <Plus size={16} /> Добавить проект
                </button>
              </div>

              <div className="admin-list">
                {projects.map((p) => {
                  const st = STATUS_META[p.status] || STATUS_META.live;
                  return (
                    <div key={p.id} className="admin-row">
                      <div className="admin-row__left">
                        {p.coverImage ? (
                          <img src={resolveAssetUrl(p.coverImage)} alt="" className="admin-row__thumb" />
                        ) : (
                          <div className="admin-row__thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Нет фото
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong>{p.title}</strong>
                            {p.featured && <Star size={14} color="var(--warning)" fill="var(--warning)" title="Закреплён сверху" />}
                            {!p.published && <EyeOff size={14} color="var(--text-muted)" title="Скрыт (черновик)" />}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                            <span>{CATEGORY_LABELS[p.category] || p.category}</span>
                            <span className={`status-pill ${st.cls}`}>{st.label}</span>
                            <span className="mono">{p.year}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {p.demoUrl && (
                          <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" className="icon-btn" title="Открыть демо">
                            <ExternalLink size={15} />
                          </a>
                        )}
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => startEditProject(p)}>
                          <Pencil size={14} /> Изменить
                        </button>
                        <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDeleteProject(p)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <form className="form" onSubmit={handleSaveProject}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.15rem' }}>{editingId ? 'Редактирование проекта' : 'Новый проект в портфолио'}</h2>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowForm(false)}>
                  Отмена
                </button>
              </div>

              <div className="form-grid">
                <div className="field full">
                  <label>Название проекта *</label>
                  <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Например, Бот онлайн-записи для барбершопа" required />
                </div>

                <div className="field">
                  <label>Тип проекта</label>
                  <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="website">Сайт / Лендинг</option>
                    <option value="webapp">Веб-приложение (Full-Stack / CRM)</option>
                    <option value="telegram_bot">Telegram-бот</option>
                    <option value="mini_app">Telegram Mini App</option>
                    <option value="desktop_mobile">Приложение (Desktop / Mobile)</option>
                    <option value="automation">Скрипт / Автоматизация</option>
                  </select>
                </div>

                <div className="field">
                  <label>Статус</label>
                  <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="live">Запущен (Live)</option>
                    <option value="demo">Демо-стенд</option>
                    <option value="in_progress">В разработке</option>
                    <option value="open_source">Open Source</option>
                  </select>
                </div>

                <div className="field full">
                  <label>Короткое описание для карточки *</label>
                  <input className="input" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="В 1–2 предложениях: что делает проект и какую задачу решает" required />
                </div>

                <div className="field full">
                  <label>Подробное описание (в карточке «Подробнее»)</label>
                  <textarea rows="3" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="field full">
                  <label>Ключевые функции (каждый пункт с новой строки)</label>
                  <textarea rows="4" className="input" value={form.featuresText} onChange={(e) => setForm({ ...form, featuresText: e.target.value })} placeholder={"Оплата и уведомления в Telegram\nАдмин-панель управления расписанием\nБаза данных SQLite"} />
                </div>

                <div className="field full">
                  <label>Технологии и стек (через запятую)</label>
                  <input className="input mono" value={form.stackText} onChange={(e) => setForm({ ...form, stackText: e.target.value })} placeholder="React, Node.js, SQLite, Telegram Bot API" />
                </div>

                <div className="field">
                  <label>Ссылка на демо / бота / релиз</label>
                  <input className="input mono" value={form.demoUrl} onChange={(e) => setForm({ ...form, demoUrl: e.target.value })} placeholder="https://... или https://t.me/my_bot" />
                </div>

                <div className="field">
                  <label>Текст кнопки демо</label>
                  <input className="input" value={form.demoLabel} onChange={(e) => setForm({ ...form, demoLabel: e.target.value })} placeholder="Открыть сайт / Запустить бота" />
                </div>

                <div className="field">
                  <label>Ссылка на GitHub</label>
                  <input className="input mono" value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} placeholder="https://github.com/tanj1ns/..." />
                </div>

                <div className="field">
                  <label>Год</label>
                  <input className="input mono" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                </div>

                <div className="field">
                  <label>Обложка (URL или путь /uploads/...)</label>
                  <input className="input mono" value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} placeholder="/uploads/shot-....png" />
                </div>

                <div className="field">
                  <label>Загрузить скриншот с ПК</label>
                  <label className="btn btn--outline btn--sm" style={{ cursor: 'pointer', width: 'fit-content' }}>
                    <Upload size={15} /> {uploading ? 'Загрузка...' : 'Выбрать PNG / JPG'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileUpload} hidden />
                  </label>
                </div>

                <div className="field full">
                  <label>Галерея скриншотов (по одному пути на строку)</label>
                  <textarea rows="2" className="input mono" value={form.galleryText} onChange={(e) => setForm({ ...form, galleryText: e.target.value })} />
                </div>

                <div className="field full" style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                    <span>Закрепить в начале списка</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                    <span>Опубликован (виден клиентам)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn--primary">Сохранить проект</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Отмена</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ВКЛАДКА 2: ПРОФИЛЬ И ФРИЛАНС-БИРЖИ */}
      {tab === 'profile' && profile && (
        <div className="panel">
          <form className="form" onSubmit={handleSaveProfile}>
            <div className="form-grid">
              <div className="field">
                <label>Имя / Никнейм</label>
                <input className="input" value={profForm.display_name} onChange={(e) => setProfForm({ ...profForm, display_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Специализация</label>
                <input className="input" value={profForm.role_title} onChange={(e) => setProfForm({ ...profForm, role_title: e.target.value })} />
              </div>
              <div className="field full">
                <label>Статус занятости (плашка в Hero)</label>
                <input className="input" value={profForm.availability} onChange={(e) => setProfForm({ ...profForm, availability: e.target.value })} />
              </div>
              <div className="field full">
                <label>Главный заголовок (H1)</label>
                <input className="input" value={profForm.headline} onChange={(e) => setProfForm({ ...profForm, headline: e.target.value })} />
              </div>
              <div className="field full">
                <label>Описание о себе</label>
                <textarea rows="3" className="input" value={profForm.bio} onChange={(e) => setProfForm({ ...profForm, bio: e.target.value })} />
              </div>
              <div className="field full">
                <label>Примечание под кнопками Hero</label>
                <input className="input" value={profForm.focus_note} onChange={(e) => setProfForm({ ...profForm, focus_note: e.target.value })} />
              </div>
              <div className="field full">
                <label>Стек и навыки (через запятую)</label>
                <input className="input mono" value={profForm.skillsText} onChange={(e) => setProfForm({ ...profForm, skillsText: e.target.value })} />
              </div>
            </div>

            <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: '0.94rem' }}>Ссылки на фриланс-биржи и контакты</strong>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() =>
                    setProfForm({
                      ...profForm,
                      links: [...profForm.links, { label: 'FL.ru', handle: 'Профиль', url: 'https://www.fl.ru', kind: 'freelance' }]
                    })
                  }
                >
                  <Plus size={14} /> Добавить площадку
                </button>
              </div>

              <div className="admin-list">
                {profForm.links.map((lnk, idx) => (
                  <div key={idx} className="form-grid" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                    <input
                      className="input"
                      placeholder="Название (Kwork, GitHub, Telegram...)"
                      value={lnk.label}
                      onChange={(e) => {
                        const next = [...profForm.links];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setProfForm({ ...profForm, links: next });
                      }}
                    />
                    <input
                      className="input"
                      placeholder="Подпись (@username / текст)"
                      value={lnk.handle}
                      onChange={(e) => {
                        const next = [...profForm.links];
                        next[idx] = { ...next[idx], handle: e.target.value };
                        setProfForm({ ...profForm, links: next });
                      }}
                    />
                    <input
                      className="input mono"
                      placeholder="https://... или mailto:..."
                      value={lnk.url}
                      onChange={(e) => {
                        const next = [...profForm.links];
                        next[idx] = { ...next[idx], url: e.target.value };
                        setProfForm({ ...profForm, links: next });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      style={{ width: 'fit-content' }}
                      onClick={() => setProfForm({ ...profForm, links: profForm.links.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 size={14} /> Удалить
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <button type="submit" className="btn btn--primary">Сохранить профиль</button>
            </div>
          </form>
        </div>
      )}

      {/* ВКЛАДКА 3: СМЕНА ПАРОЛЯ */}
      {tab === 'security' && (
        <div className="panel" style={{ maxWidth: 460 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 14 }}>Смена пароля администратора</h2>
          <form className="form" onSubmit={handleChangePassword}>
            <div className="field">
              <label>Текущий пароль</label>
              <input
                type="password"
                className="input"
                value={passForm.currentPassword}
                onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Новый пароль (минимум 6 символов)</label>
              <input
                type="password"
                className="input"
                minLength={6}
                value={passForm.newPassword}
                onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn--primary">Обновить пароль</button>
          </form>
        </div>
      )}
    </div>
  );
}
