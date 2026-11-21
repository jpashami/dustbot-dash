# Dustbot Dash

An original maze-chase game for the browser. It's the night shift at the natural history museum, and the dinosaurs have woken up. You're a little robot vacuum: clean up every dust bunny in the hall and stay out of their way.

**Play it:** https://jpashami.github.io/dustbot-dash/

## How to play

- **Steer:** arrow keys or WASD. On a phone, swipe anywhere.
- **Dust bunny:** 10 points. Clear them all to finish the hall.
- **Ice crystal** (in the corners): chills the dinosaurs for a few seconds. Bump one while it's shivering to send it back to the nest: 200, 400, 800, then 1600 points.
- **Amber:** appears twice per hall for bonus points.
- **Pause:** P or Esc. **Mute:** M.
- You get one extra life at 10,000 points.

Every hall is a new maze, generated when it starts. The dinosaurs get faster and the ice melts sooner as you go.

### The dinosaurs

Each one moves differently, not just towards a different target.

| Dinosaur | Joins | Trick |
|---|---|---|
| Rex (T-Rex) | Hall 1 | Takes the shortest path to you. Speeds up on long straight halls, slows down on corners. |
| Zip (Raptor) | Hall 1 | Quick. Aims a few tiles ahead of you, and every few seconds bursts into a sprint. |
| Trike (Triceratops) | Hall 1 | Slow and wandering, but charges hard (red eyes, steam) if it spots you down a straight hall. |
| Ptera (Pterodactyl) | Hall 3 | Flies around at random, then swoops straight at you every few seconds. |
| Bronto (Brontosaurus) | Hall 5 | Very slow. Patrols around its nest and only chases you if you come close. |

## Run locally

It's plain HTML, CSS and JavaScript with no build step. Browsers won't load ES modules from `file://`, so serve the folder:

```bash
python -m http.server 8080
```

Then open http://localhost:8080.

Maze generator tests (needs Node 18+):

```bash
node tests/maze.test.mjs
```

## Code

| File | What it does |
|---|---|
| `src/maze.js` | Maze generator: depth-first carve, mirrored, dead ends removed, central nest |
| `src/entities.js` | Robot and dinosaur movement, each dinosaur's trick (BFS pathfinding) |
| `src/render.js` | Canvas drawing; all art is drawn in code |
| `src/audio.js` | Sound effects synthesized with WebAudio |
| `src/input.js` | Keyboard and swipe input |
| `src/main.js` | Game loop, rules, scoring, UI |

All code, art and sound are original. The game is inspired by the classic maze-chase genre but doesn't use any characters, names, mazes, graphics or audio from existing games.

## License

MIT
