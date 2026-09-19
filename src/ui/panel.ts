// The right-hand tools panel: one button per registered tool, the active
// tool's hint, and document actions (Save .vox).

import type { EditorTool } from "../tools";

export interface PanelCallbacks {
  onSelectTool(id: string): void;
  onSave(): void;
}

export interface ToolsPanel {
  render(tools: EditorTool[], activeId: string | null, canSave: boolean): void;
}

export function makeToolsPanel(host: HTMLElement, cb: PanelCallbacks): ToolsPanel {
  host.className = "panel ed-tools";
  return {
    render(tools, activeId, canSave) {
      const active = tools.find((t) => t.id === activeId) ?? null;
      host.innerHTML = `
        <h3>Tools</h3>
        ${
          tools.length === 0
            ? `<p class="ed-empty">No tools yet. Register one in <code>src/tools</code>.</p>`
            : tools
                .map(
                  (t) =>
                    `<button class="ed-btn ed-tool-btn${t.id === activeId ? " active" : ""}" data-tool="${t.id}">${t.name}</button>`,
                )
                .join("")
        }
        ${active?.hint ? `<p class="ed-empty">${active.hint}</p>` : ""}
        <div class="ed-actions">
          <button class="ed-btn" id="ed-save" ${canSave ? "" : "disabled"}>Save .vox</button>
        </div>`;
      host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((b) =>
        b.addEventListener("click", () => cb.onSelectTool(b.dataset.tool!)),
      );
      host.querySelector("#ed-save")!.addEventListener("click", () => cb.onSave());
    },
  };
}
