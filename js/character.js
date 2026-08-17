import { sketchCircle, sketchEllipse, sketchLine, hatch, pencilStroke } from "./pencil.js";

const TWO_PI = Math.PI * 2;

function pt(x, y) {
  return { x, y };
}

function down(from, len, angle) {
  return pt(from.x + Math.sin(angle) * len, from.y + Math.cos(angle) * len);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Half-stride at scale 1. Full cycle (two steps) = 4 × STEP world units. */
export const STEP = 30;

export function cycleLength(scale) {
  return STEP * Math.max(0.9, scale) * 4;
}

function wrap01(phase, offset) {
  const p = (((phase + offset) % TWO_PI) + TWO_PI) % TWO_PI;
  return p / TWO_PI;
}

function footTarget(t, step, lift, dir) {
  const stance = 0.56;
  if (t < stance) {
    const u = t / stance;
    return { x: lerp(step, -step, u) * dir, y: 0 };
  }
  const u = (t - stance) / (1 - stance);
  const e = smooth(u);
  return {
    x: lerp(-step, step, e) * dir,
    y: -Math.pow(Math.sin(u * Math.PI), 0.62) * lift,
  };
}

function ikKnee(hip, foot, thigh, shin, dir) {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  let d = Math.hypot(dx, dy);
  if (d < 0.001) return pt(hip.x, hip.y + thigh);
  const max = thigh + shin - 0.6;
  if (d >= max) {
    const k = thigh / (thigh + shin);
    return pt(hip.x + dx * k, hip.y + dy * k);
  }
  const min = Math.abs(thigh - shin) + 0.6;
  if (d < min) d = min;
  const a = (thigh * thigh - shin * shin + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, thigh * thigh - a * a));
  const nx = dx / d;
  const ny = dy / d;
  let px = ny;
  let py = -nx;
  if (dir < 0) {
    px = -px;
    py = -py;
  }
  return pt(hip.x + nx * a + px * h, hip.y + ny * a + py * h);
}

function hatKind(costume) {
  if (costume === "grad") return "grad";
  if (costume === "hardhat") return "hardhat";
  if (costume === "soldier") return "soldier";
  if (costume === "chef") return "chef";
  return null;
}

