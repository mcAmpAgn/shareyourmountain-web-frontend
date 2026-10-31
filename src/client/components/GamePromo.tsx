import './game-promo.css';
export function GamePromo() {
  return (
    <section id="game" className="game-promo wrapper" aria-labelledby="game-promo-title">
      <div className="game-promo-panel">
        <div className="game-promo-copy">
          <p className="eyebrow">UNA PAUSA, UN’ALTRA AVVENTURA</p>
          <h2 id="game-promo-title">
            La prossima cima?
            <br />
            Conquistala giocando.
          </h2>
          <p>
            Sali in parete, schiva rocce e ghiaccio e trova riparo sotto le cenge. Tre vite per
            raggiungere la vetta.
          </p>
          <a className="button cream-button" href="/game">
            Gioca a Verso la vetta <span aria-hidden="true">↗</span>
          </a>
          <span className="game-promo-note">
            Frecce o WASD · Controlli touch · Nessuna registrazione
          </span>
        </div>
        <div className="game-promo-art" aria-hidden="true">
          <svg viewBox="0 0 380 300" focusable="false">
            <circle cx="290" cy="66" r="35" fill="#d5e5b2" opacity=".2" />
            <path d="M0 290 105 82 180 205 244 28 380 290Z" fill="#60786b" />
            <path d="m180 205 64-177 136 262H180Z" fill="#8f9e83" />
            <path d="m214 107 30-79 49 94-39-23-16 20-8-27Z" fill="#eceddb" />
            <path d="M247 28V4m0 0 38 10-38 6" fill="#eac27b" stroke="#eac27b" strokeWidth="3" />
            <path d="m55 228 99-2 8 11-95 5Z" fill="#c2c8a6" />
            <path d="m160 165 90-2 8 11-86 5Z" fill="#c2c8a6" />
            <path d="m290 168 12-18 13 10-9 19Z" fill="#b4e3ed" />
            <path d="m125 94 14-15 18 9-5 19-21 2Z" fill="#304c43" />
            <path d="M188 233q-40 40-12 65" fill="none" stroke="#eac27b" strokeWidth="2" />
            <path
              d="m183 222-17 18m23-16 16 17m-23-36-14-17m23 15 14-22"
              stroke="#e8b980"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <rect x="176" y="200" width="20" height="29" rx="4" fill="#e98553" />
            <circle cx="186" cy="191" r="10" fill="#f4c47b" />
            <path d="M176 188a10 10 0 0 1 20 0" stroke="#f4cf76" strokeWidth="6" fill="none" />
          </svg>
          <span>VERSO LA VETTA / IL GIOCO</span>
        </div>
      </div>
    </section>
  );
}
