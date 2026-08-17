/**
 * One composed vignette per stage.
 *
 * The reference drawings are single framed scenes, not a continuous strip, and
 * that is what these are: a prop or two, drawn with real volume, sitting on the
 * same ground line he walks along. Three things give them depth —
 *
 *   - a background layer that moves slower and is drawn thinner and paler
 *   - isometric sides with hatching on anything box-shaped
 *   - a rubbed shadow pooling under every object
 *
 * Everything records into a Sheet, so a scene can be revealed stroke by stroke
 * as it is drawn in, and cached to a tile once it is complete.
 */

import { Sheet, hash } from "./charcoal.js";

function pt(x, y) {
  return { x, y };
}

/* --------------------------------------------------------------- pieces --- */

function shadow(sheet, x, groundY, w, alpha = 0.15) {
  sheet.smudge(x, groundY + 2, w, w * 0.11 + 2, 0, { alpha });
}

/**
 * A box with an isometric side and top.
 *
 * Three planes, three values: the front catches the light and stays almost
 * bare, the side turns away and takes tone plus hatching, the top sits between.
 * Giving each plane its own value is what makes a box read as solid instead of
 * as three rectangles sharing corners.
 */
function boxIso(sheet, x, y, w, h, depth, o = {}) {
  const a = { width: o.width ?? 1.6, alpha: o.alpha ?? 0.84 };
  const gap = o.gap ?? 4.4;
  const face = [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
  const side = [
    pt(x + w, y),
    pt(x + w + depth, y - depth * 0.55),
    pt(x + w + depth, y + h - depth * 0.55),
    pt(x + w, y + h),
  ];
  const top = [
    pt(x, y),
    pt(x + w, y),
    pt(x + w + depth, y - depth * 0.55),
    pt(x + depth, y - depth * 0.55),
  ];

  // faintest tone on the lit face, just enough that it is not blank paper
  sheet.tone(face, { angle: -1.45, width: gap * 1.5, alpha: 0.055, falloff: 0.85, from: 1 });
  sheet.poly(face, a);

  sheet.tone(side, { angle: -1.15, width: gap * 1.3, alpha: 0.2, falloff: 0.5 });
  sheet.poly(side, { ...a, width: a.width * 0.85 });
  sheet.hatch(side, { angle: -1.1, gap: gap * 1.15, alpha: 0.2, width: 0.8 });

  sheet.tone(top, { angle: -0.35, width: gap * 1.4, alpha: 0.1, falloff: 0.6 });
  sheet.poly(top, { ...a, width: a.width * 0.8 });

  // the corner where the two planes meet gets pressed
  sheet.accent(x + w, y + h * 0.5, h * 0.9, Math.PI / 2, { width: a.width * 1.15, alpha: 0.35 });
  return { face, side, top };
}

function palm(sheet, x, groundY, h) {
  const lean = (hash(x * 0.31) - 0.5) * 14;
  const top = groundY - h;
  sheet.curve([pt(x, groundY), pt(x + lean * 0.4, groundY - h * 0.55), pt(x + lean, top)], {
    width: 2.1,
    alpha: 0.82,
  });
  sheet.curve([pt(x + 4, groundY), pt(x + 4 + lean * 0.4, groundY - h * 0.55), pt(x + 4 + lean, top)], {
    width: 1.2,
    alpha: 0.4,
  });
  // trunk rings
  for (let i = 0; i < 7; i++) {
    const t = (i + 1) / 9;
    const yy = groundY - h * t;
    const xx = x + lean * t;
    sheet.line(xx - 2, yy, xx + 6, yy + 1.5, { width: 0.85, alpha: 0.36 });
  }
  const cx = x + lean + 2;
  for (let i = 0; i < 9; i++) {
    const a = -2.85 + i * 0.63;
    const len = h * (0.34 + hash(x + i * 2.3) * 0.12);
    sheet.curve(
      [
        pt(cx, top),
        pt(cx + Math.cos(a) * len * 0.5, top + Math.sin(a) * len * 0.16 - 9),
        pt(cx + Math.cos(a) * len, top + Math.sin(a) * len * 0.44 + 7),
      ],
      { width: 1.45, alpha: 0.72 }
    );
  }
  shadow(sheet, cx, groundY, 26, 0.13);
}

/**
 * Distant land. One long arc reads as a stray pencil line, so this is several
 * overlapping mounds of different sizes, the way a horizon actually sits.
 */
function hills(sheet, x, groundY, w) {
  // A horizon is mostly flat with a few low swells on it. Drawing separate
  // arcs makes loops that read as stray pencil; one continuous silhouette
  // built from a handful of gaussian bumps reads as land.
  const bumps = [
    [0.16, 0.1, 30],
    [0.38, 0.07, 19],
    [0.58, 0.13, 41],
    [0.8, 0.08, 24],
  ];
  const pts = [];
  const n = 46;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let rise = 0;
    for (const [c, wd, amp] of bumps) {
      const d = (t - c) / wd;
      rise += amp * Math.exp(-d * d);
    }
    pts.push(pt(x + w * t, groundY - 7 - rise));
  }
  sheet.curve(pts, { width: 1.15, alpha: 0.26, search: 0, grain: 0.3, wobble: 0.7 });
}

