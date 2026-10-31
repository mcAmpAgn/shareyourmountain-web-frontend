import { useState } from 'react';
export function Header({
  count,
  onAdventures,
  page,
}: {
  count: number;
  onAdventures: () => void;
  page?: 'mountain' | 'route' | 'soiusa' | 'game';
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className={`site-header ${page ? 'site-header-solid' : ''}`}>
      <a className="brand" href="/" aria-label="Share Your Mountain, home">
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
        <a className={!page ? 'nav-active' : ''} href="/#explore">
          Esplora
        </a>
        <a
          href="/mountains"
          className={page === 'mountain' ? 'nav-active' : ''}
          aria-current={page === 'mountain' ? 'page' : undefined}
        >
          Montagne
        </a>
        <a
          href="/routes"
          className={page === 'route' ? 'nav-active' : ''}
          aria-current={page === 'route' ? 'page' : undefined}
        >
          Itinerari
        </a>
        <a
          href="/soiusa"
          className={page === 'soiusa' ? 'nav-active' : ''}
          aria-current={page === 'soiusa' ? 'page' : undefined}
        >
          Gruppi e catene
        </a>
        <a href="/#map">Mappa</a>
        <a
          href="/game"
          className={page === 'game' ? 'nav-active' : ''}
          aria-current={page === 'game' ? 'page' : undefined}
        >
          Gioca ↗
        </a>
        <a href="/#community">Il progetto</a>
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
        <a href="/" className="footer-brand">
          <img src="/assets/logo-white.png" width="507" height="53" alt="Share Your Mountain" />
        </a>
        <p>
          Condividi la tua montagna.
          <br />
          Condividi la tua passione.
        </p>
        <div>
          <a href="/mountains">Montagne</a>
          <a href="/routes">Itinerari</a>
          <a href="/soiusa">Gruppi e catene · SOIUSA</a>
          <a href="/game">Verso la vetta · Gioca</a>
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
