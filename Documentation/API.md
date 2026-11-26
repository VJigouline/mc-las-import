# API

## `loadLas(input, options?)`

Reads `.las` or `.laz` and returns a promise of a `LasLoadResult`.

`input` is the file's contents (`ArrayBuffer`, `Uint8Array` or string), a browser `File`, `{ name, data }`, or an iterable of files. Zip archives among them are opened.

It throws a `LasImportError` for input that isn't LAS and LAZ.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `main` | the first .las or .laz file | The file to open, if several are given. |
| `colorBy` | 'auto' | `'rgb'`, `'intensity'`, `'classification'`, `'elevation'` or `'none'`; `'auto'` takes colours, then intensity, then height. |
| `recentre` | true | Moves the cloud near the origin, as scan coordinates are too large for the GPU's precision; `origin` gives the point moved there. |
| `pointSize` | 2 | Point size in pixels. |
| `maxPoints` | 10 million | Reads at most this many points, taking every nth one. |
| `unitScale` | 1 | Metres per coordinate unit: 0.3048 for feet. |
| `lazPerfOptions` | — | Options for loading laz-perf, such as `locateFile` for laz-perf.wasm. |

### `LasLoadResult`

| Field | Type | Meaning |
| --- | --- | --- |
| `group` | `THREE.Group` | The model. |
| `header` | `LasHeader` | The header: version, point format, count, scale, offset and bounds. |
| `vlrs` | `LasVlr[]` | The variable-length records. |
| `wkt` | `string \| null` | The coordinate system. |
| `origin` | `[x, y, z]` | The file's point at the cloud's origin, in file units. |
| `colorBy` | `ColorMode` | How the points are coloured. |
| `stride` | `number` | Every nth point was read. |
| `warnings` | `string[]` | Problems that didn't stop the import. |
| `stats` | object | Counts of meshes, triangles, lines and points. |

See the package's `index.d.ts` for every exported type and helper.
