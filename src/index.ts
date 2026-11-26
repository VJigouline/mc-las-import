// Reads ASPRS LAS point clouds, and LASzip-compressed LAZ ones with Hobu's laz-perf
// (WebAssembly, Apache 2.0), into three.js point clouds coloured by colour, intensity,
// classification or height, moved near the origin, in metres and Y up.

import * as THREE from 'three';
import lazPerfModule from 'laz-perf';
import { countModel, ImportFiles, orient, type ImportInput, type ImportStats } from './common.js';
import { pointLayout, readLasHeader, readVlrs, type LasHeader, type LasVlr } from './las.js';
import { baseName, buildPoints, type ColorMode, type PointCloudOptions } from './points.js';

export { ImportFiles, countModel } from './common.js';
export type { ImportInput, ImportFile, ImportData, ImportStats } from './common.js';
export { CLASSIFICATION_COLORS, type ColorMode, type PointCloudOptions } from './points.js';
export { readLasHeader, readVlrs, pointLayout, LasError, type LasHeader, type LasVlr } from './las.js';

/** The parts of laz-perf's WebAssembly module that are used. */
export interface LazPerfModule {
  LASZip: new () => { open(ptr: number, length: number): void; getPoint(ptr: number): void; getCount(): number; getPointLength(): number; getPointFormat(): number; delete(): void };
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
}

export interface LasOptions extends PointCloudOptions {
  /** The .las or .laz file to open, if several are given. By default, the first. */
  main?: string;
  /** Reads at most this many points, taking every nth one. Default 10 million. */
  maxPoints?: number;
  /** Metres per coordinate unit. Default 1; use 0.3048 for feet and 1200/3937 for US survey feet. */
  unitScale?: number;
  /** A laz-perf module already loaded. */
  lazPerf?: LazPerfModule;
  /** Options for loading laz-perf, such as `locateFile` for its laz-perf.wasm. */
  lazPerfOptions?: { locateFile?: (name: string, prefix: string) => string };
}

export interface LasLoadResult {
  /** The point cloud, in metres and Y up, in a group named after the file. */
  group: THREE.Group;
  header: LasHeader;
  vlrs: LasVlr[];
  /** The coordinate reference system, as WKT, if the file has one. */
  wkt: string | null;
  /** The file's point at the group's origin, in file units. */
  origin: [number, number, number];
  colorBy: ColorMode;
  /** Every nth point was read. */
  stride: number;
  warnings: string[];
  stats: ImportStats & { classes: Record<number, number> };
}

export class LasImportError extends Error {
  override name = 'LasImportError';
}

let shared: Promise<LazPerfModule> | undefined;

/** Loads laz-perf once and keeps it for later calls. */
export function loadLazPerf(options?: LasOptions['lazPerfOptions']): Promise<LazPerfModule> {
  const m = lazPerfModule as unknown as { createLazPerf?: (o?: object) => Promise<LazPerfModule>; default?: { createLazPerf: (o?: object) => Promise<LazPerfModule> } };
  const create = m.createLazPerf ?? m.default?.createLazPerf;
  if (!create) throw new LasImportError('laz-perf could not be loaded');
  if (!shared) shared = create(options ?? {});
  return shared;
}

