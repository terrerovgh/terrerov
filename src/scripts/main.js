/**
 * Composition and the frame loop.
 *
 * Three surfaces, composited every frame:
 *
 *   paper   kraft board, rebuilt only on resize
 *   ink     everything drawn, in near-black on transparent
 *   tooth   grain punched out of the ink so strokes break up on the surface
 *
 * The ink goes down with `multiply`, which is what makes charcoal darken the
 * board the way it physically would, instead of painting grey on top of it.
 *
 * Nothing heavy is redrawn per frame. Each stage's scenery, ground and writing
 * bake into tiles the first time they are needed; the walker is cached per
 * costume and per twelfth of his stride. What is left per frame is a handful of
 * drawImage calls.
 */

import { STAGES } from "./stages.js";
import { Sheet, renderSheet, makePaper, punchTooth } from "./charcoal.js";
import { writeText, textHeight, underline, tag } from "./lettering.js";
import { figureSheet, cycleLength, quantizePhase, PHASE_STEPS } from "./character.js";
import { sceneSheets } from "./scenery.js";
import {
  journeyAt,
  sceneAlpha,
  spanFor,
  TRACK_SCREENS,
  STAGE_COUNT,
  progressForStage,
  ARRIVE,
} from "./journey.js";

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const searchParams = new URLSearchParams(location.search);
const journeyOpts = {
  legacy: searchParams.get("legacyJourney") === "1",
};
const forceGait = searchParams.get("gait") === "1";

const state = {
  progress: 0,
  target: 0,
  vel: 0,
  lastNow: 0,
  w: 0,
  h: 0,
  dpr: 1,
  span: 600,
  groundY: 0,
  charScale: 1,
  paper: null,
  tooth: null,
  ink: null,
  inkCtx: null,
  reduced: false,
  figScratch: null,
  figBuiltThisFrame: false,
  dadBuiltThisFrame: false,
};

/** Where the walker stands on screen, and where the ground line sits. */
function layout() {
  state.groundY = Math.round(state.h * 0.76);
  state.screenX = Math.round(state.w * 0.34);
  state.charScale = Math.max(0.95, Math.min(state.w, state.h) / 520);
  // Props were drawn against a 1.45 figure, but at that ratio they huddle by
  // his feet and leave half the sheet blank. Pushing them up spreads the
  // vignette across the frame and lets the big things read as big.
  state.sceneScale = state.charScale / 0.95;
  state.span = spanFor(state.w);
}

/* ----------------------------------------------------------- tile cache --- */

function makeTile(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.ceil(w));
  c.height = Math.max(2, Math.ceil(h));
  return c;
}

/** Small LRU so only the stages in view hold pixels. */
class TileCache {
  constructor(limit) {
    this.limit = limit;
    this.map = new Map();
  }
  get(key, build) {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const made = build();
    this.map.set(key, made);
    while (this.map.size > this.limit) {
      this.map.delete(this.map.keys().next().value);
    }
    return made;
  }
  clear() {
    this.map.clear();
  }
}

const sceneCache = new TileCache(4);
const groundCache = new TileCache(5);
const textCache = new TileCache(4);
// 18 stride poses plus idle poses, with room for the costume he is leaving
const figureCache = new TileCache(52);

function sizeKey() {
  return `${state.w}x${state.h}`;
}

/* --------------------------------------------------------------- scenes --- */

function sceneTile(i) {
  return sceneCache.get(`scene:${i}:${sizeKey()}`, () => {
    const half = state.span * 1.15;
    const c = makeTile(half * 2, state.h);
    const g = c.getContext("2d");
    const { back, front } = sceneSheets(STAGES[i].id, i + 1);
    g.save();
    g.translate(half, state.groundY);
    g.scale(state.sceneScale, state.sceneScale);
    // the background layer is thinner and paler, and drawn first
    renderSheet(g, back, { alpha: 0.62 });
    renderSheet(g, front, { alpha: 1 });
    g.restore();
    punchTooth(g, c.width, c.height);
    return { canvas: c, offset: half };
  });
}

/**
 * The ground line. Each stage owns exactly one span of it, so the tiles abut
 * and the line runs unbroken from the first stage to the last.
 */
