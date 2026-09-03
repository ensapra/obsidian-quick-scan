import { ButtonComponent, Notice } from "obsidian";
import type { ImageFilterConfig } from "../../Services/types";

/**
 * FilterControls component for managing image filters
 * Provides UI controls for brightness, contrast, saturation, and B&W conversion
 */
export class FilterControls {
	private panelContainer: HTMLElement;
	private gridContainer: HTMLElement;
	private isExpanded: boolean;
	private onFilterChange: (config: Partial<ImageFilterConfig>) => void;
	private checkImageLoaded: () => boolean;
	private onToggleMode: () => void;

	// Current filter values
	private brightness: number;
	private contrast: number;
	private saturation: number;
	private blackAndWhite: boolean;
	private invert: boolean;

	// UI elements
	private brightnessSlider: HTMLInputElement | null;
	private contrastSlider: HTMLInputElement | null;
	private saturationSlider: HTMLInputElement | null;
	private bwToggle: HTMLInputElement | null;
	private invertToggle: HTMLInputElement | null;

	constructor(
		panelContainer: HTMLElement,
		onFilterChange: (config: Partial<ImageFilterConfig>) => void,
		checkImageLoaded: () => boolean,
		onToggleMode: () => void,
	) {
		this.panelContainer = panelContainer;
		this.gridContainer = this.panelContainer.createDiv();
		this.onFilterChange = onFilterChange;
		this.checkImageLoaded = checkImageLoaded;
		this.onToggleMode = onToggleMode;
		this.isExpanded = false;

		// Initialize filter values
		this.brightness = 0;
		this.contrast = 0;
		this.saturation = 0;
		this.blackAndWhite = false;
		this.invert = false;

		// Initialize UI element references
		this.brightnessSlider = null;
		this.contrastSlider = null;
		this.saturationSlider = null;
		this.bwToggle = null;
		this.invertToggle = null;

		// Build the panel immediately
		this.buildPanel();
	}

	/**
	 * Create the Edit button that toggles the filter panel
	 * @param buttonContainer - Container where the button should be added
	 */
	public createEditButton(buttonContainer: HTMLElement): ButtonComponent {
		const btn = new ButtonComponent(buttonContainer)
			.setIcon("sliders-horizontal")
			.setTooltip("Edit image (filters)")
			.onClick(() => this.onToggleMode());

		return btn;
	}

	/**
	 * Toggle the filter panel visibility
	 */
	public togglePanel() {
		// Check if image is loaded before showing panel
		if (!this.isExpanded && !this.checkImageLoaded()) {
			new Notice("Please upload photo first!");
			return;
		}
		
		if (this.isExpanded) {
			this.panelContainer.hide();
		} else {
			this.panelContainer.show();
		}
		this.isExpanded = !this.isExpanded;
	}

	public closePanel() {
		this.isExpanded = false;
		this.panelContainer.hide();
	}

	public isPanelOpen(): boolean {
		return this.isExpanded;
	}

	/**
	 * Build the filter panel with all controls
	 */
	private buildPanel() {
		// Create filter controls
		this.createBrightnessControl();
		this.createContrastControl();
		this.createSaturationControl();
		this.createBlackAndWhiteToggle();
		this.createInvertToggle();
	}

	/**
	 * Create brightness slider control
	 */
	private createBrightnessControl() {
		if (!this.gridContainer) return;

		const wrapper = this.gridContainer.createDiv("filter-control");
		
		const label = wrapper.createDiv("filter-label");
		label.createSpan({ text: "Brightness" });
		const valueInput = label.createEl("input", {
			type: "number",
			cls: "filter-value",
			attr: { min: "-100", max: "100", step: "1", value: "0" },
		});

		this.brightnessSlider = wrapper.createEl("input", {
			type: "range",
			cls: "filter-slider",
			attr: {
				min: "-100",
				max: "100",
				value: "0",
				step: "1",
			},
		});

		this.wireNumericControl(this.brightnessSlider, valueInput, (value) => {
			this.brightness = value;
			this.onFilterChange({ brightness: value });
		});
	}

