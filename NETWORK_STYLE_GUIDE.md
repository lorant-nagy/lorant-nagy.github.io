# Neural Network Visualisation — Implementation Guide

A style guide for building interactive network pages consistent with `feedforward.html`, `rnn.html`, and `lstm.html`.

---

## Philosophy

Each page is a self-contained HTML file with no external dependencies except D3.js and Google Fonts. The goal is clarity: the diagram is the star, controls are secondary, everything fits one screen without scrolling.

- **No card containers.** Panels have no background fill and no border. Visual separation comes purely from the gap between grid cells. The dark `--bg` colour is the only background.
- **No borders on panels.** The only borders are the `card-title` bottom line and interactive elements (buttons, sliders).
- **Viewport-fitted.** The page fills exactly `100dvh`. Nothing scrolls at the page level. Mobile gets a stacked fallback with natural scrolling.
- **Equations before diagram.** A formula strip sits between the title and the main layout, written in italic with coloured `<span>` highlights matching the diagram colours.

---

## Colour Palette

```css
--bg:      #0d0f14;   /* page background */
--surface: #13161d;   /* not used on panels — reserved */
--border:  rgba(255,255,255,0.07);
--text:    #c8cdd8;
--muted:   #565c6e;
--neg:     #378ADD;   /* negative / low activation — blue */
--pos:     #e8824a;   /* positive / high activation — orange */
--accent:  #aa701e;   /* interactive elements — amber */
```

Network-specific colours (LSTM gates):
```
forget gate:    #378ADD  (same as --neg)
input gate:     #1D9E75
candidate cell: #aa701e  (same as --accent)
output gate:    #e8824a  (same as --pos)
cell state:     #7F77DD
```

---

## Typography

```css
/* body / code / labels */
font-family: 'JetBrains Mono', monospace;

/* titles and large numerical readouts */
font-family: 'Spectral', serif; font-weight: 300;
```

Import both from Google Fonts at the top of the `<style>` block.

---

## Page Structure

The `<body>` is a CSS grid, not a flex column:

```css
body {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto 1fr;  /* h1 | equations | main */
  padding: 1.1rem 1.4rem 0.9rem;
  gap: 0.55rem;
  overflow: hidden;
}
```

- Row 1 (`auto`): `<h1>` — the network name, Spectral 1.45rem
- Row 2 (`auto`): `.equations` — the formula strip
- Row 3 (`1fr`): `.page` — the main layout, fills all remaining height

The back-link (`← networks`) is `position: fixed` at `top: 1rem; left: 1.25rem` so it never participates in the grid flow.

`<h1>` must have `padding-top: 1.4rem` to clear the fixed back-link visually.

---

## Equations Strip

```css
.equations {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.85;
  font-style: italic;
}
.equations span { font-style: normal; }
```

Rules for writing equations:

- **Order**: `input:` → intermediate computations → `output:` — always in computational order, label first then formula.
- **Matrix notation preferred** over element-wise sums. Write `W · x` not `Σᵢ wᵢxᵢ`.
- **Dimensions** should be stated inline: `W ∈ ℝ³ˣ²`, `a ∈ ℝ³`.
- **Subscripts**: always use `<sub>t</sub>`, `<sub>t−1</sub>` HTML tags. Do **not** use Unicode subscript characters (ₜ, ₋, ₁) — they render inconsistently across fonts.
- **Superscripts**: `<sup>⊤</sup>`, `<sup>2×1</sup>` etc. are fine.
- **Colours**: colour the variable names (not the operators) using `<span style="color:#e8824a">h</span>`. Use the palette colours consistently — inputs/hidden states in `--pos` orange, outputs in `--neg` blue, gate-specific colours for LSTM.
- **No definitions of activation functions** in the equations strip. The activation switcher in the controls makes it self-evident.
- **Do not write "(linear)"** or other parenthetical annotations — if something is linear it's visible from the absence of a nonlinearity.
- **Activation placeholder**: write `σ(·)` in the equation; the controls show which σ is active.

---

## Main Layout Patterns

### 2×2 Grid (feedforward)

```
┌─────────────────┬──────────┐
│  network        │ params   │
│  diagram        │          │
├─────────────────┤          │  ← params ends here (grid-row: 1 only)
│  what is        │          │
│  happening      │          │
└─────────────────┴──────────┘
```

```css
.page {
  display: grid;
  grid-template-columns: 1fr 230px;
  grid-template-rows: 1fr auto;
  gap: 0.7rem;
  min-height: 0;
}
```

