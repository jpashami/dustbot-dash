// Robot and dinosaur movement on the tile grid, plus each dinosaur's personality.
import { W, H, FLOOR, PEN, DOOR, PEN_EXIT, bfs } from './maze.js';

export const DIR = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const ALL = [DIR.up, DIR.left, DIR.down, DIR.right];
const opposite = (a, b) => a && b && a.x === -b.x && a.y === -b.y;
const sameDir = (a, b) => a && b && a.x === b.x && a.y === b.y;

// `speed` is relative to the level's base dinosaur speed.
// `from` is the first level the dinosaur appears on.
export const DINO_DEFS = [
  {
    name: 'Rex', species: 'trex', kind: 'stomper', speed: 1.0, from: 1, release: 0,
    color: '#5da34a', belly: '#c9e29a', accent: '#3f7a31', corner: { x: W + 1, y: -3 },
    trait: 'Takes the shortest path to you. Speeds up on long straight halls, slows down on corners.',
  },
  {
    name: 'Zip', species: 'raptor', kind: 'dasher', speed: 1.06, from: 1, release: 2.5,
    color: '#e8873a', belly: '#f6d1a3', accent: '#9c4a17', corner: { x: -2, y: -3 },
    trait: 'Quick. Aims a few tiles ahead of you and every few seconds bursts into a sprint.',
  },
  {
    name: 'Trike', species: 'trike', kind: 'charger', speed: 0.85, from: 1, release: 6,
    color: '#7183d8', belly: '#c7cff5', accent: '#3f4e9e', corner: { x: W + 1, y: H + 2 },
    trait: 'Slow and wandering, but charges hard if it spots you down a straight hall.',
  },
  {
    name: 'Ptera', species: 'ptera', kind: 'swooper', speed: 0.95, from: 3, release: 9,
    color: '#3fb5a8', belly: '#bdeee6', accent: '#1f7a70', corner: { x: -2, y: H + 2 },
    trait: 'Circles around at random, then swoops straight at you every few seconds.',
  },
  {
    name: 'Bronto', species: 'bronto', kind: 'guard', speed: 0.72, from: 5, release: 12,
    color: '#9a8a5c', belly: '#d9cfa8', accent: '#6b5e38', corner: { x: (W - 1) / 2, y: H + 2 },
    trait: 'Very slow. Patrols around its nest and only chases you if you come close.',
  },
];

// Corners of the corridor ring around the nest, for Bronto's patrol.
const PATROL = [{ x: 5, y: 8 }, { x: 13, y: 8 }, { x: 13, y: 13 }, { x: 5, y: 13 }];

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

export class Dino extends Mover {
  constructor(def, spot, release) {
    super(spot.x, spot.y);
    this.def = def;
    this.home = spot;
    this.release = release;
    this.penTime = 0;
    this.state = 'pen'; // pen | leaving | roam | scared | eaten
    this.dir = DIR.up;
    this.face = spot.x < (W - 1) / 2 ? 1 : -1;
    this.anim = Math.random() * 10;
    // Trait state
    this.straight = 0; // Rex: tiles moved without turning
    this.traitTimer = 4 + Math.random() * 3; // Zip / Ptera: time until next burst
    this.burst = 0; // Zip: sprint time left, Ptera: swoop time left
    this.charging = false; // Trike
    this.patrol = 0; // Bronto
  }

  get homeward() { return this.state === 'leaving' || this.state === 'eaten'; }
  get dashing() { return this.def.kind === 'dasher' && this.burst > 0 && this.state === 'roam'; }
  get swooping() { return this.def.kind === 'swooper' && this.burst > 0 && this.state === 'roam'; }

  update(dt, g) {
    this.anim += dt;
    if (this.state === 'pen') {
      this.penTime += dt;
      if (this.penTime >= this.release) this.state = 'leaving';
      return;
    }
    this.updateTrait(dt, g);

    let speed = g.dinoSpeed * this.def.speed;
    if (this.state === 'scared' || this.state === 'leaving') speed = g.dinoSpeed * 0.5;
    else if (this.state === 'eaten') speed = Math.max(12, g.dinoSpeed * 1.8);
    else {
      speed *= this.traitSpeed();
      speed = Math.min(speed, g.robotSpeed * 1.15);
    }

    const homeward = this.homeward;
    const pass = (x, y) => {
      const t = g.grid[y]?.[x];
      return t === FLOOR || (homeward && (t === DOOR || t === PEN));
    };
    this.advance(speed * dt, () => this.choose(g, pass), () => this.arrive());
    if (this.dir.x) this.face = this.dir.x;
  }