function drawHat(ctx, head, r, kind, dir, s) {
  if (kind === "grad") {
    const top = head.y - r * 0.9;
    sketchLine(ctx, head.x - r * 0.52, head.y - r * 0.18, head.x - r * 0.48, top, 1.55, 21);
    sketchLine(ctx, head.x + r * 0.52, head.y - r * 0.18, head.x + r * 0.48, top, 1.55, 22);
    sketchLine(ctx, head.x - r * 0.48, top, head.x + r * 0.48, top, 1.55, 23);
    sketchLine(ctx, head.x - r * 1.22, top - 1, head.x + r * 1.22, top - 1.4, 1.7, 24);
    sketchLine(ctx, head.x - r * 1.18, top - r * 0.22, head.x + r * 1.18, top - r * 0.2, 1.5, 25);
    sketchLine(ctx, head.x - r * 1.22, top - 1, head.x - r * 1.18, top - r * 0.22, 1.4, 26);
    sketchLine(ctx, head.x + r * 1.22, top - 1.4, head.x + r * 1.18, top - r * 0.2, 1.4, 27);
    sketchLine(ctx, head.x + r * 0.72 * dir, top - 2, head.x + r * 1.42 * dir, top + r * 0.52, 1.25, 28);
    sketchEllipse(ctx, head.x + r * 1.42 * dir, top + r * 0.6, 3.1 * s, 4.3 * s, 0.2, true, 29);
  }
  if (kind === "hardhat") {
    const pts = [
      pt(head.x - r * 1.08, head.y - r * 0.08),
      pt(head.x - r * 0.7, head.y - r * 1.05),
      pt(head.x, head.y - r * 1.32),
      pt(head.x + r * 0.7, head.y - r * 1.05),
      pt(head.x + r * 1.08, head.y - r * 0.08),
    ];
    pencilStroke(ctx, pts, { width: 1.8, seed: 31 });
    sketchLine(ctx, head.x - r * 1.38, head.y - r * 0.06, head.x + r * 1.5 * dir, head.y - r * 0.16, 1.7, 32);
    sketchLine(ctx, head.x - r * 0.15, head.y - r * 1.28, head.x + r * 0.35, head.y - r * 1.1, 1.2, 33);
  }
  if (kind === "soldier") {
    sketchLine(ctx, head.x - r * 0.88, head.y - r * 0.18, head.x - r * 0.76, head.y - r * 1.02, 1.65, 34);
    sketchLine(ctx, head.x - r * 0.76, head.y - r * 1.02, head.x + r * 0.58, head.y - r * 1.06, 1.65, 35);
    sketchLine(ctx, head.x + r * 0.58, head.y - r * 1.06, head.x + r * 0.86, head.y - r * 0.18, 1.65, 36);
    sketchLine(ctx, head.x - r * 0.88, head.y - r * 0.18, head.x + r * 0.86, head.y - r * 0.18, 1.5, 37);
    sketchLine(ctx, head.x + r * 0.2 * dir, head.y - r * 0.18, head.x + r * 1.38 * dir, head.y - r * 0.1, 1.6, 38);
  }
  if (kind === "chef") {
    sketchLine(ctx, head.x - r * 0.55, head.y - r * 0.48, head.x - r * 0.55, head.y - r * 1.02, 1.55, 39);
    sketchLine(ctx, head.x + r * 0.55, head.y - r * 0.48, head.x + r * 0.55, head.y - r * 1.02, 1.55, 40);
    sketchLine(ctx, head.x - r * 0.55, head.y - r * 0.48, head.x + r * 0.55, head.y - r * 0.48, 1.5, 41);
    const puff = [
      pt(head.x - r * 0.55, head.y - r * 1.02),
      pt(head.x - r * 1.05, head.y - r * 1.55),
      pt(head.x - r * 0.35, head.y - r * 2.05),
      pt(head.x + r * 0.45, head.y - r * 2.0),
      pt(head.x + r * 1.05, head.y - r * 1.5),
      pt(head.x + r * 0.55, head.y - r * 1.02),
    ];
    pencilStroke(ctx, puff, { width: 1.65, seed: 42 });
  }
}

function mitten(ctx, x, y, dir, s) {
  sketchEllipse(ctx, x, y, 4.6 * s, 3.7 * s, 0.25 * dir, false, 50);
  sketchEllipse(ctx, x + 3.2 * dir * s, y - 1.4 * s, 2.1 * s, 1.7 * s, 0.6 * dir, false, 51);
}

function shoe(ctx, foot, dir, s) {
  const cx = foot.x + 5.4 * dir * s;
  const cy = foot.y + 1.6;
  const rot = dir > 0 ? 0.1 : -0.1;
  sketchEllipse(ctx, cx, cy, 9.2 * s, 4.3 * s, rot, false, 60 + Math.round(foot.x));
  hatch(ctx, cx, cy, 8.2 * s, 3.4 * s, rot, 61);
}

