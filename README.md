# mc-las-import

A LAS and LAZ importer for [three.js](https://threejs.org/), written in TypeScript. It reads ASPRS LAS point clouds, versions 1.0 to 1.4, and LASzip-compressed LAZ ones with Hobu's [laz-perf](https://github.com/hobuinc/laz-perf) (WebAssembly, Apache 2.0), coloured by colour, intensity, classification or height, in metres and Y up. It was made for [SceneEditor](https://github.com/VJigouline/SceneEditor), and works in any three.js application.

```ts
import { loadLas } from 'mc-las-import';

const result = await loadLas(await file.arrayBuffer());
scene.add(result.group);
console.log(result.warnings);       // anything that couldn't be read
```

## What it reads

- LAS 1.0 to 1.4, point formats 0 to 10: coordinates with their scale and offset, intensity, classification, and RGB colour.
- LAZ, decompressed with laz-perf.
- Variable-length records, and the coordinate system as WKT.
- Clouds of any size, taking every nth point beyond a limit.

Waveforms and extra bytes are not read. Coordinate systems given only as GeoTIFF keys are reported but not read; clouds in feet need `unitScale`. See [Formats and support](Documentation/Support.md) for the details.

## Install

The package is not on the npm registry. Install it from GitHub:

```sh
npm install github:VJigouline/mc-las-import
```

`three` (r160 or later) is a peer dependency. The package builds itself on install.

## Documentation

- [Getting started](Documentation/GettingStarted.md)
- [API](Documentation/API.md)
- [Formats and support](Documentation/Support.md)
- [Using it in SceneEditor](Documentation/SceneEditor.md)

## Development

```sh
npm install
npm test           # unit tests, with Vitest
npm run typecheck
npm run build      # dist/
```

The tests load real LAS and LAZ files, kept in [`tests/samples`](tests/samples/README.md) with their licences. It needs Node.js 22 or later.

## Licence

[MIT](LICENSE)
