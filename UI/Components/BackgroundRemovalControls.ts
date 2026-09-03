import { ButtonComponent } from "obsidian";
import type { RGB } from "../../Services/ImageBackgroundRemoval";
import { formatRGBColor, rgbToCSSColor } from "../../Services/ImageBackgroundRemoval";

/**
 * BackgroundRemovalControls component for managing background removal
 * Provides UI controls for sampling background color and adjusting tolerance
 */
export class BackgroundRemovalControls {
	private panelContainer: HTMLElement;
	private gridContainer: HTMLElement;
	private isExpanded: boolean;
	private onToggleMode: () => void;

	// Callbacks
	private onToleranceChange: (tolerance: number) => void;
	private checkImageLoaded: () => boolean;
	private onClearSample: () => void;

	// State
	private tolerance: number;
	private sampledColor: RGB | null;
	private toleranceDebounceTimer: number | null;

	// UI elements
	private toleranceSlider: HTMLInputElement | null;
	private colorSwatch: HTMLElement | null;
	private colorText: HTMLElement | null;
	private instructionText: HTMLElement | null;
	private toleranceValueDisplay: HTMLElement | null;

	constructor(
		panelContainer: HTMLElement,
		onToggleMode: () => void,
		onToleranceChange: (tolerance: number) => void,
		checkImageLoaded: () => boolean,
		onClearSample: () => void,
	) {
		this.panelContainer = panelContainer;
		this.gridContainer = this.panelContainer.createDiv();
		this.onToggleMode = onToggleMode;
		this.onToleranceChange = onToleranceChange;
		this.checkImageLoaded = checkImageLoaded;
		this.onClearSample = onClearSample;
		this.isExpanded = false;

		// Initialize state
		this.tolerance = 15; // default
		this.sampledColor = null;
		this.toleranceDebounceTimer = null;

		// Initialize UI element references
		this.toleranceSlider = null;
		this.colorSwatch = null;
		this.colorText = null;
		this.instructionText = null;
		this.toleranceValueDisplay = null;

		// Build the panel immediately
		this.buildPanel();
	}

	/**
	 * Create the Remove BG button in main toolbar
	 * @param buttonContainer - Container where the button should be added
	 */
	public createRemoveBGButton(buttonContainer: HTMLElement): ButtonComponent {
		const btn = new ButtonComponent(buttonContainer)
			.setIcon("wand-2") // Magic wand icon
			.setTooltip("Remove background")
			.onClick(() => this.toggleRemovalMode());

		return btn;
	}

	/**
	 * Toggle removal mode on/off
	 */
	private toggleRemovalMode() {
		// Delegate to parent modal
		this.onToggleMode();
	}

	/**
	 * Enter background removal mode
	 */
	public enterRemovalMode(sampledColor: RGB | null = null, tolerance = 15) {
		this.isExpanded = true;
		this.panelContainer.show();
		this.tolerance = tolerance;
		if (this.toleranceSlider) {
			this.toleranceSlider.value = tolerance.toString();
		}
		if (this.toleranceValueDisplay) {
			this.toleranceValueDisplay.setText(tolerance.toString());
		}
		this.updateColorDisplay(sampledColor);
	}

	/**
	 * Exit background removal mode
	 */
	public exitRemovalMode() {
		this.isExpanded = false;
		this.panelContainer.hide();
	}

	public isRemovalModeOpen(): boolean {
		return this.isExpanded;
	}

	/**
	 * Update UI when color is sampled
	 */
	public updateSampledColor(color: RGB | null) {
		this.sampledColor = color;
		this.updateColorDisplay(color);
	}

	/**
	 * Get current tolerance value
	 */
	public getTolerance(): number {
		return this.tolerance;
	}

	/**
	 * Get preview enabled state
	 */
	/**
	 * Build the panel UI
	 */
	private buildPanel() {
		// Create instruction text
		this.createInstructionText();

		// Create tolerance control
		this.createToleranceControl();

		// Create color display
		this.createColorDisplay();

	}

	/**
	 * Create instruction text
	 */
	private createInstructionText() {
		this.instructionText = this.gridContainer.createDiv("bg-removal-instruction");
		this.instructionText.setText("Click on background area to sample color");
	}

	/**
	 * Create tolerance slider control
	 */
	private createToleranceControl() {
		const wrapper = this.gridContainer.createDiv("bg-removal-control");
		const toleranceWrapper = wrapper.createDiv("bg-removal-tolerance-wrapper");

		const label = toleranceWrapper.createEl("label", { text: "Tolerance:" });
		label.htmlFor = "bg-tolerance-slider";

		this.toleranceSlider = toleranceWrapper.createEl("input", {
			type: "range",
			cls: "bg-removal-tolerance-slider",
			attr: {
				id: "bg-tolerance-slider",
				min: "0",
				max: "50",
				value: "15",
				step: "1",
			},
		});

		const valueDisplay = toleranceWrapper.createSpan({
			text: "15",
			cls: "bg-removal-tolerance-value",
		});
		this.toleranceValueDisplay = valueDisplay;

		this.toleranceSlider.addEventListener("input", (e) => {
			const value = parseInt((e.target as HTMLInputElement).value);
			this.tolerance = value;
			valueDisplay.setText(value.toString());

			// Debounce tolerance updates (200ms like filters)
			if (this.toleranceDebounceTimer !== null) {
				window.clearTimeout(this.toleranceDebounceTimer);
			}

			this.toleranceDebounceTimer = window.setTimeout(() => {
				this.onToleranceChange(value);
				this.toleranceDebounceTimer = null;
			}, 200);
		});
	}

	/**
	 * Create color display
	 */
	private createColorDisplay() {
		const wrapper = this.gridContainer.createDiv("bg-removal-control");
		const displayWrapper = wrapper.createDiv("bg-removal-color-display");

		displayWrapper.createSpan({ text: "Sampled Color:" });

	this.colorSwatch = displayWrapper.createDiv("bg-removal-color-swatch");
	this.colorSwatch.setCssProps({ backgroundColor: "transparent" });

		this.colorText = displayWrapper.createSpan({
			text: "None",
			cls: "bg-removal-color-text",
		});

		new ButtonComponent(displayWrapper)
			.setButtonText("Clear")
			.setTooltip("Clear sampled background color")
			.onClick(() => {
				this.onClearSample();
				this.updateSampledColor(null);
			});
	}

	/**
	 * Update color display with sampled color
	 */
	private updateColorDisplay(color: RGB | null) {
		if (!this.colorSwatch || !this.colorText) return;

	if (color) {
		this.colorSwatch.setCssProps({ backgroundColor: rgbToCSSColor(color) });
		this.colorText.setText(formatRGBColor(color));
	} else {
		this.colorSwatch.setCssProps({ backgroundColor: "transparent" });
		this.colorText.setText("None");
	}
	}

	/**
	 * Clean up the component
	 */
	public destroy() {
		// Clear any pending debounce timer
		if (this.toleranceDebounceTimer !== null) {
			window.clearTimeout(this.toleranceDebounceTimer);
			this.toleranceDebounceTimer = null;
		}

		this.panelContainer.empty();
	}
}
