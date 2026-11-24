import React, { useState, useEffect } from 'react';
import { ExternalLink, Github, X } from 'lucide-react';
import { resolveAssetUrl, safeHref, CATEGORY_LABELS, STATUS_META } from '../api.js';

export default function ProjectModal({ project, onClose }) {
  const images = (
    project.gallery?.length
      ? project.gallery
      : project.coverImage
        ? [project.coverImage]
        : []
  ).map(resolveAssetUrl);
  const [activeImg, setActiveImg] = useState(images[0] || '');

  useEffect(() => {
    setActiveImg(images[0] || '');
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [project]);

  const statusInfo = STATUS_META[project.status] || STATUS_META.live;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={project.title}>
        <div className="modal-head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {CATEGORY_LABELS[project.category] || project.category} · {project.year}
              </span>
              <span className={`status-pill ${statusInfo.cls}`}>{statusInfo.label}</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', lineHeight: 1.25 }}>{project.title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {activeImg && (
          <div>
            <img src={activeImg} alt={project.title} className="modal-gallery__main" draggable={false} />
            {images.length > 1 && (
              <div className="modal-gallery__thumbs">
                {images.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt=""
                    draggable={false}
                    className={`modal-thumb ${src === activeImg ? 'is-active' : ''}`}
                    onClick={() => setActiveImg(src)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', lineHeight: 1.7 }}>
          {project.description || project.subtitle}
        </p>

        {project.features?.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 10 }}>Что реализовано</h3>
            <ul className="feature-list">
              {project.features.map((feat, i) => (
                <li key={i}>{feat}</li>
              ))}
            </ul>
          </div>
        )}

        {project.stack?.length > 0 && (
          <div className="tags-row">
            {project.stack.map((tech, i) => (
              <span key={i} className="tag">{tech}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {project.demoUrl && (
            <a href={safeHref(project.demoUrl)} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
              <ExternalLink size={16} />
              {project.demoLabel || 'Открыть демо'}
            </a>
          )}
          {project.repoUrl && (
            <a href={safeHref(project.repoUrl)} target="_blank" rel="noopener noreferrer" className="btn btn--outline">
              <Github size={16} />
              Код на GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
