import { App, ButtonComponent, Modal, Notice } from "obsidian";
import { uploadImageToCanvas } from "Services/ImageUpload";
import { detectPageCorners } from "Services/PageDetection";
import { ImagePreview } from "UI/Components/ImagePreview";
import { FilterControls } from "UI/Components/FilterControls";
import { BackgroundRemovalControls } from "UI/Components/BackgroundRemovalControls";
import { ExportControls } from "UI/Components/ExportControls";
import type HandWrittenPlugin from "../../main";

export class ScannerModal extends Modal {
	private plugin: HandWrittenPlugin;
	private sourcePath?: string;
	private container: HTMLElement;
	private buttonWrapper: HTMLElement;
	private filterPanelWrapper: HTMLElement;
	private bgRemovalPanelWrapper: HTMLElement;
	private confirmButtonWrapper: HTMLElement;
	private canvas: ImagePreview;
	private btnPhotoUpload: ButtonComponent;
	private btnPhotoCamera: ButtonComponent;
	private btnPhotoRotateCW: ButtonComponent;
	private btnPhotoRotateACW: ButtonComponent;
	private btnDetectCorners: ButtonComponent;
	private btnCrop: ButtonComponent;
	private btnRemoveBG: ButtonComponent;
	private btnEdit: ButtonComponent;
	private btnExport: ButtonComponent;
	private btnConfirm: ButtonComponent;
	private btnCancel: ButtonComponent;
	private processingNotice: Notice | null;
	private filterControls: FilterControls;
	private bgRemovalControls: BackgroundRemovalControls;
	private exportControls: ExportControls;
	private launchAction: "none" | "gallery" | "camera";

constructor(
		app: App,
		plugin: HandWrittenPlugin,
		sourcePath?: string,
		launchAction: "none" | "gallery" | "camera" = "none",
	) {
		super(app);
		this.plugin = plugin;
		this.sourcePath = sourcePath;
		this.launchAction = launchAction;
		this.setTitle("Scan your note");
		this.modalEl.addClass("scanner-modal");
		this.modalEl.style.setProperty(
			"--scan-toolbar-icon-size",
			`${plugin.settings.toolbarIconSize || 40}px`,
		);

		this.container = this.contentEl.createDiv("scanner-modal-container");
		this.canvas = new ImagePreview(
			this.container,
			this.container.createEl("canvas"),
			1,  // Square 1:1 ratio for initial placeholder
		);

		this.filterPanelWrapper = this.contentEl.createDiv("filter-panel-wrapper");
		this.filterPanelWrapper.hide();
		this.bgRemovalPanelWrapper = this.contentEl.createDiv("bg-removal-panel-wrapper");
		this.bgRemovalPanelWrapper.hide();
		this.buttonWrapper = this.contentEl.createDiv("button-wrapper");
		this.confirmButtonWrapper = this.contentEl.createDiv(
			"confirm-button-wrapper",
		);
		this.confirmButtonWrapper.hide();
		this.processingNotice = null;
	}