function groundTile(i) {
  return groundCache.get(`ground:${i}:${sizeKey()}`, () => {
    const half = state.span / 2;
    const pad = 30;
    const bandTop = state.groundY - 26;
    const c = makeTile(half * 2 + pad * 2, 70);
    const g = c.getContext("2d");
    const sheet = new Sheet(700 + i);
    const baseY = state.groundY - bandTop;
    const pts = [];
    const n = Math.max(10, Math.round(state.span / 22));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      // a drawn horizon is never level: it drifts a couple of pixels
      const drift = Math.sin((i * 2.3 + t) * 1.9) * 2.2 + Math.sin((i + t) * 7.3) * 0.9;
      pts.push({ x: -half + state.span * t, y: baseY + drift });
    }
    // the smear of graphite the side of the hand leaves along a long line
    sheet.smudge(0, baseY + 3, state.span * 0.52, 5, 0, { alpha: 0.1 });
    sheet.stroke(pts, { width: 2.6, alpha: 0.88, wobble: 2.1, overshoot: 0, smooth: false });
    // gone over a second time, not quite on the same path
    sheet.stroke(pts.map((p) => ({ x: p.x + 3, y: p.y + 1.8 })), {
      width: 1.2,
      alpha: 0.34,
      wobble: 2.6,
      overshoot: 0,
      search: 0,
      smooth: false,
    });
    g.save();
    g.translate(half + pad, 0);
    renderSheet(g, sheet);
    g.restore();
    punchTooth(g, c.width, c.height);
    return { canvas: c, offset: half + pad, top: bandTop };
  });
}

/* ---------------------------------------------------------------- texts --- */

function buildTextSheet(i) {
  const s = STAGES[i];
  const sheet = new Sheet(900 + i * 7);
  const maxW = Math.min(460, state.w * 0.42);
  const big = Math.min(46, Math.max(28, state.w * 0.031));
  const body = Math.min(25, Math.max(17, state.w * 0.0165));
  // the whole block leans a little, the way a page of notes does
  const tilt = ((i % 3) - 1) * 0.012;
  let y = 0;

  y += writeText(sheet, s.place, 0, y, {
    size: body * 0.86,
    hand: "small",
    seed: 10 + i,
    tilt,
    maxWidth: maxW,
  });
  y += body * 0.5;
  y += writeText(sheet, s.title, 0, y, {
    size: big,
    hand: "display",
    seed: 40 + i,
    tilt,
    maxWidth: maxW,
  });
  underline(sheet, 0, y - big * 0.16, Math.min(maxW, s.title.length * big * 0.34), {
    seed: 60 + i,
    alpha: 0.34,
  });
  y += body * 0.7;
  y += writeText(sheet, s.body, 0, y, {
    size: body,
    hand: "note",
    seed: 80 + i,
    tilt,
    maxWidth: maxW,
  });

  if (s.chips) {
    y += body * 0.8;
    let tx = 0;
    for (const c of s.chips) {
      const w = tag(sheet, c, tx, y, { size: body * 0.74, seed: 120 + i + tx, alpha: 0.66 });
      tx += w;
      if (tx > maxW - 60) {
        tx = 0;
        y += body * 1.5;
      }
    }
    y += body * 1.2;
  }

  if (s.email) {
    y += body * 0.6;
    writeText(sheet, s.email, 0, y, { size: big * 0.7, hand: "display", seed: 160 + i, tilt });
  }

  return { sheet, height: y, width: maxW };
}

function textBundle(i) {
  return textCache.get(`text:${i}:${sizeKey()}`, () => {
    const built = buildTextSheet(i);
    return { ...built, baked: null };
  });
}

/* -------------------------------------------------------------- walker --- */

function figureTileMetrics() {
  const pad = 155 * state.charScale;
  const top = 235 * state.charScale;
  return { pad, top, w: pad * 2, h: top + 40 * state.charScale };
}

function figKey(costume, phase, walking, idleBucket) {
  return `fig:${costume}:${phase.toFixed(3)}:${walking}:${idleBucket}:${state.charScale.toFixed(2)}`;
}

function figureTile(costume, phase, walking, idleBucket) {
  const key = figKey(costume, phase, walking, idleBucket);
  return figureCache.get(key, () => {
    state.figBuiltThisFrame = true;
    if (costume === "dad") state.dadBuiltThisFrame = true;
    // headroom for the tallest hat (the chef's) plus a thrown graduation cap
    const { pad, top, w, h } = figureTileMetrics();
    const c = makeTile(w, h);
    const g = c.getContext("2d");
    const sheet = figureSheet({
      phase,
      walking,
      dir: 1,
      costume,
      scale: state.charScale,
      idleT: idleBucket * 0.5,
      seed: 7,
    });
    g.save();
    g.translate(pad, top);
    renderSheet(g, sheet);
    g.restore();
    punchTooth(g, c.width, c.height);
    return { canvas: c, ox: pad, oy: top };
  });
}