function house(sheet, x, groundY, s = 1) {
  const w = 150 * s;
  const h = 78 * s;
  const base = groundY - 3;
  boxIso(sheet, x, base - h, w, h, 26 * s, { gap: 5.4 });
  // pitched roof
  sheet.line(x - 7, base - h, x + w / 2, base - h - 38 * s, { width: 1.7, alpha: 0.85 });
  sheet.line(x + w / 2, base - h - 38 * s, x + w + 7, base - h, { width: 1.7, alpha: 0.85 });
  const roof = [pt(x - 7, base - h), pt(x + w / 2, base - h - 38 * s), pt(x + w + 7, base - h)];
  sheet.tone(roof, { angle: -1.35, width: 5 * s, alpha: 0.16, falloff: 0.6 });
  sheet.hatch(roof, { angle: -1.35, gap: 5.6 * s, alpha: 0.2, width: 0.8 });
  sheet.box(x + w * 0.42, base - 34 * s, 17 * s, 34 * s, { width: 1.3, alpha: 0.76 });
  sheet.box(x + 14 * s, base - 46 * s, 19 * s, 17 * s, { width: 1.2, alpha: 0.7 });
  sheet.box(x + w - 34 * s, base - 46 * s, 19 * s, 17 * s, { width: 1.2, alpha: 0.7 });
  shadow(sheet, x + w * 0.5, groundY, w * 0.62);
}

function books(sheet, x, groundY) {
  const stack = [
    [0, -3, 30, 9, -0.07],
    [6, -12, 26, 8, 0.11],
    [2, -20, 22, 7, -0.16],
  ];
  for (const [bx, by, w, h, rot] of stack) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const cx = x + bx;
    const cy = groundY + by;
    const corners = [pt(-w / 2, -h), pt(w / 2, -h), pt(w / 2, 0), pt(-w / 2, 0)].map((p) =>
      pt(cx + p.x * cos - p.y * sin, cy + p.x * sin + p.y * cos)
    );
    sheet.poly(corners, { width: 1.4, alpha: 0.8 });
    sheet.hatch(corners, { angle: rot - 1.4, gap: 3.2, alpha: 0.2, width: 0.7 });
    sheet.line(corners[0].x + 3, corners[0].y + 2.5, corners[1].x - 3, corners[1].y + 2.5, {
      width: 0.85,
      alpha: 0.45,
    });
  }
  shadow(sheet, x, groundY, 30);
}

function classroom(sheet, x, groundY) {
  // a blackboard on legs and a desk
  boxIso(sheet, x + 74, groundY - 74, 60, 42, 14);
  sheet.line(x + 80, groundY - 66, x + 128, groundY - 66, { width: 0.9, alpha: 0.44 });
  sheet.line(x + 80, groundY - 56, x + 120, groundY - 56, { width: 0.9, alpha: 0.44 });
  sheet.line(x + 80, groundY - 46, x + 124, groundY - 46, { width: 0.9, alpha: 0.44 });
  sheet.line(x + 84, groundY - 32, x + 84, groundY, { width: 1.2, alpha: 0.7 });
  sheet.line(x + 126, groundY - 32, x + 126, groundY, { width: 1.2, alpha: 0.7 });
  boxIso(sheet, x, groundY - 34, 52, 34, 16);
  shadow(sheet, x + 26, groundY, 40);
  shadow(sheet, x + 104, groundY, 44);
}

