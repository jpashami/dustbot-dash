// All canvas drawing. Game objects are drawn in tile units (1 unit = 1 tile).
import { W, H, WALL, FLOOR, PEN, DOOR } from './maze.js';

const C = {
  bg: '#1d2830',
  wall: '#3d6070',
  wallHi: '#4d7486',
  floor: '#ebd2aa',
  floorAlt: '#e5c99e',
  seam: 'rgba(110, 70, 30, 0.13)',
  cushion: '#c98b7f',
  cushionEdge: '#a96a60',
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

    // Cat bed cushion and cat flap.
    let px0 = W, py0 = H, px1 = 0, py1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] === PEN) { px0 = Math.min(px0, x); py0 = Math.min(py0, y); px1 = Math.max(px1, x + 1); py1 = Math.max(py1, y + 1); }
    }
    if (px1 > px0) {
      c.fillStyle = C.cushionEdge;
      roundRect(c, px0 + 0.08, py0 + 0.08, px1 - px0 - 0.16, py1 - py0 - 0.16, 0.45);
      c.fill();
      c.fillStyle = C.cushion;
      roundRect(c, px0 + 0.22, py0 + 0.2, px1 - px0 - 0.44, py1 - py0 - 0.4, 0.35);
      c.fill();
      c.setLineDash([0.12, 0.1]);
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 0.04;
      roundRect(c, px0 + 0.34, py0 + 0.32, px1 - px0 - 0.68, py1 - py0 - 0.64, 0.25);
      c.stroke();
      c.setLineDash([]);
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
    for (const y of game.yarn) if (y.alive) this.drawYarn(c, y, game.time);
    if (game.sock.active) this.drawSock(c, game.sock, game.time);

    const hideCats = (game.state === 'dying' && game.stateTime > 0.5) || game.state === 'levelclear';
    if (!hideCats) for (const cat of game.cats) this.drawCat(c, cat, game);
    if (game.state !== 'gameover') this.drawRobot(c, game.robot, game);

    // Pixel-space text.
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const T = this.T;
    if (game.state === 'ready') this.label(c, 'READY!', 9.5 * T, 13.5 * T, '#ffb347', T * 0.8);
    if (game.state === 'levelclear') this.label(c, 'ROOM CLEAN!', 9.5 * T, 13.5 * T, '#7fe0a8', T * 0.8);
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

  drawYarn(c, p, time) {
    const r = 0.25 + Math.sin(time * 6) * 0.03;
    const x = p.x + 0.5, y = p.y + 0.5;
    c.save();
    c.translate(x, y);
    c.strokeStyle = '#d23c48';
    c.lineWidth = 0.05;
    c.beginPath();
    c.moveTo(r * 0.6, r * 0.6);
    c.quadraticCurveTo(0.4, 0.4, 0.38, 0.12);
    c.stroke();
    c.fillStyle = '#e5484d';
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255, 200, 200, 0.75)';
    c.lineWidth = 0.035;
    for (let k = -1; k <= 1; k++) {
      c.beginPath();
      c.ellipse(0, 0, r * 0.95, r * (0.35 + 0.25 * Math.abs(k)), 0.7 + k * 0.9, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  drawSock(c, s, time) {
    if (s.timer < 2 && Math.floor(time * 8) % 2 === 0) return;
    c.save();
    c.translate(s.x + 0.5, s.y + 0.5 + Math.sin(time * 4) * 0.04);
    c.rotate(-0.35);
    c.fillStyle = '#4f7cff';
    roundRect(c, -0.13, -0.34, 0.24, 0.46, 0.06);
    c.fill();
    c.beginPath(); c.ellipse(0.06, 0.12, 0.2, 0.12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.fillRect(-0.13, -0.34, 0.24, 0.09);
    c.fillStyle = '#ffd34f';
    c.beginPath(); c.arc(0.2, 0.13, 0.07, 0, Math.PI * 2); c.fill();
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

    const powered = game.yarnTimer > 0;
    const on = powered || Math.floor(game.time * 2) % 2 === 0;
    c.fillStyle = powered ? '#ff5fa2' : (on ? '#3ddc84' : '#2c6a49');
    c.beginPath(); c.arc(0.14, 0, 0.055, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  drawCat(c, cat, game) {
    const bob = cat.state === 'pen' ? Math.sin(cat.anim * 5) * 0.08 : 0;
    const x = cat.px + 0.5, y = cat.py + 0.5 + bob;
    const def = cat.def;
    c.save();
    c.translate(x, y);
    c.scale(cat.face, 1);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    if (cat.state === 'eaten') {
      // Dashing back to bed: just a faint head with motion lines.
      c.globalAlpha = 0.6;
      this.catHead(c, def.color, def.accent, false, cat, 0);
      c.strokeStyle = def.color;
      c.lineWidth = 0.04;
      c.beginPath();
      for (let k = 0; k < 3; k++) { c.moveTo(-0.05, -0.2 + k * 0.1); c.lineTo(-0.3, -0.2 + k * 0.1); }
      c.stroke();
      c.restore();
      return;
    }

    const scared = cat.state === 'scared';
    let body = def.color, accent = def.accent;
    if (scared) {
      const flash = game.yarnTimer < 2 && Math.floor(game.time * 8) % 2 === 0;
      body = flash ? '#ffffff' : '#a9d0ff';
      accent = flash ? '#d4e4ff' : '#6d9fe0';
    }
    const moving = cat.state !== 'pen';
    const step = moving ? Math.sin(cat.anim * 16) : 0;

    c.fillStyle = 'rgba(0, 0, 0, 0.16)';
    c.beginPath(); c.ellipse(0, 0.33, 0.36, 0.07, 0, 0, Math.PI * 2); c.fill();

    // Tail
    c.strokeStyle = scared ? accent : (def.pattern === 'patches' ? '#3a3a3a' : accent);
    c.lineWidth = 0.09;
    c.beginPath();
    c.moveTo(-0.28, 0.04);
    c.quadraticCurveTo(-0.52, 0.0, -0.46, -0.28 + Math.sin(cat.anim * 6) * 0.08);
    c.stroke();

    // Legs
    c.strokeStyle = accent;
    c.lineWidth = 0.075;
    c.beginPath();
    [[-0.19, 1], [-0.07, -1], [0.07, 1], [0.19, -1]].forEach(([lx, ph]) => {
      c.moveTo(lx, 0.14);
      c.lineTo(lx + step * 0.05 * ph, 0.31);
    });
    c.stroke();

    // Body
    c.fillStyle = body;
    c.beginPath(); c.ellipse(0, 0.06, 0.32, 0.19, 0, 0, Math.PI * 2); c.fill();
    if (!scared && def.pattern === 'stripes') {
      c.strokeStyle = accent;
      c.lineWidth = 0.045;
      c.beginPath();
      for (const sx of [-0.16, -0.04, 0.08]) { c.moveTo(sx, -0.12); c.lineTo(sx + 0.03, 0.02); }
      c.stroke();
    } else if (!scared && def.pattern === 'patches') {
      c.fillStyle = accent;
      c.beginPath(); c.ellipse(-0.12, 0.0, 0.11, 0.08, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a3a3a';
      c.beginPath(); c.ellipse(0.1, 0.1, 0.07, 0.05, -0.2, 0, Math.PI * 2); c.fill();
    }

    this.catHead(c, body, accent, scared, cat, def.pattern === 'patches' && !scared ? 1 : 0);
    c.restore();
  }

  catHead(c, body, accent, scared, cat, patch) {
    const hx = 0.24, hy = -0.1;
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(hx - 0.15, hy - 0.08); c.lineTo(hx - 0.11, hy - 0.3); c.lineTo(hx - 0.01, hy - 0.16);
    c.moveTo(hx + 0.03, hy - 0.17); c.lineTo(hx + 0.13, hy - 0.31); c.lineTo(hx + 0.16, hy - 0.07);
    c.fill();
    c.fillStyle = '#f2a6a6';
    c.beginPath();
    c.moveTo(hx - 0.12, hy - 0.12); c.lineTo(hx - 0.1, hy - 0.24); c.lineTo(hx - 0.04, hy - 0.16);
    c.moveTo(hx + 0.06, hy - 0.17); c.lineTo(hx + 0.12, hy - 0.25); c.lineTo(hx + 0.13, hy - 0.12);
    c.fill();
    c.fillStyle = body;
    c.beginPath(); c.arc(hx, hy, 0.18, 0, Math.PI * 2); c.fill();
    if (patch) {
      c.fillStyle = accent;
      c.beginPath(); c.arc(hx - 0.07, hy - 0.07, 0.09, 0, Math.PI * 2); c.fill();
    }

    const ex = [hx - 0.06, hx + 0.07], ey = hy - 0.02;
    if (scared) {
      c.strokeStyle = '#2b3a55';
      c.lineWidth = 0.03;
      c.beginPath();
      for (const e of ex) { c.moveTo(e - 0.03, ey - 0.02); c.lineTo(e + 0.03, ey + 0.02); c.moveTo(e + 0.03, ey - 0.02); c.lineTo(e - 0.03, ey + 0.02); }
      c.moveTo(hx - 0.07, hy + 0.09);
      for (let k = 1; k <= 4; k++) c.lineTo(hx - 0.07 + k * 0.035, hy + 0.09 + (k % 2 ? -0.02 : 0));
      c.stroke();
      return;
    }
    const lookX = 0.015, lookY = cat.dir.y * 0.02;
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (const e of ex) { c.moveTo(e + 0.045, ey); c.arc(e, ey, 0.045, 0, Math.PI * 2); }
    c.fill();
    c.fillStyle = cat.def.kind === 'wanderer' ? '#c9a400' : '#1d1d1d';
    c.beginPath();
    for (const e of ex) { c.moveTo(e + lookX + 0.024, ey + lookY); c.arc(e + lookX, ey + lookY, 0.024, 0, Math.PI * 2); }
    c.fill();
    c.fillStyle = '#e07a8a';
    c.beginPath(); c.moveTo(hx + 0.14, hy + 0.04); c.lineTo(hx + 0.18, hy + 0.03); c.lineTo(hx + 0.16, hy + 0.07); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 0.015;
    c.beginPath();
    c.moveTo(hx + 0.12, hy + 0.07); c.lineTo(hx + 0.3, hy + 0.04);
    c.moveTo(hx + 0.12, hy + 0.09); c.lineTo(hx + 0.3, hy + 0.11);
    c.stroke();
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
