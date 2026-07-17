import { encode } from 'uqr';

/** Roof studies from the original temple-of-heaven-curtain assets */
export type RoofId = 'cutout' | 'enhanced' | 'crop' | 'watercolor';

export type RoofStudy = {
  id: RoofId;
  label: string;
  src: string;
  webp?: string;
  /** Native asset width (px) — used for eave scale */
  nativeW: number;
  nativeH: number;
  /** Eave pin Y in asset pixels (center / sides) */
  centerY: number;
  sideY: number;
  /** Curtain width as fraction of roof box */
  eaveRatio: number;
  multiply: boolean;
};

export const ROOFS: RoofStudy[] = [
  {
    id: 'cutout',
    label: 'Cutout',
    src: '/assets/temple-roof-cutout-web.png',
    webp: '/assets/temple-roof-cutout-web.webp',
    nativeW: 901,
    nativeH: 730,
    centerY: 652,
    sideY: 698,
    eaveRatio: 0.84,
    multiply: true,
  },
  {
    id: 'enhanced',
    label: 'Enhanced',
    src: '/assets/temple-roof-enhanced-v2.png',
    nativeW: 1632,
    nativeH: 964,
    centerY: 860,
    sideY: 930,
    eaveRatio: 0.82,
    multiply: true,
  },
  {
    id: 'crop',
    label: 'Crop',
    src: '/assets/temple-original-crop.png',
    nativeW: 760,
    nativeH: 450,
    centerY: 390,
    sideY: 430,
    eaveRatio: 0.86,
    multiply: true,
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    src: '/assets/temple-watercolor.jpg',
    nativeW: 714,
    nativeH: 960,
    centerY: 520,
    sideY: 580,
    eaveRatio: 0.78,
    multiply: false,
  },
];

type Point = {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  anchorX: number;
  anchorY: number;
  pinned: boolean;
  restLength: number;
  char: string;
  dark: boolean;
};

const FALLBACK = '天坛祈年风调雨顺天地玄黄日月星辰礼乐文明北京春秋山川云海';
const QR_PAYLOAD = 'https://www.terrerov.com';