- Network card: `grid-column: 1; grid-row: 1` — `display: flex; flex-direction: column`
- Parameters: `grid-column: 2; grid-row: 1` — ends level with network bottom
- Narrative: `grid-column: 1; grid-row: 2` — sizes to content
- Bottom-right cell is intentionally empty — preserves symmetry

### 2×2 with shared bottom-left (Elman)

```
┌─────────────────┬──────────┐
│  network        │ params   │
│  diagram        │          │
├────────┬────────┘          │  ← params ends here
│  seq   │  trail │ narrative│
└────────┴────────┴──────────┘
```

Timelines (sequence, trail) share the bottom-left cell as a nested `grid-template-columns: 1fr 1fr`.

### Dominant diagram + horizontal strip (LSTM)

```
┌─────────────────┬──────────┐
│  computation    │ params   │
│  graph          │          │
├──────┬──────┬───┴──────────┘  ← params ends here
│ seq  │trail │ gates │ narr │
└──────┴──────┴───────┴──────┘
```

Four equal bottom panels in a single `grid-template-columns: 1fr 1fr 1fr 1fr` row spanning full width.

---

## SVG Sizing

SVGs never have a hardcoded `height` attribute set in CSS or JS. Instead:

```css
#nn-svg {
  width: 100%;
  flex: 1;        /* fill remaining space in flex column */
  display: block;
  min-height: 0;  /* allow shrinking */
}
```

Every SVG uses a `viewBox` with fixed internal coordinates and `preserveAspectRatio="xMidYMid meet"`. The browser scales automatically — no distortion, no empty gaps.

The parent card is `display: flex; flex-direction: column; min-height: 0` so the SVG can grow into available space.

For fixed-height SVGs (sequence bars, trail charts) that should not grow: use a fixed `height: 60px` and `flex-shrink: 0` instead.

---

## Card Titles

```css
.card-title {
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 0.5px solid var(--border);
  padding-bottom: 0.28rem;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}
```

Every panel has exactly one `.card-title`. There are no nested headers.

---

## Controls / Parameters Panel

The parameters panel is a narrow vertical column (`230px` or `200px` fixed width) aligned with the main diagram. It ends at the diagram's bottom edge — it does **not** span the full page height.

```css
.controls-card {
  grid-column: 2; grid-row: 1;   /* row 1 only */
  padding: 0.75rem 0.85rem;
  display: flex; flex-direction: column;
  overflow-y: auto;              /* scrollable only if viewport very short */
}
```

### Sliders

```css
.ctrl-section-title {
  font-size: 8.5px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--muted); border-bottom: 0.5px solid var(--border);
  padding-bottom: 0.2rem; margin-top: 0.5rem; margin-bottom: 0.22rem;
}
.ctrl-section-title:first-child { margin-top: 0; }

.ctrl-row { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.1rem; }
.ctrl-label { font-size: 8.5px; color: var(--muted); min-width: 44px; flex-shrink: 0; }
.ctrl-val   { font-size: 8.5px; color: var(--text);  min-width: 28px; text-align: right; }

input[type=range] {
  flex: 1; -webkit-appearance: none; height: 2px;
  background: rgba(255,255,255,0.1); border-radius: 2px;
  outline: none; cursor: pointer; min-width: 0;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 9px; height: 9px;
  border-radius: 50%; background: var(--accent); cursor: pointer;
}
```

### Naming convention for sliders

