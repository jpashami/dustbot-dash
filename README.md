# Dustbot Dash

An original maze-chase game for the browser. You're a little robot vacuum: clean up every dust bunny in the room and keep away from the household cats.

**Play it:** https://jpashami.github.io/dustbot-dash/

## How to play

- **Steer:** arrow keys or WASD. On a phone, swipe anywhere.
- **Dust bunny:** 10 points. Clear them all to finish the room.
- **Yarn** (in the corners): the cats get distracted for a few seconds. Bump one to send it back to its bed: 200, 400, 800, then 1600 points.
- **Lost sock:** appears twice per room for bonus points.
- **Pause:** P or Esc. **Mute:** M.
- You get one extra life at 10,000 points.

Every room is a new maze, generated when the room starts. The cats get faster and the yarn wears off sooner as you go.

### The cats

| Cat | Habit |
|---|---|
| Biscuit (ginger) | Takes the shortest path straight to you |
| Smudge (grey) | Aims a few tiles ahead of where you're heading |
| Pepper (black) | Wanders, but pounces when you get close |
| Mochi (calico, from room 3) | Stalks from a distance, backs off when you're near |

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
| `src/maze.js` | Maze generator: depth-first carve, mirrored, dead ends removed, central cat bed |
| `src/entities.js` | Robot and cat movement, cat behaviours (BFS pathfinding) |
| `src/render.js` | Canvas drawing; all art is drawn in code |
| `src/audio.js` | Sound effects synthesized with WebAudio |
| `src/input.js` | Keyboard and swipe input |
| `src/main.js` | Game loop, rules, scoring, UI |

All code, art and sound are original. The game is inspired by the classic maze-chase genre but doesn't use any characters, names, mazes, graphics or audio from existing games.

## License

MIT