/**
 * Up to two figure tiles, source-over on a scratch, then one multiply onto
 * the board. Two multiply draws would go black where they overlap.
 */
function blitWalker(ig, tiles) {
  const s = state.figScratch;
  const g = s.getContext("2d");
  g.clearRect(0, 0, s.width, s.height);
  g.globalCompositeOperation = "source-over";
  for (const { tile, alpha } of tiles) {
    g.globalAlpha = alpha;
    g.drawImage(tile.canvas, 0, 0);
  }
  g.globalAlpha = 1;
  ig.drawImage(
    s,
    Math.round(state.screenX - tiles[0].tile.ox),
    Math.round(state.groundY - tiles[0].tile.oy),
  );
}

function snapCostume(c) {
  return c === "dad" || c === "grad";
}

function poseTile(costume, gaitSnap, phase, idleBucket) {
  return figureTile(costume, gaitSnap ? phase : 0, gaitSnap, idleBucket);
}

function gaitSmear(costume, phase, gaitAmount, idleBucket) {
  if (gaitAmount >= 1 - ARRIVE) {
    return [{ tile: figureTile(costume, phase, true, 0), alpha: 1 }];
  }
  if (gaitAmount <= ARRIVE) {
    return [{ tile: figureTile(costume, 0, false, idleBucket), alpha: 1 }];
  }
  return [
    { tile: figureTile(costume, phase, true, 0), alpha: gaitAmount },
    { tile: figureTile(costume, 0, false, idleBucket), alpha: 1 - gaitAmount },
  ];
}

function walkerTiles(from, to, mix, phase, gaitAmount, idleBucket) {
  // child and mortarboard cannot double-expose
  if (snapCostume(from) || snapCostume(to)) {
    const gaitSnap = gaitAmount >= 0.5;
    const costSnap = mix >= 0.5 ? to : from;
    return [{ tile: poseTile(costSnap, gaitSnap, phase, idleBucket), alpha: 1 }];
  }
  if (mix > 0.5) {
    return gaitSmear(to, phase, gaitAmount, idleBucket);
  }
  if (mix > ARRIVE) {
    const gaitSnap = gaitAmount >= 0.5;
    return [
      { tile: poseTile(from, gaitSnap, phase, idleBucket), alpha: 1 - mix },
      { tile: poseTile(to, gaitSnap, phase, idleBucket), alpha: mix },
    ];
  }
  return gaitSmear(from, phase, gaitAmount, idleBucket);
}

function neighborPhase(phase, delta) {
  const k = Math.round((phase / (Math.PI * 2)) * PHASE_STEPS) % PHASE_STEPS;
  const n = (k + delta + PHASE_STEPS) % PHASE_STEPS;
  return (n / PHASE_STEPS) * Math.PI * 2;
}

/**
 * Ahead-of-need figure builds, every frame. Silent if this frame already
 * missed a tile; never two dad sheets in the same frame.
 */
function warmWork(j, phase) {
  const budget = state.figBuiltThisFrame ? 0 : 2;
  if (budget === 0) return;

  const next = STAGES[j.nextStage].costume;
  const cur = STAGES[j.stage].costume;
  const queue = [
    { costume: next, phase, walking: true, idle: 0 },
    { costume: next, phase: neighborPhase(phase, +1), walking: true, idle: 0 },
    { costume: next, phase: neighborPhase(phase, -1), walking: true, idle: 0 },
    // dest idle: gaitSmear(to) on a costume-change settle will ask for this
    { costume: next, phase: 0, walking: false, idle: 0 },
    { costume: next, phase: 0, walking: false, idle: 1 },
  ];
  const curK = Math.round((phase / (Math.PI * 2)) * PHASE_STEPS) % PHASE_STEPS;
  for (let n = 0; n < PHASE_STEPS; n++) {
    const p = (((curK + n) % PHASE_STEPS) / PHASE_STEPS) * Math.PI * 2;
    queue.push({ costume: cur, phase: p, walking: true, idle: 0 });
  }
  queue.push(
    { costume: cur, phase: 0, walking: false, idle: 0 },
    { costume: cur, phase: 0, walking: false, idle: 1 },
  );

  let built = 0;
  let dadThisPass = state.dadBuiltThisFrame;
  for (const item of queue) {
    if (built >= budget) break;
    if (figureCache.map.has(figKey(item.costume, item.phase, item.walking, item.idle))) continue;
    if (item.costume === "dad" && dadThisPass) continue;
    figureTile(item.costume, item.phase, item.walking, item.idle);
    built += 1;
    if (item.costume === "dad") dadThisPass = true;
  }
}