	onOpen() {
		try {
		this.canvas.setup();
		this.canvas.load();
	} catch (error) {
		console.error(`Error: ${error.message}`);
		new Notice(
			"Cannot create image preview canvas, please review details in console",
		);
	}

		//btn setup
		this.btnPhotoCamera = new ButtonComponent(this.buttonWrapper)
			.setIcon("camera")
			.setTooltip("Take a photo with camera")
			.setCta()
			.onClick(() => this.openImagePicker(true));

		this.btnPhotoUpload = new ButtonComponent(this.buttonWrapper)
			.setIcon("image")
			.setTooltip("Choose image from gallery")
			.setCta()
			.onClick(() => this.openImagePicker(false));

		this.btnPhotoRotateCW = new ButtonComponent(this.buttonWrapper)
			.setIcon("rotate-cw")
			.setTooltip("Rotate image 90° clockwise")
			.onClick(() => {
				const result = this.canvas.rotate(90);
				if (!result.success) {
					new Notice(result.message);
				}
			});
		this.btnPhotoRotateACW = new ButtonComponent(this.buttonWrapper)
			.setIcon("rotate-ccw")
			.setTooltip("Rotate image 90° counter-clockwise")
			.onClick(() => {
				const result = this.canvas.rotate(-90);
				if (!result.success) {
					new Notice(result.message);
				}
			});

		this.btnDetectCorners = new ButtonComponent(this.buttonWrapper)
			.setIcon("scan")
			.setTooltip("Detect page corners")
			.onClick(() => this.detectAndShowCorners());

		this.btnCrop = new ButtonComponent(this.buttonWrapper)
			.setIcon("crop")
			.setTooltip("Crop image")
			.onClick(() => this.toggleCropMode());

		// Initialize background removal controls
		this.bgRemovalControls = new BackgroundRemovalControls(
			this.bgRemovalPanelWrapper,
			() => this.toggleBackgroundRemovalMode(),
			(tolerance) => this.canvas.updateBgRemovalTolerance(tolerance),
			() => this.canvas.isImageLoaded(),
			() => this.canvas.clearBackgroundSample(),
		);
		this.btnRemoveBG = this.bgRemovalControls.createRemoveBGButton(this.buttonWrapper);

		// Initialize filter controls (pass the separate panel wrapper)
		this.filterControls = new FilterControls(
			this.filterPanelWrapper,
			(config) => this.canvas.updateFilters(config),
			() => this.canvas.isImageLoaded(),
			() => this.toggleFilterMode(),
		);
		this.btnEdit = this.filterControls.createEditButton(this.buttonWrapper);

		// Initialize export controls
		this.exportControls = new ExportControls(
			this.app,
			() => this.canvas.getExportCanvas(),
			this.plugin,
			() => this.canvas.isImageLoaded(),
			() => this.close(), // Close scanner modal after export
			this.sourcePath,
		);
		this.btnExport = this.exportControls.createExportButton(this.buttonWrapper);

		// Confirmation buttons
		this.btnConfirm = new ButtonComponent(this.confirmButtonWrapper)
			.setIcon("check")
			.setTooltip("Confirm")
			.setCta()
			.onClick(() => this.confirmCrop());

		this.btnCancel = new ButtonComponent(this.confirmButtonWrapper)
			.setIcon("x")
			.setTooltip("Cancel")
			.onClick(() => this.cancelCrop());
		this.setImageControlsEnabled(false);

		if (this.launchAction !== "none") {
			this.openImagePicker(this.launchAction === "camera");
		}
	}

	private openImagePicker(openCamera: boolean): void {
		uploadImageToCanvas((file) => {
			this.canvas.darawImage(file);
			this.setImageControlsEnabled(true);
		}, openCamera);
	}

	private setImageControlsEnabled(enabled: boolean): void {
		this.btnPhotoRotateCW?.setDisabled(!enabled);
		this.btnPhotoRotateACW?.setDisabled(!enabled);
		this.btnDetectCorners?.setDisabled(!enabled);
		this.btnCrop?.setDisabled(!enabled);
		this.btnRemoveBG?.setDisabled(!enabled);
		this.btnEdit?.setDisabled(!enabled);
		this.btnExport?.setDisabled(!enabled);
	}

	private detectAndShowCorners() {
		if (!this.canvas.isImageLoaded()) {
			new Notice("Please upload photo first!");
			return;
		}

		// Get image data for page detection
		const exportCanvas = this.canvas.getExportCanvas();
		const ctx = exportCanvas.getContext("2d");
		if (!ctx) {
			new Notice("Failed to get canvas context");
			return;
		}

		const imageData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
		const dpr = window.devicePixelRatio || 1;
		
		new Notice("Detecting page corners...", 2000);
		
		// Attempt auto-detection
		const detectedCorners = detectPageCorners(imageData);
		
		if (detectedCorners) {
			// Scale corners from device pixels to CSS pixels
			const scaledCorners = detectedCorners.map(corner => ({
				x: corner.x / dpr,
				y: corner.y / dpr,
				isDragging: false
			}));
			
			new Notice(`✓ Detected corners at: TL(${Math.round(scaledCorners[0].x)},${Math.round(scaledCorners[0].y)}) TR(${Math.round(scaledCorners[1].x)},${Math.round(scaledCorners[1].y)}) BL(${Math.round(scaledCorners[2].x)},${Math.round(scaledCorners[2].y)}) BR(${Math.round(scaledCorners[3].x)},${Math.round(scaledCorners[3].y)})`, 8000);
			
			// Show the detected corners on the canvas
			const { success } = this.canvas.toggleCroppingPoints(true, scaledCorners);
			if (success) {
				// Hide main buttons and show confirm/cancel buttons
				this.buttonWrapper.hide();
				this.confirmButtonWrapper.show();
			} else {
				new Notice("Failed to display detected corners");
			}
		} else {
			new Notice("✗ No page corners detected. Try adjusting the image or use manual crop.", 5000);
		}
	}

