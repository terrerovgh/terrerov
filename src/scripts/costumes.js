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
import { chaikin, nudgeAll, hash, DENSITY } from "./charcoal.js";

/**
 * Cloth has no straight edges.
 *
 * Every garment here was a polygon: four or six corners with dead-straight lines
 * between them, which reads as a paper cut-out hung on him. A hem falls, a
 * shoulder rolls, a coat swings out where the leg pushes it.
 *
 * The edges are split into several points each FIRST, then every one of them is
 * pushed off, then the whole thing is rounded once. Rounding a bare
 * quadrilateral instead just shrinks it towards its middle — which is what
 * happened on the first attempt, and every garment quietly collapsed into a
 * small blob inside him.
 *
 * `slack` is how much the cloth gives: near 1 for a stiff apron, 2.5 for a gown.
 */
function cloth(points, seed, slack = 1.6) {
  const dense = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      dense.push(pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    }
  }
  return chaikin(nudgeAll(dense, seed, slack), true, 1);
}

/**
 * What he has on his legs.
 *
 * The legs are drawn as bare charcoal forms and the colour is rubbed into them
 * afterwards, which is the right way round: trousers at this size are not a
 * garment with its own silhouette, they are the leg with denim on it.
 */
export const LEGWEAR = {
  student: "denim",
  uni: "denim",
  dad: "denim",
  child: "denim",
  badge: "denim",
  hardhat: "denim",
  suitcase: "denim",
  linux: "denim",
  chef: "slate",
  grad: null,
};

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
    // A white apron is bare paper. The hatching that used to fill it was what
    // made it read as a grey pinafore — a white thing is drawn by leaving it
    // alone and putting the tone only where it turns away from the light.
    const hem = cloth(apron, 12.7, 1.5 * s);
    sheet.tone(hem, { angle: -1.5, width: 4.2 * s, alpha: DENSITY.soft, falloff: 0.92, from: 1 });
    sheet.blob(hem, { width: 1.6 * s, alpha: 0.86, seed: 12.7 });
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
    // a gown is the loosest thing he wears, so it gives the most
    const hem = cloth(gown, 28.3, 2.6 * s);
    sheet.wash(hem, { angle: -1.5, width: 4.4 * s, alpha: 0.2, pigment: "slate", seed: 28.3 });
    sheet.hatch(hem, { angle: -1.35, gap: 5.6 * s, alpha: DENSITY.mid, width: 0.8 });
    sheet.blob(hem, { width: 1.6 * s, alpha: 0.84, seed: 28.3 });
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
      const front = cloth(panel, 44.1 + side * 9, 1.3 * s);
      // the one properly loud thing he ever wears
      sheet.wash(front, { angle: -0.6, width: 3.6 * s, alpha: 0.34, pigment: "hiviz", seed: 44.1 });
      sheet.tone(front, { angle: -1.4, width: 3.8 * s, alpha: DENSITY.ghost, falloff: 0.8 });
      sheet.blob(front, { width: 1.5 * s, alpha: 0.82, seed: 44.1 + side * 9 });
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
    const hem = cloth(coat, 61.9, 2.2 * s);
    sheet.wash(hem, { angle: -1.4, width: 4.2 * s, alpha: 0.2, pigment: "rust", seed: 61.9 });
    sheet.tone(hem, { angle: -1.4, width: 4.2 * s, alpha: DENSITY.ghost, falloff: 0.75 });
    sheet.blob(hem, { width: 1.6 * s, alpha: 0.84, seed: 61.9 });
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
    const hem = cloth(body, 83.5, 1.9 * s);
    sheet.wash(hem, { angle: -0.5, width: 3.8 * s, alpha: 0.26, pigment: "slate", seed: 83.5 });
    sheet.tone(hem, { angle: -1.3, width: 3.8 * s, alpha: DENSITY.ghost, falloff: 0.7 });
    sheet.blob(hem, { width: 1.55 * s, alpha: 0.84, seed: 83.5 });
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
    sheet.hatch(board, { angle: -0.5, gap: 3.2 * s, alpha: DENSITY.firm, width: 0.7 });
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
    // White, so it is bare paper. The hatching that used to fill the dome was
    // the whole reason it read as a grey pot: a white object is drawn by leaving
    // it and darkening what is around and under it.
    const shell = dome.concat([pt(h.x, brow)]);
    sheet.tone(shell, { angle: -1.5, width: 3.2 * s, alpha: DENSITY.soft, falloff: 0.95, from: 1 });
    sheet.curve(dome, { width: 1.8 * s, alpha: 0.88 });
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

/**
 * A carried object with thickness.
 *
 * Everything he carried was the same flat quadrilateral with hatching in it — a
 * book, a clipboard, a suitcase, a laptop and a toolbox, all one hollow
 * rectangle stuck to his hand. A thing that size needs exactly two things to
 * stop reading as a card: one visible edge of thickness, and the planes that
 * turn away carrying more tone than the one facing you.
 *
 * `face` is the four corners facing the reader, clockwise from top left.
 */
