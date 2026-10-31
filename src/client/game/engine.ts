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
export interface Rock {
  x: number;
  y: number;
  radius: number;
  speed: number;
  age: number;
  spin: number;
}
export interface GameState {
  phase: Phase;
  x: number;
  y: number;
  lives: number;
  elapsed: number;
  immune: number;
  spawn: number;
  rocks: Rock[];
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
});
export const cameraY = (state: GameState) => Math.max(0, state.y - 480);
export const progress = (state: GameState) =>
  Math.max(0, Math.min(100, ((START - state.y) / (START - SUMMIT)) * 100));
/** Fixed-world simulation. DOM, rendering and input handling stay outside this module. */
export function step(state: GameState, controls: Controls, dt: number, random = Math.random) {
  if (state.phase !== 'playing') return;
  dt = Math.max(0, Math.min(dt, 0.04));
  state.elapsed += dt;
  state.immune = Math.max(0, state.immune - dt);
  const dx = Number(controls.right) - Number(controls.left),
    dy = Number(controls.down) - Number(controls.up);
  const factor = dx && dy ? Math.SQRT1_2 : 1;
  state.x = Math.max(28, Math.min(WIDTH - 28, state.x + dx * 190 * dt * factor));
  state.y = Math.max(SUMMIT, Math.min(START, state.y + dy * 84 * dt * factor));
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
    state.rocks.push({
      x,
      y: cameraY(state) - 35,
      radius: 13 + random() * 12,
      speed: 155 + random() * 95 + progress(state) * 0.7,
      age: 0,
      spin: random() * 6,
    });
    state.spawn = 1.15 - progress(state) * 0.005;
  }
  for (const rock of state.rocks) {
    rock.age += dt;
    if (rock.age < 0.8) continue;
    rock.y += rock.speed * dt;
    rock.spin += dt * 2;
    if (!state.immune && Math.hypot(rock.x - state.x, rock.y - state.y) < rock.radius + 14) {
      state.lives--;
      state.immune = 1.8;
      state.y = Math.min(START, state.y + 50);
      if (!state.lives) state.phase = 'lost';
    }
  }
  state.rocks = state.rocks.filter((r) => r.y < cameraY(state) + HEIGHT + 80);
}
