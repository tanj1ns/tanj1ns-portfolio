import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function PrivacyModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }} role="dialog" aria-modal="true" aria-label="Политика конфиденциальности и cookie">
        <div className="modal-head">
          <h3 style={{ fontSize: '1.08rem' }}>Политика cookie и 152-ФЗ</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Портфолио «TanJ1ns» использует файлы cookie с флагами <span className="mono">SameSite=Lax</span> для корректной работы сайта: техническую <span className="mono">HttpOnly</span>-сессию <span className="mono">tanj1ns_sid</span> на сервере, сохранение темы <span className="mono">tanj1ns_theme</span> и ваш выбор <span className="mono">tanj1ns_cookie_consent</span>.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          При выборе «Принять все» дополнительно сохраняется cookie <span className="mono">tanj1ns_prefs</span>; при выборе «Только необходимые» он сразу удаляется (<span className="mono">Max-Age=0</span>). Изменить решение можно в любой момент через «Настройки cookie» в подвале сайта.
        </p>
      </div>
    </div>
  );
}