function slab(sheet, face, depth, seed, s, o = {}) {
  const dir = o.dir ?? 1;
  const dx = depth * dir;
  const dy = -depth * 0.5;
  const off = (q) => pt(q.x + dx, q.y + dy);
  const [tl, tr, br] = face;
  const top = [tl, tr, off(tr), off(tl)];
  const side = [tr, br, off(br), off(tr)];
  const w = o.width ?? 1.35 * s;
  const a2 = o.alpha ?? 0.82;

  // The colour, if it has one, goes into the face and the two turned planes —
  // never into the outline, which stays charcoal like everything else.
  if (o.pigment) {
    sheet.wash(face, { angle: -0.9, width: 3 * s, alpha: o.ink ?? 0.24, pigment: o.pigment, seed });
    sheet.wash(side, { angle: -1.2, width: 3 * s, alpha: (o.ink ?? 0.24) * 1.15, pigment: o.pigment, seed: seed + 41 });
    sheet.wash(top, { angle: -0.4, width: 3 * s, alpha: (o.ink ?? 0.24) * 0.7, pigment: o.pigment, seed: seed + 83 });
  }
  sheet.poly(top, { width: w * 0.8, alpha: a2 * 0.86, seed: seed + 3.1 });
  sheet.tone(top, { angle: -0.4, width: 3 * s, alpha: DENSITY.soft, falloff: 0.6 });
  sheet.poly(side, { width: w * 0.8, alpha: a2 * 0.86, seed: seed + 7.3 });
  sheet.tone(side, { angle: -1.2, width: 3 * s, alpha: DENSITY.mid, falloff: 0.5 });
  sheet.hatch(side, { angle: -1.15, gap: 3.1 * s, alpha: DENSITY.mid, width: 0.7 });
  sheet.poly(face, { width: w, alpha: a2, seed });
  return face;
}

/**
 * A bag. Soft, so it sags: the bottom is pulled down by what is in it and the
 * sides bulge past where the seams are. Drawn as a rectangle a rucksack is just
 * a box with straps on it, which is what every bag here used to be.
 */
function softBag(sheet, cx, cy, w, h, seed, s, o = {}) {
  const bulge = o.bulge ?? 1;
  const shape = [
    pt(cx - w * 0.46, cy - h * 0.5),
    pt(cx + w * 0.46, cy - h * 0.5),
    pt(cx + w * (0.5 + 0.06 * bulge), cy - h * 0.1),
    pt(cx + w * 0.44, cy + h * 0.44),
    pt(cx, cy + h * (0.5 + 0.06 * bulge)),
    pt(cx - w * 0.44, cy + h * 0.44),
    pt(cx - w * (0.5 + 0.06 * bulge), cy - h * 0.1),
  ];
  const drawn = cloth(shape, seed, 1.1 * s);
  // Tone, and no hatching. Both together turned every bag into a grey smudge:
  // at this size the silhouette is doing all the work and anything laid inside
  // it only takes contrast away from the edge that has to read.
  if (o.pigment) {
    sheet.wash(drawn, { angle: -0.9, width: 4 * s, alpha: o.ink ?? 0.22, pigment: o.pigment, seed: seed + 57 });
  }
  sheet.tone(drawn, { angle: -1.1, width: 4 * s, alpha: DENSITY.soft, falloff: 0.72 });
  sheet.blob(drawn, { width: (o.width ?? 1.5) * s, alpha: o.alpha ?? 0.86, seed });
  return drawn;
}

