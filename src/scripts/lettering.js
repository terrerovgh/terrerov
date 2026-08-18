/**
 * Writing, not typesetting.
 *
 * Every letter goes down as its own little gesture: shifted control points, a
 * degree or two of rotation, its own advance, riding a baseline that sags the
 * way a hand-ruled line sags. Two `e`s in the same word are never the same
 * shape, because the seed carries the character's position in the string.
 *
 * Because the result is strokes in a Sheet, `renderSheet({reveal})` makes the
 * text write itself on rather than fade in.
 */

import { GLYPHS, MARKS, ACCENTED, DOTLESS, SPACE } from "./alphabet.js";
import { hash, fbm } from "./charcoal.js";

/**
 * The same person, writing at three speeds.
 *
 * These are tuned for reading first and character second, which is the other way
 * round from where they started. The words ARE the CV: a reader who has to
 * decode a letter has stopped reading it.
 *
 * What changed and why:
 *
 *   jitter   was up to 1.7 — nearly two full units of wander per control point,
 *            which is enough to turn an `a` into an `o` and an `rn` into an `m`.
 *            A person writing something they want read does not do that.
 *   alpha    the small hand sat at .6, which is a pencil note in the margin, not
 *            a line of a CV. Everything is darker now.
 *   track    letters are set further apart. Most of what read as "messy" was
 *            neighbouring letters touching, not the letterforms themselves.
 *   slant    less lean. A steep italic costs legibility at this size and buys
 *            nothing the hand does not already give.
 */
const HANDS = {
  display: { weight: 0.082, alpha: 0.94, slant: 0.022, track: 0.055, jitter: 0.62, wobble: 0.85, line: 1.24 },
  note: { weight: 0.092, alpha: 0.88, slant: 0.05, track: 0.038, jitter: 0.7, wobble: 0.9, line: 1.46 },
  small: { weight: 0.1, alpha: 0.78, slant: 0.045, track: 0.045, jitter: 0.75, wobble: 0.95, line: 1.36 },
};

function glyphFor(ch) {
  if (GLYPHS[ch]) return { g: GLYPHS[ch], mark: null };
  const acc = ACCENTED[ch];
  if (acc) {
    const base = GLYPHS[acc[0]];
    if (base) return { g: base, mark: MARKS[acc[1]], dotless: DOTLESS.has(acc[0]) };
  }
  const up = GLYPHS[ch.toUpperCase()] || GLYPHS[ch.toLowerCase()];
  if (up) return { g: up, mark: null };
  return null;
}

function advanceOf(ch) {
  if (ch === " ") return SPACE;
  const f = glyphFor(ch);
  return f ? f.g.a : SPACE;
}

/** Width of a run of text in em units, tracking included. */
function measureRun(text, track) {
  let w = 0;
  for (const ch of text) w += advanceOf(ch) + track;
  return w;
}

function wrap(text, maxEm, track) {
  // Measuring uses nominal advances, but every glyph is drawn with its own
  // random scale and every space with its own random width — actual lines run
  // up to about 15% wider than measured. Wrap short so they still fit.
  const limit = maxEm * 0.88;
  const out = [];
  for (const para of String(text).split("\n")) {
    if (!maxEm) {
      out.push(para);
      continue;
    }
    let cur = "";
    for (const word of para.split(" ")) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && measureRun(next, track) > limit) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    out.push(cur);
  }
  return out;
}

/**
 * Write `text` into `sheet`. Returns the height consumed, so callers can stack
 * blocks without measuring twice.
 *
 * size      cap-to-baseline in pixels, roughly
 * hand      "display" | "note" | "small"
 * maxWidth  wrap width in pixels (0 = no wrapping)
 * align     "left" | "center" | "right"
 * tilt      radians the whole block leans, because paper is never square
 */
