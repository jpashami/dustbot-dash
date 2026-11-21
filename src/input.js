// Keyboard and swipe input.
import { DIR } from './entities.js';

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export class Input {
  constructor(swipeEl, h) {
    window.addEventListener('keydown', (e) => {
      const d = KEYMAP[e.code];
      if (d) { e.preventDefault(); h.onDir(DIR[d]); return; }
      if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); h.onPause(); }
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); h.onStart(); }
      else if (e.code === 'KeyM') h.onMute();
    });

    // Swipes re-anchor after each turn, so one long gesture can steer several corners.
    let sx = 0, sy = 0, tracking = false;
    swipeEl.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; tracking = true;
      h.onTouch?.();
    }, { passive: true });
    swipeEl.addEventListener('touchmove', (e) => {
      if (!tracking) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.hypot(dx, dy) < 22) return;
      h.onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR.right : DIR.left) : (dy > 0 ? DIR.down : DIR.up));
      sx = t.clientX; sy = t.clientY;
    }, { passive: false });
    swipeEl.addEventListener('touchend', () => { tracking = false; });
    swipeEl.addEventListener('touchcancel', () => { tracking = false; });
  }
}