function clothes(ctx, p, costume) {
  const s = p.scale;
  const hem = p.hip.y - 3 * s;
  sketchLine(ctx, p.neck.x - 4 * s, p.neck.y + 3 * s, p.shoulder.x - 11 * s, p.shoulder.y + 8 * s, 1.3, 48);
  sketchLine(ctx, p.neck.x + 4 * s, p.neck.y + 3 * s, p.shoulder.x + 11 * s, p.shoulder.y + 8 * s, 1.3, 49);
  sketchLine(ctx, p.shoulder.x - 11 * s, p.shoulder.y + 8 * s, p.hip.x - 14 * s, hem, 1.45, 52);
  sketchLine(ctx, p.shoulder.x + 11 * s, p.shoulder.y + 8 * s, p.hip.x + 14 * s, hem, 1.45, 53);
  sketchLine(ctx, p.hip.x - 14 * s, hem, p.hip.x + 14 * s, hem, 1.4, 54);
  hatch(ctx, p.chest.x, (p.chest.y + hem) / 2, 8 * s, 16 * s, 0.08, 47);

  const midL = pt((p.hip.x + p.kneeL.x) / 2, (p.hip.y + p.kneeL.y) / 2);
  const midR = pt((p.hip.x + p.kneeR.x) / 2, (p.hip.y + p.kneeR.y) / 2);
  sketchLine(ctx, p.hip.x - 9 * s, p.hip.y + 2, midL.x - 6 * s, midL.y, 1.35, 55);
  sketchLine(ctx, p.hip.x + 9 * s, p.hip.y + 2, midR.x + 6 * s, midR.y, 1.35, 56);
  sketchLine(ctx, midL.x - 6 * s, midL.y, midR.x + 6 * s, midR.y, 1.25, 57);

  if (costume === "chef") {
    sketchLine(ctx, p.neck.x - 8 * s, p.neck.y + 6 * s, p.hip.x - 16 * s, p.hip.y + 12 * s, 1.45, 58);
    sketchLine(ctx, p.neck.x + 8 * s, p.neck.y + 6 * s, p.hip.x + 16 * s, p.hip.y + 12 * s, 1.45, 59);
    sketchLine(ctx, p.hip.x - 16 * s, p.hip.y + 12 * s, p.hip.x + 16 * s, p.hip.y + 12 * s, 1.4, 63);
    sketchLine(ctx, p.hip.x + 10 * s, p.hip.y + 2, p.hip.x + 18 * s, p.hip.y + 8 * s, 1.15, 64);
  }
}