	/**
	 * Create contrast slider control
	 */
	private createContrastControl() {
		if (!this.gridContainer) return;

		const wrapper = this.gridContainer.createDiv("filter-control");
		
		const label = wrapper.createDiv("filter-label");
		label.createSpan({ text: "Contrast" });
		const valueInput = label.createEl("input", {
			type: "number",
			cls: "filter-value",
			attr: { min: "-100", max: "100", step: "1", value: "0" },
		});

		this.contrastSlider = wrapper.createEl("input", {
			type: "range",
			cls: "filter-slider",
			attr: {
				min: "-100",
				max: "100",
				value: "0",
				step: "1",
			},
		});

		this.wireNumericControl(this.contrastSlider, valueInput, (value) => {
			this.contrast = value;
			this.onFilterChange({ contrast: value });
		});
	}

	/**
	 * Create saturation slider control
	 */
	private createSaturationControl() {
		if (!this.gridContainer) return;

		const wrapper = this.gridContainer.createDiv("filter-control");
		
		const label = wrapper.createDiv("filter-label");
		label.createSpan({ text: "Saturation" });
		const valueInput = label.createEl("input", {
			type: "number",
			cls: "filter-value",
			attr: { min: "-100", max: "100", step: "1", value: "0" },
		});

		this.saturationSlider = wrapper.createEl("input", {
			type: "range",
			cls: "filter-slider",
			attr: {
				min: "-100",
				max: "100",
				value: "0",
				step: "1",
			},
		});

		this.wireNumericControl(this.saturationSlider, valueInput, (value) => {
			this.saturation = value;
			this.onFilterChange({ saturation: value });
		});
	}

	/**
	 * Create black and white toggle
	 */
	private createBlackAndWhiteToggle() {
		if (!this.gridContainer) return;

		const wrapper = this.gridContainer.createDiv("filter-control");
		
		const label = wrapper.createDiv("filter-label");
		label.createSpan({ text: "Black & White (Document Mode)" });

		const toggleWrapper = wrapper.createDiv("filter-toggle-wrapper");
		
		this.bwToggle = toggleWrapper.createEl("input", {
			type: "checkbox",
			cls: "filter-checkbox",
		});

		this.bwToggle.addEventListener("change", (e) => {
			const checked = (e.target as HTMLInputElement).checked;
			this.blackAndWhite = checked;
			this.onFilterChange({ blackAndWhite: checked });

			// Disable saturation when B&W is enabled
			if (this.saturationSlider) {
				this.saturationSlider.disabled = checked;
			}
		});
	}

	private createInvertToggle() {
		if (!this.gridContainer) return;

		const wrapper = this.gridContainer.createDiv("filter-control");
		const label = wrapper.createDiv("filter-label");
		label.createSpan({ text: "Invert Colors" });

		const toggleWrapper = wrapper.createDiv("filter-toggle-wrapper");
		this.invertToggle = toggleWrapper.createEl("input", {
			type: "checkbox",
			cls: "filter-checkbox",
		});

		this.invertToggle.addEventListener("change", (e) => {
			const checked = (e.target as HTMLInputElement).checked;
			this.invert = checked;
			this.onFilterChange({ invert: checked });
		});
	}

	private wireNumericControl(
		slider: HTMLInputElement,
		valueInput: HTMLInputElement,
		onChange: (value: number) => void,
	) {
		const updateValue = (rawValue: string) => {
			const parsedValue = Number(rawValue);
			if (!Number.isFinite(parsedValue)) return;

			const min = Number(slider.min);
			const max = Number(slider.max);
			const value = Math.max(min, Math.min(max, Math.round(parsedValue)));
			slider.value = value.toString();
			valueInput.value = value.toString();
			onChange(value);
		};

		slider.addEventListener("input", () => updateValue(slider.value));
		slider.addEventListener("dblclick", () => updateValue("0"));
		valueInput.addEventListener("input", () => updateValue(valueInput.value));
		valueInput.addEventListener("blur", () => {
			if (!Number.isFinite(Number(valueInput.value))) {
				valueInput.value = slider.value;
			}
		});
	}

	/**
	 * Clean up the component
	 */
	public destroy() {
		this.panelContainer.empty();
	}
}
