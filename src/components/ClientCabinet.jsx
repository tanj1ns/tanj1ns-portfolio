import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, LogOut, Plus, UserCheck } from 'lucide-react';
import { formatClientPhone } from '../clientAuth.js';

export default function ClientCabinet({
  client,
  clientAuth,
  onClientChange,
  onBackToShowcase,
  onOpenPrivacy
}) {
  const [authTab, setAuthTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMsg, setAuthMsg] = useState({ type: '', text: '' });
  const [authBusy, setAuthBusy] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regWebsite, setRegWebsite] = useState('');
  const [regConsent, setRegConsent] = useState(false);
  const regOpenedAt = useRef(Date.now());

  const [profName, setProfName] = useState('');
  const [profCompany, setProfCompany] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profTelegram, setProfTelegram] = useState('');
  const [profMsg, setProfMsg] = useState({ type: '', text: '' });
  const [profBusy, setProfBusy] = useState(false);

  const [briefTitle, setBriefTitle] = useState('');
  const [briefBudget, setBriefBudget] = useState('120 000 ₽');
  const [briefDesc, setBriefDesc] = useState('');
  const [briefWebsite, setBriefWebsite] = useState('');
  const [briefConsent, setBriefConsent] = useState(true);
  const [briefMsg, setBriefMsg] = useState({ type: '', text: '' });
  const [briefBusy, setBriefBusy] = useState(false);
  const briefOpenedAt = useRef(Date.now());

  useEffect(() => {
    if (authTab === 'register') regOpenedAt.current = Date.now();
  }, [authTab]);

  useEffect(() => {
    if (!client) return;
    setProfName(client.name || '');
    setProfCompany(client.meta?.company || '');
    setProfPhone(client.phone || '');
    setProfTelegram(client.meta?.telegram || '');
    briefOpenedAt.current = Date.now();
  }, [client]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.login(loginEmail, loginPassword);
      onClientChange(res.client);
      setLoginPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        meta: { company: regCompany.trim(), telegram: '', briefs: [] },
        consent: regConsent,
        website: regWebsite,
        elapsedMs: Date.now() - regOpenedAt.current
      });
      if (res.client) onClientChange(res.client);
      setRegPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfMsg({ type: '', text: '' });
    setProfBusy(true);
    try {
      const res = await clientAuth.updateProfile({
        name: profName,
        phone: profPhone,
        meta: { company: profCompany.trim(), telegram: profTelegram.trim() }
      });
      onClientChange(res.client);
      setProfMsg({ type: 'ok', text: 'Профиль заказчика обновлён.' });
    } catch (err) {
      setProfMsg({ type: 'err', text: err.message });
    } finally {
      setProfBusy(false);
    }
  }

  async function handleCreateBrief(e) {
    e.preventDefault();
    setBriefMsg({ type: '', text: '' });
    if (String(briefWebsite || '').trim() !== '') {
      setBriefMsg({ type: 'ok', text: 'Заявка отправлена.' });
      return;
    }
    if (Date.now() - briefOpenedAt.current < 1200) {
      setBriefMsg({ type: 'err', text: 'Проверьте описание проекта и отправьте форму ещё раз.' });
      return;
    }
    if (!briefConsent) {
      setBriefMsg({ type: 'err', text: 'Подтвердите согласие по 152-ФЗ.' });
      return;
    }
    if (briefTitle.trim().length < 3) {
      setBriefMsg({ type: 'err', text: 'Укажите название проекта.' });
      return;
    }
    setBriefBusy(true);
    try {
      const existing = Array.isArray(client?.meta?.briefs) ? client.meta.briefs : [];
      const newBrief = {
        id: Date.now(),
        code: `BRF-${105 + existing.length}`,
        title: briefTitle.trim().slice(0, 140),
        budget: briefBudget.trim().slice(0, 40) || 'По оценке',
        details: briefDesc.trim().slice(0, 600),
        status: 'На оценке',
        createdAt: new Date().toISOString().slice(0, 10)
      };
      const res = await clientAuth.updateProfile({
        name: client.name,
        phone: client.phone,
        meta: { briefs: [newBrief, ...existing] }
      });
      onClientChange(res.client);
      setBriefTitle('');
      setBriefDesc('');
      setBriefMsg({ type: 'ok', text: `Бриф ${newBrief.code} сохранён в вашем кабинете.` });
    } catch (err) {
      setBriefMsg({ type: 'err', text: err.message });
    } finally {
      setBriefBusy(false);
    }
  }

  async function handleLogout() {
    await clientAuth.logout().catch(() => {});
    onClientChange(null);
  }

  function fillDemoClient() {
    setAuthTab('login');
    setLoginEmail('client@tanj1ns.dev');
    setLoginPassword('client12345');
    setAuthMsg({ type: 'ok', text: 'Подставлены данные демо-заказчика' });
  }

  const briefs = Array.isArray(client?.meta?.briefs) ? client.meta.briefs : [];

  return (
    <section className="section">
      <div className="container">
        <div className="cab-head">
          <div>
            <span className="section-eyebrow">Кабинет заказчика TanJ1ns</span>
            <h1 className="section-title">
              {client ? `Личный кабинет · ${client.name}` : 'Личный кабинет заказчика'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--outline btn--sm" onClick={onBackToShowcase}>
              <ArrowLeft size={14} /> На витрину
            </button>
            {client && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                <LogOut size={14} /> Выйти
              </button>
            )}
          </div>
        </div>

        {!client ? (
          <div className="auth-layout">
            <div className="panel">
              <div className="tabs" style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className={`tab ${authTab === 'login' ? 'is-active' : ''}`}
                  onClick={() => {
                    setAuthTab('login');
                    setAuthMsg({ type: '', text: '' });
                  }}
                >
                  Вход
                </button>
                <button
                  type="button"
                  className={`tab ${authTab === 'register' ? 'is-active' : ''}`}
                  onClick={() => {
                    setAuthTab('register');
                    setAuthMsg({ type: '', text: '' });
                  }}
                >
                  Регистрация заказчика
                </button>
              </div>

              {authTab === 'login' ? (
                <form className="form" onSubmit={handleLogin}>
                  <div className="field">
                    <label htmlFor="prtLoginEmail">Email</label>
                    <input
                      id="prtLoginEmail"
                      type="email"
                      className="input mono"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="client@tanj1ns.dev"
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="prtLoginPass">Пароль</label>
                    <input
                      id="prtLoginPass"
                      type="password"
                      className="input"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Введите пароль"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  {authMsg.text && (
                    <p className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                      {authMsg.text}
                    </p>
                  )}
                  <button type="submit" className="btn btn--primary" disabled={authBusy}>
                    {authBusy ? 'Входим...' : 'Войти'}
                  </button>
                </form>
              ) : (
                <form className="form" onSubmit={handleRegister}>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="prtRegName">Ваше имя *</label>
                      <input
                        id="prtRegName"
                        className="input"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Дмитрий Соколов"
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="prtRegComp">Компания</label>
                      <input
                        id="prtRegComp"
                        className="input"
                        value={regCompany}
                        onChange={(e) => setRegCompany(e.target.value)}
                        placeholder="ООО «Вектор»"
                      />
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="prtRegEmail">Email *</label>
                      <input
                        id="prtRegEmail"
                        type="email"
                        className="input mono"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="prtRegPhone">Телефон</label>
                      <input
                        id="prtRegPhone"
                        type="tel"
                        className="input mono"
                        value={regPhone}
                        onChange={(e) => setRegPhone(formatClientPhone(e.target.value))}
                        placeholder="+7 (999) 000-00-00"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="prtRegPass">Пароль (от 6 символов) *</label>
                    <input
                      id="prtRegPass"
                      type="password"
                      className="input"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="hp-trap" aria-hidden="true">
                    <label htmlFor="prtRegTrap">Ваш сайт</label>
                    <input
                      id="prtRegTrap"
                      tabIndex={-1}
                      autoComplete="off"
                      value={regWebsite}
                      onChange={(e) => setRegWebsite(e.target.value)}
                    />
                  </div>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={regConsent}
                      onChange={(e) => setRegConsent(e.target.checked)}
                      required
                    />
                    <span>
                      Согласен с{' '}
                      <button type="button" className="link-inline" onClick={onOpenPrivacy}>152-ФЗ</button>
                    </span>
                  </label>
                  {authMsg.text && (
                    <p className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                      {authMsg.text}
                    </p>
                  )}
                  <button type="submit" className="btn btn--primary" disabled={authBusy}>
                    {authBusy ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
                  </button>
                </form>
              )}
            </div>

            <aside className="panel demo-creds">
              <div>
                <span className="section-eyebrow">Демо-доступ</span>
                <h2 style={{ fontSize: '1.14rem', marginBottom: 6 }}>Кабинет заказчика</h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Следите за этапами разработки, отправляйте новые брифы на оценку и храните контакты для договора.
                </p>
              </div>
              <div className="demo-creds__box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong>Тестовый заказчик</strong>
                  <span className="status-pill status--live">ЗАКАЗЧИК</span>
                </div>
                <div className="mono" style={{ fontSize: '0.8rem' }}>Email: client@tanj1ns.dev</div>
                <div className="mono" style={{ fontSize: '0.8rem', marginBottom: 10 }}>Пароль: client12345</div>
                <button type="button" className="btn btn--outline btn--sm" onClick={fillDemoClient}>
                  Подставить данные клиента
                </button>
              </div>
            </aside>
          </div>
        ) : (
          <div className="cab-grid">
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCheck size={17} /> Профиль заказчика
                </h2>
                <span className="status-pill status--live">ЗАКАЗЧИК</span>
              </div>
              <form className="form" onSubmit={handleProfileSave}>
                <div className="field">
                  <label>Email</label>
                  <input className="input mono" value={client.email} disabled />
                </div>
                <div className="field">
                  <label htmlFor="prtProfName">Имя</label>
                  <input
                    id="prtProfName"
                    className="input"
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="prtProfComp">Компания</label>
                  <input
                    id="prtProfComp"
                    className="input"
                    value={profCompany}
                    onChange={(e) => setProfCompany(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="prtProfPhone">Телефон</label>
                  <input
                    id="prtProfPhone"
                    type="tel"
                    className="input mono"
                    value={profPhone}
                    onChange={(e) => setProfPhone(formatClientPhone(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="prtProfTg">Telegram</label>
                  <input
                    id="prtProfTg"
                    className="input mono"
                    value={profTelegram}
                    onChange={(e) => setProfTelegram(e.target.value)}
                    placeholder="@username"
                  />
                </div>
                {profMsg.text && (
                  <p className={`status-msg ${profMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {profMsg.text}
                  </p>
                )}
                <button type="submit" className="btn btn--primary" disabled={profBusy}>
                  {profBusy ? 'Сохраняем...' : 'Сохранить профиль'}
                </button>
              </form>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h2 style={{ fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={17} /> Мои заявки и брифы
                  </h2>
                  <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {briefs.length}
                  </span>
                </div>

                {briefs.length === 0 ? (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Пока нет отправленных брифов. Заполните форму ниже, чтобы получить оценку сроков и стоимости.
                  </p>
                ) : (
                  <div className="cab-list">
                    {briefs.map((b) => (
                      <article key={b.id || b.code} className="cab-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong className="mono">{b.code}</strong>
                          <span className={`status-pill ${b.status === 'На оценке' ? 'status--wip' : 'status--live'}`}>
                            {b.status}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '0.96rem' }}>{b.title}</h3>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Бюджет: <strong className="mono">{b.budget}</strong> &bull; <span className="mono">{b.createdAt}</span>
                        </div>
                        {b.details && <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{b.details}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <h2 style={{ fontSize: '1.05rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={16} /> Отправить новый бриф на оценку
                </h2>
                <form className="form" onSubmit={handleCreateBrief}>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="brfTitle">Название проекта *</label>
                      <input
                        id="brfTitle"
                        className="input"
                        value={briefTitle}
                        onChange={(e) => setBriefTitle(e.target.value)}
                        placeholder="CRM + Telegram-бот для сервиса"
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="brfBudget">Ориентировочный бюджет</label>
                      <input
                        id="brfBudget"
                        className="input mono"
                        value={briefBudget}
                        onChange={(e) => setBriefBudget(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="brfDesc">Задача, интеграции и пожелания по стеку</label>
                    <textarea
                      id="brfDesc"
                      className="input"
                      rows={3}
                      value={briefDesc}
                      onChange={(e) => setBriefDesc(e.target.value)}
                      placeholder="Опишите ключевые сценарии, нужны ли админка, оплата или Telegram..."
                    />
                  </div>
                  <div className="hp-trap" aria-hidden="true">
                    <label htmlFor="brfTrap">Ваш сайт</label>
                    <input
                      id="brfTrap"
                      tabIndex={-1}
                      autoComplete="off"
                      value={briefWebsite}
                      onChange={(e) => setBriefWebsite(e.target.value)}
                    />
                  </div>
                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={briefConsent}
                      onChange={(e) => setBriefConsent(e.target.checked)}
                      required
                    />
                    <span>
                      Согласен на обработку данных по{' '}
                      <button type="button" className="link-inline" onClick={onOpenPrivacy}>152-ФЗ</button>
                    </span>
                  </label>
                  {briefMsg.text && (
                    <p className={`status-msg ${briefMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                      {briefMsg.text}
                    </p>
                  )}
                  <button type="submit" className="btn btn--primary" disabled={briefBusy}>
                    {briefBusy ? 'Сохраняем бриф...' : 'Отправить на оценку'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
