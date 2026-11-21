// Robot and cat movement on the tile grid, plus each cat's personality.
import { W, H, FLOOR, PEN, DOOR, PEN_EXIT, bfs } from './maze.js';

export const DIR = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const ALL = [DIR.up, DIR.left, DIR.down, DIR.right];
const opposite = (a, b) => a && b && a.x === -b.x && a.y === -b.y;

export const CAT_DEFS = [
  // Biscuit follows the shortest path straight to you.
  { name: 'Biscuit', kind: 'chaser', color: '#e8914a', accent: '#b8601f', pattern: 'stripes', corner: { x: W + 1, y: -3 }, release: 0 },
  // Smudge aims a few tiles ahead of where you're heading.
  { name: 'Smudge', kind: 'ambusher', color: '#a7acb2', accent: '#6f757c', pattern: 'stripes', corner: { x: -2, y: -3 }, release: 2.5 },
  // Pepper wanders, but pounces when you get close.
  { name: 'Pepper', kind: 'wanderer', color: '#36363e', accent: '#1d1d22', pattern: 'plain', corner: { x: W + 1, y: H + 2 }, release: 6 },
  // Mochi stalks from a distance and backs off when you're near.
  { name: 'Mochi', kind: 'shy', color: '#f4eee3', accent: '#e08a3c', pattern: 'patches', corner: { x: -2, y: H + 2 }, release: 10 },
];

class Mover {
  constructor(x, y) {
    this.x = x; // tile currently departing from (or standing on)
    this.y = y;
    this.t = 0; // progress toward the next tile, 0..1
    this.dir = DIR.left;
    this.moving = false;
  }
  get px() { return this.x + this.dir.x * this.t; }
  get py() { return this.y + this.dir.y * this.t; }

  // Move `dist` tiles. `choose` picks a direction at each tile centre (or null to stop).
  // `arrive` runs on reaching a tile; returning true stops movement for this step.
  advance(dist, choose, arrive) {
    let guard = 0;
    while (dist > 1e-9 && guard++ < 8) {
      if (this.t === 0) {
        const d = choose();
        if (!d) { this.moving = false; return; }
        this.dir = d;
        this.moving = true;
      }
      const need = 1 - this.t;
      if (dist >= need) {
        dist -= need;
        this.x += this.dir.x;
        this.y += this.dir.y;
        this.t = 0;
        if (arrive && arrive() === true) return;
      } else {
        this.t += dist;
        dist = 0;
      }
    }
  }

  reverse() {
    if (this.t > 0) {
      this.x += this.dir.x;
      this.y += this.dir.y;
      this.t = 1 - this.t;
    }
    this.dir = { x: -this.dir.x, y: -this.dir.y };
  }
}

export class Robot extends Mover {
  constructor(x, y) {
    super(x, y);
    this.next = null;
  }
  update(dt, speed, grid, onArrive) {
    if (this.next && this.t > 0 && opposite(this.next, this.dir)) this.reverse();
    const ok = (d) => grid[this.y + d.y]?.[this.x + d.x] === FLOOR;
    this.advance(speed * dt, () => {
      if (this.next && ok(this.next)) return this.next;
      if (ok(this.dir)) return this.dir;
      return null;
    }, onArrive);
  }
}

export class Cat extends Mover {
  constructor(def, spot, release) {
    super(spot.x, spot.y);
    this.def = def;
    this.home = spot;
    this.release = release;
    this.penTime = 0;
    this.state = 'pen'; // pen | leaving | roam | scared | eaten
    this.dir = DIR.up;
    this.face = def.kind === 'ambusher' ? -1 : 1;
    this.anim = Math.random() * 10;
  }

  get homeward() { return this.state === 'leaving' || this.state === 'eaten'; }

  update(dt, g) {
    this.anim += dt;
    if (this.state === 'pen') {
      this.penTime += dt;
      if (this.penTime >= this.release) this.state = 'leaving';
      return;
    }
    let speed = g.catSpeed;
    if (this.state === 'scared' || this.state === 'leaving') speed *= 0.55;
    else if (this.state === 'eaten') speed = Math.max(12, g.catSpeed * 1.8);
    const homeward = this.homeward;
    const pass = (x, y) => {
      const t = g.grid[y]?.[x];
      return t === FLOOR || (homeward && (t === DOOR || t === PEN));
    };
    this.advance(speed * dt, () => this.choose(g, pass), () => this.arrive());
    if (this.dir.x) this.face = this.dir.x;
  }

  arrive() {
    if (this.state === 'leaving' && this.x === PEN_EXIT.x && this.y === PEN_EXIT.y) {
      this.state = 'roam';
      this.dir = Math.random() < 0.5 ? DIR.left : DIR.right;
      return true;
    }
    if (this.state === 'eaten' && this.x === this.home.x && this.y === this.home.y) {
      this.state = 'pen';
      this.penTime = 0;
      this.release = 0.6;
      this.dir = DIR.up;
      return true;
    }
    return false;
  }

  choose(g, pass) {
    const opts = ALL.filter((d) => pass(this.x + d.x, this.y + d.y));
    if (!opts.length) return null;
    let cand = this.homeward ? opts : opts.filter((d) => !opposite(d, this.dir));
    if (!cand.length) cand = opts;
    if (cand.length === 1) return cand[0];

    const pickRandom = () => cand[Math.floor(g.rng() * cand.length)];
    if (this.state === 'scared') return pickRandom();
    if (this.state === 'leaving') return this.bfsPick(cand, PEN_EXIT, g, pass);
    if (this.state === 'eaten') return this.bfsPick(cand, this.home, g, pass);

    if (g.mode === 'scatter') return this.greedy(cand, this.def.corner);
    const r = g.robot;
    const target = { x: r.x, y: r.y };
    const d2 = (this.x - r.x) ** 2 + (this.y - r.y) ** 2;
    switch (this.def.kind) {
      case 'chaser': return this.bfsPick(cand, target, g, pass);
      case 'ambusher': return this.greedy(cand, { x: r.x + r.dir.x * 4, y: r.y + r.dir.y * 4 });
      case 'wanderer': return d2 < 36 ? this.bfsPick(cand, target, g, pass) : pickRandom();
      case 'shy': return d2 > 49 ? this.greedy(cand, target) : this.greedy(cand, this.def.corner);
      default: return pickRandom();
    }
  }

  greedy(cand, target) {
    let best = cand[0], bestD = Infinity;
    for (const d of cand) {
      const nx = this.x + d.x, ny = this.y + d.y;
      const dd = (nx - target.x) ** 2 + (ny - target.y) ** 2;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  bfsPick(cand, target, g, pass) {
    const dist = bfs(g.grid, target, pass);
    let best = null, bestD = Infinity;
    for (const d of cand) {
      const v = dist[(this.y + d.y) * W + (this.x + d.x)];
      if (v >= 0 && v < bestD) { bestD = v; best = d; }
    }
    return best || this.greedy(cand, target);
  }
}
