// The editor document: a single MagicaVoxel model (Z-up, palette-indexed) plus
// its derived Y-up render grid. Editing tools mutate `grid` and call
// `commit()`; saving converts the grid back to a .vox byte buffer.

import { writeVox, type VoxModel } from "@voxolith/renderer/vox";
import { toViewModel, type ViewModel } from "./model";

export interface EditorDocument {
  name: string;
  /** Source model as parsed (kept for palette bytes and original size). */
  model: VoxModel;
  /** Render grid derived from the model (cropped to the occupied box, Y-up). */
  grid: ViewModel;
  /** True when a tool has changed the grid since load/save. */
  dirty: boolean;
}

export function openDocument(model: VoxModel, name: string): EditorDocument {
  return { name, model, grid: toViewModel(model), dirty: false };
}

/**
 * Serialise the current grid to .vox bytes. The grid is Y-up (X=x, Y=z, Z=y
 * relative to MagicaVoxel), so the axes are swapped back on the way out.
 */
export function toVoxBytes(doc: EditorDocument): ArrayBuffer {
  const { size, data } = doc.grid;
  const voxels: [number, number, number, number][] = [];
  for (let z = 0; z < size.z; z++) {
    for (let y = 0; y < size.y; y++) {
      for (let x = 0; x < size.x; x++) {
        const c = data[x + y * size.x + z * size.x * size.y];
        if (c) voxels.push([x, z, y, c]);
      }
    }
  }
  const pal = doc.model.palette;
  return writeVox({ x: size.x, y: size.z, z: size.y }, voxels, (i) =>
    pal[i * 4 + 3] === 0 ? null : [pal[i * 4], pal[i * 4 + 1], pal[i * 4 + 2]],
  );
}

/** Trigger a browser download of the document as .vox. */
export function downloadVox(doc: EditorDocument): void {
  const bytes = toVoxBytes(doc);
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name.replace(/\.vox$/i, "") + ".vox";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
