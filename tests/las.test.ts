import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LasImportError, loadLas, readLasHeader } from '../src/index.js';
import { sample } from './files.js';

const points = (g: THREE.Object3D) => {
  let p: THREE.Points | undefined;
  g.traverse((o) => { if ((o as THREE.Points).isPoints) p = o as THREE.Points; });
  return p!;
};

describe('LAS', () => {
  it('reads a LAS 1.2 file with colours and classes', async () => {
    const r = await loadLas(sample('simple.las'));
    expect(r.header).toMatchObject({ version: '1.2', pointFormat: 3, compressed: false, pointCount: 1065 });
    expect(r.stats.points).toBe(1065);
    expect(r.colorBy).toBe('rgb');
    expect(Object.keys(r.stats.classes).length).toBeGreaterThan(1);
    // The cloud is moved near the origin; the origin is in the header's bounds.
    expect(r.origin[0]).toBeGreaterThan(r.header.min[0]);
    expect(r.origin[0]).toBeLessThan(r.header.max[0]);
    expect(r.group.rotation.x).toBeCloseTo(-Math.PI / 2);
  });

  it('decompresses LAZ to the same points', async () => {
    const las = await loadLas(sample('simple.las'));
    const laz = await loadLas(sample('simple.laz'));
    expect(laz.header.compressed).toBe(true);
    expect(laz.stats.points).toBe(las.stats.points);
    const a = points(las.group).geometry.getAttribute('position');
    const b = points(laz.group).geometry.getAttribute('position');
    for (const i of [0, 100, 1064]) expect(b.getX(i)).toBeCloseTo(a.getX(i), 4);
    expect((await loadLas(sample('plane.laz'))).stats.points).toBe(28185);
  });

  it('reads LAS 1.4 point format 6, compressed or not', async () => {
    const r = await loadLas(sample('test1_4.las'));
    expect(r.header).toMatchObject({ version: '1.4', pointFormat: 6, pointCount: 1000 });
    expect(r.stats.points).toBe(1000);
    const laz = await loadLas(sample('1_4_w_evlr.laz'));
    expect(laz.header.version).toBe('1.4');
    expect(laz.stats.points).toBeGreaterThan(0);
  });

  it('colours by classification and takes every nth point', async () => {
    const r = await loadLas(sample('simple.las'), { colorBy: 'classification', maxPoints: 100 });
    expect(r.stride).toBe(11);
    expect(r.stats.points).toBe(97);
    expect(r.colorBy).toBe('classification');
    expect(r.warnings[0]).toContain('every 11th point');
  });

  it('refuses files that are not LAS', async () => {
    expect(() => readLasHeader(new Uint8Array(300))).toThrow();
    await expect(loadLas('hello')).rejects.toThrow(LasImportError);
  });
});
