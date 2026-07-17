import { encode } from 'uqr';

export type CurtainOptions = {
  /** URL (or text) encoded into the hanging QR curtain */
  qrPayload: string;
  /** Error correction — higher survives more motion before a scan fails */
  ecc?: 'L' | 'M' | 'Q' | 'H';
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
  const artboard = document.getElementById('artboard');
  const canvas = document.getElementById('curtain') as HTMLCanvasElement | null;
  const cursor = document.getElementById('cursor');
  const temple = document.getElementById('temple');
  const configure = document.getElementById('configure');
  const settings = document.getElementById('settings');
  const reset = document.getElementById('reset');

  if (!artboard || !canvas || !cursor || !temple) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

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
  const physics: Physics = { strength: 0.72, radius: 34, friction: 0.965, gravity: 0.18 };
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
  /** Horizontal size of one QR module in CSS pixels */
  let moduleW = 10;
  /** Vertical size of one QR module in CSS pixels */
  let moduleH = 10;

  function unlockSound() {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!sound.context) {
      const context = new AudioContextCtor();
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

  /**
   * Asset-native eave outline for temple-roof-cutout-web (901×730).
   * Same geometry as the original Temple of Heaven curtain project.
   */
  const ROOF_NATIVE_W = 901;
  // Sampled from PNG alpha edge (center higher, sides droop). A few px above
  // the true edge so strand tops tuck under the roof layer (z-index 4).
  const ROOF_CENTER_Y = 652;
  const ROOF_SIDE_Y = 698;

  function build() {
    chains.length = 0;
    const narrow = width < 720;
    const templeRect = temple.getBoundingClientRect();
    const artboardRect = artboard.getBoundingClientRect();

    // Wait until the temple box has a real layout (aspect-ratio + image)
    if (templeRect.width < 48 || templeRect.height < 48) return;

    const buildingCenter = templeRect.left - artboardRect.left + templeRect.width * 0.5;
    const roofScale = templeRect.width / ROOF_NATIVE_W;
    const templeTop = templeRect.top - artboardRect.top;

    // Eave opening under the roof (where the original character curtain hangs)
    const eaveWidth = templeRect.width * (narrow ? 0.9 : 0.84);
    const eaveLeft = buildingCenter - eaveWidth / 2;
    const centerEdge = templeTop + ROOF_CENTER_Y * roofScale;
    const sideEdge = templeTop + ROOF_SIDE_Y * roofScale;
    const bottomPad = narrow ? 52 : 56;
    const curtainBottom = height - bottomPad;
    const availableDrop = Math.max(140, curtainBottom - sideEdge);

    /*
     * Scannable square QR that IS the curtain under the roof:
     * as wide as the eave allows, as tall as the free space allows —
     * take the smaller so modules stay square (phones need that).
     */
    const span = Math.min(eaveWidth, availableDrop);
    const columns = qrSize;
    const rows = qrSize;
    const pitch = columns > 1 ? span / (columns - 1) : span;
    moduleW = pitch;
    moduleH = pitch;

    // Center the square under the roof
    const left = buildingCenter - span / 2;

    for (let column = 0; column < columns; column += 1) {
      const x = left + column * pitch;
      // Map column into the full eave so the hang curve matches the roof
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
      // Row 0 stays pinned to the eave curve
      chain[0].anchorX = x;
      chain[0].anchorY = top;
      chain[0].x = x;
      chain[0].y = top;
      chain[0].oldX = x;
      chain[0].oldY = top;
      chains.push(chain);
    }

    const meta = document.getElementById('qr-meta');
    if (meta) {
      meta.textContent = `${qrSize}×${qrSize} · ${Math.round(span)}px · ${options.qrPayload}`;
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
    // Near-full cell fill — tiny gap between modules so the grid still reads as QR
    const halfW = moduleW * 0.48;
    const halfH = moduleH * 0.48;
    const fontSize = Math.max(7, Math.min(moduleW, moduleH) * 0.7);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${fontSize}px ui-monospace, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;

    for (const chain of chains) {
      for (const point of chain) {
        if (!point.dark) continue;

        // Solid module — phone cameras read these as QR cells
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2e251f';
        ctx.fillRect(point.x - halfW, point.y - halfH, halfW * 2, halfH * 2);

        // Soft glyph texture (curtain character feel without breaking contrast)
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
    integrate();
    constrain();
    draw();
    requestAnimationFrame(frame);
  }

  function enter(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = mouse.oldX = event.clientX - rect.left;
    mouse.y = mouse.oldY = event.clientY - rect.top;
    mouse.active = true;
    cursor.style.left = `${mouse.x}px`;
    cursor.style.top = `${mouse.y}px`;
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
    cursor.style.left = `${mouse.x}px`;
    cursor.style.top = `${mouse.y}px`;
  }

  function leave() {
    mouse.active = false;
    artboard.classList.remove('is-active');
  }

  function bindRange(id: string, outputId: string, update: (value: number) => void) {
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
      if (!response.ok) throw new Error(`Unable to load body text: ${response.status}`);
      const characters = (await response.text()).match(/\p{Script=Han}/gu);
      if (characters && characters.length) {
        glyphs = characters.join('');
        build();
      }
    } catch (error) {
      console.warn(error);
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

  bindRange('strength', 'strengthValue', (value) => {
    physics.strength = value / 100;
  });
  bindRange('reach', 'reachValue', (value) => {
    physics.radius = value;
  });
  bindRange('inertia', 'inertiaValue', (value) => {
    physics.friction = value / 100;
  });

  canvas.addEventListener('pointerenter', enter);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', leave);
  window.addEventListener('pointerdown', unlockSound, { passive: true });
  window.addEventListener('resize', resize);

  // Keep eave math in sync with temple layout (mobile/desktop reflows)
  const layoutObserver = new ResizeObserver(() => {
    resize();
  });
  layoutObserver.observe(artboard);
  layoutObserver.observe(temple);

  const templeImg = temple.querySelector('img');
  if (templeImg) {
    if (templeImg.complete) {
      resize();
    } else {
      templeImg.addEventListener('load', resize, { once: true });
    }
  }

  // Second pass after fonts/paint settle (corrects first-frame misalignment)
  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(resize);
  });

  loadBodyText();
  frame();
}
