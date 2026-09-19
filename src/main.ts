// Voxolith Editor — a browser voxel editor on @voxolith/renderer (WebGPU).
//
// This is the scaffold: open or drop a .vox, orbit with drag, zoom with the
// wheel, pick a palette colour, and save the model back to .vox. Editing tools
// register in src/tools and receive pointer/keyboard events from the canvas.

import "./styles.css";
import {
  initGpu,
  resizeToDisplay,
  showUnsupportedScreen,
  WebGPUUnsupportedError,
  createRenderer,
  type Renderer,
  makeCamera,
  makePerf,
  makeRay,
  OccupancyGrid,
  parseVoxScene,
  voxSceneAnimator,
  packMaterials,
  type VoxScene,
  type Vec3,
} from "@voxolith/renderer";
import { makeOrbitView } from "./orbitView";
import { framing } from "./model";
import { openDocument, downloadVox, type EditorDocument } from "./document";
import { TOOLS, type EditorContext, type PointerHit } from "./tools";
import { makeToolsPanel } from "./ui/panel";

const APP = "Voxolith Editor";

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

// Neutral studio lighting (no sky sun disc — a calm dark backdrop).
const SUN = norm([0.5, 0.85, 0.35]);
const ENV = {
  lightDir: SUN,
  lightColor: [1.0, 0.98, 0.94] as Vec3,
  ambientSky: [0.5, 0.53, 0.6] as Vec3,
  ambientGround: [0.3, 0.29, 0.27] as Vec3,
  sunDir: SUN,
  moonDir: [0, -1, 0] as Vec3,
  sunColor: [1, 0.96, 0.85] as Vec3,
  moonColor: [0, 0, 0] as Vec3,
  skyTop: [0.15, 0.16, 0.19] as Vec3,
  skyHorizon: [0.27, 0.29, 0.33] as Vec3,
  nightFactor: 0,
  sunIntensity: 0,
  moonIntensity: 0,
};
const FLOOR = { enabled: true, y: 0, colorA: [0.22, 0.23, 0.27] as Vec3, colorB: [0.17, 0.18, 0.21] as Vec3 };

