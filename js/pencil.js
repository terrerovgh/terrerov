/** Seeded noise so strokes stay put between frames. */
export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function makePaper(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#c9a875");
  grd.addColorStop(0.5, "#c3a06c");
  grd.addColorStop(1, "#b89560");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);

  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    const n = (hash(px * 0.37 + py * 1.13) - 0.5) * 22;
    const fiber = (hash(px * 0.09 + py * 0.02) - 0.5) * 8;
    d[i] += n + fiber;
    d[i + 1] += n * 0.86 + fiber;
    d[i + 2] += n * 0.55;
  }
  g.putImageData(img, 0, 0);

  g.save();
  g.globalAlpha = 0.028;
  g.strokeStyle = "#5a4030";
  g.lineWidth = 1;
  for (let i = 0; i < 140; i++) {
    g.beginPath();
    const x = hash(i * 3.1) * w;
    const y = hash(i * 7.7) * h;
    g.moveTo(x, y);
    g.quadraticCurveTo(
      x + (hash(i * 2.2) - 0.5) * 80,
      y + (hash(i * 4.8) - 0.5) * 40,
      x + (hash(i * 5.9) - 0.5) * 160,
      y + (hash(i * 1.4) - 0.5) * 30
    );
    g.stroke();
  }
  g.restore();
  return c;
}

function ink(alpha) {
  return `rgba(28, 24, 20, ${alpha})`;
}

