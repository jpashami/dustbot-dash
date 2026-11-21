// All canvas drawing. Game objects are drawn in tile units (1 unit = 1 tile).
import { W, H, WALL, FLOOR, PEN, DOOR } from './maze.js';

const C = {
  bg: '#1d2830',
  wall: '#3d6070',
  wallHi: '#4d7486',
  floor: '#ebd2aa',
  floorAlt: '#e5c99e',
  seam: 'rgba(110, 70, 30, 0.13)',
  nest: '#c39a5e',
  nestEdge: '#8a6233',
  twig: 'rgba(95, 62, 25, 0.55)',
  flap: '#9a6a3f',
  dust: '#8e8a85',
  dustHi: '#b3afaa',
};

export class Renderer {
  constructor(canvas, stage) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stage = stage;
    this.maze = document.createElement('canvas');
    this.grid = null;
    this.T = 24;
    this.dpr = 1;
  }

  resize() {
    const hud = document.querySelector('.hud');
    const hint = document.querySelector('.hint');
    const used = (hud ? hud.offsetHeight : 60) + (hint ? hint.offsetHeight : 20) + 48;
    const availW = Math.min(window.innerWidth - 32, 640);
    const availH = window.innerHeight - used;
    this.T = Math.max(12, Math.floor(Math.min(availW / W, availH / H)));
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = W * this.T, ch = H * this.T;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.stage.style.width = cw + 'px';
    this.stage.style.height = ch + 'px';
    if (this.grid) this.buildMaze();
  }

  setMaze(grid) {
    this.grid = grid;
    this.buildMaze();
  }

  buildMaze() {
    const g = this.grid;
    const m = this.maze;
    m.width = this.canvas.width;
    m.height = this.canvas.height;
    const c = m.getContext('2d');
    const s = this.T * this.dpr;
    c.setTransform(s, 0, 0, s, 0, 0);
    c.fillStyle = C.bg;
    c.fillRect(0, 0, W, H);

    const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || g[y][x] === WALL;

    // Wooden floor with plank seams.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (isWall(x, y)) continue;
        c.fillStyle = (y % 2) ? C.floorAlt : C.floor;
        c.fillRect(x - 0.01, y - 0.01, 1.02, 1.02);
      }
    }
    c.strokeStyle = C.seam;
    c.lineWidth = 0.035;
    c.beginPath();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g[y][x] !== FLOOR) continue;
        c.moveTo(x, y + 0.5); c.lineTo(x + 1, y + 0.5);
        const a = ((x * 7 + y * 3) % 5) / 5 + 0.1;
        const b = ((x * 3 + y * 5 + 2) % 5) / 5 + 0.1;
        c.moveTo(x + a, y); c.lineTo(x + a, y + 0.5);
        c.moveTo(x + b, y + 0.5); c.lineTo(x + b, y + 1);
      }
    }
    c.stroke();

    // Walls: inset blocks bridged to neighbouring walls.
    const ins = 0.17;
    const x0 = (x) => (x === 0 ? 0 : x + ins);
    const x1 = (x) => (x === W - 1 ? W : x + 1 - ins);
    const y0 = (y) => (y === 0 ? 0 : y + ins);
    const y1 = (y) => (y === H - 1 ? H : y + 1 - ins);
    const drawWalls = (color, shrink) => {
      c.fillStyle = color;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isWall(x, y)) continue;
          const r = (ax, ay, bx, by) => c.fillRect(ax + shrink, ay + shrink, bx - ax - 2 * shrink, by - ay - 2 * shrink);
          r(x0(x), y0(y), x1(x), y1(y));
          const right = x < W - 1 && isWall(x + 1, y);
          const down = y < H - 1 && isWall(x, y + 1);
          if (right) c.fillRect(x1(x) - shrink - 0.01, y0(y) + shrink, x0(x + 1) - x1(x) + 2 * shrink + 0.02, y1(y) - y0(y) - 2 * shrink);
          if (down) c.fillRect(x0(x) + shrink, y1(y) - shrink - 0.01, x1(x) - x0(x) - 2 * shrink, y0(y + 1) - y1(y) + 2 * shrink + 0.02);
          if (right && down && isWall(x + 1, y + 1)) {
            c.fillRect(x1(x) - shrink, y1(y) - shrink, x0(x + 1) - x1(x) + 2 * shrink, y0(y + 1) - y1(y) + 2 * shrink);
          }
        }
      }
    };
    drawWalls(C.wall, 0);
    drawWalls(C.wallHi, 0.09);

    // Twig nest in the middle, with a little wooden gate.
    let px0 = W, py0 = H, px1 = 0, py1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] === PEN) { px0 = Math.min(px0, x); py0 = Math.min(py0, y); px1 = Math.max(px1, x + 1); py1 = Math.max(py1, y + 1); }
    }
    if (px1 > px0) {
      c.fillStyle = C.nestEdge;
      roundRect(c, px0 + 0.06, py0 + 0.06, px1 - px0 - 0.12, py1 - py0 - 0.12, 0.6);
      c.fill();
      c.fillStyle = C.nest;
      roundRect(c, px0 + 0.22, py0 + 0.2, px1 - px0 - 0.44, py1 - py0 - 0.4, 0.45);
      c.fill();
      c.strokeStyle = C.twig;
      c.lineWidth = 0.05;
      c.beginPath();
      for (let k = 0; k < 26; k++) {
        const fx = px0 + 0.2 + ((k * 37) % 100) / 100 * (px1 - px0 - 0.6);
        const fy = py0 + 0.15 + ((k * 61) % 100) / 100 * (py1 - py0 - 0.35);
        const a = ((k * 53) % 100) / 100 * Math.PI;
        c.moveTo(fx, fy); c.lineTo(fx + Math.cos(a) * 0.4, fy + Math.sin(a) * 0.12);
      }
      c.stroke();
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== DOOR) continue;
      c.fillStyle = C.floor;
      c.fillRect(x, y, 1, 1);
      c.fillStyle = C.flap;
      roundRect(c, x + 0.05, y + 0.38, 0.9, 0.22, 0.08);
      c.fill();
    }
  }

  draw(game) {
    const c = this.ctx;
    const s = this.T * this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.maze, 0, 0);
    c.setTransform(s, 0, 0, s, 0, 0);

    if (game.state === 'levelclear' && Math.floor(game.stateTime * 6) % 2 === 0) {
      c.fillStyle = 'rgba(255, 245, 220, 0.28)';
      c.fillRect(0, 0, W, H);
    }

    this.drawDust(c, game.dust);
    for (const p of game.ice) if (p.alive) this.drawIce(c, p, game.time);
    if (game.amber.active) this.drawAmber(c, game.amber, game.time);

    const hideDinos = (game.state === 'dying' && game.stateTime > 0.5) || game.state === 'levelclear';
    if (!hideDinos) for (const dino of game.dinos) this.drawDino(c, dino, game);
    if (game.state !== 'gameover') this.drawRobot(c, game.robot, game);

    // Pixel-space text.
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const T = this.T;
    if (game.state === 'ready') this.label(c, 'READY!', 9.5 * T, 13.5 * T, '#ffb347', T * 0.8);
    if (game.state === 'levelclear') this.label(c, 'HALL CLEAN!', 9.5 * T, 13.5 * T, '#7fe0a8', T * 0.8);
    for (const p of game.popups) {
      c.globalAlpha = Math.max(0, 1 - p.t / p.life);
      this.label(c, p.text, (p.x + 0.5) * T, (p.y + 0.5 - p.t * 0.8) * T, p.color, T * 0.55);
    }
    c.globalAlpha = 1;
  }

  label(c, text, x, y, color, size) {
    c.font = `800 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = Math.max(2, size * 0.18);
    c.strokeStyle = 'rgba(30, 20, 12, 0.85)';
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  drawDust(c, dust) {
    c.fillStyle = C.dust;
    c.beginPath();
    for (let i = 0; i < dust.length; i++) {
      if (!dust[i]) continue;
      const cx = (i % W) + 0.5, cy = ((i / W) | 0) + 0.5;
      blob(c, cx - 0.06, cy + 0.03, 0.065);
      blob(c, cx + 0.06, cy + 0.03, 0.065);
      blob(c, cx, cy - 0.04, 0.075);
    }
    c.fill();
    c.fillStyle = C.dustHi;
    c.beginPath();
    for (let i = 0; i < dust.length; i++) {
      if (!dust[i]) continue;
      blob(c, (i % W) + 0.47, ((i / W) | 0) + 0.43, 0.03);
    }
    c.fill();
  }

  drawIce(c, p, time) {
    const x = p.x + 0.5, y = p.y + 0.5;
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    const glow = c.createRadialGradient(x, y, 0, x, y, 0.42 * pulse);
    glow.addColorStop(0, 'rgba(160, 225, 255, 0.85)');
    glow.addColorStop(1, 'rgba(160, 225, 255, 0)');
    c.fillStyle = glow;
    c.beginPath(); c.arc(x, y, 0.42 * pulse, 0, Math.PI * 2); c.fill();
    this.snowflake(c, x, y, 0.27 * pulse, time * 0.8, '#ffffff');
    this.snowflake(c, x, y, 0.16 * pulse, -time * 0.8 + 0.5, '#5fb8ec');
  }

  drawAmber(c, s, time) {
    if (s.timer < 2 && Math.floor(time * 8) % 2 === 0) return;
    c.save();
    c.translate(s.x + 0.5, s.y + 0.5 + Math.sin(time * 4) * 0.04);
    c.rotate(0.3);
    c.fillStyle = '#c66a12';
    c.beginPath();
    c.moveTo(0, -0.3); c.lineTo(0.24, -0.12); c.lineTo(0.2, 0.18); c.lineTo(-0.04, 0.3); c.lineTo(-0.25, 0.12); c.lineTo(-0.2, -0.16);
    c.closePath(); c.fill();
    c.fillStyle = '#f2a33a';
    c.beginPath();
    c.moveTo(0, -0.2); c.lineTo(0.15, -0.08); c.lineTo(0.12, 0.12); c.lineTo(-0.03, 0.2); c.lineTo(-0.16, 0.08); c.lineTo(-0.12, -0.1);
    c.closePath(); c.fill();
    c.strokeStyle = '#4a2a0c';
    c.lineWidth = 0.02;
    c.beginPath();
    c.moveTo(-0.04, 0.02); c.lineTo(0.05, 0.0);
    c.moveTo(0.0, 0.01); c.lineTo(-0.05, -0.06); c.moveTo(0.0, 0.01); c.lineTo(0.05, -0.07);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath(); c.ellipse(-0.07, -0.1, 0.05, 0.025, -0.6, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  drawRobot(c, r, game) {
    if (!r) return;
    const x = r.px + 0.5, y = r.py + 0.5;
    let ang = Math.atan2(r.dir.y, r.dir.x);
    let scale = 1;
    if (game.state === 'dying') {
      const p = Math.min(1, game.stateTime / 1.4);
      ang += p * p * Math.PI * 8;
      scale = 1 - p;
      c.fillStyle = '#ffd34f';
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + p;
        const d = 0.2 + p * 0.7;
        c.globalAlpha = 1 - p;
        c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.05, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      if (scale <= 0.01) return;
    }
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.scale(scale, scale);

    c.fillStyle = 'rgba(0, 0, 0, 0.18)';
    c.beginPath(); c.arc(0.04, 0.05, 0.42, 0, Math.PI * 2); c.fill();

    c.strokeStyle = '#59646d';
    c.lineWidth = 0.03;
    for (const sgn of [-1, 1]) {
      c.save();
      c.translate(0.25, 0.27 * sgn);
      c.rotate(game.time * 18 * sgn);
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = k * (Math.PI * 2 / 3);
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * 0.15, Math.sin(a) * 0.15);
      }
      c.stroke();
      c.restore();
    }

    c.fillStyle = '#eef2f4';
    c.strokeStyle = '#93a2ab';
    c.lineWidth = 0.045;
    c.beginPath(); c.arc(0, 0, 0.4, 0, Math.PI * 2); c.fill(); c.stroke();

    c.strokeStyle = '#46535b';
    c.lineWidth = 0.09;
    c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, 0.355, -1.05, 1.05); c.stroke();

    c.fillStyle = '#d2dbe0';
    c.beginPath(); c.arc(-0.06, 0, 0.19, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#b7c3ca';
    c.lineWidth = 0.025;
    c.beginPath(); c.moveTo(-0.06, -0.19); c.lineTo(-0.06, 0.19); c.stroke();

    const powered = game.iceTimer > 0;
    const on = powered || Math.floor(game.time * 2) % 2 === 0;
    c.fillStyle = powered ? '#7fd4ff' : (on ? '#3ddc84' : '#2c6a49');
    c.beginPath(); c.arc(0.14, 0, 0.055, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  drawDino(c, dino, game) {
    const def = dino.def;
    const sp = def.species;
    const bob = dino.state === 'pen' ? Math.sin(dino.anim * 5) * 0.06 : 0;
    const fly = sp === 'ptera' ? -0.1 + Math.sin(dino.anim * 4) * 0.04 : 0;
    const x = dino.px + 0.5, y = dino.py + 0.5;
    const fossil = dino.state === 'eaten';
    const scared = dino.state === 'scared';

    let col = { body: def.color, belly: def.belly, accent: def.accent, horn: '#f5ecd2' };
    if (scared) {
      const flash = game.iceTimer < 2 && Math.floor(game.time * 8) % 2 === 0;
      col = flash
        ? { body: '#ffffff', belly: '#eef6ff', accent: '#bcd6f5', horn: '#ffffff', scared }
        : { body: '#a9d6ff', belly: '#e3f2ff', accent: '#5f9bd8', horn: '#eaf6ff', scared };
    } else if (fossil) {
      col = { body: '#f1e6cc', belly: '#f7efdc', accent: '#c4ad80', horn: '#f7efdc', fossil };
    }

    c.save();
    c.translate(x, y);
    // Shadow stays on the floor, even for the flyer.
    c.fillStyle = sp === 'ptera' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.16)';
    c.beginPath(); c.ellipse(0, 0.34, sp === 'ptera' ? 0.22 : 0.36, 0.07, 0, 0, Math.PI * 2); c.fill();

    c.translate(scared ? Math.sin(game.time * 70) * 0.025 : 0, bob + fly);
    c.scale(dino.face, 1);
    if (sp === 'bronto') c.scale(1.08, 1.08);
    if (fossil) c.globalAlpha = 0.6;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    const fast = dino.dashing || dino.charging || dino.swooping;
    const step = dino.state === 'pen' ? 0 : Math.sin(dino.anim * (fast ? 24 : 15));
    if (fast || fossil) this.speedLines(c, dino.anim);

    switch (sp) {
      case 'trex': this.trex(c, col, step, dino); break;
      case 'raptor': this.raptor(c, col, step, dino); break;
      case 'trike': this.trike(c, col, step, dino); break;
      case 'ptera': this.ptera(c, col, dino); break;
      default: this.bronto(c, col, step, dino); break;
    }

    if (dino.charging) {
      c.fillStyle = 'rgba(255,255,255,0.8)';
      const p = (dino.anim * 3) % 1;
      c.beginPath();
      c.arc(0.5 + p * 0.15, -0.05 - p * 0.1, 0.04 + p * 0.04, 0, Math.PI * 2);
      c.arc(0.48 + p * 0.1, 0.06 - p * 0.06, 0.03 + p * 0.03, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    if (scared) this.snowflake(c, x, y - 0.55 + fly, 0.12, game.time * 2, 'rgba(230,245,255,0.95)');
  }

  speedLines(c, t) {
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 0.035;
    c.beginPath();
    for (let k = 0; k < 3; k++) {
      const o = ((t * 4 + k * 0.33) % 1) * 0.15;
      c.moveTo(-0.42 - o, -0.15 + k * 0.13);
      c.lineTo(-0.62 - o, -0.15 + k * 0.13);
    }
    c.stroke();
  }

  eye(c, x, y, r, dino, col) {
    if (col.fossil) {
      c.fillStyle = '#6b5a3c';
      c.beginPath(); c.arc(x, y, r * 0.8, 0, Math.PI * 2); c.fill();
      return;
    }
    if (col.scared) {
      c.strokeStyle = '#2b3a55';
      c.lineWidth = 0.025;
      c.beginPath();
      c.moveTo(x - r, y - r * 0.6); c.lineTo(x + r * 0.6, y); c.lineTo(x - r, y + r * 0.6);
      c.stroke();
      return;
    }
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = dino.charging ? '#c0262d' : '#1d1d1d';
    c.beginPath(); c.arc(x + r * 0.3, y + dino.dir.y * r * 0.4, r * 0.55, 0, Math.PI * 2); c.fill();
  }

  legs(c, color, width, xs, top, bottom, step) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    xs.forEach((lx, i) => {
      const ph = i % 2 ? -1 : 1;
      c.moveTo(lx, top);
      c.lineTo(lx + step * 0.05 * ph, bottom);
    });
    c.stroke();
  }

  trex(c, col, step, dino) {
    c.fillStyle = col.body;
    c.beginPath(); c.moveTo(-0.12, -0.06); c.quadraticCurveTo(-0.38, 0.0, -0.5, 0.12); c.lineTo(-0.1, 0.14); c.fill();
    this.legs(c, col.accent, 0.1, [-0.06, 0.08], 0.1, 0.31, step);
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(0, 0.03, 0.23, 0.16, -0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.belly;
    c.beginPath(); c.ellipse(0.06, 0.08, 0.14, 0.08, -0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.body;
    c.beginPath(); c.moveTo(0.04, -0.1); c.lineTo(0.14, -0.3); c.lineTo(0.27, -0.2); c.lineTo(0.18, 0.02); c.fill();
    roundRect(c, 0.1, -0.38, 0.34, 0.19, 0.07); c.fill();
    c.fillStyle = col.accent;
    roundRect(c, 0.15, -0.21, 0.27, 0.08, 0.04); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (const tx of [0.24, 0.31, 0.38]) { c.moveTo(tx, -0.2); c.lineTo(tx + 0.025, -0.16); c.lineTo(tx + 0.05, -0.2); }
    c.fill();
    c.strokeStyle = col.accent;
    c.lineWidth = 0.045;
    c.beginPath(); c.moveTo(0.16, -0.01); c.lineTo(0.24, 0.03); c.stroke();
    c.fillStyle = col.accent;
    c.beginPath();
    for (const [sx, sy] of [[-0.12, -0.05], [-0.02, -0.1], [-0.2, 0.02]]) { c.moveTo(sx + 0.03, sy); c.arc(sx, sy, 0.03, 0, Math.PI * 2); }
    c.fill();
    this.eye(c, 0.25, -0.3, 0.045, dino, col);
  }

  raptor(c, col, step, dino) {
    c.strokeStyle = col.body;
    c.lineWidth = 0.08;
    c.beginPath(); c.moveTo(-0.1, -0.02); c.quadraticCurveTo(-0.3, -0.04, -0.5, -0.14); c.stroke();
    c.strokeStyle = col.accent;
    c.lineWidth = 0.055;
    c.beginPath();
    for (const ph of [1, -1]) {
      c.moveTo(0.0, 0.06);
      c.lineTo(0.05 + step * 0.05 * ph, 0.19);
      c.lineTo(-0.01 + step * 0.07 * ph, 0.31);
    }
    c.stroke();
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(-0.02, 0.0, 0.2, 0.11, -0.15, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col.accent;
    c.lineWidth = 0.035;
    c.beginPath();
    for (const sx of [-0.12, -0.03, 0.06]) { c.moveTo(sx, -0.1); c.lineTo(sx + 0.03, -0.02); }
    c.stroke();
    c.strokeStyle = col.body;
    c.lineWidth = 0.09;
    c.beginPath(); c.moveTo(0.1, -0.04); c.lineTo(0.22, -0.2); c.stroke();
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(0.3, -0.22, 0.14, 0.065, 0.05, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col.accent;
    c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(0.3, -0.19); c.lineTo(0.43, -0.2); c.stroke();
    c.beginPath();
    for (let k = 0; k < 3; k++) { c.moveTo(0.2 - k * 0.03, -0.26); c.lineTo(0.12 - k * 0.04, -0.34 + k * 0.02); }
    c.stroke();
    c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(0.12, 0.0); c.lineTo(0.2, 0.05); c.lineTo(0.23, 0.02); c.stroke();
    this.eye(c, 0.31, -0.245, 0.036, dino, col);
  }

  trike(c, col, step, dino) {
    c.fillStyle = col.body;
    c.beginPath(); c.moveTo(-0.2, -0.04); c.lineTo(-0.46, 0.09); c.lineTo(-0.2, 0.11); c.fill();
    this.legs(c, col.accent, 0.1, [-0.17, -0.06, 0.07, 0.16], 0.1, 0.31, step);
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(-0.04, 0.02, 0.25, 0.16, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.belly;
    c.beginPath(); c.ellipse(-0.04, 0.09, 0.17, 0.06, 0, 0, Math.PI * 2); c.fill();
    // Frill with a scalloped edge.
    c.fillStyle = col.accent;
    c.beginPath(); c.arc(0.19, -0.07, 0.2, 0, Math.PI * 2); c.fill();
    c.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI * 0.95 + k * (Math.PI * 1.1 / 6);
      const fx = 0.19 + Math.cos(a) * 0.2, fy = -0.07 + Math.sin(a) * 0.2;
      c.moveTo(fx + 0.05, fy); c.arc(fx, fy, 0.05, 0, Math.PI * 2);
    }
    c.fill();
    c.fillStyle = col.belly;
    c.beginPath(); c.arc(0.19, -0.07, 0.12, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(0.3, 0.0, 0.14, 0.1, 0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.accent;
    c.beginPath(); c.moveTo(0.41, -0.02); c.lineTo(0.49, 0.06); c.lineTo(0.39, 0.08); c.fill();
    c.fillStyle = col.horn;
    c.beginPath();
    c.moveTo(0.27, -0.07); c.lineTo(0.47, -0.25); c.lineTo(0.33, -0.05);
    c.moveTo(0.33, -0.07); c.lineTo(0.52, -0.2); c.lineTo(0.37, -0.03);
    c.moveTo(0.4, -0.04); c.lineTo(0.46, -0.12); c.lineTo(0.44, -0.02);
    c.fill();
    this.eye(c, 0.29, -0.03, 0.035, dino, col);
  }

  ptera(c, col, dino) {
    const flap = Math.sin(dino.anim * (dino.swooping ? 20 : 9));
    const wing = (color, dx) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0.04 + dx, -0.03);
      c.quadraticCurveTo(-0.05 + dx, -0.2 - 0.25 * flap, -0.18 + dx, -0.06 - 0.36 * flap);
      c.lineTo(-0.3 + dx, 0.06);
      c.closePath();
      c.fill();
    };
    wing(col.accent, 0.12);
    c.strokeStyle = col.accent;
    c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(-0.04, 0.06); c.lineTo(-0.06, 0.15); c.moveTo(0.04, 0.06); c.lineTo(0.03, 0.15); c.stroke();
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(0, 0.0, 0.14, 0.08, -0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.belly;
    c.beginPath(); c.ellipse(0.02, 0.03, 0.09, 0.04, -0.1, 0, Math.PI * 2); c.fill();
    wing(col.body, 0);
    c.fillStyle = col.accent;
    c.beginPath(); c.moveTo(0.13, -0.09); c.lineTo(-0.02, -0.22); c.lineTo(0.18, -0.12); c.fill();
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(0.17, -0.07, 0.08, 0.06, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.fossil || col.scared ? col.horn : '#f2c14e';
    c.beginPath(); c.moveTo(0.21, -0.1); c.lineTo(0.44, -0.04); c.lineTo(0.21, -0.03); c.fill();
    this.eye(c, 0.18, -0.085, 0.03, dino, col);
  }

  bronto(c, col, step, dino) {
    c.fillStyle = col.body;
    c.beginPath(); c.moveTo(-0.24, -0.02); c.quadraticCurveTo(-0.45, 0.0, -0.55, -0.08); c.quadraticCurveTo(-0.42, 0.08, -0.22, 0.12); c.fill();
    this.legs(c, col.accent, 0.11, [-0.2, -0.09, 0.05, 0.15], 0.12, 0.31, step);
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(-0.04, 0.04, 0.27, 0.17, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.belly;
    c.beginPath(); c.ellipse(-0.03, 0.11, 0.18, 0.06, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col.body;
    c.lineWidth = 0.1;
    c.beginPath(); c.moveTo(0.14, 0.0); c.quadraticCurveTo(0.3, -0.12, 0.29, -0.36); c.stroke();
    c.fillStyle = col.body;
    c.beginPath(); c.ellipse(0.34, -0.39, 0.1, 0.06, 0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = col.accent;
    c.beginPath();
    for (const [sx, sy] of [[-0.14, -0.06], [-0.02, -0.1], [0.08, -0.06]]) { c.moveTo(sx + 0.035, sy); c.arc(sx, sy, 0.035, 0, Math.PI * 2); }
    c.fill();
    this.eye(c, 0.36, -0.41, 0.03, dino, col);
  }

  snowflake(c, x, y, r, rot, color) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.strokeStyle = color;
    c.lineWidth = r * 0.22;
    c.lineCap = 'round';
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      const ca = Math.cos(a), sa = Math.sin(a);
      c.moveTo(0, 0); c.lineTo(ca * r, sa * r);
      const bx = ca * r * 0.6, by = sa * r * 0.6;
      for (const s of [-1, 1]) {
        const b = a + s * 0.7;
        c.moveTo(bx, by); c.lineTo(bx + Math.cos(b) * r * 0.32, by + Math.sin(b) * r * 0.32);
      }
    }
    c.stroke();
    c.restore();
  }
}

function blob(c, x, y, r) {
  c.moveTo(x + r, y);
  c.arc(x, y, r, 0, Math.PI * 2);
}

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
