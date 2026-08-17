/**
 * What he is wearing and carrying, stage by stage.
 *
 * Two rules, both learned the hard way on this figure:
 *
 *   - one big silhouette per stage, or nothing. The torso is about eighty
 *     pixels tall; collars, plackets and cuffs turn to mush at that size, while
 *     an apron, a gown or a hood reads instantly across the room.
 *   - anything hanging off him swings. A bag, a lanyard, a tassel, a suitcase —
 *     each on its own pendulum, lagging the stride. Secondary motion is the
 *     cheapest life-per-line-of-code there is.
 */

import { pt } from "./character.js";

/** A pendulum trailing the gait. */
function swingOf(p, freq = 1, lag = 0.6, amp = 1) {
  if (!p.walking) return Math.sin(p.idleT * 0.9) * 0.12 * amp;
  return Math.sin(p.phase * freq - lag) * amp;
}

/* ------------------------------------------------------------- garments --- */

/**
 * The figure is a bare stick by default — that is what the reference drawings
 * are, and it is what makes each stage's one garment read instantly. Clothes
 * appear only where they say something about the stage.
 */
export function drawGarment(sheet, p, costume) {
  const s = p.scale;
  if (!costume) return;

  // Bare stick, plus one big shape. At this size a torso is about eighty pixels
  // tall, and a shirt with a collar, a placket and cuffs collapses into mush on
  // it. The garments that read — the apron, the gown, the hard hat — are the
  // ones that are a single large silhouette, so every stage gets one of those
  // or nothing at all, and the accessory carries the rest.
  if (costume === "student" || costume === "uni" || costume === "dad" || costume === "child") return;
  if (costume === "badge") return; // the lanyard and clipboard say office

  if (costume === "chef") {
    // the apron: one long shape, front and centre
    const apron = [
      pt(p.neck.x - 5 * s, p.neck.y + 6 * s),
      pt(p.neck.x + 5 * s, p.neck.y + 6 * s),
      pt(p.hip.x + 15 * s, p.hip.y + 6 * s),
      pt(p.hip.x + 13 * s, p.hip.y + 20 * s),
      pt(p.hip.x - 13 * s, p.hip.y + 20 * s),
      pt(p.hip.x - 15 * s, p.hip.y + 6 * s),
    ];
    sheet.poly(apron, { width: 1.6 * s, alpha: 0.86 });
    sheet.tone(apron, { angle: -0.5, width: 4.2 * s, alpha: 0.1, falloff: 0.65 });
    sheet.hatch(apron, { angle: -0.95, gap: 5 * s, alpha: 0.18, width: 0.85, cross: 0.25 });
    const tie = swingOf(p, 1, 0.9, 3.4 * s);
    sheet.line(p.hip.x - 14 * s, p.hip.y + 5 * s, p.hip.x - 17 * s + tie, p.hip.y + 17 * s, {
      width: 1.1 * s,
      alpha: 0.6,
    });
    return;
  }

  if (costume === "grad") {
    const gown = [
      pt(p.shoulder.x - 13 * s, p.shoulder.y + 6 * s),
      pt(p.shoulder.x + 13 * s, p.shoulder.y + 6 * s),
      pt(p.hip.x + 20 * s, p.hip.y + 26 * s),
      pt(p.hip.x - 20 * s, p.hip.y + 26 * s),
    ];
    sheet.poly(gown, { width: 1.6 * s, alpha: 0.84 });
    sheet.tone(gown, { angle: -1.5, width: 4.4 * s, alpha: 0.09, falloff: 0.75 });
    sheet.hatch(gown, { angle: -1.35, gap: 5.6 * s, alpha: 0.15, width: 0.8 });
    sheet.line(p.neck.x - 5 * s, p.neck.y + 4 * s, p.hip.x - 7 * s, p.hip.y + 14 * s, {
      width: 1.5 * s,
      alpha: 0.72,
    });
    sheet.line(p.neck.x + 5 * s, p.neck.y + 4 * s, p.hip.x + 7 * s, p.hip.y + 14 * s, {
      width: 1.5 * s,
      alpha: 0.72,
    });
    return;
  }

  // site work: a hi-vis vest, open at the front, with its two bands
  if (costume === "hardhat") {
    for (const side of [-1, 1]) {
      const panel = [
        pt(p.shoulder.x + side * 3 * s, p.shoulder.y + 5 * s),
        pt(p.shoulder.x + side * 13 * s, p.shoulder.y + 6 * s),
        pt(p.hip.x + side * 14 * s, p.hip.y + 4 * s),
        pt(p.hip.x + side * 3 * s, p.hip.y + 4 * s),
      ];
      sheet.poly(panel, { width: 1.5 * s, alpha: 0.82 });
      sheet.tone(panel, { angle: -0.6, width: 3.8 * s, alpha: 0.08, falloff: 0.6 });
    }
    // the reflective bands, the thing that actually says hi-vis
    for (const y of [16, 26]) {
      sheet.line(p.shoulder.x - 13 * s, p.shoulder.y + y * s, p.shoulder.x + 13 * s, p.shoulder.y + (y - 1) * s, {
        width: 1.7 * s,
        alpha: 0.5,
      });
    }
    return;
  }

  // leaving: a long coat, the biggest shape he wears
  if (costume === "suitcase") {
    const coat = [
      pt(p.shoulder.x - 12 * s, p.shoulder.y + 4 * s),
      pt(p.shoulder.x + 12 * s, p.shoulder.y + 4 * s),
      pt(p.hip.x + 16 * s, p.hip.y + 22 * s),
      pt(p.hip.x - 16 * s, p.hip.y + 22 * s),
    ];
    sheet.poly(coat, { width: 1.6 * s, alpha: 0.84 });
    sheet.tone(coat, { angle: -1.4, width: 4.2 * s, alpha: 0.09, falloff: 0.7 });
    // lapels, and the opening running to the hem
    sheet.line(p.neck.x - 3 * s, p.neck.y + 4 * s, p.shoulder.x - 10 * s, p.shoulder.y + 13 * s, {
      width: 1.25 * s,
      alpha: 0.66,
    });
    sheet.line(p.neck.x + 3 * s, p.neck.y + 4 * s, p.shoulder.x + 10 * s, p.shoulder.y + 13 * s, {
      width: 1.25 * s,
      alpha: 0.66,
    });
    sheet.line(p.chest.x, p.chest.y + 12 * s, p.hip.x, p.hip.y + 21 * s, { width: 1.2 * s, alpha: 0.58 });
    return;
  }

  // the night workshop: hood up. Nothing else reads as instantly at this size.
  if (costume === "linux") {
    const body = [
      pt(p.shoulder.x - 13 * s, p.shoulder.y + 5 * s),
      pt(p.shoulder.x + 13 * s, p.shoulder.y + 5 * s),
      pt(p.hip.x + 15 * s, p.hip.y + 8 * s),
      pt(p.hip.x - 15 * s, p.hip.y + 8 * s),
    ];
    sheet.poly(body, { width: 1.55 * s, alpha: 0.84 });
    sheet.tone(body, { angle: -0.5, width: 3.8 * s, alpha: 0.1, falloff: 0.6 });
    // the kangaroo pocket
    sheet.line(p.hip.x - 10 * s, p.hip.y - 4 * s, p.hip.x + 10 * s, p.hip.y - 4 * s, {
      width: 1.15 * s,
      alpha: 0.5,
    });
    sheet.line(p.hip.x - 10 * s, p.hip.y - 4 * s, p.hip.x - 8 * s, p.hip.y + 5 * s, {
      width: 1 * s,
      alpha: 0.45,
    });
    sheet.line(p.hip.x + 10 * s, p.hip.y - 4 * s, p.hip.x + 8 * s, p.hip.y + 5 * s, {
      width: 1 * s,
      alpha: 0.45,
    });
    return;
  }
}

