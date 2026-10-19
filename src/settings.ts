import { App, PluginSettingTab, Setting } from "obsidian";
import type GtdBookPlugin from "./main";
import { DEFAULT_MATERIALS, DEFAULT_STRUCTURAL } from "./model";

export class GtdBookSettingTab extends PluginSettingTab {
  private plugin: GtdBookPlugin;

  constructor(app: App, plugin: GtdBookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

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
      .setDesc("Each book chooses its own material folders via `materials:` in its index note (e.g. Characters for a novel, Concepts for a manual). This list is only the default for newly created books.")
      .setHeading();

    new Setting(containerEl)
      .setName("Defaults for new books")
      .setDesc("Comma-separated folder names.")
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_MATERIALS.join(", "))
          .setValue(this.plugin.settings.defaultMaterials.join(", "))
          .onChange(async (v) => {
            const names = v
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            this.plugin.settings.defaultMaterials = names.length
              ? names
              : [...DEFAULT_MATERIALS];
            await this.plugin.saveSettings();
          }),
      );
  }
}
