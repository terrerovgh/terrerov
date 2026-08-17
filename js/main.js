import { STAGES } from "./stages.js";
import { makePaper, groundAt, drawTimeline, charcoalText } from "./pencil.js";
import { drawCharacter, cycleLength } from "./character.js";
import { drawScenery } from "./scenery.js";

const WORLD = 13200;
const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const ticks = STAGES.map((stage, i) => ({
  x: (i / (STAGES.length - 1)) * WORLD,
  label: stage.title,
}));

const state = {
  progress: 0,
  lastProgress: 0,
  dir: 1,
  paper: null,
  dpr: 1,
  w: 0,
  h: 0,
  stageIndex: -1,
  fontsReady: false,
};

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
  state.paper = makePaper(Math.max(2, Math.floor(state.w / 2)), Math.max(2, Math.floor(state.h / 2)));
}

function stageAt(progress) {
  const i = Math.min(STAGES.length - 1, Math.round(progress * (STAGES.length - 1)));
  return { stage: STAGES[i], index: i };
}

function drawWriting(camX, originY, viewW, current) {
  if (!state.fontsReady) return;
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i];
    const wx = ticks[i].x + 36;
    const sx = wx - camX;
    if (sx < -80 || sx > viewW - 40) continue;
    const dist = Math.abs(i - current);
    if (dist > 1) continue;
    const fade = dist === 0 ? 1 : 0.38;
    const gy = originY + groundAt(wx);
    const top = Math.max(52, gy - Math.min(state.h * 0.46, 340));
    const maxW = Math.min(420, viewW * 0.42);

    let y = top;
    y += charcoalText(ctx, s.place, sx, y, {
      size: 20,
      font: '"Reenie Beanie", cursive',
      seed: 400 + i,
      alpha: 0.55 * fade,
      fill: "rgba(154, 58, 42, ALPHA)",
    });
    y += 8;
    y += charcoalText(ctx, s.title, sx, y, {
      size: 36,
      font: '"Caveat", cursive',
      seed: 420 + i,
      alpha: 0.88 * fade,
      maxWidth: maxW,
    });
    y += 10;
    y += charcoalText(ctx, s.body, sx, y, {
      size: 20,
      font: '"Gochi Hand", cursive',
      seed: 440 + i,
      alpha: 0.72 * fade,
      maxWidth: maxW,
      line: 1.32,
    });
    if (s.chips && dist === 0) {
      y += 14;
      y += charcoalText(ctx, s.chips.join("   ·   "), sx, y, {
        size: 18,
        font: '"Reenie Beanie", cursive',
        seed: 460 + i,
        alpha: 0.58,
      });
    }
    if (s.email && dist === 0) {
      y += 8;
      charcoalText(ctx, s.email, sx, y, {
        size: 28,
        font: '"Caveat", cursive',
        seed: 480 + i,
        alpha: 0.84,
      });
    }
    charcoalText(ctx, s.title, ticks[i].x - camX, gy + 28, {
      size: 18,
      font: '"Reenie Beanie", cursive',
      align: "center",
      seed: 500 + i,
      alpha: dist === 0 ? 0.62 : 0.32,
    });
  }

  if (state.progress < 0.04) {
    charcoalText(ctx, "scroll to walk", viewW * 0.5, state.h * 0.88, {
      size: 30,
      font: '"Reenie Beanie", cursive',
      align: "center",
      seed: 9,
      alpha: 0.55,
    });
  }
}

function frame() {
  const { w, h, progress } = state;
  const worldX = progress * WORLD;
  const walking = progress > 0.003 && progress < 0.995;
  if (progress > state.lastProgress + 0.00012) state.dir = 1;
  else if (progress < state.lastProgress - 0.00012) state.dir = -1;

  const originY = h * 0.62;
  const screenX = w * 0.33;
  const camX = worldX - screenX;
  const ground = originY + groundAt(worldX);
  const slope = (groundAt(worldX + 8) - groundAt(worldX - 8)) / 16;
  const tilt = Math.atan(slope);
  const scale = Math.max(0.9, Math.min(w, h) / 680);
  const phase = (worldX / cycleLength(scale)) * Math.PI * 2;
  const { index } = stageAt(progress);

  ctx.clearRect(0, 0, w, h);
  if (state.paper) ctx.drawImage(state.paper, 0, 0, w, h);

  drawTimeline(ctx, camX, w, originY, WORLD, ticks);
  drawScenery(ctx, camX, originY, w, groundAt, ticks, STAGES);
  drawWriting(camX, originY, w, index);

  ctx.save();
  ctx.translate(screenX, ground);
  ctx.rotate(tilt);
  drawCharacter(
    ctx,
    { x: 0, y: 0 },
    {
      phase,
      walking,
      dir: state.dir,
      costume: STAGES[index].costume,
      scale: Math.max(0.9, scale),
    }
  );
  ctx.restore();

  state.lastProgress = progress;
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

function nativeProgress() {
  const debug = queryProgress();
  if (debug !== null) return debug;
  return Math.min(1, Math.max(0, window.scrollY / maxScroll()));
}

function setupScroll() {
  const track = document.querySelector(".track");
  const sizeTrack = () => {
    if (track) track.style.height = `${Math.round(window.innerHeight * 16)}px`;
  };
  sizeTrack();
  window.addEventListener("resize", sizeTrack);

  let wheelFallback = 0;
  window.addEventListener(
    "wheel",
    (event) => {
      if (queryProgress() !== null) return;
      if (maxScroll() > 2) return;
      wheelFallback = Math.min(1, Math.max(0, wheelFallback + event.deltaY / 3400));
    },
    { passive: true }
  );

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const snap = reduced || queryProgress() !== null;

  const loop = () => {
    const target = maxScroll() > 2 ? nativeProgress() : wheelFallback;
    if (snap) state.progress = queryProgress() ?? target;
    else state.progress += (target - state.progress) * 0.2;
    frame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

document.fonts.ready.then(() => {
  state.fontsReady = true;
});

window.addEventListener("resize", resize);
resize();
setupScroll();