/** A gateway, tall enough to walk through — not a bump on the ground. */
function arch(sheet, x, groundY) {
  const r = 74;
  const rise = 58;
  const springs = groundY - rise;
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const a = Math.PI + t * Math.PI;
    pts.push(pt(x + r + Math.cos(a) * r, springs + Math.sin(a) * r * 0.92));
  }
  sheet.curve(pts, { width: 2.2, alpha: 0.84 });
  sheet.curve(
    pts.map((p, i) => pt(p.x + (i - 10) * 0.2, p.y + 11)),
    { width: 1.25, alpha: 0.34, search: 0 }
  );
  // the piers it stands on
  const pierL = [pt(x - 7, springs), pt(x + 8, springs), pt(x + 8, groundY), pt(x - 7, groundY)];
  const pierR = [
    pt(x + 2 * r - 8, springs),
    pt(x + 2 * r + 7, springs),
    pt(x + 2 * r + 7, groundY),
    pt(x + 2 * r - 8, groundY),
  ];
  for (const pier of [pierL, pierR]) {
    sheet.poly(pier, { width: 1.8, alpha: 0.82 });
    sheet.hatch(pier, { angle: -1.3, gap: 6, alpha: 0.16, width: 0.75 });
  }
  // caps thrown in the air
  for (let i = 0; i < 8; i++) {
    const cx = x - 40 + hash(i * 3.2) * 250;
    const cy = springs - r * 0.8 - hash(i * 7.1) * 96;
    sheet.line(cx - 6, cy, cx + 6, cy - 2, { width: 1.15, alpha: 0.46 });
    sheet.line(cx, cy + 1, cx + 4, cy + 6, { width: 0.9, alpha: 0.36 });
  }
  shadow(sheet, x + r, groundY, 60);
}

function office(sheet, x, groundY) {
  boxIso(sheet, x, groundY - 44, 74, 44, 20);
  // a monitor on top
  boxIso(sheet, x + 12, groundY - 80, 38, 30, 12, { gap: 3.6 });
  sheet.box(x + 18, groundY - 73, 26, 17, { width: 1, alpha: 0.6 });
  for (let i = 0; i < 4; i++) {
    sheet.line(x + 21, groundY - 69 + i * 4, x + 21 + 8 + hash(i * 5.3) * 12, groundY - 69 + i * 4, {
      width: 0.7,
      alpha: 0.38,
    });
  }
  sheet.line(x + 22, groundY - 50, x + 42, groundY - 50, { width: 1.15, alpha: 0.6 });
  // ledgers stacked beside it
  for (let i = 0; i < 4; i++) {
    sheet.box(x + 84, groundY - 12 - i * 9, 32, 8, { width: 1.05, alpha: 0.66 });
  }
  shadow(sheet, x + 40, groundY, 56);
  shadow(sheet, x + 100, groundY, 22, 0.1);
}

/**
 * The hero prop. It has to stand taller than he does, or the six years it
 * stands for do not read. Dish on a mast, on a tapering tower, next to a rack.
 */
