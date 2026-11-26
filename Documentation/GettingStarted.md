# Getting started

## Install

```sh
npm install three github:VJigouline/mc-las-import
```

## Open a file

`loadLas` takes the file's contents (`ArrayBuffer`, `Uint8Array` or string), a browser `File`, `{ name, data }`, or an iterable of files. Zip archives among them are opened. It returns a promise of the model.

```ts
import * as THREE from 'three';
import { loadLas } from 'mc-las-import';

const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
input.addEventListener('change', async () => {
  const result = await loadLas(input.files![0]!);
  scene.add(result.group);
  for (const warning of result.warnings) console.warn(warning);
});
```

## What you get

- **`group`:** a `THREE.Group` holding the model, named after the file.
- **`stats`:** counts of what was read.
- **`warnings`:** anything that couldn't be read or was left out.

LAS is Z up, in the units of its coordinate system; the group turns the cloud Y up. The cloud is moved near the origin; `origin` gives the point moved there.

## Options

- **`main`** (default the first .las or .laz file): The file to open, if several are given.
- **`colorBy`** (default 'auto'): `'rgb'`, `'intensity'`, `'classification'`, `'elevation'` or `'none'`; `'auto'` takes colours, then intensity, then height.
- **`recentre`** (default true): Moves the cloud near the origin, as scan coordinates are too large for the GPU's precision; `origin` gives the point moved there.
- **`pointSize`** (default 2): Point size in pixels.
- **`maxPoints`** (default 10 million): Reads at most this many points, taking every nth one.
- **`unitScale`** (default 1): Metres per coordinate unit: 0.3048 for feet.
- **`lazPerfOptions`** (default —): Options for loading laz-perf, such as `locateFile` for laz-perf.wasm.

See the [API](API.md) for every field of the result.