export function drawProps(sheet, p, costume) {
  const s = p.scale;
  const { hip, neck, chest, handL, handR, dir } = p;

  if (costume === "student") {
    // backpack, swinging against the stride
    const sw = swingOf(p, 1, 1.2, 2.2 * s);
    const bx = chest.x - 15 * s * dir + sw;
    const by = chest.y + 18 * s;
    softBag(sheet, bx, by + 7 * s, 20 * s, 27 * s, 129.7, s, { bulge: 1.3, pigment: "rust" });
    // The straps take his weight, so they run OVER the shoulder and pull in at
    // the top rather than meeting the bag at a corner.
    for (const side of [-1, 1]) {
      sheet.curve(
        [
          pt(bx + side * 6 * s, by - 6 * s),
          pt(neck.x + side * 5 * s * dir, neck.y + 2 * s),
          pt(neck.x + side * 3 * s * dir + 3 * s * dir, neck.y + 9 * s),
        ],
        { width: 1.2 * s, alpha: 0.66 }
      );
    }
    // a book in the free hand, thick enough to have pages
    const bk = [
      pt(handR.x - 1, handR.y - 5 * s),
      pt(handR.x + 15 * s, handR.y - 6 * s),
      pt(handR.x + 15 * s, handR.y + 7 * s),
      pt(handR.x - 1, handR.y + 6 * s),
    ];
    slab(sheet, bk, 3.4 * s, 141.3, s, { dir, width: 1.25 * s, alpha: 0.78, pigment: "brick", ink: 0.2 });
    // the block of pages: a few edges, not one ruled line
    for (let i = 0; i < 3; i++) {
      sheet.line(handR.x + 2 * s, handR.y - 3.2 * s + i * 1.7 * s, handR.x + 13 * s, handR.y - 3.7 * s + i * 1.7 * s, {
        width: 0.7 * s,
        alpha: 0.34,
      });
    }
    return;
  }

  if (costume === "uni") {
    const sw = swingOf(p, 1, 1.4, 2.8 * s);
    const bag = pt(hip.x - 2 * s * dir + sw, hip.y - 2 * s);
    sheet.line(neck.x + 8 * s * dir, neck.y + 3 * s, bag.x - 13 * s, bag.y - 5 * s, {
      width: 1.35 * s,
      alpha: 0.7,
    });
    softBag(sheet, bag.x, bag.y + 5 * s, 31 * s, 22 * s, 167.1, s, { bulge: 0.8, width: 1.45, pigment: "rust" });
    // the flap, and the buckle holding it down — the one detail that says
    // satchel rather than sack
    sheet.curve(
      [
        pt(bag.x - 15 * s, bag.y - 3 * s),
        pt(bag.x, bag.y + 3 * s),
        pt(bag.x + 15 * s, bag.y - 4 * s),
      ],
      { width: 1.15 * s, alpha: 0.56 }
    );
    sheet.dot(bag.x + 1 * s, bag.y + 2.4 * s, 1.5 * s, { alpha: 0.5 });
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
    slab(sheet, badge, 1.6 * s, 183.9, s, { dir, width: 1.2 * s, alpha: 0.8 });
    sheet.line(bx - 3 * s, chest.y + 26 * s, bx + 4 * s, chest.y + 26 * s, { width: 0.8 * s, alpha: 0.45 });
    // clipboard
    const cb = [
      pt(handR.x, handR.y - 15 * s),
      pt(handR.x + 17 * s, handR.y - 16 * s),
      pt(handR.x + 18 * s, handR.y + 8 * s),
      pt(handR.x, handR.y + 8 * s),
    ];
    slab(sheet, cb, 2.6 * s, 197.3, s, { dir, width: 1.3 * s, alpha: 0.8, pigment: "rust", ink: 0.14 });
    // the clip at the top is what makes it a clipboard and not a slate
    sheet.box(handR.x + 5 * s, handR.y - 18 * s, 8 * s, 4 * s, { width: 1.05 * s, alpha: 0.66 });
    // written on, not ruled: the lines stop short and never twice the same
    for (let i = 0; i < 3; i++) {
      const run = (0.6 + hash(197 + i * 3.3) * 0.36) * 11 * s;
      sheet.line(handR.x + 3 * s, handR.y - 9 * s + i * 5 * s, handR.x + 3 * s + run, handR.y - 9.4 * s + i * 5 * s, {
        width: 0.72 * s,
        alpha: 0.38,
        wobble: 1.8,
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
    slab(sheet, shape, 5.2 * s, 211.7, s, { dir, width: 1.5 * s, alpha: 0.85, pigment: "rust", ink: 0.26 });
    // the seam round the middle, and the two catches either side of the handle
    sheet.line(x + 1 * s, y + 9 * s, x + 27 * s, y + 8 * s, { width: 0.95 * s, alpha: 0.42 });
    for (const cx of [8, 20]) {
      sheet.box(x + cx * s, y + 6.5 * s, 3.4 * s, 3.4 * s, { width: 0.85 * s, alpha: 0.5 });
    }
    sheet.curve(
      [pt(x + 9 * s, y), pt(x + 13.5 * s, y - 9 * s), pt(x + 19 * s, y)],
      { width: 1.6 * s, alpha: 0.78 }
    );
    return;
  }

  if (costume === "hardhat") {
    // tool belt, jiggling
    const jg = p.walking ? Math.sin(p.phase * 2) * 1.1 * s : 0;
    const px = hip.x - 12 * s * dir;
    const py = hip.y - 1 * s + jg;
    // leather, so it sags round what is in it
    softBag(sheet, px + 6.5 * s, py + 8 * s, 14 * s, 17 * s, 233.1, s, { bulge: 0.7, width: 1.3, pigment: "rust", ink: 0.26 });
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
    // black, so the chalk goes on heavy and the charcoal under it does the rest
    slab(sheet, base, 2.4 * s, 251.9, s, { dir, width: 1.35 * s, alpha: 0.82, pigment: "slate", ink: 0.34 });
    const lid = [pt(lx, ly), pt(lx + 8 * s, ly - 15 * s), pt(lx + 29 * s, ly - 14 * s), pt(lx + 24 * s, ly + 1 * s)];
    sheet.wash(lid, { angle: -0.75, width: 3.4 * s, alpha: 0.4, pigment: "slate", seed: 253.3 });
    sheet.tone(lid, { angle: -0.75, width: 3.4 * s, alpha: DENSITY.mid, falloff: 0.6 });
    sheet.hatch(lid, { angle: -0.75, gap: 3.6 * s, alpha: DENSITY.mid, width: 0.75 });
    sheet.poly(lid, { width: 1.35 * s, alpha: 0.82, seed: 253.3 });
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
