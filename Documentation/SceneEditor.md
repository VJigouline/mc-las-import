# Using it in SceneEditor

[SceneEditor](https://github.com/VJigouline/SceneEditor) opens `.las` and `.laz` files with mc-las-import. Drop or open a `.las` or `.laz` file. SceneEditor serves `laz-perf.wasm` from its assets.

The model is added to the scene, named after its file, and the view is refitted. A file that can't be read gives a **Failure** message, and the scene is unaffected. Warnings go to the browser console.

It comes in metres with Y up, like the other formats.