/* ----------------------------------------------------------------- hats --- */

export function drawHat(sheet, p, costume) {
  const s = p.scale;
  const r = p.r;
  const h = p.head;
  const dir = p.dir;

  if (costume === "grad") {
    // the skullcap sits on the crown; the board rides above it
    const brow = h.y - r * 0.62;
    const top = h.y - r * 1.12;
    sheet.line(h.x - r * 0.62, brow, h.x - r * 0.5, top, { width: 1.5 * s, alpha: 0.82 });
    sheet.line(h.x + r * 0.62, brow, h.x + r * 0.5, top, { width: 1.5 * s, alpha: 0.82 });
    sheet.line(h.x - r * 0.62, brow, h.x + r * 0.62, brow - r * 0.04, { width: 1.35 * s, alpha: 0.74 });
    const board = [
      pt(h.x - r * 1.34, top + r * 0.1),
      pt(h.x + r * 1.28, top - r * 0.14),
      pt(h.x + r * 1.22, top + r * 0.24),
      pt(h.x - r * 1.38, top + r * 0.46),
    ];
    sheet.poly(board, { width: 1.7 * s, alpha: 0.86 });
    sheet.hatch(board, { angle: -0.5, gap: 3.2 * s, alpha: 0.22, width: 0.7 });
    // tassel, swinging a beat behind the stride
    const sw = swingOf(p, 1, 0.9, 4.2 * s);
    const ax = h.x + r * 0.9 * dir;
    sheet.line(ax, top - 1, ax + sw, top + r * 0.62, { width: 1.15 * s, alpha: 0.7, wobble: 1.4 });
    sheet.ellipse(ax + sw * 1.15, top + r * 0.74, 3 * s, 4.2 * s, sw * 0.06, {
      width: 1.2 * s,
      alpha: 0.75,
      ghost: 0,
    });
    return;
  }

  if (costume === "hardhat") {
    // the dome caps the head, it does not cover the face
    const brow = h.y - r * 0.58;
    const dome = [
      pt(h.x - r * 1.02, brow),
      pt(h.x - r * 0.78, brow - r * 0.52),
      pt(h.x, brow - r * 0.78),
      pt(h.x + r * 0.78, brow - r * 0.52),
      pt(h.x + r * 1.02, brow),
    ];
    sheet.curve(dome, { width: 1.8 * s, alpha: 0.88 });
    sheet.hatch(dome.concat([pt(h.x, brow)]), { angle: -1.1, gap: 3.4 * s, alpha: 0.2, width: 0.75 });
    // brim, longer at the front
    sheet.line(h.x - r * 1.2 * dir, brow + r * 0.06, h.x + r * 1.5 * dir, brow - r * 0.06, {
      width: 1.7 * s,
      alpha: 0.84,
    });
    sheet.line(h.x - r * 0.12, brow - r * 0.74, h.x + r * 0.3, brow - r * 0.56, {
      width: 1.1 * s,
      alpha: 0.55,
    });
    return;
  }

  if (costume === "chef") {
    const band = h.y - r * 0.66;
    sheet.box(h.x - r * 0.62, band - r * 0.46, r * 1.24, r * 0.46, { width: 1.4 * s, alpha: 0.8 });
    // the puff, with pleats
    const puff = [
      pt(h.x - r * 0.58, band - r * 0.5),
      pt(h.x - r * 1.06, band - r * 1.12),
      pt(h.x - r * 0.38, band - r * 1.66),
      pt(h.x + r * 0.42, band - r * 1.62),
      pt(h.x + r * 1.06, band - r * 1.06),
      pt(h.x + r * 0.58, band - r * 0.5),
    ];
    sheet.curve(puff, { width: 1.6 * s, alpha: 0.86 });
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 5;
      const x = h.x - r * 0.5 + r * t;
      sheet.line(x, band - r * 0.52, x - r * 0.06, band - r * 1.5, {
        width: 0.9 * s,
        alpha: 0.4,
        wobble: 1.5,
      });
    }
    return;
  }

  if (costume === "linux") {
    // headphones pushed up onto the crown, not over the face
    const brow = h.y - r * 0.66;
    sheet.curve([pt(h.x - r * 0.94, brow + r * 0.1), pt(h.x, brow - r * 0.44), pt(h.x + r * 0.94, brow + r * 0.1)], {
      width: 1.35 * s,
      alpha: 0.66,
    });
    sheet.ellipse(h.x - r * 0.96, brow + r * 0.22, 2.4 * s, 3.2 * s, 0, { width: 1.2 * s, alpha: 0.7, ghost: 0 });
    sheet.ellipse(h.x + r * 0.96, brow + r * 0.22, 2.4 * s, 3.2 * s, 0, { width: 1.2 * s, alpha: 0.7, ghost: 0 });
  }
}

