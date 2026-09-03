import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
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

		this.addCommand({
			id: "open-sketch-scanner",
			name: "Open sketch scanner",
			icon: "scan",
			callback: () => void this.openScanner(),
		});

		this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
			if (!(file instanceof TFile)) return;

			menu.addItem((item) =>
				item
					.setTitle("Scan note")
					.setIcon("scan")
					.onClick(() => void this.openScanner(file.path)),
			);
		}));

		this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => {
			const file = info.file;
			if (!file) return;

			menu.addItem((item) =>
				item
					.setTitle("Scan note")
					.setIcon("scan")
					.onClick(() => void this.openScanner(file.path)),
			);
		}));

		this.addSettingTab(new HandwrittenScannerSettingTab(this.app, this));
	}

	private async openScanner(sourcePath?: string): Promise<void> {
		const { ScannerModal } = await import("./UI/Modals/scannerModal");
		new ScannerModal(this.app, this, sourcePath).open();
	}

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
