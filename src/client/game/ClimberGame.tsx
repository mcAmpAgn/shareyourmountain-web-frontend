import { useEffect, useRef, useState } from 'react';
import {
  freshGame,
  progress,
  step,
  WIDTH,
  HEIGHT,
  shelter,
  type Controls,
  type Phase,
} from './engine';
import { draw } from './render';
import './climber-game.css';
const emptyControls = (): Controls => ({ left: false, right: false, up: false, down: false });
const keys: Record<string, keyof Controls> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
};
export default function ClimberGame() {
  const canvas = useRef<HTMLCanvasElement>(null),
    state = useRef(freshGame()),
    controls = useRef(emptyControls());
  const [hud, setHud] = useState({
    phase: 'ready' as Phase,
    lives: 3,
    progress: 0,
    elapsed: 0,
    covered: false,
    rest: 0,
    recovered: false,
  });
  const announce = () =>
    setHud({
      phase: state.current.phase,
      lives: state.current.lives,
      progress: Math.floor(progress(state.current)),
      elapsed: Math.floor(state.current.elapsed),
      covered: !!shelter(state.current),
      rest: Math.floor((state.current.rest * 100) / 3),
      recovered: state.current.recoveredLedges.includes(shelter(state.current)?.id ?? -1),
    });
  function start() {
    state.current = { ...freshGame(), phase: 'playing' };
    controls.current = emptyControls();
    announce();
    canvas.current?.focus();
  }
  function pause() {
    if (state.current.phase === 'playing' || state.current.phase === 'paused') {
      state.current.phase = state.current.phase === 'playing' ? 'paused' : 'playing';
      controls.current = emptyControls();
      announce();
    }
  }
  useEffect(() => {
    document.title = 'Verso la vetta · Gioca — Share Your Mountain';
    const c = canvas.current!,
      context = c.getContext('2d');
    if (!context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      c.width = WIDTH * ratio;
      c.height = HEIGHT * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(context, state.current, reducedMotion);
    };
    resize();
    window.addEventListener('resize', resize);
    let drawnPhase: Phase | null = null;
    let frame = 0,
      last = 0,
      lastHud = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.04) : 0;
      last = now;
      const before = state.current.phase;
      step(state.current, controls.current, dt);
      if (state.current.phase === 'playing' || drawnPhase !== state.current.phase)
        draw(context, state.current, reducedMotion);
      drawnPhase = state.current.phase;
      if (
        (state.current.phase === 'playing' && now - lastHud > 100) ||
        before !== state.current.phase
      ) {
        lastHud = now;
        announce();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const stop = () => {
      controls.current = emptyControls();
      if (state.current.phase === 'playing') {
        state.current.phase = 'paused';
        announce();
      }
    };
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  const direction = (direction: keyof Controls, label: string, symbol: string) => (
    <button
      className={'climb-direction climb-' + direction}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        if (state.current.phase !== 'playing') return;
        e.currentTarget.setPointerCapture(e.pointerId);
        controls.current[direction] = true;
      }}
      onPointerUp={() => {
        controls.current[direction] = false;
      }}
      onPointerCancel={() => {
        controls.current[direction] = false;
      }}
      onLostPointerCapture={() => {
        controls.current[direction] = false;
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          controls.current[direction] = true;
        }
      }}
      onKeyUp={() => {
        controls.current[direction] = false;
      }}
      onBlur={() => {
        controls.current[direction] = false;
      }}
    >
      {symbol}
    </button>
  );
  const messages = {
    ready: [
      'La vetta ti aspetta.',
      'Schiva rocce e ghiaccio. Riposati sotto i tetti e conquista la cima.',
    ],
    paused: ['Una pausa in parete.', 'Riprendi quando sei pronto.'],
    won: ['La vetta è tua!', 'Hai conquistato la cima. Respira: il panorama te lo sei meritato.'],
    lost: [
      'Si riparte dal campo base.',
      'Rocce e ghiaccio hanno avuto la meglio. Riprova e scegli una nuova linea.',
    ],
  };
  return (
    <div className="climb-page">
      <header className="climb-header">
        <a href="/" aria-label="Share Your Mountain, home">
          <img src="/assets/logo-white.png" width="507" height="53" alt="Share Your Mountain" />
        </a>
        <nav aria-label="Navigazione del gioco">
          <a href="/mountains">Esplora le montagne ↗</a>
          <a href="/">← Torna al portale</a>
        </nav>
      </header>
      <main className="climb-layout">
        <section className="climb-intro">
          <p className="climb-eyebrow">UN PICCOLO GIOCO. UNA GRANDE SALITA.</p>
          <h1 aria-label="Verso la vetta">
            Verso
            <br />
            la vetta<span>.</span>
          </h1>
          <p>
            Trova la tua linea, schiva rocce e ghiaccio e riprendi fiato sotto le sporgenze. La cima
            ti aspetta.
          </p>
          <div className="climb-instructions">
            <h2>Come si gioca</h2>
            <p>
              <strong>↑ ↓ ← → oppure W A S D</strong>
              <br />
              Muoviti sulla parete. Tieni premuto ↑ per salire.
            </p>
            <p>
              <strong>Occhio al segnale !</strong>
              <br />
              Rocce (!) e ghiaccio (❄) stanno per cadere. Il ghiaccio è più veloce: spostati di
              lato.
            </p>
            <p>
              <strong>Piccoli tetti, vere soste.</strong>
              <br />
              Fermati 3 secondi sotto un tetto per recuperare una vita, una volta per sosta. Aggira
              le sporgenze per salire. P o Esc per la pausa.
            </p>
          </div>
          <p className="climb-touch-note">
            Su telefono usa i quattro pulsanti sotto il gioco. Puoi tenere premute due direzioni
            insieme.
          </p>
          <a className="climb-explore" href="/soiusa">
            Dopo il gioco, scopri le Alpi ↗
          </a>
        </section>
        <section className="climb-game" aria-label="Gioco di arrampicata">
          <div className="climb-hud">
            <div>
              <span>VERSO LA CIMA</span>
              <strong>{hud.progress}%</strong>
            </div>
            <div>
              <span>VITE</span>
              <strong aria-label={`${hud.lives} vite rimaste`}>
                {'♥'.repeat(hud.lives)}
                <span aria-hidden="true" className="climb-lost-hearts">
                  {'♡'.repeat(3 - hud.lives)}
                </span>
              </strong>
            </div>
            <div>
              <span>TEMPO</span>
              <strong>
                {Math.floor(hud.elapsed / 60)}:{String(hud.elapsed % 60).padStart(2, '0')}
              </strong>
            </div>
            <button
              className="climb-pause"
              disabled={hud.phase !== 'playing' && hud.phase !== 'paused'}
              onClick={pause}
              aria-label={hud.phase === 'paused' ? 'Riprendi il gioco' : 'Pausa'}
            >
              {hud.phase === 'paused' ? '▶' : 'Ⅱ'}
            </button>
          </div>
          <div
            className="climb-progress"
            role="progressbar"
            aria-label="Salita completata"
            aria-valuenow={hud.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: hud.progress + '%' }} />
          </div>
          <div className="climb-stage">
            <canvas
              ref={canvas}
              tabIndex={0}
              aria-label="Parete da scalare. Usa frecce o WASD per muoverti, P per mettere in pausa."
              aria-describedby="climb-status"
              onKeyDown={(e) => {
                const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
                if (keys[key]) {
                  e.preventDefault();
                  controls.current[keys[key]] = true;
                } else if ((key === 'p' || key === 'Escape') && !e.repeat) {
                  e.preventDefault();
                  pause();
                }
              }}
              onKeyUp={(e) => {
                const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
                if (keys[key]) {
                  e.preventDefault();
                  controls.current[keys[key]] = false;
                }
              }}
              onBlur={() => {
                controls.current = emptyControls();
              }}
            >
              Il gioco richiede un browser con supporto Canvas. Usa frecce o WASD per raggiungere la
              cima evitando rocce e ghiaccio; fermati sotto i tetti per riposare.
            </canvas>
            {hud.phase !== 'playing' && (
              <div className="climb-overlay">
                <span className="climb-overlay-icon" aria-hidden="true">
                  {hud.phase === 'won' ? '⚑' : hud.phase === 'lost' ? '↺' : '△'}
                </span>
                <h2>{messages[hud.phase][0]}</h2>
                <p>{messages[hud.phase][1]}</p>
                {hud.phase === 'won' && <p>Salita completata in {hud.elapsed} secondi.</p>}
                <button
                  className="climb-start"
                  onClick={() => {
                    if (hud.phase === 'paused') {
                      pause();
                      canvas.current?.focus();
                    } else start();
                  }}
                >
                  {hud.phase === 'ready'
                    ? 'Inizia la salita ↗'
                    : hud.phase === 'paused'
                      ? 'Riprendi la salita ↗'
                      : 'Riprova la salita ↗'}
                </button>
              </div>
            )}
          </div>
          <div className="climb-bottom">
            <span id="climb-status" role="status" aria-live="polite">
              {hud.phase === 'won'
                ? 'Vetta raggiunta!'
                : hud.phase === 'lost'
                  ? 'Vite terminate. Puoi riprovare.'
                  : hud.phase === 'paused'
                    ? 'Gioco in pausa.'
                    : hud.phase === 'ready'
                      ? 'Pronto per partire.'
                      : hud.covered
                        ? hud.recovered
                          ? 'Al riparo. Sosta già utilizzata: aggira il tetto per ripartire.'
                          : hud.lives === 3
                            ? 'Al riparo. Vite al massimo. Aggira il tetto per ripartire.'
                            : `Al riparo: fermati per recuperare una vita (${Math.ceil((100 - hud.rest) * 0.03)} s).`
                        : `${hud.lives} vite rimaste. Schiva rocce e ghiaccio.`}
            </span>
            <div className="climb-pad" aria-label="Controlli touch">
              {direction('up', 'Sali', '↑')}
              {direction('left', 'Spostati a sinistra', '←')}
              {direction('down', 'Scendi', '↓')}
              {direction('right', 'Spostati a destra', '→')}
            </div>
          </div>
        </section>
      </main>
      <footer className="climb-footer">
        Share Your Mountain · Un gioco per chi ha sempre voglia di salire.
      </footer>
    </div>
  );
}