- Hidden layer weights: `w1→1`, `w2→1`, … (from-node → to-node)
- Output layer weights: `v1`, `v2`, `v3` (matching the equation's `v` vector)
- Hidden biases: `b1`, `b2`, `b3`
- Output bias: `c` (matching the equation's `c` scalar)
- RNN: `x → h1`, `x → h2` for `Wx`; `h1→h1`, `h1→h2` etc. for `Wh`

**Every parameter that appears in the equation must have a slider.** No hidden parameters.

### Activation switcher

Present for feedforward and Elman. Options: `sigmoid`, `tanh`, `relu`, `linear`.

```css
.act-fn-row { display: flex; gap: 0.3rem; margin-bottom: 0.2rem; }
.act-btn {
  flex: 1; background: none; border: 0.5px solid var(--border);
  border-radius: 3px; color: var(--muted);
  font-family: 'JetBrains Mono', monospace; font-size: 8.5px;
  padding: 3px 0; cursor: pointer; transition: all 0.15s;
}
.act-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(170,112,30,0.08); }
.act-btn:hover:not(.active) { border-color: rgba(255,255,255,0.2); color: var(--text); }
```

`linear: x => x` must be included — it lets users verify computations by hand.

### Reset button

Every network has two weight reset buttons at the top of the controls:

```css
.reset-btn {
  width: 100%; background: none; border: 0.5px solid var(--border);
  border-radius: 3px; color: var(--muted);
  font-family: 'JetBrains Mono', monospace; font-size: 8.5px;
  padding: 4px 0; cursor: pointer; transition: all 0.15s;
  letter-spacing: 0.06em;
}
.reset-btn:hover { border-color: rgba(255,255,255,0.25); color: var(--text); }
```

- **zero all weights** (`btn-zero`) — sets all weights and biases to 0. Also resets `revealedLayers` to `{0}` on feedforward so hidden/output go blank.
- **randomise weights** (`btn-rand-weights`) — picks uniform random values in `[-1, 1]` for all weights and biases, then rebuilds sliders and redraws.

For feedforward: zeros/randomises `weights`, `biases` (inputs are not reset — they're user data). For RNN: zeros/randomises `Wx`, `Wh`, `b` and resets sequence state. For LSTM: zeros/randomises all `W[gate]` entries and resets `t`, `cellState`, `hiddenState`.

Both buttons must have IDs (`btn-zero`, `btn-rand-weights`) so they can be disabled by `setAnimating()` during animation.

---

## Step Buttons (recurrent networks)

Recurrent networks (Elman, LSTM) have a step-through interface:

```
[rand]  [reset]  [step →]  t = 3 / 7
```

- `rand` — randomises the input sequence
- `reset` — resets `t = 0` and clears state history
- `step →` — advances one timestep
- `t = N / 7` — inline with the buttons in the same flex row (not below)

The step button pulses when active (t < SEQ_LEN):

```css
@keyframes pulse {
  0%, 100% { border-color: var(--accent); box-shadow: 0 0 0 0 rgba(170,112,30,0); }
  50%       { border-color: #d4921f;      box-shadow: 0 0 0 3px rgba(170,112,30,0.18); }
}
button.primary:not(:disabled) { animation: pulse 2s ease-in-out infinite; }
button:disabled { opacity: 0.3; cursor: default; animation: none; }
```

```css
button.primary { border-color: var(--accent); color: var(--accent); }
```

---

## "What is happening" Panel

Every network has a narrative panel that explains the current computation in plain text with coloured inline values.

```css
.narrative { font-size: 10.5px; color: var(--text); line-height: 1.65; }
.narrative .hi  { color: var(--pos); }   /* positive values */
.narrative .lo  { color: var(--neg); }   /* negative values */
.narrative .dim { color: var(--muted); } /* secondary labels */
```

For feedforward: always visible, updates live with every slider change. Shows the full arithmetic: weighted sum → activation → output.

For recurrent networks: shows the computation at the current step `t`. Initial state: `"Press step → to start."`.

---

## Neuron Colour Mapping

Neuron fill uses `d3.interpolateRgb('#378ADD', '#e8824a')` — blue (negative/low) to orange (positive/high).

The mapping `t ∈ [0,1]` depends on the active activation:

```js
if (isOutput)              t = (clamp(val, -2, 2) + 2) / 4;  // linear, symmetric
else if (actFn === 'tanh') t = (val + 1) / 2;                 // [-1, 1] → [0, 1]
else if (actFn === 'relu') t = clamp(val / 2, 0, 1);          // [0, 2] → [0, 1]
else if (actFn === 'linear') t = (clamp(val, -2, 2) + 2) / 4;
else                       t = val;                            // sigmoid [0, 1]
```

The output neuron always uses the linear/symmetric mapping regardless of the hidden activation — it is never passed through a nonlinearity.

Weight edges: same colour interpolation, same `t` mapping, width proportional to `|w|`:

```js
function weightWidth(w) { return 0.5 + Math.abs(w) * 2.5; }
```

---

## Conceptual Decisions

- **Elman / vanilla RNN are the same thing.** Name the page "Elman network".
- **The output layer of the Elman network is not shown.** The recurrent hidden state is the conceptual focus; the output is just a linear readout and distracts from understanding recurrence.
- **All parameters that appear in the equations must be controllable.** If a variable is named (`v`, `c`, `Wx`, `Wh`) it must have a slider.
- **Activation function definitions are not shown in the equations.** The switcher makes them self-evident.
- **No "(linear)" annotations.** If something has no activation it's clear from the equation.

---

## Mobile Fallback

```css
@media (max-width: 600px) {
  body {
    height: auto;
    overflow: auto;
    padding: 2.5rem 1rem 2rem;
    grid-template-rows: auto auto auto;
  }
  .page {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;  /* one per panel */
  }
}
```

On mobile: single column, natural scroll, explicit `grid-row` placement for each panel, SVGs get a `min-height` instead of `flex: 1`.

---

## File Structure

```
networks/
  feedforward.html
  rnn.html           (Elman network)
  lstm.html
  index.html         (← networks listing page)
```

Each file is fully self-contained. No shared CSS, no shared JS. D3 loaded from cdnjs CDN:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
```

Back-link always points to `/networks/`.

---

## Animation — Forward Pass

Every network has a forward pass animation triggered by a dedicated button. The animation is purely CSS-based (CSS `@keyframes` + `offset-path` for dots, dynamically injected `<style>` tags for per-element keyframes). No `requestAnimationFrame` — `setTimeout` drives sequencing.

### General rules

- All interactive controls (step button, activation buttons, zero/randomise weight buttons, reset button) are **disabled for the entire duration of the animation** and re-enabled when the last cleanup callback fires.
- Animation elements (dots, rings, glows) are appended directly to the SVG. They are tracked in an `animEls` array and removed in a cleanup callback at the end.
- A `schedule(ms, fn)` helper wraps `setTimeout` and pushes timers into a `timers` array for potential cancellation.
- **Never call `redraw()` mid-animation** — it calls `rnnSvg.selectAll('*').remove()` which destroys animation elements in flight. Instead, update node fills and text directly via `querySelector` on named groups (`.cur-node`, `.prev-node`).

### Dot travel

Each dot travels along a `<path>` element registered in `<defs>`:

```css
.anim-dot {
  opacity: 0; offset-rotate: 0deg;
  animation-name: dot-travel;
  animation-timing-function: cubic-bezier(0.37,0,0.63,1);
  animation-fill-mode: both;
}
@keyframes dot-travel {
  0%   { offset-distance: 0%;   opacity: 0; }
  8%   { opacity: 1; }
  88%  { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
```

Dots fade in near departure and fade out near arrival. Duration and delay set per-element via `style.animationDuration` and `style.animationDelay`.

### Pulse

A pulse is an expanding ring that fires when a node receives new information and updates its value. It communicates "this node just changed":

```js
function mkPulse(x, y, color) {
  // injects a unique @keyframes per call, animates r from R to R+24
  // fill: none, stroke: color, stroke-width: 2
  // duration: 0.6s, ease-out
}
```

Pulse colour signals the source: **orange** (`#e8824a`) when the input contribution arrives, **blue** (`#378ADD`) when the recurrent/hidden contribution arrives.

### Glow

A soft filled circle behind a node, used when a layer "fires" (all inputs received):

```css
.anim-glow {
  opacity: 0; pointer-events: none;
  animation-name: node-glow;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}
@keyframes node-glow {
  0%   { opacity: 0; }
  20%  { opacity: 0.55; }
  100% { opacity: 0; }
}
```

---

## Elman Network — Step Animation

The Elman diagram has three columns: **input** (left), **hidden/current** (mid), **previous hidden** (right). The animation reflects one timestep.

### State flags

```js
let hiddenRevealed = false;  // whether mid column shows values
let prevRevealed   = false;  // whether right column shows values
```

Both reset to `false` on `resetAndRedraw()`.

### What stays visible and when

| Moment | Input node | Mid column | Prev column |
|--------|-----------|------------|-------------|
| Before first step | shows x₁ (sequence[0]) with colour | blank | blank |
| During dots flying | shows xₜ (current input) | shows **previous step's value** (hiddenRevealed stays true from last step) | shows previous hₜ₋₁ (persists from last step) |
| Orange lands (step 1) | unchanged | shows full σ(Wx·x+b) + **orange pulse** | still blank |
| Orange lands (step 2+) | unchanged | shows partial Wx·x+b (no activation, no recurrent) + **orange pulse** | unchanged |
| Blue lands (step 2+) | unchanged | shows full σ(Wx·x+Wh·h+b) + **blue pulse** | unchanged |
| Ring departs | unchanged | fill and value **stay** — only border ring slides right | unchanged |
| Ring lands | unchanged | unchanged | updates to new h values (direct node update, no redraw) |
| Animation ends | unchanged | unchanged | unchanged |

**Key rule**: the mid column never goes blank mid-animation. It shows the previous step's value while dots are flying, then updates in place when computations arrive.

### Phase sequence

**Phase 1a — orange dots** (duration `T_DOT = 1.1s`):
- One orange dot per hidden node travels from input → mid column along a straight line
- When they arrive (`T_DOT * 1000` ms):
  - **Step 1**: compute full `stepRNN(x_t, [0,0])`, set `hiddenRevealed = true`, update mid nodes directly, fire **orange pulse**
  - **Step 2+**: compute partial `b[j] + Wx[j] * x_t` (linear, no activation, no recurrent), update mid nodes, fire **orange pulse**

**Phase 1b — blue dots** (steps 2+ only, delay `T_DOT + T_GAP`):
- One blue dot per recurrent connection travels from prev → mid along curved quadratic bezier paths (matching the drawn arrows)
- Self-connections arc above/below; cross-connections curve through the midpoint
- When they arrive:
  - Compute full `stepRNN(x_t, hSnap)` where `hSnap` is the snapshot of h taken at click time
  - Update mid nodes with final activated values
  - Fire **blue pulse**

**Phase 2 — border ring copy** (fires at `ghostStart`):
- A ring (stroke only, no fill) is created at mid column and slides to prev column using a dynamically injected `@keyframes` with the exact pixel offset baked in (CSS variable approach not used — unreliable cross-browser)
- The mid column fill and value are **not touched** — the ring is a separate SVG element
- When ring lands (`T_GHOST * 0.82` into the ring animation):
  - Prev column nodes update directly (fill + text, no redraw)
  - A blue glow fires on prev column nodes

**Phase 3 — cleanup**:
- All `animEls` removed
- All buttons re-enabled via `setAnimating(false)`
- `hiddenRevealed` stays `true` (mid column keeps showing values between steps)

### Step 1 specifics

- No blue dots (no previous state to flow back)
- No partial value shown — orange lands and immediately shows the full computation
- Ring still slides to prev column (communicates that the state is being stored)
- After ring lands: prev column populates for the first time with h₁

### Input node

Always shows the **next input to be processed** (`sequence[t]`) with its colour. Label shows `x{t+1}`. Updates after each step as `t` increments.

---

## Feedforward — Forward Pass Animation

Simpler than the Elman: one button press animates all layers sequentially.

### State flag

```js
const revealedLayers = new Set([0]);  // input always shown, others revealed by animation
```

Moving any slider resets `revealedLayers` to `{0}` — hidden and output go blank, requiring the animation to re-reveal them.

### Phase sequence

For each layer transition `l → l+1`:
- All dots for that layer fire simultaneously (one per edge)
- Duration `DOT_DUR = 1.1s` per layer, gap `GAP = 0.3s` between layers — **matches the Elman network speed exactly**. Do not change one without the other.
- When dots arrive: `revealedLayers.add(l+1)`, redraw (safe here — no ongoing animation elements in the SVG at that moment since dots use CSS `offset-path`)
- A glow fires on destination nodes

Layers are revealed sequentially: input already shown, hidden revealed when orange arrives, output revealed when second wave arrives.

### Why redraw() is safe here

The feedforward dots use CSS `offset-path` on `<path>` elements in `<defs>`. The `draw()` function only touches `edgeGroup` and `nodeGroup` — it does not remove the defs or the dot elements. So `draw()` mid-animation is safe and correctly updates node colours.

---

## Dynamic @keyframes Pattern

For animations requiring per-element parameters (exact pixel offsets, per-node radii), inject keyframes dynamically:

```js
const styleEl = document.createElement('style');
document.head.appendChild(styleEl);
animEls.push(styleEl);  // cleaned up with everything else

const uid = `anim-${Date.now()}`;
styleEl.sheet.insertRule(`
  @keyframes ${uid} {
    0%   { transform: translateX(0px);   opacity: 0; }
    8%   { transform: translateX(0px);   opacity: 1; }
    80%  { transform: translateX(${dx}px); opacity: 0.8; }
    100% { transform: translateX(${dx}px); opacity: 0; }
  }
`, 0);

element.style.animationName = uid;
element.style.animationDuration = '1s';
element.style.animationFillMode = 'both';
```

**Do not use CSS custom properties (`var(--x)`) inside `@keyframes transform`** — browser support is inconsistent. Always bake the actual value into the keyframe string.

---

## Canonical Animation Timing

All networks use the same speed constants so animations feel consistent:

```js
const DOT_DUR   = 1.1;   // seconds — dot travels along one edge layer
const GAP       = 0.3;   // seconds — pause between phases (orange→blue, dots→ghost)
const T_GHOST   = 1.0;   // seconds — border ring slides from mid to prev column (Elman)
const T_GHOST_DLY = 0.3; // seconds — delay before ghost departs after hidden reveals
```

Do not change one without the others. The goal is that a human can visually follow each dot as it travels — around 1 second per layer is the right perceptual speed.