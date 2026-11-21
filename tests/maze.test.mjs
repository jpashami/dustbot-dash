// Checks generated mazes: run with `node tests/maze.test.mjs`
import assert from 'node:assert/strict';
import {
  W, H, WALL, FLOOR, PEN, DOOR, generateMaze, bfs,
  ROBOT_START, PEN_EXIT, PEN_SPOTS, ICE_SPOTS,
} from '../src/maze.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RUNS = 1000;
for (let seed = 1; seed <= RUNS; seed++) {
  const g = generateMaze(mulberry32(seed));
  const at = (p) => g[p.y][p.x];

  for (let x = 0; x < W; x++) { assert.equal(g[0][x], WALL); assert.equal(g[H - 1][x], WALL); }
  for (let y = 0; y < H; y++) {
    assert.equal(g[y][0], WALL); assert.equal(g[y][W - 1], WALL);
    for (let x = 0; x < W; x++) assert.equal(g[y][x], g[y][W - 1 - x], `seed ${seed}: not mirrored`);
  }

  assert.equal(at(ROBOT_START), FLOOR);
  assert.equal(at(PEN_EXIT), FLOOR);
  for (const p of ICE_SPOTS) assert.equal(at(p), FLOOR);
  for (const p of PEN_SPOTS) assert.equal(at(p), PEN);

  const dist = bfs(g, ROBOT_START, (x, y) => g[y][x] === FLOOR);
  let dust = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== FLOOR) continue;
      dust++;
      assert.notEqual(dist[y * W + x], -1, `seed ${seed}: (${x},${y}) unreachable`);
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => g[y + dy][x + dx] === FLOOR).length;
      assert.ok(n >= 2, `seed ${seed}: dead end at (${x},${y})`);
    }
  }
  assert.ok(dust > 120, `seed ${seed}: only ${dust} floor tiles`);

  const catPass = (x, y) => [FLOOR, PEN, DOOR].includes(g[y][x]);
  const fromExit = bfs(g, PEN_EXIT, catPass);
  for (const p of PEN_SPOTS) assert.notEqual(fromExit[p.y * W + p.x], -1, `seed ${seed}: cat trapped`);
}
console.log(`ok: ${RUNS} mazes connected, mirrored, dead-end free`);