/** Charcoal on kraft: dust, pressure, a second pass that misses a little. */
export function pencilStroke(ctx, points, { width = 1.9, seed = 1, alpha = 0.86 } = {}) {
  if (points.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawPass = (offset, w, a) => {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const j = (hash(seed * 17 + i * 8.3) - 0.5) * 1.35;
      const nx = i === 0 || i === points.length - 1 ? 0 : j;
      const x = p.x + nx + offset * 0.45;
      const y = p.y + nx * 0.45 + offset;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = ink(a);
    ctx.lineWidth = w;
    ctx.stroke();
  };

  drawPass(1.1, width * 2.35, alpha * 0.1);
  drawPass(0.55, width * 1.7, alpha * 0.2);
  drawPass(0, width, alpha);
  drawPass(-0.55, width * 0.5, alpha * 0.28);

  ctx.fillStyle = ink(alpha * 0.16);
  for (let i = 0; i < points.length; i += 2) {
    if (hash(seed + i * 3.3) < 0.62) continue;
    const p = points[i];
    ctx.beginPath();
    ctx.arc(p.x + (hash(i) - 0.5) * 2.2, p.y + (hash(i + 4) - 0.5) * 2.2, 0.7 + hash(i + 8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function charcoalText(ctx, text, x, y, opts = {}) {
  const {
    size = 22,
    font = '"Caveat", cursive',
    align = "left",
    seed = 1,
    alpha = 0.8,
    maxWidth = 0,
    line = 1.18,
    fill = "rgba(32, 27, 22, ALPHA)",
  } = opts;
  ctx.save();
  ctx.font = `${size}px ${font}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const lines = [];
  if (!maxWidth) {
    String(text).split("\n").forEach((ln) => lines.push(ln));
  } else {
    for (const para of String(text).split("\n")) {
      const words = para.split(" ");
      let cur = "";
      for (const word of words) {
        const next = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && cur) {
          lines.push(cur);
          cur = word;
        } else cur = next;
      }
      if (cur) lines.push(cur);
    }
  }

  lines.forEach((ln, li) => {
    const w = ctx.measureText(ln).width;
    let px = x;
    if (align === "center") px -= w / 2;
    if (align === "right") px -= w;
    const jy = (hash(seed + li * 13) - 0.5) * 1.1;
    const yy = y + li * size * line + jy;
    ctx.fillStyle = fill.replace("ALPHA", String(alpha * 0.18));
    ctx.fillText(ln, px + 0.7, yy + 0.6);
    ctx.fillStyle = fill.replace("ALPHA", String(alpha));
    ctx.fillText(ln, px + (hash(seed + li) - 0.5) * 0.6, yy);
  });
  ctx.restore();
  return lines.length * size * line;
}

export function wobblePoints(x1, y1, x2, y2, seed) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const n = Math.max(4, Math.round(len / 6.5));
  const px = -dy / len;
  const py = dx / len;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const amp = Math.sin(t * Math.PI) * 1.45;
    const j = (hash(seed + i * 11.3) - 0.5) * amp;
    pts.push({ x: x1 + dx * t + px * j, y: y1 + dy * t + py * j });
  }
  return pts;
}

export function sketchLine(ctx, x1, y1, x2, y2, width = 1.9, seed = 1) {
  pencilStroke(ctx, wobblePoints(x1, y1, x2, y2, seed), { width, seed });
}

export function sketchCircle(ctx, x, y, r, width = 1.9, seed = 3) {
  const n = 26;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = r + (hash(seed + i * 4.7) - 0.5) * 1.15;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  pencilStroke(ctx, pts, { width, seed, alpha: 0.88 });
  const ghost = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - 0.3;
    const rr = r * 0.97 + (hash(seed + 40 + i) - 0.5) * 0.8;
    ghost.push({ x: x + 0.7 + Math.cos(a) * rr, y: y + 0.5 + Math.sin(a) * rr });
  }
  pencilStroke(ctx, ghost, { width: width * 0.6, seed: seed + 9, alpha: 0.28 });
}

export function sketchEllipse(ctx, x, y, rx, ry, rot = 0, fill = false, seed = 5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const n = 22;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = (hash(seed + i * 3.9) - 0.5) * 0.7;
    pts.push({ x: Math.cos(a) * (rx + j), y: Math.sin(a) * (ry + j) });
  }
  pencilStroke(ctx, pts, { width: 1.55, seed, alpha: 0.86 });
  if (fill) {
    ctx.fillStyle = "rgba(38, 33, 28, 0.9)";
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function hatch(ctx, x, y, rx, ry, rot, seed = 8) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = "rgba(42, 36, 30, 0.22)";
  ctx.lineWidth = 0.7;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.4) / 5;
    const yy = -ry + t * ry * 2;
    const w = Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2)) * rx * 0.75;
    ctx.beginPath();
    ctx.moveTo(-w, yy + (hash(seed + i) - 0.5));
    ctx.lineTo(w, yy + (hash(seed + i + 3) - 0.5));
    ctx.stroke();
  }
  ctx.restore();
}

export function groundAt(x) {
  return Math.sin(x * 0.0018) * 8 + Math.sin(x * 0.007) * 3 + (hash(Math.floor(x / 28)) - 0.5) * 1.6;
}

export function drawTimeline(ctx, camX, viewW, originY, worldLen, ticks) {
  const pad = 120;
  const x0 = camX - pad;
  const x1 = camX + viewW + pad;
  const step = 7;
  const pts = [];
  for (let x = x0; x <= x1; x += step) {
    const wobble = (hash(x * 0.19) - 0.5) * 1.6;
    pts.push({ x: x - camX, y: originY + groundAt(x) + wobble });
  }
  pencilStroke(ctx, pts, { width: 2.15, seed: 101, alpha: 0.9 });

  const walkedTo = Math.min(camX + viewW * 0.34, worldLen);
  const walked = [];
  for (let x = Math.max(0, camX - pad); x <= walkedTo; x += step) {
    walked.push({ x: x - camX, y: originY + groundAt(x) + 1.4 });
  }
  if (walked.length > 1) pencilStroke(ctx, walked, { width: 1.05, seed: 102, alpha: 0.28 });

  for (const t of ticks) {
    if (t.x < x0 || t.x > x1) continue;
    const y = originY + groundAt(t.x);
    const sx = t.x - camX;
    sketchLine(ctx, sx + 0.4, y - 11, sx - 0.3, y + 10, 1.45, t.x);
  }
}