/* --------------------------------------------------------------- cover --- */

/**
 * The cover has about two seconds to answer "what is this person" and "why
 * should I believe them". A poetic title answers neither, so it leads with the
 * role, then the proof, then the way in — eyebrow, headline, evidence, prompt.
 */
function coverSheet() {
  return textCache.get(`cover:${sizeKey()}`, () => {
    const sheet = new Sheet(3);
    const cx = state.w * 0.5;
    const big = Math.min(58, Math.max(21, state.w * 0.042));
    const maxW = Math.min(state.w * 0.88, 880);
    let y = state.h * 0.13;

    y += writeText(sheet, "Computer engineer", cx, y, {
      size: Math.max(14, big * 0.38),
      hand: "small",
      align: "center",
      seed: 2,
      tilt: -0.01,
    });
    y += Math.max(20, big * 0.7);

    const headTop = y;
    y += writeText(sheet, "Linux systems and network administrator", cx, y, {
      size: big,
      hand: "display",
      align: "center",
      maxWidth: maxW,
      seed: 5,
      tilt: -0.008,
    });
    underline(sheet, cx - Math.min(maxW, big * 9) / 2, y - big * 0.2, Math.min(maxW, big * 9), {
      seed: 8,
      alpha: 0.4,
    });
    void headTop;
    y += big * 0.62;

    writeText(sheet, "Six years keeping critical infrastructure online.", cx, y, {
      size: Math.max(15, big * 0.42),
      hand: "note",
      align: "center",
      maxWidth: maxW,
      seed: 11,
      tilt: 0.007,
    });

    writeText(sheet, "scroll to walk the line", cx, state.h * 0.88, {
      size: Math.max(18, big * 0.34),
      hand: "small",
      align: "center",
      seed: 9,
      tilt: -0.02,
    });
    return { sheet };
  });
}

/* ---------------------------------------------------------------- frame --- */

