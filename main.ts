import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import type { ExportFormat } from "./Services/ImageExport";
import { ScannerModal } from "./UI/Modals/scannerModal";

interface HandwrittenScannerSettings {
	exportDefaultFormat: ExportFormat;
	closeAfterExport: boolean;
	toolbarIconSize: number;
	quickSketchAction: "none" | "gallery" | "camera";
}

const DEFAULT_TOOLBAR_ICON_SIZE = 40;

const DEFAULT_SETTINGS: HandwrittenScannerSettings = {
	exportDefaultFormat: "png",
	closeAfterExport: true,
	toolbarIconSize: DEFAULT_TOOLBAR_ICON_SIZE,
	quickSketchAction: "camera",
};

export default class HandWrittenPlugin extends Plugin {
	settings: HandwrittenScannerSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "open-sketch-scanner",
			name: "Scan your document",
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

	private openScanner(sourcePath?: string): void {
		new ScannerModal(this.app, this, sourcePath, this.settings.quickSketchAction).open();
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
			.setName("Quick sketch action")
			.setDesc("Choose what opens automatically when starting Quick Scan")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("none", "Do nothing")
					.addOption("gallery", "Open gallery")
					.addOption("camera", "Open camera")
					.setValue(this.plugin.settings.quickSketchAction)
					.onChange(async (value) => {
						this.plugin.settings.quickSketchAction = value as "none" | "gallery" | "camera";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Toolbar icon size")
			.setDesc("Size of the scanner toolbar icons, independent of Obsidian's interface zoom")
			.addSlider((slider) =>
				slider
					.setLimits(32, 72, 4)
					.setValue(this.plugin.settings.toolbarIconSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.toolbarIconSize = value;
						await this.plugin.saveSettings();
					}),
			)
			.addButton((button) =>
				button
					.setButtonText("Reset")
					.setTooltip("Reset toolbar icon size to 40px")
					.onClick(async () => {
						this.plugin.settings.toolbarIconSize = DEFAULT_TOOLBAR_ICON_SIZE;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

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