export function writeText(sheet, text, x, y, opts = {}) {
  const {
    size = 24,
    hand = "note",
    maxWidth = 0,
    align = "left",
    alpha = 1,
    seed = 1,
    tilt = 0,
    tint = 0,
    lineGap = 0,
    pigment = "charcoal",
  } = opts;

  const h = HANDS[hand] || HANDS.note;
  const track = h.track;
  const maxEm = maxWidth ? maxWidth / size : 0;
  const lines = wrap(text, maxEm, track);
  const lineStep = size * h.line + lineGap;
  const width = Math.max(...lines.map((l) => measureRun(l, track))) * size;

  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const place = (px, py) => ({
    x: x + (px * cosT - py * sinT),
    y: y + (px * sinT + py * cosT),
  });

  lines.forEach((line, li) => {
    const lineW = measureRun(line, track) * size;
    let pen = 0;
    if (align === "center") pen = -lineW / 2;
    else if (align === "right") pen = -lineW;

    const baseY = li * lineStep;
    // a hand-ruled line sags a little and drifts down as it goes
    const sagAmp = size * 0.022 * h.jitter;
    const lineSeed = seed * 7.13 + li * 31.7;

    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch === " ") {
        pen += (SPACE + track) * size * (0.82 + hash(lineSeed + ci * 3.3) * 0.5);
        continue;
      }
      const found = glyphFor(ch);
      if (!found) {
        pen += (SPACE + track) * size;
        continue;
      }

      const gs = lineSeed + ci * 13.9 + ch.charCodeAt(0) * 0.77;
      const t = lineW ? pen / lineW : 0;
      const sag = Math.sin(t * Math.PI) * sagAmp * 0.5 + (fbm(t * 2.6 + lineSeed, lineSeed) - 0.5) * sagAmp * 2;
      const rot = (hash(gs * 1.7) - 0.5) * 0.07 * h.jitter;
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      // a letter varies in size, but not so much that two of the same word read
      // as different words
      const scaleY = 0.96 + hash(gs * 2.9) * 0.09;
      const scaleX = 0.95 + hash(gs * 4.1) * 0.09;
      const cx = found.g.a * 0.5;
      // some letters get leaned on harder than others — the strongest cue that
      // a hand wrote this and not a font renderer
      // some letters get leaned on harder than others, but none of them get
      // leaned on so lightly that they drop out of the line
      const press = 0.84 + hash(gs * 8.3) * 0.34;
      const ink = 0.9 + hash(gs * 5.9) * 0.2;

      const put = (gx, gy, k) => {
        // per-point wander, so no two instances of a letter match
        const jx = (hash(gs + k * 5.3) - 0.5) * 0.022 * h.jitter;
        const jy = (hash(gs + k * 9.1) - 0.5) * 0.022 * h.jitter;
        let ex = (gx + jx - cx) * scaleX;
        let ey = (gy + jy) * scaleY;
        ex -= ey * h.slant; // the lean
        const rx = ex * cr - ey * sr + cx;
        const ry = ex * sr + ey * cr;
        return place(pen + rx * size, baseY + ry * size + sag);
      };

      const strokeOpts = {
        width: Math.max(0.95, size * h.weight * press),
        alpha: Math.min(0.96, h.alpha * alpha * ink),
        wobble: h.wobble,
        // A searching line under every letter is a lovely thing on a drawing and
        // a second ghost letter on a word. It comes right down for text.
        overshoot: 0.5,
        search: 0.12,
        grain: 0.55,
        taper: 0.85,
        tint,
        pigment,
        seed: gs,
      };

      const marks = [];
      if (found.mark) {
        if (found.mark.s) marks.push(...found.mark.s);
      }
      const strokes = found.mark && found.dotless ? found.g.s : found.g.s;

      strokes.forEach((flat, si) => {
        const pts = [];
        for (let i = 0; i < flat.length; i += 2) pts.push(put(flat[i], flat[i + 1], si * 7 + i));
        sheet.stroke(pts, { ...strokeOpts, smooth: pts.length > 2 ? 6 : false, seed: gs + si * 3.7 });
      });

      marks.forEach((flat, si) => {
        const pts = [];
        for (let i = 0; i < flat.length; i += 2) pts.push(put(flat[i], flat[i + 1], 90 + si * 7 + i));
        sheet.stroke(pts, { ...strokeOpts, smooth: pts.length > 2 ? 6 : false, seed: gs + 77 + si });
      });

      const dots = [];
      if (found.g.d && !(found.mark && found.dotless)) dots.push(...found.g.d);
      if (found.mark && found.mark.d) dots.push(...found.mark.d);
      dots.forEach((d, di) => {
        const p = put(d[0], d[1], 40 + di * 3);
        sheet.dot(p.x, p.y, Math.max(0.7, d[2] * size), {
          alpha: h.alpha * alpha * 0.95,
          tint,
          pigment,
          seed: gs + di,
        });
      });

      pen += (found.g.a * scaleX + track) * size * (0.97 + hash(gs * 6.7) * 0.07);
    }
  });

  return lines.length * lineStep;
}