function radar(sheet, x, groundY) {
  const cx = x + 62;
  const deck = groundY - 150;

  // tapering lattice tower
  const legL = (t) => pt(x + 30 + 16 * t, groundY + (deck - groundY) * t);
  const legR = (t) => pt(x + 94 - 16 * t, groundY + (deck - groundY) * t);
  sheet.line(legL(0).x, legL(0).y, legL(1).x, legL(1).y, { width: 2, alpha: 0.85 });
  sheet.line(legR(0).x, legR(0).y, legR(1).x, legR(1).y, { width: 2, alpha: 0.85 });
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    sheet.line(legL(t).x, legL(t).y, legR(t).x, legR(t).y, { width: 0.95, alpha: 0.42 });
    // cross bracing
    const t2 = (i - 1) / 6;
    sheet.line(legL(t2).x, legL(t2).y, legR(t).x, legR(t).y, { width: 0.8, alpha: 0.28 });
    sheet.line(legR(t2).x, legR(t2).y, legL(t).x, legL(t).y, { width: 0.8, alpha: 0.28 });
  }
  const deckShape = [
    pt(x + 34, deck),
    pt(x + 90, deck),
    pt(x + 96, deck + 13),
    pt(x + 28, deck + 13),
  ];
  sheet.poly(deckShape, { width: 1.5, alpha: 0.8 });
  sheet.hatch(deckShape, { angle: -0.5, gap: 3.6, alpha: 0.22, width: 0.7 });
  // railing
  for (let i = 0; i <= 6; i++) {
    const px = x + 34 + i * 9.4;
    sheet.line(px, deck, px, deck - 11, { width: 0.85, alpha: 0.4 });
  }
  sheet.line(x + 32, deck - 11, x + 92, deck - 12, { width: 1.05, alpha: 0.5 });

  // the mast and the dish, tilted up at the sky
  const mastTop = deck - 46;
  sheet.line(cx, deck - 8, cx, mastTop, { width: 1.7, alpha: 0.8 });
  const tilt = -0.52;
  const rx = 58;
  const ry = 22;
  sheet.ellipse(cx + 12, mastTop - 16, rx, ry, tilt, { width: 1.9, alpha: 0.88, ghost: 0.45 });
  const face = [];
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    face.push(pt(cx + 12 + px * Math.cos(tilt) - py * Math.sin(tilt), mastTop - 16 + px * Math.sin(tilt) + py * Math.cos(tilt)));
  }
  sheet.tone(face, { angle: tilt + 1.5, width: 5.4, alpha: 0.17, falloff: 0.8 });
  sheet.hatch(face, { angle: tilt + 1.5, gap: 6, alpha: 0.17, width: 0.8 });
  // the bowl's depth, and the feed arm out front
  sheet.curve(
    [pt(cx + 12 - rx * 0.86, mastTop - 16 + rx * 0.46), pt(cx + 16, mastTop + 6), pt(cx + 12 + rx * 0.86, mastTop - 16 - rx * 0.42)],
    { width: 1.3, alpha: 0.5 }
  );
  sheet.line(cx + 12, mastTop - 16, cx + 40, mastTop - 52, { width: 1.35, alpha: 0.7 });
  sheet.line(cx + 40, mastTop - 52, cx + 30, mastTop - 56, { width: 1.15, alpha: 0.6 });
  sheet.line(cx + 40, mastTop - 52, cx + 48, mastTop - 46, { width: 1.15, alpha: 0.6 });

  // the rack of machines beside it
  const rrx = x + 132;
  boxIso(sheet, rrx, groundY - 118, 52, 118, 24, { gap: 4 });
  for (let i = 0; i < 9; i++) {
    const y = groundY - 110 + i * 12;
    sheet.box(rrx + 6, y, 40, 8, { width: 0.95, alpha: 0.6 });
    for (let d = 0; d < 3; d++) {
      sheet.dot(rrx + 34 + d * 4.5, y + 4, 1.1, { alpha: d === 1 ? 0.75 : 0.4 });
    }
  }
  shadow(sheet, cx, groundY, 60);
  shadow(sheet, rrx + 30, groundY, 46);
}

