import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshGame,
  step,
  SUMMIT,
  START,
  WIDTH,
  progress,
  LEDGES,
  shelter,
} from '../src/client/game/engine.js';
const still = { left: false, right: false, up: false, down: false };
test('climber moves within the wall, pauses completely, and reaches the summit', () => {
  const game = freshGame();
  step(game, { ...still, up: true }, 0.04);
  assert.equal(game.y, START);
  game.phase = 'playing';
  game.spawn = 1000;
  step(game, { ...still, up: true, left: true }, 0.04);
  assert.ok(game.y < START);
  assert.ok(game.x < WIDTH / 2);
  for (let i = 0; i < 300; i++) step(game, { ...still, left: true }, 0.04);
  assert.equal(game.x, 28);
  game.phase = 'paused';
  const previous = JSON.stringify(game);
  step(game, { ...still, up: true }, 10);
  assert.equal(JSON.stringify(game), previous);
  game.phase = 'playing';
  game.y = SUMMIT + 1;
  step(game, { ...still, up: true }, 0.04);
  assert.equal(game.phase, 'won');
  assert.equal(progress(game), 100);
});
test('rocks warn before falling, collisions consume one life and give a recovery window', () => {
  const game = freshGame();
  game.phase = 'playing';
  game.spawn = 0;
  step(game, still, 0.04, () => 0.5);
  assert.equal(game.rocks.length, 1);
  const rock = game.rocks[0],
    previousY = rock.y;
  step(game, still, 0.04, () => 0.5);
  assert.equal(rock.y, previousY);
  game.spawn = 1000;
  game.rocks = [
    { x: game.x, y: game.y - 7, radius: 18, speed: 175, age: 1, spin: 0, kind: 'rock' },
  ];
  step(game, still, 0.04);
  assert.equal(game.lives, 2);
  assert.ok(game.immune > 0);
  game.rocks[0].y = game.y - 7;
  step(game, still, 0.04);
  assert.equal(game.lives, 2);
  game.immune = 0;
  game.lives = 1;
  game.rocks[0].y = game.y - 7;
  step(game, still, 0.04);
  assert.equal(game.lives, 0);
  assert.equal(game.phase, 'lost');
});

test('ice spawns with its own faster hazard and consumes a life outside shelter', () => {
  const ice = freshGame(),
    rock = freshGame();
  for (const s of [ice, rock]) {
    s.phase = 'playing';
    s.spawn = 0;
  }
  step(ice, still, 0.04, () => 0.2);
  step(rock, still, 0.04, () => 0.8);
  assert.equal(ice.rocks[0].kind, 'ice');
  assert.equal(rock.rocks[0].kind, 'rock');
  assert.ok(ice.rocks[0].speed > rock.rocks[0].speed);
  ice.spawn = 1000;
  ice.rocks = [{ kind: 'ice', x: ice.x, y: ice.y - 7, radius: 12, speed: 175, age: 1, spin: 0 }];
  step(ice, still, 0.04);
  assert.equal(ice.lives, 2);
});

test('roofs block both types of falling debris and must be climbed around', () => {
  const l = LEDGES[0],
    s = freshGame();
  s.phase = 'playing';
  s.spawn = 1000;
  s.x = l.x + l.width / 2;
  s.y = l.y + 45;
  step(s, { ...still, up: true }, 0.04);
  assert.equal(s.y, l.y + 44);
  assert.equal(shelter(s)?.id, l.id);
  s.x = l.x - 21;
  s.y = l.y;
  step(s, { ...still, right: true }, 0.04);
  assert.equal(s.x, l.x - 20);
  s.x = l.x - 28;
  s.y = l.y + 45;
  for (let i = 0; i < 30; i++) step(s, { ...still, up: true }, 0.04);
  assert.ok(s.y < l.y - 30);
  for (const kind of ['rock', 'ice'] as const) {
    s.x = l.x + l.width / 2;
    s.y = l.y + 60;
    s.rocks = [{ kind, x: s.x, y: l.y - 25, radius: 10, speed: 700, age: 1, spin: 0 }];
    step(s, still, 0.04);
    assert.equal(s.rocks.length, 0);
    assert.equal(s.lives, 3);
  }
  s.x = l.x + 10;
  assert.equal(shelter(s), undefined);
});

test('three seconds of stationary shelter recover one life per ledge, pause and movement cannot farm lives', () => {
  const l = LEDGES[0],
    s = freshGame();
  s.phase = 'playing';
  s.spawn = 1000;
  s.x = l.x + 60;
  s.y = l.y + 60;
  s.lives = 1;
  for (let i = 0; i < 50; i++) step(s, still, 0.04);
  assert.equal(s.lives, 1);
  const rest = s.rest;
  s.phase = 'paused';
  step(s, still, 0.04);
  assert.equal(s.rest, rest);
  s.phase = 'playing';
  step(s, { ...still, right: true }, 0.04);
  assert.equal(s.rest, 0);
  for (let i = 0; i < 80; i++) step(s, still, 0.04);
  assert.equal(s.lives, 2);
  assert.deepEqual(s.recoveredLedges, [l.id]);
  for (let i = 0; i < 100; i++) step(s, still, 0.04);
  assert.equal(s.lives, 2);
  s.x = 240;
  step(s, still, 0.04);
  assert.equal(s.rest, 0);
  s.x = l.x + 60;
  for (let i = 0; i < 80; i++) step(s, still, 0.04);
  assert.equal(s.lives, 2);
  const next = LEDGES[1];
  s.x = next.x + 60;
  s.y = next.y + 60;
  for (let i = 0; i < 80; i++) step(s, still, 0.04);
  assert.equal(s.lives, 3);
  assert.equal(freshGame().recoveredLedges.length, 0);
});