function accessories(ctx, p, costume) {
  const { hip, neck, chest, handL, handR, dir, scale: s } = p;

  if (costume === "student") {
    const bx = chest.x - 14 * dir;
    const by = chest.y + 20 * s;
    sketchLine(ctx, bx - 9 * s, by - 5 * s, bx + 9 * s, by - 6 * s, 1.4, 70);
    sketchLine(ctx, bx + 9 * s, by - 6 * s, bx + 10 * s, by + 20 * s, 1.4, 71);
    sketchLine(ctx, bx + 10 * s, by + 20 * s, bx - 10 * s, by + 19 * s, 1.4, 72);
    sketchLine(ctx, bx - 10 * s, by + 19 * s, bx - 9 * s, by - 5 * s, 1.4, 73);
    sketchLine(ctx, bx - 6 * s, by - 5 * s, neck.x - 5 * dir, neck.y + 5, 1.25, 74);
    sketchLine(ctx, bx + 6 * s, by - 6 * s, neck.x + 4 * dir, neck.y + 7, 1.25, 75);
    sketchLine(ctx, bx - 4 * s, by + 19 * s, bx - 4 * s, by + 30 * s, 1.15, 140);
    sketchLine(ctx, bx - 10 * s, by + 30 * s, bx + 4 * s, by + 30 * s, 1.2, 141);
    sketchLine(ctx, bx - 10 * s, by + 30 * s, bx - 10 * s, by + 38 * s, 1.15, 142);
    sketchLine(ctx, bx + 4 * s, by + 30 * s, bx + 4 * s, by + 38 * s, 1.15, 143);
    sketchLine(ctx, bx - 10 * s, by + 38 * s, bx + 4 * s, by + 38 * s, 1.2, 144);
    sketchLine(ctx, handR.x - 1, handR.y - 4, handR.x + 14 * s, handR.y - 5, 1.25, 76);
    sketchLine(ctx, handR.x + 14 * s, handR.y - 5, handR.x + 14 * s, handR.y + 7, 1.25, 77);
    sketchLine(ctx, handR.x + 14 * s, handR.y + 7, handR.x - 1, handR.y + 6, 1.25, 78);
    sketchLine(ctx, handR.x + 2, handR.y - 3, handR.x + 12 * s, handR.y - 3.5, 0.9, 79);
  }

  if (costume === "uni") {
    const bag = pt(hip.x - 2 * dir, hip.y - 2 * s);
    sketchLine(ctx, neck.x + 8 * dir, neck.y + 3, bag.x - 13 * s, bag.y - 5, 1.35, 80);
    sketchLine(ctx, neck.x - 3 * dir, neck.y + 7, bag.x + 13 * s, bag.y - 4, 1.35, 81);
    sketchLine(ctx, bag.x - 15 * s, bag.y - 5, bag.x + 15 * s, bag.y - 6, 1.45, 82);
    sketchLine(ctx, bag.x + 15 * s, bag.y - 6, bag.x + 16 * s, bag.y + 16, 1.45, 83);
    sketchLine(ctx, bag.x + 16 * s, bag.y + 16, bag.x - 15 * s, bag.y + 15, 1.45, 84);
    sketchLine(ctx, bag.x - 15 * s, bag.y + 15, bag.x - 15 * s, bag.y - 5, 1.45, 85);
    sketchLine(ctx, bag.x - 15 * s, bag.y + 2, bag.x + 16 * s, bag.y + 1, 1.1, 86);
  }

  if (costume === "badge") {
    sketchLine(ctx, neck.x - 2, neck.y + 3, hip.x + 4 * dir, hip.y - 36 * s, 1.15, 87);
    sketchLine(ctx, hip.x - 1, hip.y - 42 * s, hip.x + 11 * s, hip.y - 42 * s, 1.2, 88);
    sketchLine(ctx, hip.x + 11 * s, hip.y - 42 * s, hip.x + 11 * s, hip.y - 26 * s, 1.2, 89);
    sketchLine(ctx, hip.x + 11 * s, hip.y - 26 * s, hip.x - 1, hip.y - 26 * s, 1.2, 90);
    sketchLine(ctx, hip.x - 1, hip.y - 26 * s, hip.x - 1, hip.y - 42 * s, 1.2, 91);
    sketchLine(ctx, handR.x, handR.y - 14 * s, handR.x + 16 * s, handR.y - 15 * s, 1.25, 92);
    sketchLine(ctx, handR.x + 16 * s, handR.y - 15 * s, handR.x + 17 * s, handR.y + 8 * s, 1.25, 93);
    sketchLine(ctx, handR.x + 17 * s, handR.y + 8 * s, handR.x, handR.y + 8 * s, 1.25, 94);
    sketchLine(ctx, handR.x, handR.y + 8 * s, handR.x, handR.y - 14 * s, 1.25, 95);
  }

  if (costume === "suitcase") {
    const x = handL.x - 12 * s;
    const y = handL.y;
    sketchLine(ctx, x, y, x + 26 * s, y - 1, 1.5, 96);
    sketchLine(ctx, x + 26 * s, y - 1, x + 27 * s, y + 18 * s, 1.5, 97);
    sketchLine(ctx, x + 27 * s, y + 18 * s, x + 1, y + 19 * s, 1.5, 98);
    sketchLine(ctx, x + 1, y + 19 * s, x, y, 1.5, 99);
    sketchLine(ctx, x + 8 * s, y, x + 8 * s, y - 8 * s, 1.3, 100);
    sketchLine(ctx, x + 8 * s, y - 8 * s, x + 18 * s, y - 8 * s, 1.3, 101);
    sketchLine(ctx, x + 18 * s, y - 8 * s, x + 18 * s, y, 1.3, 102);
  }

  if (costume === "hardhat") {
    const px = hip.x - 11 * dir;
    const py = hip.y - 2 * s;
    sketchLine(ctx, px, py, px + 12 * s, py, 1.3, 103);
    sketchLine(ctx, px + 12 * s, py, px + 12 * s, py + 16 * s, 1.3, 104);
    sketchLine(ctx, px + 12 * s, py + 16 * s, px, py + 16 * s, 1.3, 105);
    sketchLine(ctx, px, py + 16 * s, px, py, 1.3, 106);
    sketchLine(ctx, px + 3 * s, py, px + 3 * s, py - 8 * s, 1.15, 107);
    sketchLine(ctx, px + 7 * s, py, px + 7 * s, py - 10 * s, 1.15, 145);
    sketchLine(ctx, px + 10 * s, py, px + 10 * s, py - 6 * s, 1.15, 146);
  }



  if (costume === "linux") {
    const lx = handR.x + 2 * dir;
    const ly = handR.y;
    sketchLine(ctx, lx, ly, lx + 23 * s, ly + 1, 1.35, 112);
    sketchLine(ctx, lx + 23 * s, ly + 1, lx + 22 * s, ly + 14 * s, 1.35, 113);
    sketchLine(ctx, lx + 22 * s, ly + 14 * s, lx, ly + 13 * s, 1.35, 114);
    sketchLine(ctx, lx, ly + 13 * s, lx, ly, 1.35, 115);
    sketchLine(ctx, lx, ly, lx + 8 * s, ly - 15 * s, 1.35, 116);
    sketchLine(ctx, lx + 8 * s, ly - 15 * s, lx + 28 * s, ly - 14 * s, 1.35, 117);
    sketchLine(ctx, lx + 28 * s, ly - 14 * s, lx + 23 * s, ly + 1, 1.35, 118);
    sketchEllipse(ctx, lx + 17 * s, ly - 9 * s, 3.1 * s, 3.6 * s, 0, false, 119);
    sketchEllipse(ctx, lx + 17 * s, ly - 6 * s, 2 * s, 1.4 * s, 0, true, 120);
  }

  if (costume === "soldier") {
    sketchLine(ctx, hip.x - 16 * dir, hip.y, hip.x - 16 * dir + 11 * s, hip.y - 1, 1.25, 121);
    sketchLine(ctx, hip.x - 16 * dir + 11 * s, hip.y - 1, hip.x - 16 * dir + 11 * s, hip.y + 14 * s, 1.25, 122);
    sketchLine(ctx, hip.x - 16 * dir + 11 * s, hip.y + 14 * s, hip.x - 16 * dir, hip.y + 14 * s, 1.25, 123);
    sketchLine(ctx, hip.x - 16 * dir, hip.y + 14 * s, hip.x - 16 * dir, hip.y, 1.25, 124);
    sketchEllipse(ctx, hip.x - 16 * dir + 5 * s, hip.y - 3 * s, 2.2 * s, 2.4 * s, 0, false, 125);
  }

  if (costume === "grad") {
    sketchEllipse(ctx, handR.x + 5 * dir, handR.y, 4.6 * s, 11.2 * s, 0.5 * dir, false, 126);
    sketchLine(ctx, handR.x + 2 * dir, handR.y - 2, handR.x + 8 * dir, handR.y + 2, 1.1, 127);
  }
}