function plane(sheet, x, y) {
  // fuselage
  sheet.curve(
    [pt(x - 42, y + 3), pt(x - 10, y - 4), pt(x + 30, y - 3), pt(x + 46, y + 2)],
    { width: 1.6, alpha: 0.72 }
  );
  sheet.curve([pt(x - 42, y + 3), pt(x - 8, y + 9), pt(x + 30, y + 8), pt(x + 46, y + 2)], {
    width: 1.5,
    alpha: 0.68,
  });
  // swept wing and tailplane
  const wing = [pt(x - 4, y + 2), pt(x + 24, y + 22), pt(x + 34, y + 22), pt(x + 14, y + 1)];
  sheet.poly(wing, { width: 1.3, alpha: 0.62 });
  sheet.hatch(wing, { angle: -0.7, gap: 4.5, alpha: 0.16, width: 0.7 });
  const tail = [pt(x - 40, y + 2), pt(x - 30, y - 18), pt(x - 22, y - 18), pt(x - 26, y + 1)];
  sheet.poly(tail, { width: 1.25, alpha: 0.6 });
  // windows
  for (let i = 0; i < 6; i++) {
    sheet.dot(x - 22 + i * 10, y + 1, 1.1, { alpha: 0.34 });
  }
  // vapour trail, thinning out behind
  for (let i = 0; i < 8; i++) {
    sheet.line(x - 58 - i * 34, y + 5 + i * 2.2, x - 80 - i * 34, y + 7 + i * 2.2, {
      width: 1.3 - i * 0.1,
      alpha: 0.2 - i * 0.022,
      search: 0,
    });
  }
}

/** Flat-bottomed clouds: a run of arcs sitting on one level line. */
function clouds(sheet, x, y, n = 3) {
  for (let k = 0; k < n; k++) {
    const cx = x + k * 210 + hash(k * 3.7) * 70;
    const cy = y + hash(k * 7.3) * 80;
    const s = 0.75 + hash(k * 2.1) * 0.55;
    const puffs = [
      [-36 * s, 20 * s],
      [-8 * s, 27 * s],
      [20 * s, 21 * s],
    ];
    const pts = [];
    for (const [ox, r] of puffs) {
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        pts.push(pt(cx + ox + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8));
      }
    }
    sheet.curve(pts, { width: 1.2, alpha: 0.22, search: 0, grain: 0.3, seed: cx });
    sheet.line(cx - 56 * s, cy, cx + 42 * s, cy + 1, { width: 1.05, alpha: 0.18, search: 0 });
  }
}

function frameHouse(sheet, x, groundY) {
  const w = 170;
  const h = 92;
  sheet.line(x, groundY, x + w, groundY + 1, { width: 1.5, alpha: 0.72 });
  sheet.line(x, groundY, x, groundY - h, { width: 1.6, alpha: 0.82 });
  sheet.line(x + w, groundY, x + w, groundY - h, { width: 1.6, alpha: 0.82 });
  sheet.line(x, groundY - h, x + w / 2, groundY - h - 36, { width: 1.6, alpha: 0.82 });
  sheet.line(x + w, groundY - h, x + w / 2, groundY - h - 36, { width: 1.6, alpha: 0.82 });
  for (let i = 1; i < 6; i++) {
    const xx = x + (w * i) / 6;
    sheet.line(xx, groundY, xx, groundY - h, { width: 1.1, alpha: 0.52 });
  }
  for (let i = 1; i < 4; i++) {
    sheet.line(x + (w * i) / 4, groundY - h, x + w / 2, groundY - h - 36, { width: 1.05, alpha: 0.44 });
  }
  sheet.line(x + 12, groundY - h * 0.55, x + w - 12, groundY - h * 0.55, { width: 1.05, alpha: 0.44 });
  // a ladder leaning on it
  sheet.line(x + w + 16, groundY, x + w - 6, groundY - h - 6, { width: 1.4, alpha: 0.7 });
  sheet.line(x + w + 26, groundY, x + w + 4, groundY - h - 6, { width: 1.4, alpha: 0.7 });
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    sheet.line(
      x + w + 16 + (-22) * t,
      groundY + (-h - 6) * t,
      x + w + 26 + (-22) * t,
      groundY + (-h - 6) * t,
      { width: 0.95, alpha: 0.5 }
    );
  }
  shadow(sheet, x + w * 0.5, groundY, w * 0.55);
}

