import { sketchLine, sketchEllipse, sketchCircle, pencilStroke, hatch, hash } from "./pencil.js";

function pt(x, y) {
  return { x, y };
}

function box(ctx, x, y, w, h, seed) {
  sketchLine(ctx, x, y, x + w, y, 1.45, seed);
  sketchLine(ctx, x + w, y, x + w, y + h, 1.45, seed + 1);
  sketchLine(ctx, x + w, y + h, x, y + h, 1.45, seed + 2);
  sketchLine(ctx, x, y + h, x, y, 1.45, seed + 3);
}

function palm(ctx, x, ground, h) {
  sketchLine(ctx, x, ground, x + 4, ground - h, 1.9, x);
  sketchLine(ctx, x + 3, ground, x + 8, ground - h * 0.97, 1.25, x + 2);
  for (let i = 0; i < 6; i++) {
    const y = ground - 12 - i * (h / 9);
    sketchLine(ctx, x - 2, y, x + 8, y + 2, 0.9, x + 4 + i);
  }
  const top = ground - h;
  for (let i = 0; i < 8; i++) {
    const a = -2.75 + i * 0.7;
    const len = h * (0.36 + hash(x + i * 2) * 0.08);
    const x2 = x + 5 + Math.cos(a) * len;
    const y2 = top + Math.sin(a) * len * 0.42 + 6;
    const cx = x + 5 + Math.cos(a) * len * 0.45;
    const cy = top + Math.sin(a) * len * 0.12 - 10;
    pencilStroke(ctx, [pt(x + 5, top), pt(cx, cy), pt(x2, y2)], { width: 1.4, seed: x + 10 + i });
  }
  for (let i = 0; i < 5; i++) {
    sketchLine(ctx, x - 7 + i * 5, ground, x - 5 + i * 5, ground - 9, 1.05, x + 30 + i);
  }
}

function house(ctx, x, ground, s) {
  const w = 148 * s;
  const h = 78 * s;
  const left = x;
  const base = ground - 4;
  box(ctx, left, base - h, w, h, 200);
  sketchLine(ctx, left - 6, base - h, left + w / 2, base - h - 36 * s, 1.65, 210);
  sketchLine(ctx, left + w / 2, base - h - 36 * s, left + w + 6, base - h, 1.65, 211);
  sketchLine(ctx, left - 6, base - h, left + w + 6, base - h, 1.3, 212);
  for (let i = 0; i < 6; i++) {
    sketchLine(ctx, left + 8, base - h + 8 + i * 8 * s, left + w - 8, base - h + 8 + i * 8 * s, 0.95, 220 + i);
  }
  box(ctx, left + w * 0.42, base - 32 * s, 16 * s, 32 * s, 230);
  box(ctx, left + 12 * s, base - 44 * s, 18 * s, 16 * s, 234);
  box(ctx, left + w - 32 * s, base - 44 * s, 18 * s, 16 * s, 238);
  hatch(ctx, left + w * 0.5, base - h * 0.45, w * 0.38, h * 0.28, 0.04, 239);
}

function books(ctx, x, ground) {
  const stack = [
    [x, -4, 28, 8, -0.08],
    [x + 34, 0, 24, 10, 0.12],
    [x + 18, 12, 22, 9, -0.2],
  ];
  for (const [bx, by, w, h, rot] of stack) {
    ctx.save();
    ctx.translate(x + bx, ground + by);
    ctx.rotate(rot);
    box(ctx, -w / 2, -h, w, h, bx + 40);
    sketchLine(ctx, -w / 2 + 3, -h + 3, w / 2 - 3, -h + 3, 0.9, bx);
    ctx.restore();
  }
  sketchLine(ctx, x + 8, ground + 6, x + 26, ground + 8, 1.2, 50);
  sketchEllipse(ctx, x + 30, ground + 8, 3, 1.4, 0.2, true, 51);
}

function booth(ctx, x, ground) {
  box(ctx, x, ground - 78, 52, 78, 60);
  sketchLine(ctx, x - 6, ground - 78, x + 26, ground - 96, 1.5, 70);
  sketchLine(ctx, x + 26, ground - 96, x + 58, ground - 78, 1.5, 71);
  box(ctx, x + 8, ground - 62, 36, 28, 74);
  sketchLine(ctx, x + 8, ground - 48, x + 44, ground - 48, 1.1, 78);
}

