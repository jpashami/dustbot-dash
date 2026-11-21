// Dustbot Dash: game state, loop and UI wiring.
import { W, H, FLOOR, generateMaze, ROBOT_START, PEN_SPOTS, ICE_SPOTS } from './maze.js';
import { Robot, Dino, DINO_DEFS } from './entities.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';

const STEP = 1 / 120;
const HI_KEY = 'dustbot-dash-hi';
const MODES = [['scatter', 5], ['chase', 20], ['scatter', 5], ['chase', 20], ['scatter', 4], ['chase', Infinity]];

function loadHi() {
  try { return parseInt(localStorage.getItem(HI_KEY) || '0', 10) || 0; } catch { return 0; }
}
function saveHi(v) {
  try { localStorage.setItem(HI_KEY, String(v)); } catch { /* storage unavailable */ }
}

class Game {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      score: $('score'), hi: $('hi'), level: $('level'), lives: $('lives'),
      ovTitle: $('ov-title'), ovPause: $('ov-pause'), ovOver: $('ov-over'),
      finalScore: $('final-score'), finalNote: $('final-note'),
      btnPause: $('btn-pause'), btnMute: $('btn-mute'),
    };
    this.stage = $('stage');
    this.renderer = new Renderer($('game'), this.stage);
    this.sfx = new Sfx();
    this.hi = loadHi();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.state = 'title';
    this.stateTime = 0;
    this.paused = false;
    this.time = 0;
    this.freeze = 0;
    this.popups = [];
    this.hudCache = {};

    this.buildLevel(); // backdrop for the title screen
    this.state = 'title';

    new Input($('app'), {
      onDir: (d) => { if (this.robot && !this.paused) this.robot.next = d; },
      onPause: () => this.togglePause(),
      onStart: () => {
        if (this.state === 'title' || this.state === 'gameover') this.newGame();
        else if (this.paused) this.togglePause();
      },
      onMute: () => this.toggleMute(),
      onTouch: () => this.sfx.unlock(),
    });

    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
    click('btn-start', () => this.newGame());
    click('btn-again', () => this.newGame());
    click('btn-resume', () => this.togglePause());
    click('btn-pause', () => this.togglePause());
    click('btn-mute', () => this.toggleMute());

    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isActive() && !this.paused) this.togglePause();
    });

    this.renderer.resize();
    this.updateMuteBtn();
    this.last = performance.now();
    this.acc = 0;
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- level parameters ----
  get robotSpeed() { return Math.min(8.6, 7.2 + 0.2 * (this.level - 1)); }
  get dinoSpeed() { return Math.min(8.3, 6.0 + 0.35 * (this.level - 1)); }
  get iceTime() { return Math.max(2, 7 - 0.7 * (this.level - 1)); }

  isActive() { return ['ready', 'playing', 'dying', 'levelclear'].includes(this.state); }

  newGame() {
    this.sfx.unlock();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.startHi = this.hi;
    this.nextLifeAt = 10000;
    this.paused = false;
    this.popups = [];
    this.showOverlay(null);
    this.buildLevel();
    this.toReady();
  }

  buildLevel() {
    this.grid = generateMaze();
    this.dust = new Uint8Array(W * H);
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.grid[y][x] !== FLOOR) continue;
        if (x === ROBOT_START.x && y === ROBOT_START.y) continue;
        if (ICE_SPOTS.some((p) => p.x === x && p.y === y)) continue;
        this.dust[y * W + x] = 1;
        n++;
      }
    }
    this.dustLeft = n;
    this.dustTotal = n;
    this.ice = ICE_SPOTS.map((p) => ({ ...p, alive: true }));
    this.amber = { active: false, x: ROBOT_START.x, y: ROBOT_START.y, timer: 0, spawned: 0 };
    this.renderer.setMaze(this.grid);
    this.resetActors();
  }

  resetActors() {
    this.robot = new Robot(ROBOT_START.x, ROBOT_START.y);
    const relScale = Math.max(0.35, 1 - 0.12 * (this.level - 1));
    this.dinos = DINO_DEFS.filter((d) => this.level >= d.from)
      .map((d, i) => new Dino(d, PEN_SPOTS[i], d.release * relScale));
    this.iceTimer = 0;
    this.chain = 0;
    this.modeIdx = 0;
    this.modeTime = 0;
    this.mode = MODES[0][0];
    this.freeze = 0;
  }

  toReady() {
    this.state = 'ready';
    this.stateTime = 0;
    this.sfx.start();
  }

  // ---- loop ----
  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
    this.renderer.draw(this);
    this.updateHud();
    requestAnimationFrame((t) => this.frame(t));
  }

  step(dt) {
    if (this.paused) return;
    this.time += dt;
    this.stateTime += dt;
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);

    switch (this.state) {
      case 'ready':
        if (this.stateTime >= 2) { this.state = 'playing'; this.stateTime = 0; }
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'dying':
        if (this.stateTime >= 1.8) {
          this.lives--;
          if (this.lives <= 0) this.gameOver();
          else { this.resetActors(); this.toReady(); }
        }
        break;
      case 'levelclear':
        if (this.stateTime >= 2.2) {
          this.level++;
          this.buildLevel();
          this.toReady();
        }
        break;
      default:
        break;
    }
  }

  updatePlaying(dt) {
    if (this.freeze > 0) { this.freeze -= dt; return; }

    if (this.iceTimer > 0) {
      this.iceTimer -= dt;
      if (this.iceTimer <= 0) {
        this.iceTimer = 0;
        for (const dino of this.dinos) if (dino.state === 'scared') dino.state = 'roam';
      }
    } else {
      this.modeTime += dt;
      if (this.modeTime >= MODES[this.modeIdx][1] && this.modeIdx < MODES.length - 1) {
        this.modeIdx++;
        this.modeTime = 0;
        this.mode = MODES[this.modeIdx][0];
        for (const dino of this.dinos) if (dino.state === 'roam') dino.reverse();
      }
    }

    const s = this.amber;
    if (s.active) {
      s.timer -= dt;
      if (s.timer <= 0) s.active = false;
    }
    const eaten = this.dustTotal - this.dustLeft;
    if ((s.spawned === 0 && eaten >= this.dustTotal * 0.3) || (s.spawned === 1 && eaten >= this.dustTotal * 0.7)) {
      s.spawned++;
      s.active = true;
      s.timer = 9;
    }

    this.robot.update(dt, this.robotSpeed, this.grid, () => this.robotArrived());
    const ctx = { grid: this.grid, robot: this.robot, mode: this.mode, dinoSpeed: this.dinoSpeed, robotSpeed: this.robotSpeed, rng: Math.random };
    for (const dino of this.dinos) dino.update(dt, ctx);
    if (this.checkCollisions()) return;

    if (this.dustLeft === 0) {
      this.state = 'levelclear';
      this.stateTime = 0;
      this.sfx.levelClear();
      saveHi(this.hi);
    }
  }

  robotArrived() {
    const { x, y } = this.robot;
    const i = y * W + x;
    if (this.dust[i]) {
      this.dust[i] = 0;
      this.dustLeft--;
      this.addScore(10);
      this.sfx.dust();
    }
    for (const ice of this.ice) {
      if (ice.alive && ice.x === x && ice.y === y) {
        ice.alive = false;
        this.addScore(50);
        this.startIce();
      }
    }
    const s = this.amber;
    if (s.active && s.x === x && s.y === y) {
      s.active = false;
      const pts = 100 * Math.min(10, this.level) + 200;
      this.addScore(pts);
      this.popup(x, y, String(pts), '#9ec1ff');
      this.sfx.amber();
    }
    return false;
  }

  startIce() {
    this.iceTimer = this.iceTime;
    this.chain = 0;
    for (const dino of this.dinos) {
      if (dino.state === 'roam') { dino.state = 'scared'; dino.reverse(); }
    }
    this.sfx.ice();
  }

  checkCollisions() {
    const r = this.robot;
    for (const dino of this.dinos) {
      if (dino.state === 'pen' || dino.state === 'eaten') continue;
      const dx = dino.px - r.px, dy = dino.py - r.py;
      if (dx * dx + dy * dy > 0.45) continue;
      if (dino.state === 'scared') {
        dino.state = 'eaten';
        const pts = 200 * 2 ** this.chain;
        this.chain = Math.min(this.chain + 1, 3);
        this.addScore(pts);
        this.popup(dino.px, dino.py, String(pts), '#ffd34f');
        this.freeze = 0.45;
        this.sfx.dinoCaught();
      } else {
        this.state = 'dying';
        this.stateTime = 0;
        this.iceTimer = 0;
        this.sfx.death();
        return true;
      }
    }
    return false;
  }

  addScore(n) {
    this.score += n;
    if (this.score > this.hi) this.hi = this.score;
    if (this.score >= this.nextLifeAt) {
      this.nextLifeAt = Infinity;
      this.lives++;
      this.popup(this.robot.x, this.robot.y - 1, '1UP', '#7fe0a8');
      this.sfx.extraLife();
    }
  }

  popup(x, y, text, color) {
    this.popups.push({ x, y, text, color, t: 0, life: 1.1 });
  }

  gameOver() {
    this.state = 'gameover';
    saveHi(this.hi);
    this.el.finalScore.textContent = this.score.toLocaleString();
    const best = this.score > 0 && this.score > (this.startHi || 0);
    this.el.finalNote.textContent = best ? 'New best score!' : `Best: ${this.hi.toLocaleString()}`;
    this.showOverlay('over');
  }

  // ---- UI ----
  togglePause() {
    if (!this.isActive()) return;
    this.paused = !this.paused;
    this.showOverlay(this.paused ? 'pause' : null);
    this.el.btnPause.textContent = this.paused ? '▶' : '❚❚';
    this.el.btnPause.setAttribute('aria-label', this.paused ? 'Resume' : 'Pause');
  }

  toggleMute() {
    this.sfx.unlock();
    this.sfx.toggleMute();
    this.updateMuteBtn();
  }

  updateMuteBtn() {
    const b = this.el.btnMute;
    b.textContent = this.sfx.muted ? '🔇' : '🔊';
    b.setAttribute('aria-label', this.sfx.muted ? 'Unmute' : 'Mute');
  }

  showOverlay(name) {
    this.el.ovTitle.classList.toggle('hidden', name !== 'title');
    this.el.ovPause.classList.toggle('hidden', name !== 'pause');
    this.el.ovOver.classList.toggle('hidden', name !== 'over');
  }

  updateHud() {
    const h = this.hudCache;
    if (h.score !== this.score) { h.score = this.score; this.el.score.textContent = this.score.toLocaleString(); }
    if (h.hi !== this.hi) { h.hi = this.hi; this.el.hi.textContent = this.hi.toLocaleString(); }
    if (h.level !== this.level) { h.level = this.level; this.el.level.textContent = this.level; }
    const spare = this.state === 'title' ? 3 : Math.max(0, this.lives);
    if (h.lives !== spare) {
      h.lives = spare;
      this.el.lives.innerHTML = '<span class="life"></span>'.repeat(Math.min(spare, 6));
      this.el.lives.setAttribute('aria-label', `${spare} lives`);
    }
  }
}

window.game = new Game();