function frame() {
  state.figBuiltThisFrame = false;
  state.dadBuiltThisFrame = false;
  const now = performance.now();
  const { w, h } = state;
  const span = state.span;
  const j = journeyAt(state.progress, span, journeyOpts);
  const camX = j.worldX - state.screenX;

  // The board goes down, then every mark is multiplied onto it. Compositing
  // straight onto the visible canvas rather than through an intermediate ink
  // buffer saves two full-screen operations a frame, which is most of the cost.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(state.paper, 0, 0, w, h);
  ctx.globalCompositeOperation = "multiply";
  const ig = ctx;

  // ground: only the stages whose span is on screen
  for (let i = 0; i < STAGE_COUNT; i++) {
    const sx = i * span - camX;
    if (sx < -span * 1.2 || sx > w + span * 1.2) continue;
    const t = groundTile(i);
    ig.drawImage(t.canvas, Math.round(sx - t.offset), t.top);
  }

  // scenery and writing
  for (let i = 0; i < STAGE_COUNT; i++) {
    const a = sceneAlpha(j.worldX, i, span);
    if (a <= 0.005) continue;
    const sx = i * span - camX;
    const tile = sceneTile(i);
    ig.globalAlpha = a;
    ig.drawImage(tile.canvas, Math.round(sx - tile.offset), 0);

    // The writing sits up and to the left of the stop and leaves with its
    // scene — but it has to be gone before it slides off the edge, so it fades
    // on its own, much faster than the scenery does.
    const bundle = textBundle(i);
    const away = Math.abs(j.worldX - i * span);
    const textA = Math.max(0, 1 - away / (span * 0.2));
    if (textA <= 0.004) {
      ig.globalAlpha = 1;
      continue;
    }
    const tx = Math.max(22, Math.round(sx - state.w * 0.3));
    const ty = Math.round(h * 0.1);
    const reveal = journeyOpts.legacy
      ? i === j.stage ? j.writeT : i < j.stage ? 1 : 0
      : i <= j.stage ? 1 : 0;
    if (reveal > 0.002) {
      ig.globalAlpha = a * textA;
      if (reveal >= 1) {
        if (!bundle.baked) {
          // the first baseline sits at sheet y=0, so ascenders live at negative
          // y — the tile needs real headroom or the top line loses its heads
          const pad = 70;
          const c = makeTile(bundle.width + pad * 2, bundle.height + pad * 2);
          const g = c.getContext("2d");
          renderSheet(g, bundle.sheet, { x: pad, y: pad });
          bundle.baked = c;
          bundle.pad = pad;
        }
        ig.drawImage(bundle.baked, tx - bundle.pad, ty - bundle.pad);
      } else {
        renderSheet(ig, bundle.sheet, { x: tx, y: ty, reveal });
      }
    }
    ig.globalAlpha = 1;
  }

  // the walker
  const frozen = queryProgress() !== null;
  // ?gait=1 on a freeze: passing pose, not the idle the sample would hold
  const gaitAmount = frozen && forceGait ? 1 : j.gaitAmount;
  const phase = quantizePhase((j.worldX / cycleLength(state.charScale)) * Math.PI * 2);
  const idleBucket = frozen || gaitAmount >= ARRIVE ? 0 : Math.floor(now / 500) % 6;
  blitWalker(ig, walkerTiles(j.costumeFrom, j.costumeTo, j.costumeMix, phase, gaitAmount, idleBucket));
  warmWork(j, phase);

  // the cover, gone before the first stage starts writing itself
  if (state.progress < 0.022) {
    const a = Math.max(0, 1 - state.progress / 0.019);
    ig.globalAlpha = a;
    renderSheet(ig, coverSheet().sheet);
    ig.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/* --------------------------------------------------------------- setup --- */

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.dpr = dpr;
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.floor(state.w * dpr);
  canvas.height = Math.floor(state.h * dpr);
  canvas.style.width = state.w + "px";
  canvas.style.height = state.h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  layout();

  // half resolution: it is a paper texture, nobody counts its pixels, and it
  // is the single most expensive thing built on load
  state.paper = makePaper(Math.max(2, state.w / 2), Math.max(2, state.h / 2), 7);

  sceneCache.clear();
  groundCache.clear();
  textCache.clear();
  figureCache.clear();
  const fig = figureTileMetrics();
  state.figScratch = makeTile(fig.w, fig.h);

  sizeTrack();
}

function sizeTrack() {
  const track = document.querySelector(".track");
  if (track) track.style.height = `${Math.round(window.innerHeight * TRACK_SCREENS)}px`;
}

function maxScroll() {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

function queryProgress() {
  const raw = new URLSearchParams(location.search).get("p");
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function setupKeys() {
  window.addEventListener("keydown", (e) => {
    const cur = journeyAt(state.target, state.span, journeyOpts).stage;
    let next = null;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") next = cur + 1;
    else if (e.key === "ArrowLeft" || e.key === "PageUp") next = cur - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = STAGE_COUNT - 1;
    if (next === null) return;
    e.preventDefault();
    const p = progressForStage(Math.max(0, Math.min(STAGE_COUNT - 1, next)));
    window.scrollTo({ top: p * maxScroll(), behavior: "smooth" });
  });
}

const OMEGA = 18;     // rad/s
const ZETA = 1.0;     // critically damped
const DT_MAX = 0.048;

function stepSpring(now) {
  const raw = (now - state.lastNow) / 1000;
  const dt = state.lastNow === 0 ? 1 / 60 : Math.min(DT_MAX, Math.max(0, raw));
  state.lastNow = now;

  const err = state.progress - state.target;
  if (Math.abs(state.target - state.progress) > 1 / STAGE_COUNT) {
    // Home/End or a trackpad leap of a full stage: snap, don't interpolate
    state.progress = state.target;
    state.vel = 0;
    return;
  }

  // v then x — explicit Euler can invert vel after a long background tab
  const acc = -2 * ZETA * OMEGA * state.vel - OMEGA * OMEGA * err;
  state.vel += acc * dt;
  state.progress += state.vel * dt;
}

function start() {
  const debug = queryProgress();
  state.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (debug !== null) {
    state.progress = debug;
    state.target = debug;
    frame();
    return;
  }

  const loop = (now) => {
    state.target = Math.min(1, Math.max(0, window.scrollY / maxScroll()));
    if (state.reduced) {
      state.progress = state.target;
      state.vel = 0;
    } else {
      stepSpring(now);
    }
    frame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Rebuilding the paper and every tile costs a few hundred milliseconds, so a
// drag-resize must not trigger it on every pixel.
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resize();
    frame();
  }, 160);
});
resize();
setupKeys();
start();