function classroom(ctx, x, ground) {
  box(ctx, x, ground - 36, 54, 36, 80);
  box(ctx, x + 10, ground - 54, 16, 18, 84);
  sketchLine(ctx, x + 4, ground - 36, x + 4, ground, 1.2, 88);
  sketchLine(ctx, x + 50, ground - 36, x + 50, ground, 1.2, 89);
  box(ctx, x + 78, ground - 70, 56, 40, 90);
  sketchLine(ctx, x + 84, ground - 64, x + 128, ground - 64, 0.9, 94);
  sketchLine(ctx, x + 84, ground - 54, x + 122, ground - 54, 0.9, 95);
}

function hut(ctx, x, ground) {
  sketchLine(ctx, x, ground - 8, x + 40, ground - 8, 1.2, 100);
  box(ctx, x + 4, ground - 36, 32, 28, 101);
  sketchLine(ctx, x + 2, ground - 36, x + 20, ground - 52, 1.4, 105);
  sketchLine(ctx, x + 20, ground - 52, x + 38, ground - 36, 1.4, 106);
  box(ctx, x + 14, ground - 28, 8, 12, 107);
  sketchEllipse(ctx, x + 10, ground - 70, 2.2, 2.2, 0, false, 110);
  sketchEllipse(ctx, x + 48, ground - 86, 1.6, 1.6, 0, false, 111);
  sketchLine(ctx, x + 10, ground - 72, x + 10, ground - 68, 0.8, 112);
}

function arch(ctx, x, ground) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const a = Math.PI + t * Math.PI;
    pts.push(pt(x + 40 + Math.cos(a) * 40, ground - 8 + Math.sin(a) * 52));
  }
  pencilStroke(ctx, pts, { width: 2.1, seed: 120 });
  const inner = pts.map((p, i) => pt(p.x + (i - 7) * 0.15, p.y + 8));
  pencilStroke(ctx, inner, { width: 1.3, seed: 121, alpha: 0.45 });
  for (let i = 0; i < 12; i++) {
    const cx = x - 20 + hash(i * 3.2) * 130;
    const cy = ground - 40 - hash(i * 7.1) * 70;
    sketchLine(ctx, cx, cy, cx + 3, cy + 5, 0.9, 130 + i);
  }
}

function office(ctx, x, ground) {
  box(ctx, x, ground - 40, 72, 40, 140);
  box(ctx, x + 10, ground - 78, 36, 30, 144);
  box(ctx, x + 16, ground - 70, 24, 16, 148);
  sketchLine(ctx, x + 18, ground - 48, x + 38, ground - 48, 1.2, 150);
  sketchLine(ctx, x + 28, ground - 48, x + 28, ground - 40, 1.1, 151);
  for (let i = 0; i < 5; i++) {
    sketchLine(ctx, x + 52, ground - 14 - i * 5, x + 68, ground - 14 - i * 5, 1.15, 155 + i);
  }
}

function radar(ctx, x, ground) {
  const cx = x + 48;
  const rim = ground - 118;
  sketchLine(ctx, x + 18, ground, x + 78, ground, 1.7, 160);
  sketchLine(ctx, x + 28, ground, x + 34, rim + 22, 1.8, 161);
  sketchLine(ctx, x + 68, ground, x + 62, rim + 22, 1.8, 162);
  box(ctx, x + 26, rim + 14, 44, 16, 163);
  const dish = [];
  for (let i = 0; i <= 20; i++) {
    const a = -2.5 + (i / 20) * 2.2;
    dish.push(pt(cx + 8 + Math.cos(a) * 46, rim - 6 + Math.sin(a) * 32));
  }
  pencilStroke(ctx, dish, { width: 1.85, seed: 170 });
  sketchLine(ctx, dish[0].x, dish[0].y, dish[dish.length - 1].x, dish[dish.length - 1].y, 1.4, 171);
  sketchLine(ctx, cx, rim + 14, cx + 16, rim - 28, 1.35, 172);
  sketchLine(ctx, cx, rim + 14, cx + 30, rim - 10, 1.25, 173);
  box(ctx, x + 86, ground - 86, 42, 86, 175);
  for (let i = 0; i < 6; i++) {
    const y = ground - 78 + i * 13;
    sketchLine(ctx, x + 91, y, x + 123, y, 1.15, 180 + i);
    sketchEllipse(ctx, x + 98, y + 5, 1.5, 1.5, 0, true, 190 + i);
    sketchEllipse(ctx, x + 106, y + 5, 1.5, 1.5, 0, false, 195 + i);
    sketchEllipse(ctx, x + 114, y + 5, 1.5, 1.5, 0, true, 198 + i);
  }
}