function skeleton(ground, phase, walking, dir, scale) {
  const thigh = 35 * scale;
  const shin = 32 * scale;
  const torso = 50 * scale;
  const neckLen = 11 * scale;
  const headR = 17.5 * scale;
  const arm = 27 * scale;
  const forearm = 25 * scale;
  const step = STEP * scale;
  const lift = 18 * scale;

  const ph = walking ? phase : 0.12;
  const contact = 1 - Math.abs(Math.cos(ph));
  const lean = 0.055 * dir;
  const hip = pt(
    ground.x + Math.sin(ph) * 1.4 * dir,
    ground.y - (thigh + shin) * 0.95 - contact * 2.4 * scale
  );
  const chest = pt(hip.x + lean * 14, hip.y - torso);
  const neck = pt(chest.x + lean * 5, chest.y - neckLen);
  const head = pt(neck.x + lean * 3, neck.y - headR);
  const shoulder = pt(chest.x, chest.y + 5 * scale);

  const fR = footTarget(wrap01(ph, 0), step, lift, dir);
  const fL = footTarget(wrap01(ph, Math.PI), step, lift, dir);
  const footR = pt(ground.x + fR.x, ground.y + fR.y);
  const footL = pt(ground.x + fL.x, ground.y + fL.y);
  const kneeR = ikKnee(hip, footR, thigh, shin, dir);
  const kneeL = ikKnee(hip, footL, thigh, shin, dir);

  const swing = Math.cos(ph);
  const aR = -swing * 0.5 * dir;
  const aL = swing * 0.5 * dir;
  const eR = 0.2 + Math.max(0, -swing) * 0.28;
  const eL = 0.2 + Math.max(0, swing) * 0.28;
  const elbowR = down(shoulder, arm, aR);
  const handR = down(elbowR, forearm, aR + eR * dir);
  const elbowL = down(shoulder, arm, aL);
  const handL = down(elbowL, forearm, aL + eL * dir);

  return {
    hip,
    chest,
    neck,
    head,
    shoulder,
    kneeL,
    footL,
    kneeR,
    footR,
    elbowL,
    handL,
    elbowR,
    handR,
    r: headR,
    scale,
    dir,
    ground,
  };
}

