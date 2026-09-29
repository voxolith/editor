import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { serviceWorker } from "@voxolith/engine/vite";

export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    // WebGPU needs a secure context; basic-ssl serves HTTPS on localhost + LAN.
    basicSsl(),
    // The shared service worker (build only): the editor opens offline after a first visit.
    // The public files it needs at start (manifest, icons, the header mark, the sample the
    // editor opens with) are not in the bundle, so they are precached by name.
    serviceWorker({
      name: "editor",
      include: [
        "manifest.webmanifest",
        "favicon.svg",
        "favicon-32.png",
        "apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "brand/logo-mark.svg",
        "models/cat-sit.vox",
      ],
    }),
  ],
  // @voxolith/renderer ships raw TypeScript with `?raw` shader imports; it must be
  // compiled with the app rather than pre-bundled.
  optimizeDeps: { exclude: ["@voxolith/renderer"] },
  server: {
    host: true,
  },
});