function plane(ctx, x, y) {
  sketchEllipse(ctx, x, y, 22, 6, -0.12, false, 200);
  sketchLine(ctx, x - 6, y, x - 16, y - 10, 1.3, 201);
  sketchLine(ctx, x - 16, y - 10, x + 2, y - 1, 1.3, 202);
  sketchLine(ctx, x + 8, y + 1, x + 18, y + 8, 1.2, 203);
  sketchLine(ctx, x + 16, y - 2, x + 26, y - 8, 1.15, 204);
}

function hills(ctx, x, ground, w) {
  const pts = [pt(x, ground)];
  for (let i = 1; i < 8; i++) {
    pts.push(pt(x + (w * i) / 8, ground - 10 - hash(x + i) * 16));
  }
  pts.push(pt(x + w, ground));
  pencilStroke(ctx, pts, { width: 1.2, seed: x, alpha: 0.45 });
}

function frameHouse(ctx, x, ground) {
  const w = 168;
  const d = 46;
  const h = 92;
  const fl = x;
  const fr = x + w;
  const bl = x + 22;
  const br = x + w + 22;
  sketchLine(ctx, fl, ground, fr, ground, 1.5, 210);
  sketchLine(ctx, fl, ground, fl, ground - h, 1.55, 211);
  sketchLine(ctx, fr, ground, fr, ground - h, 1.55, 212);
  sketchLine(ctx, fl, ground - h, fl + w / 2, ground - h - 34, 1.6, 213);
  sketchLine(ctx, fr, ground - h, fl + w / 2, ground - h - 34, 1.6, 214);
  sketchLine(ctx, bl, ground - 8, br, ground - 8, 1.3, 215);
  sketchLine(ctx, br, ground - 8, br, ground - h - 6, 1.35, 216);
  sketchLine(ctx, fr, ground - h, br, ground - h - 6, 1.35, 217);
  sketchLine(ctx, fl + w / 2, ground - h - 34, br - 20, ground - h - 28, 1.4, 218);
  for (let i = 1; i < 6; i++) {
    const xx = fl + (w * i) / 6;
    sketchLine(ctx, xx, ground, xx, ground - h, 1.15, 230 + i);
  }
  for (let i = 1; i < 4; i++) {
    sketchLine(ctx, fl + (w * i) / 4, ground - h, fl + w / 2, ground - h - 34, 1.1, 240 + i);
  }
  sketchLine(ctx, fl + 58, ground, fl + 78, ground - 70, 1.55, 260);
  sketchLine(ctx, fl + 78, ground - 70, fl + 98, ground, 1.55, 261);
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const y = ground - 70 * t;
    const half = 20 * t;
    sketchLine(ctx, fl + 78 - half, y, fl + 78 + half, y, 1.2, 270 + i);
  }
}

function stove(ctx, x, ground) {
  box(ctx, x, ground - 44, 48, 44, 280);
  box(ctx, x + 10, ground - 28, 20, 16, 284);
  sketchEllipse(ctx, x + 12, ground - 48, 5, 2.2, 0, false, 288);
  sketchEllipse(ctx, x + 28, ground - 48, 5, 2.2, 0, false, 289);
  sketchEllipse(ctx, x + 20, ground - 36, 2, 2, 0, true, 290);
  sketchEllipse(ctx, x + 32, ground - 36, 2, 2, 0, true, 291);
  sketchLine(ctx, x + 8, ground - 54, x + 40, ground - 54, 1.3, 292);
  sketchEllipse(ctx, x + 24, ground - 56, 16, 3, 0, false, 293);
  sketchLine(ctx, x + 40, ground - 56, x + 52, ground - 60, 1.2, 294);
  sketchEllipse(ctx, x + 18, ground - 92, 14, 14, 0, false, 295);
  sketchLine(ctx, x + 18, ground - 106, x + 18, ground - 118, 1.3, 296);
}

