import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type GtdBookPlugin from "./main";
import { DEFAULT_MATERIALS, DEFAULT_STRUCTURAL } from "./model";

export class GtdBookSettingTab extends PluginSettingTab {
  private plugin: GtdBookPlugin;

  constructor(app: App, plugin: GtdBookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Declarative definitions (Obsidian 1.13+) — also index settings for search.
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: "Structural folders",
        items: [
          {
            name: "Manuscript",
            desc: `Tracked chapters and scenes. Default: ${DEFAULT_STRUCTURAL.manuscript}`,
            control: {
              type: "text",
              key: "manuscript",
              placeholder: DEFAULT_STRUCTURAL.manuscript,
            },
          },
          {
            name: "Notes",
            desc: `Compile output lands here. Default: ${DEFAULT_STRUCTURAL.notes}`,
            control: {
              type: "text",
              key: "notes",
              placeholder: DEFAULT_STRUCTURAL.notes,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Material folders",
        items: [
          {
            name: "Defaults for new books",
            desc: "Comma-separated folder names each new book starts with. Each book overrides this via `materials:` in its index note.",
            control: {
              type: "text",
              key: "defaultMaterials",
              placeholder: DEFAULT_MATERIALS.join(", "),
            },
          },
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    const s = this.plugin.settings;
    if (key === "manuscript") return s.structural.manuscript;
    if (key === "notes") return s.structural.notes;
    if (key === "defaultMaterials") return s.defaultMaterials.join(", ");
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const v = typeof value === "string" ? value : "";
    const s = this.plugin.settings;
    if (key === "manuscript") {
      s.structural.manuscript = v.trim() || DEFAULT_STRUCTURAL.manuscript;
    } else if (key === "notes") {
      s.structural.notes = v.trim() || DEFAULT_STRUCTURAL.notes;
    } else if (key === "defaultMaterials") {
      s.defaultMaterials = parseMaterials(v);
    }
    await this.plugin.saveSettings();
  }

  // Fallback renderer for Obsidian < 1.13 (ignored when getSettingDefinitions
  // returns a non-empty array).
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Structural folders")
      .setDesc("Folders the plugin acts on, shared by all books. Rename for localization.")
      .setHeading();

    new Setting(containerEl)
      .setName("Manuscript")
      .setDesc(`Tracked chapters and scenes. Default: ${DEFAULT_STRUCTURAL.manuscript}`)
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_STRUCTURAL.manuscript)
          .setValue(this.plugin.settings.structural.manuscript)
          .onChange(async (v) => {
            this.plugin.settings.structural.manuscript =
              v.trim() || DEFAULT_STRUCTURAL.manuscript;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Notes")
      .setDesc(`Compile output lands here. Default: ${DEFAULT_STRUCTURAL.notes}`)
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_STRUCTURAL.notes)
          .setValue(this.plugin.settings.structural.notes)
          .onChange(async (v) => {
            this.plugin.settings.structural.notes =
              v.trim() || DEFAULT_STRUCTURAL.notes;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Material folders")
      .setDesc("Each book chooses its own material folders via `materials:` in its index note. This list is only the default for newly created books.")
      .setHeading();

    new Setting(containerEl)
      .setName("Defaults for new books")
      .setDesc("Comma-separated folder names.")
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_MATERIALS.join(", "))
          .setValue(this.plugin.settings.defaultMaterials.join(", "))
          .onChange(async (v) => {
            this.plugin.settings.defaultMaterials = parseMaterials(v);
            await this.plugin.saveSettings();
          }),
      );
  }
}

function parseMaterials(value: string): string[] {
  const names = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return names.length ? names : [...DEFAULT_MATERIALS];
}
