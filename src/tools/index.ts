// Editor tool registry. A tool receives pointer and keyboard events from the
// canvas and mutates the current document through the EditorContext. The
// registry starts empty: this scaffold ships the viewing, loading and saving
// plumbing, and tools (paint, erase, fill, select, ...) plug in here.

import type { Vec3 } from "@voxolith/renderer";
import type { EditorDocument } from "../document";

/** A ray in grid space, plus the voxel it hits (if any) and the face normal. */
export interface PointerHit {
  origin: Vec3;
  dir: Vec3;
  /** Grid cell hit, or null if the ray misses the model. */
  cell: [number, number, number] | null;
  /** Outward face normal at the hit, or null. */
  normal: Vec3 | null;
}

export interface EditorContext {
  doc: EditorDocument;
  /** Currently selected palette slot (1..255). */
  color: number;
  /** Re-upload the document's voxels to the GPU after a mutation. */
  commit(): void;
}

export interface EditorTool {
  /** Stable id used for the active-tool state. */
  id: string;
  /** Label shown in the tools panel. */
  name: string;
  /** Optional one-line hint shown while the tool is active. */
  hint?: string;
  onPointerDown?(hit: PointerHit, ctx: EditorContext, e: PointerEvent): void;
  onPointerMove?(hit: PointerHit, ctx: EditorContext, e: PointerEvent): void;
  onPointerUp?(hit: PointerHit, ctx: EditorContext, e: PointerEvent): void;
  onKey?(e: KeyboardEvent, ctx: EditorContext): void;
}

/** Registered tools, in panel order. Empty for now. */
export const TOOLS: EditorTool[] = [];

export function registerTool(tool: EditorTool): void {
  if (TOOLS.some((t) => t.id === tool.id)) throw new Error(`Tool "${tool.id}" already registered`);
  TOOLS.push(tool);
}