function panel(ctx, x, ground, scale = 1) {
  const w = 70 * scale;
  const h = 42 * scale;
  ctx.save();
  ctx.translate(x, ground);
  ctx.rotate(-0.18);
  box(ctx, 0, -h - 18, w, h, 300 + x);
  for (let r = 1; r < 4; r++) {
    sketchLine(ctx, 4, -h - 18 + (h * r) / 4, w - 4, -h - 18 + (h * r) / 4, 0.95, 310 + r);
  }
  for (let c = 1; c < 5; c++) {
    sketchLine(ctx, (w * c) / 5, -h - 16, (w * c) / 5, -20, 0.95, 320 + c);
  }
  ctx.restore();
  sketchLine(ctx, x + 22 * scale, ground - 16, x + 22 * scale, ground, 1.5, 330 + x);
  box(ctx, x + 12 * scale, ground - 6, 20 * scale, 6, 334 + x);
}

function terminals(ctx, x, ground) {
  const wins = [
    [x - 70, ground - 150, 54, 36],
    [x - 20, ground - 190, 60, 40],
    [x + 50, ground - 160, 50, 34],
    [x + 90, ground - 110, 56, 38],
    [x - 90, ground - 90, 48, 32],
  ];
  for (const [wx, wy, ww, wh] of wins) {
    box(ctx, wx, wy, ww, wh, wx);
    sketchEllipse(ctx, wx + 6, wy + 6, 1.6, 1.6, 0, true, wx + 1);
    sketchEllipse(ctx, wx + 12, wy + 6, 1.6, 1.6, 0, false, wx + 2);
    sketchEllipse(ctx, wx + 18, wy + 6, 1.6, 1.6, 0, false, wx + 3);
    sketchLine(ctx, wx + 4, wy + 12, wx + ww - 4, wy + 12, 0.9, wx + 4);
    sketchLine(ctx, wx + 6, wy + 18, wx + ww * 0.7, wy + 18, 0.85, wx + 5);
    sketchLine(ctx, wx + 6, wy + 24, wx + ww * 0.55, wy + 24, 0.85, wx + 6);
  }
}

function servers(ctx, x, ground) {
  for (const ox of [-90, 70]) {
    box(ctx, x + ox, ground - 88, 40, 88, 400 + ox);
    for (let i = 0; i < 6; i++) {
      const y = ground - 80 + i * 12;
      sketchLine(ctx, x + ox + 5, y, x + ox + 35, y, 1.05, 410 + i + ox);
      for (let d = 0; d < 5; d++) {
        sketchEllipse(ctx, x + ox + 8 + d * 5, y + 5, 1.1, 1.1, 0, d % 2 === 0, 420 + d + ox);
      }
    }
  }
}

const DRAW = {
  origen(ctx, x, g) {
    palm(ctx, x + 70, g, 118);
    palm(ctx, x + 178, g, 152);
    house(ctx, x + 78, g, 1.12);
  },
  escuela(ctx, x, g) {
    books(ctx, x + 36, g);
    books(ctx, x - 70, g);
  },
  militar(ctx, x, g) {
    booth(ctx, x + 70, g);
  },
  universidad(ctx, x, g) {
    classroom(ctx, x + 64, g);
  },
  padre(ctx, x, g) {
    hut(ctx, x + 90, g);
  },
  grado(ctx, x, g) {
    arch(ctx, x + 50, g);
  },
  economia(ctx, x, g) {
    office(ctx, x + 70, g);
  },
  radares(ctx, x, g) {
    radar(ctx, x + 55, g);
  },
  viaje(ctx, x, g) {
    plane(ctx, x + 40, g - 130);
    hills(ctx, x - 40, g, 220);
  },
  oficios(ctx, x, g) {
    frameHouse(ctx, x + 60, g);
  },
  cocina(ctx, x, g) {
    stove(ctx, x - 100, g);
  },
  solar(ctx, x, g) {
    panel(ctx, x - 160, g, 1.25);
    panel(ctx, x - 86, g, 0.92);
    panel(ctx, x + 48, g, 0.92);
    panel(ctx, x + 124, g, 1.28);
  },
  linux(ctx, x, g) {
    terminals(ctx, x + 10, g);
  },
  cierre(ctx, x, g) {
    terminals(ctx, x - 10, g);
  },
};

export function drawScenery(ctx, camX, originY, viewW, groundAt, ticks, stages) {
  for (let i = 0; i < stages.length; i++) {
    const next = ticks[i + 1] ? ticks[i + 1].x : ticks[i].x + 900;
    const wx = ticks[i].x + (next - ticks[i].x) * 0.42;
    const sx = wx - camX;
    if (sx < -320 || sx > viewW + 340) continue;
    const g = originY + groundAt(wx);
    const fn = DRAW[stages[i].id];
    if (fn) fn(ctx, sx, g);
  }
  void servers;
  void hatch;
}