/* ---------------------------------------------------------------- props --- */

export function drawProps(sheet, p, costume) {
  const s = p.scale;
  const { hip, neck, chest, handL, handR, dir } = p;

  if (costume === "student") {
    // backpack, swinging against the stride
    const sw = swingOf(p, 1, 1.2, 2.2 * s);
    const bx = chest.x - 15 * s * dir + sw;
    const by = chest.y + 18 * s;
    const bag = [
      pt(bx - 9 * s, by - 6 * s),
      pt(bx + 9 * s, by - 7 * s),
      pt(bx + 10 * s, by + 20 * s),
      pt(bx - 10 * s, by + 19 * s),
    ];
    sheet.poly(bag, { width: 1.5 * s, alpha: 0.82 });
    sheet.hatch(bag, { angle: -1.15, gap: 4 * s, alpha: 0.24, width: 0.8 });
    sheet.line(bx - 6 * s, by - 6 * s, neck.x - 5 * s * dir, neck.y + 5 * s, { width: 1.2 * s, alpha: 0.66 });
    sheet.line(bx + 6 * s, by - 7 * s, neck.x + 4 * s * dir, neck.y + 7 * s, { width: 1.2 * s, alpha: 0.66 });
    // a book in the free hand
    const bk = [
      pt(handR.x - 1, handR.y - 5 * s),
      pt(handR.x + 15 * s, handR.y - 6 * s),
      pt(handR.x + 15 * s, handR.y + 7 * s),
      pt(handR.x - 1, handR.y + 6 * s),
    ];
    sheet.poly(bk, { width: 1.25 * s, alpha: 0.78 });
    sheet.line(handR.x + 2 * s, handR.y - 3.5 * s, handR.x + 13 * s, handR.y - 4 * s, {
      width: 0.85 * s,
      alpha: 0.5,
    });
    return;
  }

  if (costume === "uni") {
    const sw = swingOf(p, 1, 1.4, 2.8 * s);
    const bag = pt(hip.x - 2 * s * dir + sw, hip.y - 2 * s);
    sheet.line(neck.x + 8 * s * dir, neck.y + 3 * s, bag.x - 13 * s, bag.y - 5 * s, {
      width: 1.35 * s,
      alpha: 0.7,
    });
    const shape = [
      pt(bag.x - 15 * s, bag.y - 5 * s),
      pt(bag.x + 15 * s, bag.y - 6 * s),
      pt(bag.x + 16 * s, bag.y + 16 * s),
      pt(bag.x - 15 * s, bag.y + 15 * s),
    ];
    sheet.poly(shape, { width: 1.45 * s, alpha: 0.82 });
    sheet.hatch(shape, { angle: -0.9, gap: 4.2 * s, alpha: 0.22, width: 0.8 });
    sheet.line(bag.x - 15 * s, bag.y + 2 * s, bag.x + 16 * s, bag.y + 1 * s, { width: 1 * s, alpha: 0.5 });
    return;
  }

  if (costume === "badge") {
    // the lanyard swings on its own, slower than the arms
    const sw = swingOf(p, 1, 0.4, 2.6 * s);
    const bx = chest.x + sw;
    sheet.line(neck.x - 3 * s, neck.y + 3 * s, bx + 1 * s, chest.y + 22 * s, { width: 1.05 * s, alpha: 0.6 });
    sheet.line(neck.x + 3 * s, neck.y + 3 * s, bx + 1 * s, chest.y + 22 * s, { width: 1.05 * s, alpha: 0.6 });
    const badge = [
      pt(bx - 5 * s, chest.y + 22 * s),
      pt(bx + 6 * s, chest.y + 22 * s),
      pt(bx + 6 * s, chest.y + 34 * s),
      pt(bx - 5 * s, chest.y + 34 * s),
    ];
    sheet.poly(badge, { width: 1.2 * s, alpha: 0.8 });
    sheet.line(bx - 3 * s, chest.y + 26 * s, bx + 4 * s, chest.y + 26 * s, { width: 0.8 * s, alpha: 0.45 });
    // clipboard
    const cb = [
      pt(handR.x, handR.y - 15 * s),
      pt(handR.x + 17 * s, handR.y - 16 * s),
      pt(handR.x + 18 * s, handR.y + 8 * s),
      pt(handR.x, handR.y + 8 * s),
    ];
    sheet.poly(cb, { width: 1.3 * s, alpha: 0.8 });
    sheet.hatch(cb, { angle: -1.3, gap: 5 * s, alpha: 0.14, width: 0.7 });
    for (let i = 0; i < 3; i++) {
      sheet.line(handR.x + 3 * s, handR.y - 10 * s + i * 5 * s, handR.x + 14 * s, handR.y - 10 * s + i * 5 * s, {
        width: 0.75 * s,
        alpha: 0.4,
      });
    }
    return;
  }

  if (costume === "suitcase") {
    // the case bobs against the walk and the arm hangs heavier for it
    const bob = p.walking ? Math.abs(Math.cos(p.phase)) * 2.2 * s : 0;
    const x = handL.x - 13 * s;
    const y = handL.y + bob;
    const shape = [pt(x, y), pt(x + 27 * s, y - 1 * s), pt(x + 28 * s, y + 19 * s), pt(x + 1 * s, y + 20 * s)];
    sheet.poly(shape, { width: 1.5 * s, alpha: 0.85 });
    sheet.hatch(shape, { angle: -1.05, gap: 4 * s, alpha: 0.24, width: 0.8 });
    sheet.curve(
      [pt(x + 8 * s, y), pt(x + 13 * s, y - 9 * s), pt(x + 19 * s, y)],
      { width: 1.3 * s, alpha: 0.75 }
    );
    // travel stickers
    sheet.line(x + 5 * s, y + 8 * s, x + 24 * s, y + 7 * s, { width: 0.9 * s, alpha: 0.4 });
    return;
  }

  if (costume === "hardhat") {
    // tool belt, jiggling
    const jg = p.walking ? Math.sin(p.phase * 2) * 1.1 * s : 0;
    const px = hip.x - 12 * s * dir;
    const py = hip.y - 1 * s + jg;
    const pouch = [pt(px, py), pt(px + 13 * s, py), pt(px + 12 * s, py + 16 * s), pt(px + 1 * s, py + 16 * s)];
    sheet.poly(pouch, { width: 1.3 * s, alpha: 0.8 });
    sheet.hatch(pouch, { angle: -1.2, gap: 3.6 * s, alpha: 0.22, width: 0.75 });
    for (let i = 0; i < 3; i++) {
      sheet.line(px + 3 * s + i * 4 * s, py, px + 3 * s + i * 4 * s, py - (7 + i * 2) * s, {
        width: 1.05 * s,
        alpha: 0.6,
      });
    }
    return;
  }

  if (costume === "linux") {
    // laptop under the arm
    const lx = handR.x + 2 * s * dir;
    const ly = handR.y;
    const base = [pt(lx, ly), pt(lx + 24 * s, ly + 1 * s), pt(lx + 23 * s, ly + 14 * s), pt(lx, ly + 13 * s)];
    sheet.poly(base, { width: 1.35 * s, alpha: 0.82 });
    const lid = [pt(lx, ly), pt(lx + 8 * s, ly - 15 * s), pt(lx + 29 * s, ly - 14 * s), pt(lx + 24 * s, ly + 1 * s)];
    sheet.poly(lid, { width: 1.35 * s, alpha: 0.82 });
    sheet.hatch(lid, { angle: -0.75, gap: 3.6 * s, alpha: 0.2, width: 0.75 });
    // a penguin-ish blob on the lid
    sheet.ellipse(lx + 17 * s, ly - 8 * s, 3.2 * s, 3.8 * s, 0, { width: 1.1 * s, alpha: 0.6, ghost: 0 });
    sheet.ellipse(lx + 17 * s, ly - 5 * s, 2 * s, 1.5 * s, 0, { width: 1 * s, alpha: 0.55, ghost: 0 });
    return;
  }

  if (costume === "chef") {
    // a towel over the shoulder, lagging
    const sw = swingOf(p, 1, 1.1, 2.4 * s);
    sheet.curve(
      [
        pt(p.shoulder.x - 9 * s, p.shoulder.y + 4 * s),
        pt(p.shoulder.x - 13 * s + sw, p.shoulder.y + 14 * s),
        pt(p.shoulder.x - 11 * s + sw * 1.4, p.shoulder.y + 24 * s),
      ],
      { width: 1.4 * s, alpha: 0.66 }
    );
    return;
  }

  if (costume === "grad") {
    // the rolled diploma
    sheet.ellipse(handR.x + 5 * s * dir, handR.y, 4.6 * s, 11.4 * s, 0.5 * dir, {
      width: 1.3 * s,
      alpha: 0.8,
      ghost: 0.4,
    });
    return;
  }
}
