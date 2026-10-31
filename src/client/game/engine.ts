export const WIDTH = 480,
  HEIGHT = 640,
  SUMMIT = 80,
  START = 1800;
export type Phase = 'ready' | 'playing' | 'paused' | 'won' | 'lost';
export interface Controls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}
export interface FallingDebris {
  kind: 'rock' | 'ice';
  x: number;
  y: number;
  radius: number;
  speed: number;
  age: number;
  spin: number;
}
export interface Fragment {
  kind: FallingDebris['kind'];
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  age: number;
  lifetime: number;
  dust: boolean;
}
export interface GameState {
  phase: Phase;
  x: number;
  y: number;
  lives: number;
  elapsed: number;
  immune: number;
  spawn: number;
  rocks: FallingDebris[];
  fragments: Fragment[];
  rest: number;
  recoveredLedges: number[];
}
export const freshGame = (): GameState => ({
  phase: 'ready',
  x: WIDTH / 2,
  y: START,
  lives: 3,
  elapsed: 0,
  immune: 0,
  spawn: 1,
  rocks: [],
  fragments: [],
  rest: 0,
  recoveredLedges: [],
});
export const cameraY = (state: GameState) => Math.max(0, state.y - 480);
export const progress = (state: GameState) =>
  Math.max(0, Math.min(100, ((START - state.y) / (START - SUMMIT)) * 100));
export interface Ledge {
  id: number;
  x: number;
  y: number;
  width: number;
}
export const LEDGES: readonly Ledge[] = [
  { id: 1, x: 85, y: 1630, width: 125 },
  { id: 2, x: 270, y: 1340, width: 125 },
  { id: 3, x: 65, y: 1050, width: 140 },
  { id: 4, x: 265, y: 760, width: 135 },
  { id: 5, x: 100, y: 470, width: 135 },
  { id: 6, x: 285, y: 230, width: 125 },
];
/** The climber's whole body must be inside the shelter, below the roof. */
export function shelter(state: Pick<GameState, 'x' | 'y'>): Ledge | undefined {
  return LEDGES.find(
    (l) =>
      state.x >= l.x + 23 &&
      state.x <= l.x + l.width - 23 &&
      state.y >= l.y + 44 &&
      state.y <= l.y + 112,
  );
}
/** Fixed-world simulation. DOM, rendering and input handling stay outside this module. */
export function step(state: GameState, controls: Controls, dt: number, random = Math.random) {
  if (state.phase !== 'playing') return;
  dt = Math.max(0, Math.min(dt, 0.04));
  // Effects use the same world coordinates and clock as collisions, including pause.
  for (const fragment of state.fragments) {
    fragment.age += dt;
    fragment.x += fragment.vx * dt;
    fragment.y += fragment.vy * dt;
    fragment.vy += (fragment.dust ? 50 : 390) * dt;
    fragment.angle += fragment.spin * dt;
  }
  state.fragments = state.fragments.filter((f) => f.age < f.lifetime);
  state.elapsed += dt;
  state.immune = Math.max(0, state.immune - dt);
  const dx = Number(controls.right) - Number(controls.left),
    dy = Number(controls.down) - Number(controls.up);
  const factor = dx && dy ? Math.SQRT1_2 : 1;
  const previousY = state.y,
    previousX = state.x;
  state.x = Math.max(28, Math.min(WIDTH - 28, state.x + dx * 190 * dt * factor));
  for (const ledge of LEDGES) {
    if (previousY <= ledge.y - 30 || previousY >= ledge.y + 44) continue;
    if (previousX <= ledge.x - 20 && state.x > ledge.x - 20) state.x = ledge.x - 20;
    else if (previousX >= ledge.x + ledge.width + 20 && state.x < ledge.x + ledge.width + 20)
      state.x = ledge.x + ledge.width + 20;
  }
  state.y = Math.max(SUMMIT, Math.min(START, state.y + dy * 84 * dt * factor));
  // Roofs are solid: climb around either edge, rather than through the rock.
  for (const ledge of LEDGES) {
    if (state.x < ledge.x - 20 || state.x > ledge.x + ledge.width + 20) continue;
    if (previousY >= ledge.y + 44 && state.y < ledge.y + 44) state.y = ledge.y + 44;
    else if (previousY <= ledge.y - 30 && state.y > ledge.y - 30) state.y = ledge.y - 30;
  }
  const cover = shelter(state);
  if (cover && dx === 0 && dy === 0) {
    state.rest = Math.min(3, state.rest + dt);
    if (state.rest >= 3 && state.lives < 3 && !state.recoveredLedges.includes(cover.id)) {
      state.lives++;
      state.recoveredLedges.push(cover.id);
    }
  } else state.rest = 0;
  if (state.y <= SUMMIT) {
    state.phase = 'won';
    return;
  }
  state.spawn -= dt;
  if (state.spawn <= 0) {
    const x =
      random() < 0.35
        ? Math.max(24, Math.min(WIDTH - 24, state.x + (random() - 0.5) * 90))
        : 24 + random() * (WIDTH - 48);
    const kind = random() < 0.4 ? 'ice' : 'rock';
    state.rocks.push({
      kind,
      x,
      y: cameraY(state) - 35,
      radius: kind === 'ice' ? 10 + random() * 9 : 13 + random() * 12,
      speed: 155 + random() * 95 + progress(state) * 0.7 + (kind === 'ice' ? 85 : 0),
      age: 0,
      spin: random() * 6,
    });
    state.spawn = 1.15 - progress(state) * 0.005;
  }
  for (const rock of state.rocks) {
    rock.age += dt;
    if (rock.age < 0.8) continue;
    const oldY = rock.y;
    rock.y += rock.speed * dt;
    // Swept contact prevents fast ice passing straight through a roof.
    const impactedLedge = LEDGES.find(
      (l) =>
        rock.x + rock.radius >= l.x &&
        rock.x - rock.radius <= l.x + l.width &&
        oldY + rock.radius <= l.y + 10 &&
        rock.y + rock.radius >= l.y,
    );
    if (impactedLedge) {
      const impactX = Math.max(
        impactedLedge.x + 2,
        Math.min(impactedLedge.x + impactedLedge.width - 2, rock.x),
      );
      for (let i = 0; i < 14; i++) {
        const dust = i >= 10,
          angle = -Math.PI * 0.95 + random() * Math.PI * 0.9;
        const speed = dust ? 25 + random() * 45 : 65 + random() * 130;
        state.fragments.push({
          kind: rock.kind,
          x: impactX,
          y: impactedLedge.y - 3,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: dust ? 5 + random() * 6 : 2 + random() * rock.radius * 0.25,
          angle: random() * Math.PI * 2,
          spin: (random() - 0.5) * 13,
          age: 0,
          lifetime: dust ? 0.45 + random() * 0.25 : 0.65 + random() * 0.4,
          dust,
        });
      }
      // Keep effect cost bounded even with many simultaneous collisions.
      state.fragments = state.fragments.slice(-140);
      rock.y = Infinity;
      continue;
    }
    rock.spin += dt * 2;
    if (
      !cover &&
      !state.immune &&
      Math.hypot(rock.x - state.x, rock.y - state.y) < rock.radius + 14
    ) {
      state.lives--;
      state.immune = 1.8;
      state.y = Math.min(START, state.y + 50);
      if (!state.lives) state.phase = 'lost';
    }
  }
  state.rocks = state.rocks.filter((r) => r.y < cameraY(state) + HEIGHT + 80);
}