	private toggleCropMode() {
		const { success, message } = this.canvas.toggleCroppingPoints(true);
		new Notice(message);
		if (!success) {
			return;
		}
		// Hide main buttons and show confirm/cancel buttons
		this.buttonWrapper.hide();
		this.confirmButtonWrapper.show();
	}

	private async confirmCrop() {
		try {
			// Show processing notice
			this.processingNotice = new Notice("Processing perspective crop...", 0);

			// Disable buttons during processing
			this.setButtonsEnabled(false);

			// Add a small delay to allow UI to update
			await new Promise(resolve => window.setTimeout(resolve, 100));

			// Perform the perspective crop
			const result = this.canvas.performPerspectiveCrop();

			// Hide processing notice
			if (this.processingNotice) {
				this.processingNotice.hide();
				this.processingNotice = null;
			}

			if (result.success) {
				// Show success message
				new Notice(result.message, 3000);

				// Wait a brief moment for the crop to render
				await new Promise(resolve => window.setTimeout(resolve, 100));

				// Hide crop confirmation buttons and show main buttons
				this.confirmButtonWrapper.hide();
				this.buttonWrapper.show();

				// Re-enable buttons
				this.setButtonsEnabled(true);
			} else {
				// Show error message
				new Notice(result.message, 5000);

				// Re-enable buttons so user can try again or cancel
				this.setButtonsEnabled(true);
			}
		} catch (error) {
			// Hide processing notice if it's still showing
			if (this.processingNotice) {
				this.processingNotice.hide();
				this.processingNotice = null;
			}

			// Log error for debugging
			console.error("Error in confirmCrop:", error);

			// Show user-friendly error message
			new Notice(
				`Crop failed: ${error.message || "Unknown error"}\nCheck console for details.`,
				6000,
			);

			// Re-enable buttons
			this.setButtonsEnabled(true);
		}
	}

	private cancelCrop() {
		// Remove the cropping points
		const { message } = this.canvas.toggleCroppingPoints(false);
		new Notice(message, 2000);

		// Hide crop confirmation buttons and show main buttons
		this.confirmButtonWrapper.hide();
		this.buttonWrapper.show();
	}

	private toggleBackgroundRemovalMode() {
		if (this.bgRemovalControls.isRemovalModeOpen()) {
			this.canvas.applyBackgroundRemoval();
			this.exitBackgroundRemovalMode();
			return;
		}

		if (this.filterControls.isPanelOpen()) {
			this.filterControls.closePanel();
		}

		const result = this.canvas.enterBackgroundRemovalMode(
			(color) => this.bgRemovalControls.updateSampledColor(color)
		);

		if (!result.success) {
			new Notice(result.message);
			return;
		}

		// Show BG removal panel
		this.bgRemovalControls.enterRemovalMode(
			this.canvas.getSampledBackgroundColor(),
			this.canvas.getBgRemovalTolerance(),
		);
		this.bgRemovalPanelWrapper.show();

		new Notice(result.message);
	}

	private exitBackgroundRemovalMode() {
		this.bgRemovalControls.exitRemovalMode();
		this.bgRemovalPanelWrapper.hide();
		this.buttonWrapper.show();
	}

	private toggleFilterMode() {
		if (this.bgRemovalControls.isRemovalModeOpen()) {
			this.canvas.applyBackgroundRemoval();
			this.exitBackgroundRemovalMode();
		}

		this.filterControls.togglePanel();
	}

	/**
	 * Enable or disable all buttons during processing
	 */
	private setButtonsEnabled(enabled: boolean) {
		// Main buttons
		this.btnPhotoUpload.setDisabled(!enabled);
		this.btnPhotoRotateCW.setDisabled(!enabled);
		this.btnPhotoRotateACW.setDisabled(!enabled);
		this.btnDetectCorners.setDisabled(!enabled);
		this.btnCrop.setDisabled(!enabled);
		this.btnRemoveBG.setDisabled(!enabled);
		this.btnEdit.setDisabled(!enabled);
		this.btnExport.setDisabled(!enabled);

		// Confirmation buttons
		this.btnConfirm.setDisabled(!enabled);
		this.btnCancel.setDisabled(!enabled);
	}

	onClose() {
		// Clean up processing notice if modal is closed while processing
		if (this.processingNotice) {
			this.processingNotice.hide();
			this.processingNotice = null;
		}

		// Clean up filter controls
		if (this.filterControls) {
			this.filterControls.destroy();
		}

		// Clean up background removal controls
		if (this.bgRemovalControls) {
			this.bgRemovalControls.destroy();
		}
		
		this.canvas.unload();
	}
}
