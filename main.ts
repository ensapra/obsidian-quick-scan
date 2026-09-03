import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { ExportFormat } from "./Services/ImageExport";

interface HandwrittenScannerSettings {
	exportDefaultFormat: ExportFormat;
	closeAfterExport: boolean;
}

const DEFAULT_SETTINGS: HandwrittenScannerSettings = {
	exportDefaultFormat: "png",
	closeAfterExport: true,
};

export default class HandWrittenPlugin extends Plugin {
	settings: HandwrittenScannerSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon("scan", "Scanner", async (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			// Lazy load ScannerModal only when needed
			const { ScannerModal } = await import("./UI/Modals/scannerModal");
			new ScannerModal(this.app, this).open();
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sketch-scanner",
			name: "Open sketch scanner",
			icon: "scan",
			callback: async () => {
				// Lazy load ScannerModal only when needed
				const { ScannerModal } = await import("./UI/Modals/scannerModal");
				new ScannerModal(this.app, this).open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new HandwrittenScannerSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		const savedSettings = await this.loadData() as Partial<HandwrittenScannerSettings> | null;

		this.settings = {
			...DEFAULT_SETTINGS,
			...savedSettings,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class HandwrittenScannerSettingTab extends PluginSettingTab {
	plugin: HandWrittenPlugin;

	constructor(app: App, plugin: HandWrittenPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Default export format")
			.setDesc("Default file format for exporting scanned images")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("png", "PNG")
					.addOption("jpg", "JPG")
					.addOption("svg", "SVG")
					.setValue(this.plugin.settings.exportDefaultFormat)
					.onChange(async (value: ExportFormat) => {
						this.plugin.settings.exportDefaultFormat = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Close scanner after export")
			.setDesc("Automatically close the scanner window after successfully exporting an image")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.closeAfterExport)
					.onChange(async (value) => {
						this.plugin.settings.closeAfterExport = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