/** Height a block will take, without drawing it. */
export function textHeight(text, opts = {}) {
  const { size = 24, hand = "note", maxWidth = 0, lineGap = 0 } = opts;
  const h = HANDS[hand] || HANDS.note;
  const lines = wrap(text, maxWidth ? maxWidth / size : 0, h.track);
  return lines.length * (size * h.line + lineGap);
}

/**
 * The lines `writeText` would set the text on. Callers that need to underline
 * or box a block have to know where the last line actually ends.
 */
export function wrapLines(text, opts = {}) {
  const { size = 24, hand = "note", maxWidth = 0 } = opts;
  const h = HANDS[hand] || HANDS.note;
  return wrap(text, maxWidth ? maxWidth / size : 0, h.track);
}

/** Width of a single line, without drawing it. */
export function textWidth(text, opts = {}) {
  const { size = 24, hand = "note" } = opts;
  const h = HANDS[hand] || HANDS.note;
  return measureRun(String(text), h.track) * size;
}

/** The line someone draws under a heading, in one quick pass. */
export function underline(sheet, x, y, w, opts = {}) {
  const { alpha = 0.5, seed = 1, width = 1.6, pigment = "sanguine" } = opts;
  const pts = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({
      x: x + w * t,
      y: y + Math.sin(t * Math.PI) * 1.6 + (hash(seed + i * 3.1) - 0.5) * 1.4,
    });
  }
  sheet.stroke(pts, {
    width,
    alpha,
    wobble: 1.3,
    overshoot: 2.4,
    search: 0.5,
    taper: 1,
    pigment,
    seed,
    smooth: 6,
  });
}

/** A hand-boxed tag for the skill chips. Corners never meet. */
export function tag(sheet, text, x, y, opts = {}) {
  const { size = 15, alpha = 0.7, seed = 1 } = opts;
  const w = textWidth(text, { size, hand: "small" });
  const padX = size * 0.42;
  const padY = size * 0.34;
  const left = x - padX;
  const right = x + w + padX;
  const top = y - size * 0.74 - padY;
  const bottom = y + size * 0.16 + padY;
  // the box is drawn round the word afterwards, the way you ring something in
  // the margin — so it is the red chalk, and the word itself is not
  const o = {
    width: 1.15,
    alpha: alpha * 0.62,
    wobble: 1.4,
    overshoot: 1.6,
    search: 0.3,
    pigment: "sanguine",
    seed,
  };
  sheet.line(left, top, right, top + (hash(seed) - 0.5) * 2, o);
  sheet.line(right, top, right + (hash(seed + 1) - 0.5) * 2, bottom, o);
  sheet.line(right, bottom, left, bottom + (hash(seed + 2) - 0.5) * 2, o);
  sheet.line(left, bottom, left + (hash(seed + 3) - 0.5) * 2, top, o);
  writeText(sheet, text, x, y, { size, hand: "small", alpha, seed: seed + 5 });
  return right - left + size * 0.5;
}
