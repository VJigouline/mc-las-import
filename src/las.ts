// Reads the header, variable-length records and point records of ASPRS LAS files, versions 1.0
// to 1.4, point formats 0 to 10.

export interface LasHeader {
  version: string;
  systemIdentifier: string;
  generatingSoftware: string;
  /** Year and day of year the file was made. */
  creation: { year: number; day: number };
  headerSize: number;
  pointDataOffset: number;
  pointFormat: number;
  pointLength: number;
  /** Whether the point data is LASzip-compressed (a LAZ file). */
  compressed: boolean;
  pointCount: number;
  scale: [number, number, number];
  offset: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
  vlrCount: number;
}

export interface LasVlr {
  userId: string;
  recordId: number;
  description: string;
  data: Uint8Array;
}

export class LasError extends Error {
  override name = 'LasError';
}

const ascii = (b: Uint8Array, from: number, length: number) => new TextDecoder('latin1').decode(b.subarray(from, from + length)).replace(/\0.*$/s, '').trim();

export function readLasHeader(b: Uint8Array): LasHeader {
  if (b.length < 227 || ascii(b, 0, 4) !== 'LASF') throw new LasError('Not a LAS file: it does not start with LASF');
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const major = b[24]!;
  const minor = b[25]!;
  const headerSize = v.getUint16(94, true);
  const rawFormat = b[104]!;
  let pointCount = v.getUint32(107, true);
  if (minor >= 4 && headerSize >= 375) {
    const big = Number(v.getBigUint64(247, true));
    if (big) pointCount = big;
  }
  const f64 = (o: number) => v.getFloat64(o, true);
  return {
    version: `${major}.${minor}`,
    systemIdentifier: ascii(b, 26, 32),
    generatingSoftware: ascii(b, 58, 32),
    creation: { day: v.getUint16(90, true), year: v.getUint16(92, true) },
    headerSize,
    pointDataOffset: v.getUint32(96, true),
    pointFormat: rawFormat & 0x3f,
    pointLength: v.getUint16(105, true),
    // LASzip marks compressed point data by setting the top bits of the format.
    compressed: (rawFormat & 0xc0) !== 0,
    pointCount,
    scale: [f64(131), f64(139), f64(147)],
    offset: [f64(155), f64(163), f64(171)],
    max: [f64(179), f64(195), f64(211)],
    min: [f64(187), f64(203), f64(219)],
    vlrCount: v.getUint32(100, true),
  };
}

export function readVlrs(b: Uint8Array, header: LasHeader): LasVlr[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: LasVlr[] = [];
  let at = header.headerSize;
  for (let i = 0; i < header.vlrCount && at + 54 <= b.length; i++) {
    const length = v.getUint16(at + 20, true);
    out.push({ userId: ascii(b, at + 2, 16), recordId: v.getUint16(at + 18, true), description: ascii(b, at + 22, 32), data: b.subarray(at + 54, at + 54 + length) });
    at += 54 + length;
  }
  return out;
}

/** Where the fields of a point record are, by point format. */
export function pointLayout(format: number): { intensity: number; classification: number; classMask: number; rgb: number } {
  if (format > 10) throw new LasError(`Point format ${format} is not a LAS point format`);
  if (format >= 6) return { intensity: 12, classification: 16, classMask: 0xff, rgb: [7, 8, 10].includes(format) ? 30 : -1 };
  return { intensity: 12, classification: 15, classMask: 0x1f, rgb: format === 2 ? 20 : format === 3 || format === 5 ? 28 : -1 };
}
