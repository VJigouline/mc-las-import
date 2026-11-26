# Formats and support

mc-las-import reads LAS and LAZ with its own LAS reader, with laz-perf to decompress LAZ.

## What is read

- LAS 1.0 to 1.4, point formats 0 to 10: coordinates with their scale and offset, intensity, classification, and RGB colour.
- LAZ, decompressed with laz-perf.
- Variable-length records, and the coordinate system as WKT.
- Clouds of any size, taking every nth point beyond a limit.

## Orientation and units

LAS is Z up, in the units of its coordinate system; the group turns the cloud Y up. The cloud is moved near the origin; `origin` gives the point moved there.

## Limits

Waveforms and extra bytes are not read. Coordinate systems given only as GeoTIFF keys are reported but not read; clouds in feet need `unitScale`.
