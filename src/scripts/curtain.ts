import { encode } from 'uqr';

export type CurtainOptions = {
  /** Root scene element (scoped queries) */
  root: HTMLElement;
  /** URL (or text) encoded into the hanging QR curtain */
  qrPayload: string;
  ecc?: 'L' | 'M' | 'Q' | 'H';
  /** Asset native width used for roofScale */
  roofNativeW?: number;
  roofCenterY?: number;
  roofSideY?: number;
  eaveWidthRatio?: number;
  /** Disable chimes (gallery cards) */
  enableSound?: boolean;
  /** Compact layout (gallery card) */
  compact?: boolean;
};

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
  alpha: number;
  dark: boolean;
  col: number;
  row: number;
};

type Physics = {
  strength: number;
  radius: number;
  friction: number;
  gravity: number;
};

const FALLBACK_GLYPHS = '天坛祈年风调雨顺天地玄黄日月星辰礼乐文明北京春秋山川云海';

export function initCurtain(options: CurtainOptions) {
  const root = options.root;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-curtain-canvas]');
  const cursor = root.querySelector<HTMLElement>('[data-curtain-cursor]');
  const temple = root.querySelector<HTMLElement>('[data-curtain-roof]');
  const configure = root.querySelector<HTMLElement>('[data-curtain-configure]');
  const settings = root.querySelector<HTMLElement>('[data-curtain-settings]');
  const reset = root.querySelector<HTMLElement>('[data-curtain-reset]');
  const meta = root.querySelector<HTMLElement>('[data-curtain-meta]');

  if (!canvas || !temple) return () => {};

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const roofNativeW = options.roofNativeW ?? 901;
  const roofCenterY = options.roofCenterY ?? 652;
  const roofSideY = options.roofSideY ?? 698;
  const eaveWidthRatio = options.eaveWidthRatio ?? 0.84;
  const enableSound = options.enableSound !== false;
  const compact = Boolean(options.compact);

  const qr = encode(options.qrPayload, {
    ecc: options.ecc ?? 'M',
    border: 1,
    boostEcc: true,
  });
  const qrSize = qr.size;
  const qrData = qr.data;

  const chains: Point[][] = [];
  let glyphs = FALLBACK_GLYPHS;
  const mouse = { x: -999, y: -999, oldX: -999, oldY: -999, active: false };
  const physics: Physics = {
    strength: compact ? 0.55 : 0.72,
    radius: compact ? 22 : 34,
    friction: 0.965,
    gravity: 0.18,
  };
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
  let running = true;
  let visible = true;
  let raf = 0;

  function unlockSound() {
    if (!enableSound) return;
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!sound.context) {
      const context = new AudioContextCtor();
      const output = context.createGain();
      const compressor = context.createDynamicsCompressor();
      const delay = context.createDelay(0.3);
      const feedback = context.createGain();
      const wet = context.createGain();

      output.gain.value = 0.5;
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
    if (!enableSound) return;
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
    const level = 0.022 + (Math.min(impact, 18) / 18) * 0.06;
    const duration = 0.72 + Math.random() * 0.32;
    const spatial = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    const pan = Math.max(-0.9, Math.min(0.9, (x / width) * 2 - 1));
    if ('pan' in spatial) {
      (spatial as StereoPannerNode).pan.setValueAtTime(pan, now);
    }
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

  function build() {
    chains.length = 0;
    const narrow = width < 720;
    const templeRect = temple.getBoundingClientRect();
    const artboardRect = root.getBoundingClientRect();

    if (templeRect.width < 24 || templeRect.height < 24) return;

    const buildingCenter = templeRect.left - artboardRect.left + templeRect.width * 0.5;
    const roofScale = templeRect.width / roofNativeW;
    const templeTop = templeRect.top - artboardRect.top;

    const eaveWidth = templeRect.width * (narrow ? Math.min(0.92, eaveWidthRatio + 0.04) : eaveWidthRatio);
    const eaveLeft = buildingCenter - eaveWidth / 2;
    const centerEdge = templeTop + roofCenterY * roofScale;
    const sideEdge = templeTop + roofSideY * roofScale;
    const bottomPad = compact ? 16 : narrow ? 52 : 56;
    const curtainBottom = height - bottomPad;
    const availableDrop = Math.max(compact ? 80 : 140, curtainBottom - sideEdge);

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
          alpha: dark ? 0.94 : 0.06,
          dark,
          col: column,
          row,
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

    if (meta) {
      meta.textContent = `${qrSize}×${qrSize} · ${Math.round(span)}px · ${options.qrPayload}`;
    }
  }

  function resize() {
    const rect = root.getBoundingClientRect();
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
        if (!point.dark) continue;
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
    for (let pass = 0; pass < (compact ? 5 : 8); pass += 1) {
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
    const halfW = moduleW * 0.48;
    const halfH = moduleH * 0.48;
    const fontSize = Math.max(5, Math.min(moduleW, moduleH) * 0.7);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${fontSize}px ui-monospace, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;

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
    ctx.globalAlpha = 1;
  }

  function frame() {
    if (!running) return;
    if (visible) {
      integrate();
      constrain();
      draw();
    }
    raf = requestAnimationFrame(frame);
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
    root.classList.add('is-active');
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
    root.classList.remove('is-active');
  }

  function bindRange(id: string, update: (value: number) => void) {
    const input = root.querySelector<HTMLInputElement>(`[data-curtain-${id}]`);
    const output = root.querySelector<HTMLOutputElement>(`[data-curtain-${id}-value]`);
    if (!input) return;
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (output) output.value = String(value);
      update(value);
    });
  }

  async function loadBodyText() {
    try {
      const response = await fetch('/assets/tiantan.txt');
      if (!response.ok) return;
      const characters = (await response.text()).match(/\p{Script=Han}/gu);
      if (characters && characters.length) {
        glyphs = characters.join('');
        build();
      }
    } catch {
      /* keep fallback glyphs */
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

  bindRange('strength', (value) => {
    physics.strength = value / 100;
  });
  bindRange('reach', (value) => {
    physics.radius = value;
  });
  bindRange('inertia', (value) => {
    physics.friction = value / 100;
  });

  canvas.addEventListener('pointerenter', enter);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', leave);
  if (enableSound) {
    root.addEventListener('pointerdown', unlockSound, { passive: true });
  }
  window.addEventListener('resize', resize);

  const layoutObserver = new ResizeObserver(() => resize());
  layoutObserver.observe(root);
  layoutObserver.observe(temple);

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
    },
    { threshold: 0.05 },
  );
  visibilityObserver.observe(root);

  const templeImg = temple.querySelector('img');
  if (templeImg) {
    if (templeImg.complete) resize();
    else templeImg.addEventListener('load', resize, { once: true });
  }

  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(resize);
  });

  loadBodyText();
  frame();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    layoutObserver.disconnect();
    visibilityObserver.disconnect();
    window.removeEventListener('resize', resize);
  };
}

/** Boot every `[data-curtain-root]` on the page */
export function bootAllCurtains() {
  const roots = document.querySelectorAll<HTMLElement>('[data-curtain-root]');
  const cleanups: Array<() => void> = [];
  roots.forEach((root) => {
    const qrPayload = root.dataset.qrPayload || 'https://www.terrerov.com';
    const ecc = (root.dataset.ecc || 'M') as 'L' | 'M' | 'Q' | 'H';
    cleanups.push(
      initCurtain({
        root,
        qrPayload,
        ecc,
        roofNativeW: Number(root.dataset.roofW || 901),
        roofCenterY: Number(root.dataset.roofCenterY || 652),
        roofSideY: Number(root.dataset.roofSideY || 698),
        eaveWidthRatio: Number(root.dataset.eaveRatio || 0.84),
        enableSound: root.dataset.sound !== '0',
        compact: root.dataset.compact === '1',
      }),
    );
  });
  return () => cleanups.forEach((fn) => fn());
}
