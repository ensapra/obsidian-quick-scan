/**
 * Export controls component
 * Creates and manages the export button in the scanner modal
 */

import { App, ButtonComponent, Notice, TFile } from "obsidian";
import {
	exportCanvasToJPG,
	exportCanvasToPNG,
	exportCanvasToSVG,
	generateDefaultFilename,
	getFileExtension,
} from "Services/ImageExport";
import { saveToVault } from "Services/VaultExport";
import type HandWrittenPlugin from "../../main";

export class ExportControls {
	private app: App;
	private getCanvas: () => HTMLCanvasElement;
	private plugin: HandWrittenPlugin;
	private isImageLoaded: () => boolean;
	private onExportComplete?: () => void;
	private sourcePath?: string;

	constructor(
		app: App,
		getCanvas: () => HTMLCanvasElement,
		plugin: HandWrittenPlugin,
		isImageLoaded: () => boolean,
		onExportComplete?: () => void,
		sourcePath?: string,
	) {
		this.app = app;
		this.getCanvas = getCanvas;
		this.plugin = plugin;
		this.isImageLoaded = isImageLoaded;
		this.onExportComplete = onExportComplete;
		this.sourcePath = sourcePath;
	}

	/**
	 * Create export button for button wrapper
	 * @param container - Button wrapper element
	 * @returns Export button component
	 */
	public createExportButton(container: HTMLElement): ButtonComponent {
		return new ButtonComponent(container)
			.setIcon("check")
			.setTooltip("Save scan to note")
			.setCta()
			.onClick(() => void this.handleExportClick());
	}

	private async handleExportClick(): Promise<void> {
		if (!this.isImageLoaded()) {
			new Notice("Please upload photo first!");
			return;
		}

		const sourcePath = this.sourcePath ?? this.app.workspace.getActiveFile()?.path;
		if (!sourcePath) {
			new Notice("Open a note before saving a scan.");
			return;
		}

		const format = this.plugin.settings.exportDefaultFormat;
		const filename = generateDefaultFilename() + getFileExtension(format);
		const processingNotice = new Notice("Saving scan...", 0);

		try {
			const canvas = this.getCanvas();
			const blob = format === "png"
				? await exportCanvasToPNG(canvas)
				: format === "jpg"
					? await exportCanvasToJPG(canvas)
					: exportCanvasToSVG(canvas);
			const filePath = await this.app.fileManager.getAvailablePathForAttachment(
				filename,
				sourcePath,
			);
			const file = await saveToVault(this.app.vault, filePath, blob);
			await this.insertLink(sourcePath, file);

			processingNotice.hide();
			new Notice(`Saved scan to ${file.path}`, 3000);
			this.onExportComplete?.();
		} catch (error) {
			processingNotice.hide();
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to save scan: ${message}`, 5000);
		}
	}

	private async insertLink(sourcePath: string, attachment: TFile): Promise<void> {
		const markdownLink = `!${this.app.fileManager.generateMarkdownLink(
			attachment,
			sourcePath,
		)}`;
		const activeFile = this.app.workspace.getActiveFile();
		const editor = this.app.workspace.activeEditor?.editor;
		if (activeFile?.path === sourcePath && editor) {
			const cursor = editor.getCursor();
			editor.replaceRange(`${markdownLink}\n`, cursor);
			return;
		}

		const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
		if (sourceFile instanceof TFile) {
			await this.app.vault.process(
				sourceFile,
				(content) => `${content}${content.endsWith("\n") ? "" : "\n"}\n${markdownLink}\n`,
			);
		}
	}
}
