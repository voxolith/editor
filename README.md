<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voxolith/.github/main/profile/lockup-dark.svg">
    <img alt="Voxolith — WebGPU voxel engine" src="https://raw.githubusercontent.com/voxolith/.github/main/profile/lockup.svg" width="420">
  </picture>
</p>

# Voxolith Editor

A browser voxel editor built on [`@voxolith/renderer`](https://github.com/voxolith/renderer) (WebGPU).

This is the scaffold. It already does the plumbing an editor needs:

- Open or drop a MagicaVoxel `.vox`; a bundled sample loads on start
- Turntable orbit (drag) and zoom (wheel) with the engine's raymarcher
- Palette strip with a selected colour slot
- **Save .vox** writes the current grid back to a MagicaVoxel file
- A tool registry (`src/tools`) that routes canvas pointer and keyboard events to the active tool
- Multi-model or animated `.vox` scenes open read-only
- Render on demand with a quality dropdown (engine presets, shared with the viewer)

Planned scope: paint / erase / fill tools with voxel hit testing, palette editing, model resizing,
multi-model scenes, undo/redo, and Minecraft region import.

## Requirements

- [bun](https://bun.sh) 1.4 or newer
- A WebGPU-capable browser (Chrome, Edge, Safari 26+, Firefox with WebGPU enabled)

## Run

```sh
bun install
bun run dev
```

Open the printed `https://localhost:5173` URL and accept the self-signed certificate.

## Adding a tool

```ts
import { registerTool } from "./tools";

registerTool({
  id: "paint",
  name: "Paint",
  hint: "Click a face to add a voxel",
  onPointerDown(hit, ctx) {
    // walk hit.origin / hit.dir through ctx.doc.grid.data, set a cell to ctx.color,
    ctx.commit(); // re-uploads the grid to the GPU and marks the document dirty
  },
});
```

Import the file from `src/main.ts` so it registers on startup. `src/document.ts` holds the model
and its Y-up render grid and converts back to `.vox` bytes on save.

## Layout

| path | role |
|---|---|
| `src/main.ts` | boot, HUD, loading, tool event routing, render loop |
| `src/document.ts` | editor document, `.vox` export |
| `src/model.ts` | `.vox` model to render grid (crop, Z-up to Y-up) and framing |
| `src/orbitView.ts` | drag/wheel turntable camera |
| `src/tools/` | tool interface and registry |
| `src/ui/panel.ts` | tools panel with Save |

## Local development with the engine

This repo depends on `@voxolith/renderer` as `workspace:*`. Clone it next to this one and run
`bun install` from a workspace root that lists both folders. Once the engine is on npm, swap the
dependency to a version range.

## Deploy

Every push to `main` builds the app and publishes it to GitHub Pages at
<https://voxolith.github.io/editor/> via `.github/workflows/pages.yml`. The workflow checks out
`voxolith/renderer` next to the app and builds with `BASE_PATH=/editor/`, so asset and fetch URLs
resolve under the project path. Run the same locally with `BASE_PATH=/editor/ bun run build`.

## Theming

The UI uses the Voxolith design tokens in `src/brand/tokens.css` (dark navy by default, a paper
light theme via `prefers-color-scheme` or the toolbar toggle, persisted in `localStorage`). Those
files and the favicons are generated from the private `voxolith/branding` repo; edit them there
and re-run its sync script rather than here.

## License

MIT
