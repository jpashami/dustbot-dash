// Maze generation for Dustbot Dash.
// Every level gets a fresh, procedurally generated, left-right mirrored maze
// with no dead ends, plus a central dinosaur nest (pen) with a gate (door).

export const W = 19;
export const H = 21;

export const WALL = 0;
export const FLOOR = 1;
export const PEN = 2;
export const DOOR = 3;

const CX = (W - 1) / 2; // centre column (9)

export const ROBOT_START = { x: CX, y: 15 };
export const DOOR_POS = { x: CX, y: 9 };
export const PEN_EXIT = { x: CX, y: 8 };
export const PEN_SPOTS = [
  { x: CX, y: 10 },
  { x: CX - 1, y: 11 },
  { x: CX + 1, y: 11 },
  { x: CX, y: 11 },
  { x: CX - 2, y: 11 },
];
export const ICE_SPOTS = [
  { x: 1, y: 1 },
  { x: W - 2, y: 1 },
  { x: 1, y: H - 2 },
  { x: W - 2, y: H - 2 },
];

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function generateMaze(rng = Math.random) {
  const g = Array.from({ length: H }, () => new Array(W).fill(WALL));
  const prot = Array.from({ length: H }, () => new Array(W).fill(false));
  const rand = (n) => Math.floor(rng() * n);
  const open = (x, y) => {
    g[y][x] = FLOOR;
    g[y][W - 1 - x] = FLOOR;
  };

  // 1. Depth-first carve over the left half (cells sit on odd coordinates).
  const stack = [[1, 1]];
  g[1][1] = FLOOR;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = D4.filter(([dx, dy]) => {
      const nx = x + 2 * dx, ny = y + 2 * dy;
      return nx >= 1 && nx <= CX && ny >= 1 && ny <= H - 2 && g[ny][nx] === WALL;
    });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = opts[rand(opts.length)];
    g[y + dy][x + dx] = FLOOR;
    g[y + 2 * dy][x + 2 * dx] = FLOOR;
    stack.push([x + 2 * dx, y + 2 * dy]);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < CX; x++) g[y][W - 1 - x] = g[y][x];

  // 2. Dinosaur nest in the middle, wrapped by a corridor ring.
  for (let y = 8; y <= 13; y++) {
    for (let x = 5; x <= 13; x++) {
      if (y === 8 || y === 13 || x === 5 || x === 13) { g[y][x] = FLOOR; continue; }
      g[y][x] = (x >= 7 && x <= 11 && y >= 10 && y <= 11) ? PEN : WALL;
      prot[y][x] = true;
    }
  }
  g[DOOR_POS.y][DOOR_POS.x] = DOOR;

  const isFloor = (x, y) => g[y]?.[x] === FLOOR;
  const nbrs = (x, y) => D4.filter(([dx, dy]) => isFloor(x + dx, y + dy)).length;
  const knockable = (x, y, dx, dy) => {
    const wx = x + dx, wy = y + dy, fx = x + 2 * dx, fy = y + 2 * dy;
    return fx >= 1 && fx <= W - 2 && fy >= 1 && fy <= H - 2 &&
      g[wy][wx] === WALL && !prot[wy][wx] && g[fy][fx] === FLOOR;
  };

  // 3. Remove dead ends so the maze is full of loops.
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y <= H - 2; y += 2) {
      for (let x = 1; x <= CX; x += 2) {
        if (!isFloor(x, y) || nbrs(x, y) > 1) continue;
        const c = D4.filter(([dx, dy]) => knockable(x, y, dx, dy));
        if (!c.length) continue;
        const de = c.filter(([dx, dy]) => nbrs(x + 2 * dx, y + 2 * dy) <= 1);
        const pool = de.length ? de : c;
        const [dx, dy] = pool[rand(pool.length)];
        open(x + dx, y + dy);
      }
    }
  }

  // 4. A few extra openings for flow.
  let extra = 0;
  for (let tries = 0; tries < 60 && extra < 4; tries++) {
    const x = 1 + 2 * rand((CX + 1) / 2);
    const y = 1 + 2 * rand((H - 1) / 2);
    if (!isFloor(x, y)) continue;
    const [dx, dy] = D4[rand(4)];
    if (knockable(x, y, dx, dy)) { open(x + dx, y + dy); extra++; }
  }

  // 5. Safety: anything unreachable from the robot start becomes wall.
  const dist = bfs(g, ROBOT_START, (x, y) => g[y][x] === FLOOR);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x] === FLOOR && dist[y * W + x] === -1) g[y][x] = WALL;
    }
  }

  return g;
}

// Breadth-first distances from `target` over tiles where canPass(x, y) is true.
export function bfs(grid, target, canPass) {
  const dist = new Int16Array(W * H).fill(-1);
  const q = new Int16Array(W * H);
  let head = 0, tail = 0;
  const start = target.y * W + target.x;
  if (target.x < 0 || target.y < 0 || target.x >= W || target.y >= H) return dist;
  dist[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const i = q[head++];
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (dist[j] !== -1 || !canPass(nx, ny)) continue;
      dist[j] = dist[i] + 1;
      q[tail++] = j;
    }
  }
  return dist;
}