function stove(sheet, x, groundY) {
  boxIso(sheet, x, groundY - 46, 50, 46, 18);
  sheet.box(x + 10, groundY - 30, 22, 17, { width: 1.1, alpha: 0.62 });
  sheet.dot(x + 21, groundY - 38, 2, { alpha: 0.6 });
  sheet.dot(x + 34, groundY - 38, 2, { alpha: 0.6 });
  // a pan on the hob with steam
  sheet.ellipse(x + 24, groundY - 58, 17, 4, 0, { width: 1.35, alpha: 0.76, ghost: 0.3 });
  sheet.line(x + 41, groundY - 58, x + 55, groundY - 62, { width: 1.25, alpha: 0.68 });
  for (let i = 0; i < 3; i++) {
    const sx = x + 14 + i * 9;
    sheet.curve(
      [pt(sx, groundY - 64), pt(sx + 7, groundY - 78), pt(sx - 3, groundY - 92), pt(sx + 5, groundY - 106)],
      { width: 1.1, alpha: 0.26 - i * 0.04, search: 0 }
    );
  }
  shadow(sheet, x + 25, groundY, 40);
}

function panels(sheet, x, groundY) {
  // a row of trackers, all tilted the same way toward the sun
  for (let i = 0; i < 4; i++) {
    const px = x + i * 84;
    const s = 1.25 - i * 0.09;
    const w = 68 * s;
    const h = 40 * s;
    const tilt = -0.24;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const oy = groundY - 26 - h;
    const face = [pt(0, 0), pt(w, 0), pt(w, h), pt(0, h)].map((p) =>
      pt(px + p.x * cos - p.y * sin, oy + p.x * sin + p.y * cos)
    );
    sheet.poly(face, { width: 1.4, alpha: 0.8 });
    sheet.tone(face, { angle: tilt - 1.25, width: 4.6 * s, alpha: 0.14, falloff: 0.85, from: 1 });
    sheet.hatch(face, { angle: tilt - 1.25, gap: 4.8 * s, alpha: 0.15, width: 0.75 });
    for (let r = 1; r < 3; r++) {
      const a = face[0];
      const b = face[1];
      const c = face[3];
      const t = r / 3;
      sheet.line(
        a.x + (c.x - a.x) * t,
        a.y + (c.y - a.y) * t,
        b.x + (c.x - a.x) * t,
        b.y + (c.y - a.y) * t,
        { width: 0.8, alpha: 0.36 }
      );
    }
    const post = px + w * 0.42;
    sheet.line(post, groundY - 26, post, groundY, { width: 1.6, alpha: 0.78 });
    shadow(sheet, post, groundY, 22, 0.12);
  }
  // the sun they are all following
  sheet.circle(x + 150, groundY - 240, 22, { width: 1.4, alpha: 0.36, ghost: 0.3 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    sheet.line(
      x + 150 + Math.cos(a) * 30,
      groundY - 240 + Math.sin(a) * 30,
      x + 150 + Math.cos(a) * 40,
      groundY - 240 + Math.sin(a) * 40,
      { width: 1, alpha: 0.24, search: 0 }
    );
  }
}

function terminals(sheet, x, groundY) {
  const wins = [
    [x - 76, groundY - 156, 58, 40],
    [x - 18, groundY - 200, 64, 44],
    [x + 54, groundY - 168, 54, 38],
    [x + 96, groundY - 112, 60, 42],
    [x - 96, groundY - 96, 52, 36],
  ];
  wins.forEach(([wx, wy, ww, wh], k) => {
    const face = [pt(wx, wy), pt(wx + ww, wy), pt(wx + ww, wy + wh), pt(wx, wy + wh)];
    sheet.poly(face, { width: 1.3, alpha: 0.72 - k * 0.05 });
    sheet.line(wx, wy + 9, wx + ww, wy + 9, { width: 0.95, alpha: 0.45 });
    sheet.dot(wx + 6, wy + 4.5, 1.5, { alpha: 0.55 });
    sheet.dot(wx + 12, wy + 4.5, 1.5, { alpha: 0.4 });
    sheet.dot(wx + 18, wy + 4.5, 1.5, { alpha: 0.4 });
    for (let i = 0; i < 4; i++) {
      const lw = (0.3 + hash(wx + i * 3.3) * 0.6) * (ww - 12);
      sheet.line(wx + 6, wy + 17 + i * 6, wx + 6 + lw, wy + 17 + i * 6, { width: 0.75, alpha: 0.34 });
    }
  });
}


/** Birds: two strokes each, the way everyone draws them. */
function birds(sheet, x, y, n = 4) {
  for (let i = 0; i < n; i++) {
    const bx = x + i * 46 + hash(i * 3.1) * 30;
    const by = y + hash(i * 7.7) * 52;
    const w = 7 + hash(i * 2.3) * 5;
    sheet.curve([pt(bx - w, by), pt(bx, by - w * 0.45), pt(bx + w, by)], {
      width: 1.05,
      alpha: 0.26,
      search: 0,
    });
  }
}

/** A line of poles with wires sagging between them. */
function wires(sheet, x, groundY, n = 4, gap = 150) {
  for (let i = 0; i < n; i++) {
    const px = x + i * gap;
    sheet.line(px, groundY, px, groundY - 92, { width: 1.2, alpha: 0.3 });
    sheet.line(px - 12, groundY - 78, px + 12, groundY - 79, { width: 1, alpha: 0.26 });
    if (i < n - 1) {
      sheet.curve(
        [pt(px, groundY - 76), pt(px + gap * 0.5, groundY - 56), pt(px + gap, groundY - 76)],
        { width: 0.9, alpha: 0.22, search: 0 }
      );
    }
  }
}

/** Scrub and stones along the ground, so the line is not bare. */
function scrub(sheet, x, groundY, w, n = 9, seed = 1) {
  for (let i = 0; i < n; i++) {
    const sx = x + (w * i) / n + hash(seed + i * 3.7) * 26;
    const h = 5 + hash(seed + i * 5.3) * 9;
    if (hash(seed + i * 9.1) > 0.55) {
      for (let b = -1; b <= 1; b++) {
        sheet.line(sx + b * 2.4, groundY, sx + b * 4.5, groundY - h, { width: 0.95, alpha: 0.34 });
      }
    } else {
      sheet.ellipse(sx, groundY - 2, 3.6, 2.2, 0, { width: 1, alpha: 0.34, ghost: 0 });
    }
  }
}

/* ---------------------------------------------------------------- scenes --- */

/**
 * Each scene builds into two sheets: `back` drifts slower and paler, `front`
 * sits on the ground line with him.
 *
 * Coordinates are relative to the stop, where he comes to a halt. He occupies
 * roughly -60 to +60, so foreground props start past +90 and the composition
 * reads the way the reference drawings do: figure on the left, the thing he is
 * looking at on the right.
 */
const CLEAR = 100;

export const SCENES = {
  origen(back, front, groundY) {
    hills(back, -320, groundY, 900);
    wires(back, -260, groundY, 3, 190);
    birds(back, CLEAR + 190, groundY - 300, 4);
    scrub(front, -300, groundY, 900, 12, 3);
    palm(back, CLEAR + 210, groundY, 116);
    house(front, CLEAR + 20, groundY, 1.0);
    palm(front, CLEAR + 5, groundY, 150);
  },
  escuela(back, front, groundY) {
    hills(back, -280, groundY, 760);
    birds(back, CLEAR + 240, groundY - 280, 3);
    scrub(front, -280, groundY, 760, 9, 7);
    classroom(back, CLEAR + 150, groundY);
    books(front, CLEAR + 20, groundY);
    books(front, CLEAR + 96, groundY);
  },
  universidad(back, front, groundY) {
    arch(back, CLEAR + 190, groundY);
    classroom(front, CLEAR + 10, groundY);
  },
  padre(back, front, groundY) {
    house(back, CLEAR + 150, groundY, 0.7);
    // a small chair and a ball: the furniture of a young family
    front.box(CLEAR + 10, groundY - 26, 22, 26, { width: 1.3, alpha: 0.72 });
    front.line(CLEAR + 10, groundY - 26, CLEAR + 10, groundY - 46, { width: 1.3, alpha: 0.72 });
    front.line(CLEAR + 32, groundY - 26, CLEAR + 32, groundY - 46, { width: 1.3, alpha: 0.72 });
    front.line(CLEAR + 10, groundY - 46, CLEAR + 32, groundY - 45, { width: 1.2, alpha: 0.66 });
    front.circle(CLEAR + 66, groundY - 9, 9, { width: 1.35, alpha: 0.74 });
    shadow(front, CLEAR + 66, groundY, 13, 0.12);
    shadow(front, CLEAR + 21, groundY, 18, 0.12);
  },
  grado(back, front, groundY) {
    arch(front, CLEAR + 10, groundY);
  },
  economia(back, front, groundY) {
    wires(back, CLEAR + 220, groundY, 3, 160);
    office(front, CLEAR + 10, groundY);
  },
  radares(back, front, groundY) {
    hills(back, -340, groundY, 940);
    birds(back, CLEAR + 330, groundY - 320, 3);
    scrub(front, -320, groundY, 940, 11, 13);
    radar(front, CLEAR, groundY);
  },
  viaje(back, front, groundY) {
    hills(back, -300, groundY, 860);
    birds(back, CLEAR - 60, groundY - 260, 3);
    scrub(front, -280, groundY, 860, 10, 37);
    clouds(back, CLEAR - 40, groundY - 300, 3);
    plane(back, CLEAR + 250, groundY - 210);
    // a signpost pointing the way out, nothing written on it
    front.line(CLEAR + 40, groundY, CLEAR + 40, groundY - 78, { width: 1.7, alpha: 0.78 });
    const board = [
      pt(CLEAR + 40, groundY - 78),
      pt(CLEAR + 96, groundY - 76),
      pt(CLEAR + 110, groundY - 66),
      pt(CLEAR + 96, groundY - 56),
      pt(CLEAR + 40, groundY - 58),
    ];
    front.poly(board, { width: 1.3, alpha: 0.74 });
    front.hatch(board, { angle: -1.2, gap: 5, alpha: 0.14, width: 0.7 });
    shadow(front, CLEAR + 40, groundY, 16, 0.12);
  },
  oficios(back, front, groundY) {
    hills(back, -280, groundY, 780);
    wires(back, CLEAR + 260, groundY, 3, 170);
    frameHouse(front, CLEAR + 10, groundY);
    scrub(front, -260, groundY, 700, 8, 21);
  },
  cocina(back, front, groundY) {
    // a shelf of pans behind
    back.line(CLEAR + 150, groundY - 124, CLEAR + 280, groundY - 126, { width: 1.3, alpha: 0.38 });
    for (let i = 0; i < 3; i++) {
      back.ellipse(CLEAR + 172 + i * 40, groundY - 112, 13, 5, 0, { width: 1.1, alpha: 0.32, ghost: 0 });
      back.line(CLEAR + 185 + i * 40, groundY - 112, CLEAR + 197 + i * 40, groundY - 115, {
        width: 0.9,
        alpha: 0.28,
      });
    }
    stove(front, CLEAR + 20, groundY);
  },
  solar(back, front, groundY) {
    hills(back, -340, groundY, 940);
    scrub(front, -320, groundY, 940, 14, 29);
    panels(front, CLEAR, groundY);
  },
  linux(back, front, groundY) {
    terminals(back, CLEAR + 170, groundY);
  },
  cierre(back, front, groundY) {
    terminals(back, CLEAR + 190, groundY);
    // a mailbox, flag up
    front.box(CLEAR + 20, groundY - 46, 32, 23, { width: 1.4, alpha: 0.78 });
    front.line(CLEAR + 36, groundY - 23, CLEAR + 36, groundY, { width: 1.5, alpha: 0.76 });
    front.line(CLEAR + 52, groundY - 42, CLEAR + 60, groundY - 55, { width: 1.2, alpha: 0.66 });
    front.line(CLEAR + 60, groundY - 55, CLEAR + 66, groundY - 51, { width: 1.1, alpha: 0.6 });
    shadow(front, CLEAR + 36, groundY, 20, 0.12);
  },
};

/**
 * Build the two layers for a stage. The ground sits at y = 0 and everything
 * stands on it, so the caller is free to scale the whole scene with the figure
 * and drop it wherever the horizon happens to be.
 */
export function sceneSheets(stageId, seed) {
  const back = new Sheet(seed * 3.1 + 11);
  const front = new Sheet(seed * 5.7 + 29);
  const fn = SCENES[stageId];
  if (fn) fn(back, front, 0);
  return { back, front };
}
