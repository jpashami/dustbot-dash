// Tiny synthesized sound effects (WebAudio). No audio files.
const MUTE_KEY = 'dustbot-dash-muted';

export class Sfx {
  constructor() {
    this.ctx = null;
    this.flip = false;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    return this.muted;
  }

  tone(freq, dur, { type = 'square', vol = 0.1, to = null, delay = 0, filter = null } = {}) {
    if (this.muted || !this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  dust() {
    this.flip = !this.flip;
    this.tone(this.flip ? 880 : 700, 0.045, { type: 'triangle', vol: 0.05 });
  }
  ice() {
    [1568, 1319, 1175, 988, 1319, 1760].forEach((f, i) =>
      this.tone(f, 0.22, { type: 'sine', vol: 0.06, delay: i * 0.05 }));
    this.tone(2400, 0.5, { type: 'triangle', vol: 0.02, to: 1200, delay: 0.05 });
  }
  dinoCaught() {
    // Short growl that tumbles down.
    this.tone(220, 0.32, { type: 'sawtooth', vol: 0.09, to: 70, filter: 900 });
    this.tone(330, 0.22, { type: 'square', vol: 0.04, to: 110, delay: 0.04, filter: 1200 });
  }
  death() {
    this.tone(640, 1.0, { type: 'square', vol: 0.06, to: 70, filter: 1400 });
    this.tone(960, 1.0, { type: 'triangle', vol: 0.05, to: 110, delay: 0.12 });
  }
  amber() {
    [1175, 1568, 2093].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.05, delay: i * 0.06 }));
  }
  extraLife() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.07, delay: i * 0.08 }));
  }
  start() {
    [392, 494, 587, 784, 659, 784].forEach((f, i) =>
      this.tone(f, 0.14, { type: 'square', vol: 0.05, delay: i * 0.13, filter: 2400 }));
  }
  levelClear() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.07, delay: i * 0.1 }));
  }
}
