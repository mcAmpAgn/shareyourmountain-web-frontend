import { WIDTH, HEIGHT, SUMMIT, START, cameraY, LEDGES, shelter, type GameState } from './engine';
function polygon(c: CanvasRenderingContext2D, points: number[][], fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}
export function draw(c: CanvasRenderingContext2D, s: GameState) {
  const cam = cameraY(s);
  const sky = c.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#142d43');
  sky.addColorStop(1, '#a5c5bd');
  c.fillStyle = sky;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  // Distant ridges and a continuous rock face create depth without external assets.
  polygon(
    c,
    [
      [0, HEIGHT],
      [0, 220],
      [65, 145],
      [130, 240],
      [240, 75],
      [330, 190],
      [390, 110],
      [480, 210],
      [480, HEIGHT],
    ],
    '#6f9594',
  );
  polygon(
    c,
    [
      [0, HEIGHT],
      [0, 360],
      [100, 220],
      [190, 350],
      [300, 180],
      [480, 370],
      [480, HEIGHT],
    ],
    '#456965',
  );
  const top = SUMMIT - cam;
  polygon(
    c,
    [
      [12, HEIGHT],
      [50, top + 30],
      [150, top + 12],
      [220, top - 8],
      [300, top + 4],
      [420, top + 20],
      [468, HEIGHT],
    ],
    '#607367',
  );
  polygon(
    c,
    [
      [12, HEIGHT],
      [50, top + 30],
      [140, top + 17],
      [112, HEIGHT],
    ],
    '#788879',
  );
  polygon(
    c,
    [
      [315, top + 8],
      [420, top + 20],
      [468, HEIGHT],
      [370, HEIGHT],
    ],
    '#3e5b50',
  );
  c.save();
  c.beginPath();
  c.rect(35, Math.max(0, top), 410, HEIGHT);
  c.clip();
  for (let y = 130; y < START + 150; y += 85) {
    const sy = y - cam;
    if (sy < -90 || sy > HEIGHT + 90) continue;
    for (let i = 0; i < 5; i++) {
      const x = 48 + ((i * 91 + y * 0.83) % 380);
      c.strokeStyle = '#334f4580';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, sy);
      c.lineTo(x + 19, sy + 20);
      c.lineTo(x + 8, sy + 37);
      c.stroke();
      polygon(
        c,
        [
          [x + 22, sy + 18],
          [x + 38, sy + 12],
          [x + 43, sy + 21],
          [x + 26, sy + 25],
        ],
        '#a7b49a',
      );
    }
  }
  c.restore();
  if (top > -60) {
    polygon(
      c,
      [
        [50, top + 30],
        [150, top + 12],
        [220, top - 8],
        [300, top + 4],
        [420, top + 20],
        [394, top + 42],
        [325, top + 28],
        [280, top + 42],
        [210, top + 20],
        [165, top + 40],
        [100, top + 37],
      ],
      '#edf1db',
    );
    c.strokeStyle = '#e8edda';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(245, top + 10);
    c.lineTo(245, top - 47);
    c.stroke();
    polygon(
      c,
      [
        [246, top - 47],
        [286, top - 33],
        [246, top - 20],
      ],
      '#edb14a',
    );
    c.fillStyle = '#f4f5df';
    c.font = 'bold 12px Arial';
    c.textAlign = 'center';
    c.fillText('LA VETTA', 245, top - 58);
  }
  for (const ledge of LEDGES) {
    const y = ledge.y - cam;
    if (y < -130 || y > HEIGHT + 30) continue;
    const active = shelter(s)?.id === ledge.id;
    c.fillStyle = active ? '#a9db9838' : '#203e3526';
    c.fillRect(ledge.x + 20, y + 25, ledge.width - 40, 90);
    polygon(
      c,
      [
        [ledge.x, y],
        [ledge.x + ledge.width, y - 5],
        [ledge.x + ledge.width + 9, y + 8],
        [ledge.x + ledge.width - 8, y + 24],
        [ledge.x + 14, y + 21],
        [ledge.x - 6, y + 10],
      ],
      '#293f39',
    );
    polygon(
      c,
      [
        [ledge.x, y],
        [ledge.x + ledge.width, y - 5],
        [ledge.x + ledge.width + 9, y + 8],
        [ledge.x + 7, y + 10],
      ],
      '#b0b49a',
    );
    c.fillStyle = active ? '#eff8d8' : '#d8e7c6';
    c.font = 'bold 10px Arial';
    c.textAlign = 'center';
    c.fillText(
      s.recoveredLedges.includes(ledge.id) ? 'RIPARO' : 'SOSTA + ♥',
      ledge.x + ledge.width / 2,
      y + 40,
    );
    if (active && s.rest > 0 && !s.recoveredLedges.includes(ledge.id) && s.lives < 3) {
      c.fillStyle = '#1a332c';
      c.fillRect(ledge.x + 25, y + 100, ledge.width - 50, 5);
      c.fillStyle = '#c3e493';
      c.fillRect(ledge.x + 25, y + 100, ((ledge.width - 50) * s.rest) / 3, 5);
    }
  }
  for (const rock of s.rocks) {
    if (rock.age < 0.8) {
      const y = Math.max(24, rock.y - cam + 28);
      c.fillStyle = rock.kind === 'ice' ? '#b5f0ff' : '#ffcb65';
      c.font = 'bold 25px Arial';
      c.textAlign = 'center';
      c.fillText(rock.kind === 'ice' ? '❄' : '!', rock.x, y);
      continue;
    }
    c.save();
    c.translate(rock.x, rock.y - cam);
    c.rotate(rock.spin);
    const r = rock.radius;
    if (rock.kind === 'ice') {
      polygon(
        c,
        [
          [0, -r * 1.3],
          [r * 0.8, -r * 0.4],
          [r * 0.55, r],
          [0, r * 1.35],
          [-r * 0.8, r * 0.1],
          [-r * 0.5, -r],
        ],
        '#a6e1f3',
      );
      polygon(
        c,
        [
          [0, -r * 1.3],
          [r * 0.8, -r * 0.4],
          [0, r * 1.35],
          [-r * 0.15, 0],
        ],
        '#e9fbff',
      );
      c.strokeStyle = '#4facc9';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, -r);
      c.lineTo(-r * 0.15, 0);
      c.lineTo(r * 0.4, r * 0.5);
      c.stroke();
      c.restore();
      continue;
    }
    polygon(
      c,
      [
        [-r, -r * 0.4],
        [-r * 0.3, -r],
        [r * 0.65, -r * 0.8],
        [r, r * 0.25],
        [r * 0.2, r],
        [-r * 0.8, r * 0.6],
      ],
      '#2e3e3d',
    );
    polygon(
      c,
      [
        [-r, -r * 0.4],
        [-r * 0.3, -r],
        [r * 0.65, -r * 0.8],
        [r * 0.2, 0],
      ],
      '#a1a494',
    );
    c.restore();
  }
  const y = s.y - cam,
    moving = Math.sin(s.elapsed * 11) * 4;
  // Rope and climber are deliberately high contrast against the cliff.
  c.strokeStyle = '#dfb96c';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(s.x, y + 9);
  c.bezierCurveTo(s.x - 20, y + 60, s.x + 20, y + 100, s.x - 4, HEIGHT + 40);
  c.stroke();
  if (s.immune > 0 && Math.floor(s.immune * 10) % 2) return;
  c.save();
  c.translate(s.x, y);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = '#172e38';
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(-5, 7);
  c.lineTo(-11, 22 + moving);
  c.lineTo(-20, 26 + moving);
  c.moveTo(5, 7);
  c.lineTo(14, 20 - moving);
  c.lineTo(22, 19 - moving);
  c.stroke();
  c.strokeStyle = '#f3bc67';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(-7, -8);
  c.lineTo(-20, -17 - moving);
  c.lineTo(-20, -27 - moving);
  c.moveTo(7, -8);
  c.lineTo(20, -22 + moving);
  c.lineTo(17, -31 + moving);
  c.stroke();
  c.fillStyle = '#e98553';
  c.fillRect(-10, -16, 20, 27);
  c.fillStyle = '#a7523a';
  c.fillRect(-8, -12, 16, 19);
  c.strokeStyle = '#f0d09c';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-11, 8);
  c.lineTo(11, 8);
  c.stroke();
  c.fillStyle = '#efc18d';
  c.beginPath();
  c.arc(0, -23, 8, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffd16d';
  c.beginPath();
  c.arc(0, -26, 9, Math.PI, Math.PI * 2);
  c.fill();
  c.fillRect(-10, -27, 20, 4);
  c.restore();
}