function drawLimb(ctx, a, b, w, seed) {
  sketchLine(ctx, a.x, a.y, b.x, b.y, w, seed);
}

function drawBody(ctx, p, hat) {
  const w = 2.25 * Math.max(0.88, p.scale);
  const far = p.dir > 0 ? "L" : "R";

  const drawLeg = (side) => {
    const knee = side === "L" ? p.kneeL : p.kneeR;
    const foot = side === "L" ? p.footL : p.footR;
    drawLimb(ctx, p.hip, knee, w, 10 + (side === "L" ? 1 : 2));
    drawLimb(ctx, knee, foot, w, 12 + (side === "L" ? 1 : 2));
    shoe(ctx, foot, p.dir, p.scale);
  };
  const drawArm = (side) => {
    const elbow = side === "L" ? p.elbowL : p.elbowR;
    const hand = side === "L" ? p.handL : p.handR;
    drawLimb(ctx, p.shoulder, elbow, w * 0.94, 14 + (side === "L" ? 1 : 2));
    drawLimb(ctx, elbow, hand, w * 0.94, 16 + (side === "L" ? 1 : 2));
    mitten(ctx, hand.x, hand.y, p.dir, p.scale);
  };

  drawLeg(far);
  drawArm(far);

  drawLimb(ctx, p.neck, p.hip, w, 18);
  clothes(ctx, p, hat === "chef" ? "chef" : null);
  sketchCircle(ctx, p.head.x, p.head.y, p.r, w, 19);
  sketchEllipse(
    ctx,
    p.head.x + p.r * 0.4 * p.dir,
    p.head.y - p.r * 0.02,
    2.2 * p.scale,
    2.75 * p.scale,
    0,
    true,
    20
  );
  drawHat(ctx, p.head, p.r, hat, p.dir, p.scale);

  const near = far === "L" ? "R" : "L";
  drawLeg(near);
  drawArm(near);
}

export function drawCharacter(ctx, origin, { phase, walking, dir, costume, scale = 1 }) {
  const parts = skeleton(origin, phase, walking, dir, scale);
  const hat = hatKind(costume);

  if (costume === "dad") {
    const child = skeleton({ x: origin.x + 44 * dir, y: origin.y }, phase + 0.35, walking, dir, scale * 0.55);
    drawBody(ctx, parts, null);
    drawBody(ctx, child, null);
    sketchLine(ctx, parts.handR.x, parts.handR.y, child.handL.x, child.handL.y, 1.45, 130);
    return parts;
  }

  drawBody(ctx, parts, hat);
  accessories(ctx, parts, costume);
  return parts;
}