export function initCurtain() {
  const artboard = document.getElementById('artboard');
  const canvas = document.getElementById('curtain') as HTMLCanvasElement | null;
  const cursor = document.getElementById('cursor');
  const temple = document.getElementById('temple');
  const templeImg = document.getElementById('temple-img') as HTMLImageElement | null;
  const templeWebp = document.getElementById('temple-webp') as HTMLSourceElement | null;
  const configure = document.getElementById('configure');
  const settings = document.getElementById('settings');
  const reset = document.getElementById('reset');
  const roofSelect = document.getElementById('roof') as HTMLSelectElement | null;
  const modeSelect = document.getElementById('mode') as HTMLSelectElement | null;

  if (!artboard || !canvas || !temple || !templeImg) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let roof = ROOFS[0];
  let mode: 'qr' | 'classic' = 'qr';

  const qr = encode(QR_PAYLOAD, { ecc: 'M', border: 1, boostEcc: true });
  const qrSize = qr.size;
  const qrData = qr.data;

  const chains: Point[][] = [];
  let glyphs = FALLBACK;
  const mouse = { x: -999, y: -999, oldX: -999, oldY: -999, active: false };
  const physics = { strength: 0.72, radius: 34, friction: 0.965, gravity: 0.18 };
  const sound = {
    context: null as AudioContext | null,
    output: null as GainNode | null,
    lastStrike: [] as number[],
    lastGlobal: 0,
    voices: 0,
    scale: [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760],
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let moduleW = 10;
  let moduleH = 10;

  function unlockSound() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!sound.context) {
      const context = new AC();
      const output = context.createGain();
      const compressor = context.createDynamicsCompressor();
      const delay = context.createDelay(0.3);
      const feedback = context.createGain();
      const wet = context.createGain();
      output.gain.value = 0.62;
      compressor.threshold.value = -18;
      compressor.ratio.value = 3;
      delay.delayTime.value = 0.11;
      feedback.gain.value = 0.14;
      wet.gain.value = 0.13;
      output.connect(compressor);
      output.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(compressor);
      compressor.connect(context.destination);
      sound.context = context;
      sound.output = output;
    }
    if (sound.context.state === 'suspended') sound.context.resume().catch(() => {});
  }

  function strikeChain(columnIndex: number, impact: number, x: number) {
    const context = sound.context;
    if (!context || !sound.output || context.state !== 'running' || impact < 1.1) return;
    const timestamp = performance.now();
    if (timestamp - (sound.lastStrike[columnIndex] || 0) < 95) return;
    if (timestamp - sound.lastGlobal < 28 || sound.voices >= 8) return;
    sound.lastStrike[columnIndex] = timestamp;
    sound.lastGlobal = timestamp;
    sound.voices += 1;
    const now = context.currentTime;
    const frequency = sound.scale[columnIndex % sound.scale.length];
    const level = 0.028 + (Math.min(impact, 18) / 18) * 0.075;
    const duration = 0.72 + Math.random() * 0.32;
    const spatial = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    const pan = Math.max(-0.9, Math.min(0.9, (x / width) * 2 - 1));
    if ('pan' in spatial) (spatial as StereoPannerNode).pan.setValueAtTime(pan, now);
    spatial.connect(sound.output);
    (
      [
        { ratio: 1, amount: 1, decay: 1 },
        { ratio: 2.01, amount: 0.24, decay: 0.62 },
        { ratio: 3.96, amount: 0.1, decay: 0.38 },
      ] as const
    ).forEach((partial) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency * partial.ratio, now);
      oscillator.detune.setValueAtTime((Math.random() - 0.5) * 8, now);
      envelope.gain.setValueAtTime(level * partial.amount, now);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration * partial.decay);
      oscillator.connect(envelope);
      envelope.connect(spatial);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.05);
    });
    window.setTimeout(() => {
      sound.voices = Math.max(0, sound.voices - 1);
      spatial.disconnect();
    }, (duration + 0.15) * 1000);
  }

  function applyRoof(study: RoofStudy) {
    roof = study;
    templeImg.src = study.src;
    templeImg.width = study.nativeW;
    templeImg.height = study.nativeH;
    if (templeWebp) {
      if (study.webp) {
        templeWebp.srcset = study.webp;
        templeWebp.media = '';
        templeWebp.type = 'image/webp';
      } else {
        templeWebp.removeAttribute('srcset');
      }
    }
    templeImg.style.mixBlendMode = study.multiply ? 'multiply' : 'normal';
    temple.style.aspectRatio = `${study.nativeW} / ${study.nativeH}`;
    if (templeImg.complete) resize();
    else templeImg.addEventListener('load', resize, { once: true });
  }

  function build() {
    chains.length = 0;
    const narrow = width < 720;
    const templeRect = temple.getBoundingClientRect();
    const artboardRect = artboard.getBoundingClientRect();
    if (templeRect.width < 40) return;

    const buildingCenter = templeRect.left - artboardRect.left + templeRect.width * 0.5;
    const roofScale = templeRect.width / roof.nativeW;
    const templeTop = templeRect.top - artboardRect.top;
    const centerEdge = templeTop + roof.centerY * roofScale;
    const sideEdge = templeTop + roof.sideY * roofScale;
    const curtainBottom = height - (narrow ? 42 : 48);
    const eaveWidth = templeRect.width * (narrow ? Math.min(0.92, roof.eaveRatio + 0.04) : roof.eaveRatio);
    const eaveLeft = buildingCenter - eaveWidth / 2;

    if (mode === 'qr') {
      // Scannable square QR hanging from the eave (centered under the roof)
      const availableDrop = Math.max(140, curtainBottom - sideEdge);
      const span = Math.min(eaveWidth, availableDrop);
      const columns = qrSize;
      const rows = qrSize;
      const pitch = columns > 1 ? span / (columns - 1) : span;
      moduleW = pitch;
      moduleH = pitch;
      const left = buildingCenter - span / 2;

      for (let column = 0; column < columns; column += 1) {
        const x = left + column * pitch;
        const eaveT = columns > 1 ? (x - eaveLeft) / eaveWidth : 0.5;
        const normalizedX = Math.abs(Math.min(1, Math.max(0, eaveT)) * 2 - 1);
        const top = centerEdge + (sideEdge - centerEdge) * Math.pow(normalizedX, 1.7) - 3;
        const chain: Point[] = [];
        for (let row = 0; row < rows; row += 1) {
          const y = top + row * pitch;
          const dark = Boolean(qrData[row]?.[column]);
          const readingColumn = columns - 1 - column;
          chain.push({
            x,
            y,
            oldX: x,
            oldY: y,
            anchorX: x,
            anchorY: y,
            pinned: row === 0,
            restLength: pitch,
            char: glyphs[(readingColumn * rows + row) % glyphs.length],
            dark,
          });
        }
        chain[0].anchorX = x;
        chain[0].anchorY = top;
        chain[0].x = x;
        chain[0].y = top;
        chain[0].oldX = x;
        chain[0].oldY = top;
        chains.push(chain);
      }
    } else {
      // Classic temple-of-heaven-curtain character beads
      const columns = narrow ? 16 : 26;
      const availableHeight = Math.max(120, curtainBottom - sideEdge);
      const rows = Math.max(18, Math.min(narrow ? 35 : 39, Math.floor(availableHeight / 9.4) + 1));
      moduleW = eaveWidth / Math.max(1, columns - 1);
      moduleH = availableHeight / Math.max(1, rows - 1);

      for (let column = 0; column < columns; column += 1) {
        const x = eaveLeft + (column * eaveWidth) / Math.max(1, columns - 1);
        const normalizedX = Math.abs((column / Math.max(1, columns - 1)) * 2 - 1);
        const top = centerEdge + (sideEdge - centerEdge) * Math.pow(normalizedX, 1.7) - 4;
        const segmentLength = Math.max(6.4, (curtainBottom - top) / Math.max(1, rows - 1));
        const readingColumn = columns - 1 - column;
        const chain: Point[] = [];
        for (let row = 0; row < rows; row += 1) {
          const y = top + row * segmentLength;
          chain.push({
            x,
            y,
            oldX: x,
            oldY: y,
            anchorX: x,
            anchorY: y,
            pinned: row === 0,
            restLength: segmentLength,
            char: glyphs[(readingColumn * rows + row) % glyphs.length],
            dark: true,
          });
        }
        chain[0].anchorX = x;
        chain[0].anchorY = top;
        chain[0].x = x;
        chain[0].y = top;
        chain[0].oldX = x;
        chain[0].oldY = top;
        chains.push(chain);
      }
    }
  }

  function resize() {
    const rect = artboard.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function injectMouseDelta() {
    if (!mouse.active) return;
    const moveX = mouse.x - mouse.oldX;
    const moveY = mouse.y - mouse.oldY;
    const speed = Math.hypot(moveX, moveY);
    if (speed < 0.01 || speed > 80) return;
    for (let chainIndex = 0; chainIndex < chains.length; chainIndex += 1) {
      const chain = chains[chainIndex];
      let strongestImpact = 0;
      for (let index = 1; index < chain.length; index += 1) {
        const point = chain[index];
        if (mode === 'qr' && !point.dark) continue;
        const distance = Math.hypot(point.x - mouse.oldX, point.y - mouse.oldY);
        if (distance >= physics.radius) continue;
        const falloff = 1 - distance / physics.radius;
        strongestImpact = Math.max(strongestImpact, speed * falloff);
        point.x += moveX * physics.strength * falloff;
        point.y += moveY * physics.strength * falloff;
      }
      if (strongestImpact > 0) strikeChain(chainIndex, strongestImpact, chain[0].x);
    }
  }

  function integrate() {
    for (const chain of chains) {
      for (const point of chain) {
        if (point.pinned) continue;
        const velocityX = (point.x - point.oldX) * physics.friction;
        const velocityY = (point.y - point.oldY) * physics.friction;
        point.oldX = point.x;
        point.oldY = point.y;
        point.x += velocityX;
        point.y += velocityY + physics.gravity;
      }
    }
  }

  function constrain() {
    for (let pass = 0; pass < 8; pass += 1) {
      for (const chain of chains) {
        const anchor = chain[0];
        anchor.x = anchor.anchorX;
        anchor.y = anchor.anchorY;
        for (let index = 1; index < chain.length; index += 1) {
          const a = chain[index - 1];
          const b = chain[index];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.max(0.0001, Math.hypot(dx, dy));
          const difference = (distance - b.restLength) / distance;
          if (a.pinned) {
            b.x -= dx * difference;
            b.y -= dy * difference;
          } else {
            const cx = dx * difference * 0.5;
            const cy = dy * difference * 0.5;
            a.x += cx;
            a.y += cy;
            b.x -= cx;
            b.y -= cy;
          }
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (mode === 'qr') {
      const halfW = moduleW * 0.48;
      const halfH = moduleH * 0.48;
      const fontSize = Math.max(6, Math.min(moduleW, moduleH) * 0.65);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `500 ${fontSize}px ui-monospace, "Noto Sans SC", sans-serif`;
      for (const chain of chains) {
        for (const point of chain) {
          if (!point.dark) continue;
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#2e251f';
          ctx.fillRect(point.x - halfW, point.y - halfH, halfW * 2, halfH * 2);
          if (Math.min(moduleW, moduleH) >= 8) {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#e8dfca';
            ctx.fillText(point.char, point.x, point.y + 0.3);
          }
        }
      }
    } else {
      // Original character curtain draw
      ctx.fillStyle = '#2e251f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      for (const chain of chains) {
        for (let i = 0; i < chain.length; i += 1) {
          const point = chain[i];
          const alpha = 0.36 + ((point.x + i * 2) % 6) * 0.055;
          ctx.globalAlpha = Math.min(0.95, alpha);
          ctx.fillText(point.char, point.x, point.y);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  let raf = 0;
  let visible = true;
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame() {
    if (!visible) {
      raf = 0;
      return;
    }
    if (!prefersReduced) {
      integrate();
      constrain();
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function ensureLoop() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  function enter(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = mouse.oldX = event.clientX - rect.left;
    mouse.y = mouse.oldY = event.clientY - rect.top;
    mouse.active = true;
    if (cursor) {
      cursor.style.left = `${mouse.x}px`;
      cursor.style.top = `${mouse.y}px`;
    }
    artboard.classList.add('is-active');
  }

  function move(event: PointerEvent) {
    if (!mouse.active) enter(event);
    mouse.oldX = mouse.x;
    mouse.oldY = mouse.y;
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    injectMouseDelta();
    if (cursor) {
      cursor.style.left = `${mouse.x}px`;
      cursor.style.top = `${mouse.y}px`;
    }
  }

  function leave() {
    mouse.active = false;
    artboard.classList.remove('is-active');
  }

  function pointerDown(event: PointerEvent) {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    unlockSound();
    enter(event);
  }

  function pointerUp(event: PointerEvent) {
    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
    leave();
  }

  function bindRange(id: string, outputId: string, update: (v: number) => void) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    const output = document.getElementById(outputId) as HTMLOutputElement | null;
    if (!input || !output) return;
    input.addEventListener('input', () => {
      const value = Number(input.value);
      output.value = String(value);
      update(value);
    });
  }

  async function loadBodyText() {
    try {
      const response = await fetch('/assets/tiantan.txt');
      if (!response.ok) return;
      const characters = (await response.text()).match(/\p{Script=Han}/gu);
      if (characters?.length) {
        glyphs = characters.join('');
        build();
      }
    } catch {
      /* keep fallback */
    }
  }

  if (configure && settings) {
    configure.addEventListener('click', () => {
      const open = settings.hasAttribute('hidden');
      if (open) settings.removeAttribute('hidden');
      else settings.setAttribute('hidden', '');
      configure.setAttribute('aria-expanded', String(open));
    });
  }
  if (reset) reset.addEventListener('click', build);

  if (roofSelect) {
    roofSelect.innerHTML = ROOFS.map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
    roofSelect.addEventListener('change', () => {
      const study = ROOFS.find((r) => r.id === roofSelect.value) || ROOFS[0];
      applyRoof(study);
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      mode = modeSelect.value === 'classic' ? 'classic' : 'qr';
      build();
    });
  }

  bindRange('strength', 'strengthValue', (v) => {
    physics.strength = v / 100;
  });
  bindRange('reach', 'reachValue', (v) => {
    physics.radius = v;
  });
  bindRange('inertia', 'inertiaValue', (v) => {
    physics.friction = v / 100;
  });

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('pointerenter', enter);
  window.addEventListener('pointerdown', unlockSound, { passive: true });
  window.addEventListener('resize', resize);

  const ro = new ResizeObserver(() => resize());
  ro.observe(artboard);
  ro.observe(temple);

  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) ensureLoop();
      },
      { threshold: 0.05 },
    );
    io.observe(artboard);
  }

  applyRoof(ROOFS[0]);
  loadBodyText();
  ensureLoop();
}