/** Reads a LAS or LAZ point cloud. */
export async function loadLas(input: ImportInput, options: LasOptions = {}): Promise<LasLoadResult> {
  const files = await ImportFiles.from(input, 'cloud.las');
  const main = files.main(['las', 'laz'], options.main) ?? files.files[0];
  if (!main) throw new LasImportError('There is no .las file to open');
  const b = main.bytes;
  let header: LasHeader;
  try {
    header = readLasHeader(b);
  } catch (error) {
    throw new LasImportError(`${main.name}: ${(error as Error).message}`);
  }
  const vlrs = readVlrs(b, header);
  const warnings: string[] = [];
  const wkt = vlrs.find((r) => r.userId === 'LASF_Projection' && r.recordId === 2112);
  const wktText = wkt ? new TextDecoder().decode(wkt.data).replace(/\0+$/, '') : null;
  if (!wktText && vlrs.some((r) => r.userId === 'LASF_Projection' && r.recordId === 34735)) warnings.push('The coordinate system is given as GeoTIFF keys, which are not read');
  if (wktText && /foot|feet/i.test(wktText) && options.unitScale === undefined) warnings.push('The coordinate system is in feet; pass unitScale to show the cloud in metres');

  // Point records, decompressed by laz-perf for LAZ.
  let read: (i: number) => DataView;
  let count = header.pointCount;
  let length = header.pointLength;
  let cleanup = () => {};
  if (header.compressed) {
    let lp: LazPerfModule;
    try {
      lp = options.lazPerf ?? (await loadLazPerf(options.lazPerfOptions));
    } catch (error) {
      throw new LasImportError(`laz-perf could not be loaded: ${(error as Error).message}`);
    }
    const filePtr = lp._malloc(b.length);
    lp.HEAPU8.set(b, filePtr);
    const zip = new lp.LASZip();
    try {
      zip.open(filePtr, b.length);
    } catch (error) {
      lp._free(filePtr);
      zip.delete();
      throw new LasImportError(`${main.name} could not be decompressed: ${(error as Error).message}`);
    }
    count = zip.getCount();
    length = zip.getPointLength();
    const pointPtr = lp._malloc(length);
    // LAZ points can only be read in order; skipped ones are still decompressed.
    let next = 0;
    read = (i: number) => {
      while (next <= i) {
        zip.getPoint(pointPtr);
        next++;
      }
      return new DataView(lp.HEAPU8.buffer, pointPtr, length);
    };
    cleanup = () => {
      zip.delete();
      lp._free(pointPtr);
      lp._free(filePtr);
    };
  } else {
    if (header.pointDataOffset + count * length > b.length) {
      warnings.push('The file is shorter than its header says; the points it has are read');
      count = Math.floor((b.length - header.pointDataOffset) / length);
    }
    read = (i: number) => new DataView(b.buffer, b.byteOffset + header.pointDataOffset + i * length, length);
  }

  const maxPoints = options.maxPoints ?? 10_000_000;
  const stride = Math.max(1, Math.ceil(count / maxPoints));
  if (stride > 1) warnings.push(`The file has ${count} points; every ${stride}th point is shown`);
  const n = Math.ceil(count / stride);
  const layout = pointLayout(header.pointFormat);
  const positions = new Float64Array(n * 3);
  const intensity = new Float32Array(n);
  const classification = new Uint8Array(n);
  const rgb = layout.rgb >= 0 ? new Float32Array(n * 3) : undefined;
  const classes: Record<number, number> = {};
  let maxIntensity = 0;
  let maxColor = 0;
  const [sx, sy, sz] = header.scale;
  const [ox, oy, oz] = header.offset;
  try {
    for (let j = 0; j < n; j++) {
      const p = read(j * stride);
      positions[j * 3] = p.getInt32(0, true) * sx + ox;
      positions[j * 3 + 1] = p.getInt32(4, true) * sy + oy;
      positions[j * 3 + 2] = p.getInt32(8, true) * sz + oz;
      const it = p.getUint16(layout.intensity, true);
      intensity[j] = it;
      if (it > maxIntensity) maxIntensity = it;
      const c = p.getUint8(layout.classification) & layout.classMask;
      classification[j] = c;
      classes[c] = (classes[c] ?? 0) + 1;
      if (rgb) {
        for (let k = 0; k < 3; k++) {
          const v = p.getUint16(layout.rgb + k * 2, true);
          rgb[j * 3 + k] = v;
          if (v > maxColor) maxColor = v;
        }
      }
    }
  } finally {
    cleanup();
  }
  // Intensity runs to the file's largest value; colours to 65535, or to 255 in files that wrote 8-bit values.
  for (let j = 0; j < n; j++) intensity[j]! /= maxIntensity || 1;
  if (rgb) {
    const div = maxColor > 255 ? 65535 : 255;
    const color = new THREE.Color();
    for (let j = 0; j < n * 3; j += 3) {
      color.setRGB(rgb[j]! / div, rgb[j + 1]! / div, rgb[j + 2]! / div, THREE.SRGBColorSpace);
      rgb[j] = color.r;
      rgb[j + 1] = color.g;
      rgb[j + 2] = color.b;
    }
  }
  const hasClasses = Object.keys(classes).some((c) => c !== '0' && c !== '1');
  const name = baseName(main.name, /\.la[sz]$/i);
  const { points, origin, colorBy } = buildPoints(name, {
    positions,
    colors: rgb && maxColor > 0 ? rgb : undefined,
    intensity: maxIntensity > 0 ? intensity : undefined,
    classification: hasClasses ? classification : undefined,
  }, options);
  points.userData.las = { classes };
  const group = orient(points, name, true, options.unitScale ?? 1);
  return { group, header, vlrs, wkt: wktText, origin, colorBy, stride, warnings, stats: { ...countModel(group), classes } };
}
