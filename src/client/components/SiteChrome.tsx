import { useState } from 'react';
export function Header({ count, onAdventures }: { count: number; onAdventures: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <a className="brand" href="#" aria-label="Share Your Mountain, home">
        <img src="/assets/logo-white.png" alt="Share Your Mountain" width="507" height="53" />
      </a>
      <button
        className="menu-toggle icon-button"
        aria-expanded={open}
        aria-controls="navigation"
        aria-label="Apri menu"
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>
      <nav
        id="navigation"
        className={open ? 'open' : ''}
        aria-label="Menu principale"
        onClick={() => setOpen(false)}
      >
        <a className="nav-active" href="#explore">
          Esplora
        </a>
        <a href="#destinations">Destinazioni</a>
        <a href="#map">Mappa</a>
        <a href="#community">Il progetto</a>
      </nav>
      <button className="saved-button" onClick={onAdventures}>
        <span aria-hidden="true">♡</span> Le mie avventure <span>{count}</span>
      </button>
    </header>
  );
}
export function Footer({ onInfo }: { onInfo: (kind: 'data' | 'privacy') => void }) {
  return (
    <footer className="wrapper">
      <div className="footer-top">
        <a href="#" className="footer-brand">
          <img src="/assets/logo-white.png" width="507" height="53" alt="Share Your Mountain" />
        </a>
        <p>
          Condividi la tua montagna.
          <br />
          Condividi la tua passione.
        </p>
        <div>
          <a href="#explore">Esplora</a>
          <a href="#destinations">Destinazioni</a>
          <button onClick={() => onInfo('data')}>Dati e fonti</button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Share Your Mountain</span>
        <span>Fatto con passione. Per chi ama la montagna.</span>
        <button onClick={() => onInfo('privacy')}>Privacy e dati locali</button>
      </div>
    </footer>
  );
}