async function main() {
  const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
  const hud = document.getElementById("hud");
  if (!canvas || !hud) throw new Error("Missing #scene / #hud");

  let gpu;
  try {
    gpu = await initGpu(canvas);
  } catch (err) {
    if (err instanceof WebGPUUnsupportedError) {
      showUnsupportedScreen(err.message, { appName: APP, emoji: "🧊" });
      return;
    }
    throw err;
  }

  hud.innerHTML = `
    <div class="panel ed-toolbar">
      <div class="ed-title">${APP} <small>· @voxolith/renderer</small></div>
      <button class="ed-btn" id="ed-open">Open .vox</button>
      <input type="file" id="ed-file" accept=".vox" hidden />
    </div>
    <div class="panel ed-info" id="ed-info" hidden></div>
    <aside id="ed-tools"></aside>
    <div class="panel ed-palette" id="ed-palette" hidden></div>
    <div class="ed-hint" id="ed-hint"><div>Drop a <b>.vox</b> file here<br>or use <b>Open</b></div></div>`;

  const infoEl = hud.querySelector("#ed-info") as HTMLElement;
  const paletteEl = hud.querySelector("#ed-palette") as HTMLElement;
  const hintEl = hud.querySelector("#ed-hint") as HTMLElement;
  const fileInput = hud.querySelector("#ed-file") as HTMLInputElement;
  const toolsHost = hud.querySelector("#ed-tools") as HTMLElement;

  const orbit = makeOrbitView(canvas, { yaw: 35, pitch: 28, distance: 120, minDistance: 6, maxDistance: 1400 });
  const camera = makeCamera({ target: [0, 0, 0], distance: 120, pitchDeg: 30, fovDeg: 32 });

  let renderer: Renderer | null = null;
  let target: Vec3 = [0, 0, 0];
  let doc: EditorDocument | null = null;
  let activeToolId: string | null = null;
  let color = 1;

  // --- Tools panel ----------------------------------------------------------
  const panel = makeToolsPanel(toolsHost, {
    onSelectTool(id) {
      activeToolId = activeToolId === id ? null : id;
      refreshPanel();
    },
    onSave() {
      if (doc) {
        downloadVox(doc);
        doc.dirty = false;
        refreshInfo();
      }
    },
  });
  const refreshPanel = () => panel.render(TOOLS, activeToolId, doc !== null);
  refreshPanel();

  function refreshInfo() {
    if (!doc) return;
    const g = doc.grid;
    infoEl.innerHTML = `
      <div class="name">${doc.name}${doc.dirty ? " •" : ""}</div>
      <div class="row"><span>Size</span><span>${g.srcSize.x}×${g.srcSize.y}×${g.srcSize.z}</span></div>
      <div class="row"><span>Voxels</span><span>${g.voxelCount.toLocaleString()}</span></div>
      <div class="row"><span>Colours</span><span>${g.usedColors.length}</span></div>`;
  }

  function refreshPalette() {
    if (!doc) return;
    paletteEl.innerHTML = doc.grid.usedColors
      .map(
        (c) =>
          `<div class="ed-swatch${c.index === color ? " active" : ""}" data-slot="${c.index}" title="#${c.index} rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})" style="background:rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})"></div>`,
      )
      .join("");
    paletteEl.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) =>
      el.addEventListener("click", () => {
        color = Number(el.dataset.slot);
        refreshPalette();
      }),
    );
  }

  // --- Document -------------------------------------------------------------
  async function setDocument(next: EditorDocument) {
    doc = next;
    const g = next.grid;
    // A fresh renderer per load (the grid size changes). The WESL shader links
    // once on the first call, then it's cached.
    const r = await createRenderer(gpu!, { size: g.size, data: g.data, palette: g.palette });
    r.setFloor(FLOOR);
    r.updateCoarse(new OccupancyGrid(g.size, g.data).data);
    renderer = r;

    const f = framing(g.size);
    target = f.target;
    orbit.setDistance(f.distance);

    color = g.usedColors[0]?.index ?? 1;
    infoEl.hidden = false;
    paletteEl.hidden = false;
    hintEl.hidden = true;
    refreshInfo();
    refreshPalette();
    refreshPanel();
  }

  // Multi-model / animated scenes are shown read-only (first frame) until the
  // editor grows scene support.
  async function setReadOnlyScene(scene: VoxScene, name: string) {
    doc = null;
    const anim = voxSceneAnimator(scene);
    const r = await createRenderer(gpu!, {
      size: anim.size,
      data: anim.frame(0),
      palette: anim.palette,
      materials: packMaterials(scene),
    });
    r.setFloor(FLOOR);
    r.updateCoarse(new OccupancyGrid(anim.size, anim.frame(0)).data);
    renderer = r;
    const f = framing(anim.size);
    target = f.target;
    orbit.setDistance(f.distance);
    infoEl.hidden = false;
    paletteEl.hidden = true;
    hintEl.hidden = true;
    infoEl.innerHTML = `
      <div class="name">${name}</div>
      <div class="row"><span>Models</span><span>${scene.models.length}</span></div>
      <div class="row"><span>Frames</span><span>${anim.frameCount}</span></div>
      <div class="row"><span>Mode</span><span>view only</span></div>`;
    refreshPanel();
  }

  function showError(msg: string) {
    infoEl.hidden = false;
    infoEl.innerHTML = `<div class="name" style="color:#ff8d8d">Failed to load</div><div class="row"><span>${msg}</span></div>`;
  }

  const IDENTITY9 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  async function loadBuffer(buf: ArrayBuffer, name: string) {
    try {
      const scene = parseVoxScene(buf);
      const pl = scene.sample(0);
      const plain =
        scene.frameCount === 1 &&
        scene.models.length === 1 &&
        pl.length === 1 &&
        pl[0].trans.every((v) => v === 0) &&
        pl[0].rot.every((v, i) => v === IDENTITY9[i]);
      if (plain) await setDocument(openDocument(scene.models[0], name));
      else await setReadOnlyScene(scene, name);
    } catch (e) {
      showError(String((e as Error)?.message ?? e));
    }
  }
  const loadFile = (file: File) => file.arrayBuffer().then((b) => loadBuffer(b, file.name));

  hud.querySelector("#ed-open")!.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.[0]) loadFile(fileInput.files[0]);
  });

  const app = document.getElementById("app")!;
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    app.classList.add("ed-drop");
  });
  document.addEventListener("dragleave", (e) => {
    if (e.relatedTarget === null) app.classList.remove("ed-drop");
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    app.classList.remove("ed-drop");
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });

  // --- Tool event routing ---------------------------------------------------
  // Builds a grid-space ray from a pointer event. Hit testing against voxels is
  // left to tools (a DDA walk over doc.grid.data); the scaffold only supplies
  // the ray.
  function pointerHit(e: PointerEvent): PointerHit {
    const frame = camera(orbit.yaw(), orbit.distance(), target, orbit.pitch());
    const ray = makeRay(canvas!, frame, e.clientX, e.clientY);
    return { origin: ray.origin, dir: ray.dir, cell: null, normal: null };
  }
  const ctx = (): EditorContext | null =>
    doc && renderer
      ? {
          doc,
          color,
          commit: () => {
            renderer!.updateVoxels(doc!.grid.data);
            doc!.dirty = true;
            refreshInfo();
          },
        }
      : null;
  const activeTool = () => TOOLS.find((t) => t.id === activeToolId) ?? null;
  canvas.addEventListener("pointerdown", (e) => {
    const t = activeTool(), c = ctx();
    if (t?.onPointerDown && c) t.onPointerDown(pointerHit(e), c, e);
  });
  canvas.addEventListener("pointermove", (e) => {
    const t = activeTool(), c = ctx();
    if (t?.onPointerMove && c) t.onPointerMove(pointerHit(e), c, e);
  });
  canvas.addEventListener("pointerup", (e) => {
    const t = activeTool(), c = ctx();
    if (t?.onPointerUp && c) t.onPointerUp(pointerHit(e), c, e);
  });
  window.addEventListener("keydown", (e) => {
    const t = activeTool(), c = ctx();
    if (t?.onKey && c) t.onKey(e, c);
  });

  // --- Render loop ----------------------------------------------------------
  const perf = makePerf({ enabled: new URLSearchParams(location.search).has("perf"), scale: gpu.renderScale });
  let last = performance.now();
  function loop(now: number) {
    requestAnimationFrame(loop);
    if (now - last < 1000 / 60 - 1) return;
    last = now;
    perf.frame(now);
    gpu!.renderScale = perf.scale();
    resizeToDisplay(gpu!);
    if (renderer) {
      renderer.render({ ...camera(orbit.yaw(), orbit.distance(), target, orbit.pitch()), ...ENV });
    }
  }
  requestAnimationFrame(loop);

  // Start with the bundled sample so the canvas isn't blank.
  const res = await fetch("/models/cat-sit.vox");
  if (res.ok) await loadBuffer(await res.arrayBuffer(), "cat-sit.vox");
}

main().catch((err) => {
  console.error(err);
  showUnsupportedScreen("An unexpected error occurred while starting up.", { appName: APP, emoji: "🧊" });
});