  updateTrait(dt, g) {
    const kind = this.def.kind;
    if (kind === 'dasher' || kind === 'swooper') {
      if (this.burst > 0) {
        this.burst -= dt;
      } else {
        this.traitTimer -= dt;
        if (this.traitTimer <= 0) {
          this.burst = kind === 'dasher' ? 1.3 : 3;
          this.traitTimer = kind === 'dasher' ? 5 + Math.random() * 3 : 6 + Math.random() * 3;
        }
      }
    }
    if (kind === 'charger') {
      this.charging = this.state === 'roam' && this.seesRobot(g);
    }
  }

  traitSpeed() {
    switch (this.def.kind) {
      case 'stomper': return 0.85 + Math.min(this.straight, 6) * 0.055;
      case 'dasher': return this.dashing ? 1.45 : 1;
      case 'charger': return this.charging ? 1.7 : 1;
      case 'swooper': return this.swooping ? 1.3 : 1;
      default: return 1;
    }
  }

  // Trike: is the robot in the same row or column with nothing but floor between?
  seesRobot(g) {
    const r = g.robot;
    if (r.x !== this.x && r.y !== this.y) return false;
    const dx = Math.sign(r.x - this.x), dy = Math.sign(r.y - this.y);
    const steps = Math.abs(r.x - this.x) + Math.abs(r.y - this.y);
    if (steps > 12) return false;
    for (let i = 1; i < steps; i++) {
      if (g.grid[this.y + dy * i][this.x + dx * i] !== FLOOR) return false;
    }
    return true;
  }

  arrive() {
    if (this.state === 'leaving' && this.x === PEN_EXIT.x && this.y === PEN_EXIT.y) {
      this.state = 'roam';
      this.dir = Math.random() < 0.5 ? DIR.left : DIR.right;
      this.straight = 0;
      return true;
    }
    if (this.state === 'eaten' && this.x === this.home.x && this.y === this.home.y) {
      this.state = 'pen';
      this.penTime = 0;
      this.release = 0.6;
      this.dir = DIR.up;
      return true;
    }
    if (this.def.kind === 'guard') {
      const p = PATROL[this.patrol];
      if (Math.abs(p.x - this.x) + Math.abs(p.y - this.y) <= 1) this.patrol = (this.patrol + 1) % PATROL.length;
    }
    return false;
  }

  choose(g, pass) {
    const d = this.pick(g, pass);
    if (d && this.def.kind === 'stomper') this.straight = sameDir(d, this.dir) ? this.straight + 1 : 0;
    return d;
  }

  pick(g, pass) {
    const opts = ALL.filter((d) => pass(this.x + d.x, this.y + d.y));
    if (!opts.length) return null;
    let cand = this.homeward ? opts : opts.filter((d) => !opposite(d, this.dir));
    if (!cand.length) cand = opts;
    if (cand.length === 1) return cand[0];

    const pickRandom = () => cand[Math.floor(g.rng() * cand.length)];
    if (this.state === 'scared') return pickRandom();
    if (this.state === 'leaving') return this.bfsPick(cand, PEN_EXIT, g, pass);
    if (this.state === 'eaten') return this.bfsPick(cand, this.home, g, pass);

    const r = g.robot;
    const target = { x: r.x, y: r.y };
    const d2 = (this.x - r.x) ** 2 + (this.y - r.y) ** 2;

    // A charging Trike or swooping Ptera ignores scatter time.
    if (this.charging || this.swooping) return this.bfsPick(cand, target, g, pass);
    if (g.mode === 'scatter') return this.greedy(cand, this.def.corner);

    switch (this.def.kind) {
      case 'stomper': return this.bfsPick(cand, target, g, pass);
      case 'dasher':
        return this.dashing
          ? this.bfsPick(cand, target, g, pass)
          : this.greedy(cand, { x: r.x + r.dir.x * 4, y: r.y + r.dir.y * 4 });
      case 'charger': return d2 < 25 ? this.greedy(cand, target) : pickRandom();
      case 'swooper': return pickRandom();
      case 'guard': return d2 < 36 ? this.bfsPick(cand, target, g, pass) : this.greedy(cand, PATROL[this.patrol]);
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
