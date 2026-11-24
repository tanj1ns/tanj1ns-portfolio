import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/main.css';

const PROTECTED_SELECTOR = 'img, .project-card__media, .modal-gallery__main, .modal-gallery__thumbs';

document.addEventListener('contextmenu', (e) => {
  if (e.target && e.target.closest && e.target.closest(PROTECTED_SELECTOR)) {
    e.preventDefault();
  }
});

document.addEventListener('dragstart', (e) => {
  if (e.target && e.target.closest && e.target.closest(PROTECTED_SELECTOR)) {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
