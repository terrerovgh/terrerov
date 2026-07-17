export type RoofId = 'heaven' | 'pagoda' | 'pavilion' | 'torii' | 'moon-gate';

export type RoofConfig = {
  id: RoofId;
  name: string;
  nameZh: string;
  /** Short editorial label */
  kicker: string;
  description: string;
  /** Image(s) under public/ */
  src: string;
  srcWebp?: string;
  width: number;
  height: number;
  /** Eave attachment Y in asset pixels (center / sides) */
  centerY: number;
  sideY: number;
  /** Fraction of roof width the curtain spans */
  eaveWidthRatio: number;
  /** QR / curtain payload for this example */
  qrPayload: string;
  eyebrow: string;
  headline: string;
  caption: string;
};

/**
 * Roof catalog for the curtain system.
 * Geometry (centerY / sideY) is measured in the asset's native pixel space
 * and maps to where strands pin under the eave.
 */
export const roofs: RoofConfig[] = [
  {
    id: 'heaven',
    name: 'Temple of Heaven',
    nameZh: '天坛',
    kicker: 'HERO · LOUISVILLE',
    description: 'The studio signature — triple-eave circular hall with a scannable curtain QR.',
    src: '/assets/temple-roof-cutout-web.png',
    srcWebp: '/assets/temple-roof-cutout-web.webp',
    width: 901,
    height: 730,
    centerY: 652,
    sideY: 698,
    eaveWidthRatio: 0.84,
    qrPayload: 'https://www.terrerov.com',
    eyebrow: 'Louisville, KY / English · Español',
    headline: 'Web design\nthat elevates',
    caption:
      'Custom sites for local business — crafted carefully, built fast, made to bring in actual customers.',
  },
  {
    id: 'pagoda',
    name: 'Five-Story Pagoda',
    nameZh: '五重塔',
    kicker: 'EXAMPLE · STACKED EAVES',
    description: 'Layered tier roofs — a denser hang line for taller curtain compositions.',
    src: '/assets/roofs/pagoda.svg',
    width: 900,
    height: 520,
    centerY: 448,
    sideY: 488,
    eaveWidthRatio: 0.78,
    qrPayload: 'https://www.terrerov.com/#works',
    eyebrow: 'Pagoda / stacked eaves',
    headline: 'Stories\nin layers',
    caption: 'Each eave a chapter — the curtain carries the work.',
  },
  {
    id: 'pavilion',
    name: 'Garden Pavilion',
    nameZh: '亭',
    kicker: 'EXAMPLE · OPEN COURT',
    description: 'Open-sided garden roof with a gentle eave curve — lighter, airier curtain.',
    src: '/assets/roofs/pavilion.svg',
    width: 900,
    height: 420,
    centerY: 348,
    sideY: 392,
    eaveWidthRatio: 0.88,
    qrPayload: 'https://www.terrerov.com/#services',
    eyebrow: 'Pavilion / open court',
    headline: 'Shelter\nfor craft',
    caption: 'A quieter structure for quieter brands.',
  },
  {
    id: 'torii',
    name: 'Torii Gate',
    nameZh: '鳥居',
    kicker: 'EXAMPLE · THRESHOLD',
    description: 'Gateway lintel as hang bar — minimal architecture, strong curtain presence.',
    src: '/assets/roofs/torii.svg',
    width: 900,
    height: 380,
    centerY: 268,
    sideY: 272,
    eaveWidthRatio: 0.72,
    qrPayload: 'https://www.terrerov.com/#contact',
    eyebrow: 'Torii / threshold',
    headline: 'Cross\nthe threshold',
    caption: 'An invitation hung in the gate — scan to enter the studio.',
  },
  {
    id: 'moon-gate',
    name: 'Moon Gate',
    nameZh: '月亮门',
    kicker: 'EXAMPLE · CIRCULAR FRAME',
    description: 'Round portal with a shallow cap roof — curtain framed inside the circle.',
    src: '/assets/roofs/moon-gate.svg',
    width: 900,
    height: 560,
    centerY: 218,
    sideY: 248,
    eaveWidthRatio: 0.62,
    qrPayload: 'mailto:hola@terrerov.com',
    eyebrow: 'Moon gate / portal',
    headline: 'Frame\nthe message',
    caption: 'Architecture as composition — the QR is the view through the gate.',
  },
];

export function getRoof(id: RoofId): RoofConfig {
  const roof = roofs.find((r) => r.id === id);
  if (!roof) throw new Error(`Unknown roof: ${id}`);
  return roof;
}

/** Examples shown in the gallery (excludes the full-page hero) */
export const galleryRoofs = roofs.filter((r) => r.id !== 'heaven');
