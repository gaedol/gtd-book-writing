import { App, PluginSettingTab, Setting } from "obsidian";
import type GtdBookPlugin from "./main";
import { DEFAULT_RESERVED, ReservedNames } from "./model";

export class GtdBookSettingTab extends PluginSettingTab {
  private plugin: GtdBookPlugin;

  constructor(app: App, plugin: GtdBookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: "Reserved folder names" });
    containerEl.createEl("p", {
      text: "Rename the structural folders the plugin recognizes (e.g. for localization). Defaults are English.",
      cls: "setting-item-description",
    });

    const keys: (keyof ReservedNames)[] = [
      "manuscript",
      "characters",
      "locations",
      "research",
      "notes",
    ];

    for (const key of keys) {
      new Setting(containerEl)
        .setName(key[0].toUpperCase() + key.slice(1))
        .setDesc(`Default: ${DEFAULT_RESERVED[key]}`)
        .addText((text) =>
          text
            .setPlaceholder(DEFAULT_RESERVED[key])
            .setValue(this.plugin.settings.reserved[key])
            .onChange(async (value) => {
              this.plugin.settings.reserved[key] =
                value.trim() || DEFAULT_RESERVED[key];
              await this.plugin.saveSettings();
            }),
        );
    }
  }
}
