# Scan Sketch Architecture Guide

This document is a practical map of the plugin. Read it once from top to bottom, then use the file map and workflow sections when making changes.

## 1. What This Plugin Does

Scan Sketch is an Obsidian plugin that opens a scanner modal, loads a photo, renders it on a canvas, lets the user rotate/crop/filter/remove the background, and exports the result into the vault with a Markdown link.

The source of truth is TypeScript. `main.js` is a generated production bundle and should not be edited by hand.

## 2. Start Here

Read these files in this order:

1. `AGENTS.md` - repository commands, style rules, test setup, and aliases.
2. `main.ts` - plugin registration, command/menu hooks, and settings.
3. `UI/Modals/scannerModal.ts` - the user workflow and component wiring.
4. `UI/Components/ImagePreview.ts` - the stateful image/canvas engine.
5. The service file related to the behavior you want to change.
6. The matching test file under `test/`.

The modal is the coordinator. `ImagePreview` owns image state. Services should contain calculations and pixel operations rather than Obsidian UI behavior.

## 3. High-Level Structure

```text
Obsidian
  |
  v
main.ts
  | registers command, menus, settings
  v
ScannerModal
  | creates and wires components
  +--> ImagePreview       stateful canvas and image pipeline
  +--> FilterControls     filter UI -> ImagePreview.updateFilters
  +--> BackgroundRemovalControls
  |                         -> ImagePreview sampling/tolerance methods
  +--> ExportControls     ImagePreview.getExportCanvas -> vault save/link
  |
  v
Services/
  pure image, geometry, interaction, upload, and vault helpers
```

### Runtime flow

1. `main.ts` creates `ScannerModal` when the command or file/editor menu item is used.
2. `ScannerModal.onOpen()` creates the canvas, controls, and export handler.
3. `ImagePreview.load()` initializes the placeholder and layout.
4. `uploadImageToCanvas()` opens the file picker. The selected file reaches `ImagePreview.darawImage()`.
5. User actions update state in `ImagePreview`, then redraw the canvas.
6. Export calls `ImagePreview.getExportCanvas()`, encodes the returned canvas, saves it with `VaultExport`, and inserts a Markdown link.

## 4. File Map

### Root files

- `main.ts`: Plugin entry point. Registers the `open-sketch-scanner` command, note context-menu actions, settings, and modal creation.
- `manifest.json`: Obsidian plugin metadata.
- `styles.css`: All scanner modal, toolbar, canvas, control-panel, crop-handle, and responsive styling.
- `package.json`: Scripts and dependencies.
- `tsconfig.json`: TypeScript compiler options. It includes every TypeScript file.
- `vitest.config.ts`: Vitest environment, aliases, and test setup.
- `esbuild.config.mjs`: Bundles `main.ts` to `main.js`; Obsidian and its runtime dependencies stay external.
- `version-bump.mjs`, `versions.json`: Release/version metadata.
- `AGENTS.md`: Local working rules. Follow its tabs, double quotes, semicolons, testing, and import guidance.

### UI

#### `UI/Modals/scannerModal.ts`

The application-level coordinator. It:

- Builds the canvas and control-panel containers.
- Constructs `ImagePreview`, `FilterControls`, `BackgroundRemovalControls`, and `ExportControls`.
- Connects callbacks between controls and the preview.
- Handles crop confirmation/cancellation and modal cleanup.
- Uses Obsidian `Notice` for user feedback.

Keep business logic out of this class where possible. A modal method should normally validate, call a component/service, and update UI state.

#### `UI/Components/ImagePreview.ts`

The main state owner and canvas renderer. Important state includes:

- `img`: current source `HTMLImageElement`.
- `toRotateDegree`: current rotation.
- `filterConfig`: brightness, contrast, saturation, B&W, and invert settings.
- `cropPoints`: interactive crop geometry.
- `sampledBackgroundColor`: selected RGB color, or `null`.
- `bgRemovalTolerance`: background matching tolerance.
- `originalImageDataBeforeRemoval`: temporary snapshot used when clearing/cancelling background removal.

Important public methods include:

- `setup()`, `load()`, `darawImage(file)`: lifecycle and image loading. `darawImage` is misspelled in the existing public API; preserve that spelling unless deliberately performing a broader rename.
- `rotate(degree)`: updates rotation and redraws.
- `toggleCroppingPoints()`, `performPerspectiveCrop()`: crop workflow.
- `updateFilters()`, `resetFilters()`: filter workflow.
- `enterBackgroundRemovalMode()`, `sampleBackgroundAtPoint()`, `updateBgRemovalTolerance()`: background workflow.
- `clearBackgroundSample()`: removes the sample and restores the saved pre-removal image.
- `applyBackgroundRemoval()`: exits removal mode while keeping the sampled color active for future redraws.
- `restoreBeforeBackgroundRemoval()`: cancels removal and clears the sampled color.
- `getExportCanvas()`: creates a clean canvas for export without the visible checkerboard.

#### `UI/Components/FilterControls.ts`

Builds filter sliders/toggles. It owns control values only long enough to update the UI, then sends partial `ImageFilterConfig` objects to `ImagePreview.updateFilters()`. Slider changes redraw after a 200 ms debounce in `ImagePreview`.

#### `UI/Components/BackgroundRemovalControls.ts`

Builds the background-removal panel. It displays the sampled RGB color and sends tolerance updates to `ImagePreview`. The canvas itself owns the actual sampled color and pixel processing.

#### `UI/Components/ExportControls.ts`

Creates the save button and handles the export workflow: choose format, generate filename, get attachment path, encode the canvas, save to the vault, and insert a link in the source note.

### Services

Services are intended to be stateless functions. Add reusable image or geometry logic here rather than putting algorithms in UI classes.

- `Services/CanvasRenderer.ts`: checkerboard, placeholder, crop-point, and magnifier drawing helpers.
- `Services/CropPointManager.ts`: crop-point creation, updates, ordering, validation, distances, and output dimensions.
- `Services/ImageBackgroundRemoval.ts`: RGB sampling, Euclidean color distance, background-to-transparent processing, and color formatting.
- `Services/ImageExport.ts`: PNG/JPG/SVG encoding helpers, filename validation, tinting, and binary conversion.
- `Services/ImageFilter.ts`: pixel filters and `ImageFilterConfig` handling. Filter functions mutate `ImageData` in place.
- `Services/ImageTransform.ts`: rotation drawing, rotated dimensions, perspective transformation, and `ImageData` to `HTMLImageElement` conversion.
- `Services/ImageUpload.ts`: native file input setup.
- `Services/Interaction.ts`: crop-point hit testing and pointer-related calculations.
- `Services/PageDetection.ts`: image-processing pipeline that detects document corners.
- `Services/VaultExport.ts`: saving binary blobs through the Obsidian vault API.
- `Services/types.ts`: shared interfaces such as `CropPoint`, `OperationResult`, `ImageDimensions`, and `ImageFilterConfig`.

## 5. The Render Pipeline

The key idea is that the displayed canvas is a view, not the permanent image model. Redrawing reconstructs pixels from the source image and current settings.

### Normal redraw

`ImagePreview.redrawImage()` does this:

1. Read CSS canvas dimensions.
2. Draw the checkerboard.
3. Draw the source image with the current rotation.
4. Apply active filters to canvas `ImageData`.
5. If a background color is sampled, apply background removal to the current rendered image data.
6. Draw crop handles/points separately when crop mode is active.

Because redraws reconstruct the image, every persistent visual setting must be represented in state and applied from the redraw path. If a new setting is only painted once onto the canvas, rotation or another redraw will erase it.

### Background removal state

There are two different concepts:

- The sampled color (`sampledBackgroundColor`) is persistent processing state. It stays active after leaving the panel, so later filter/redraw operations continue applying it.
- The pre-removal snapshot (`originalImageDataBeforeRemoval`) is temporary undo state. It exists so `Clear` or cancellation can restore the image that existed when removal mode began.

`clearBackgroundSample()` cancels the effect and restores the snapshot. `applyBackgroundRemoval()` commits the current effect by discarding the snapshot but retaining the sampled color.

### Export redraw

`getExportCanvas()` builds a clean canvas without the checkerboard:

1. Draw the rotated source image.
2. Read image data.
3. Apply active filters.
4. Apply sampled background removal if a color exists.
5. Put the final image data back on the export canvas.

Keep the display and export pipelines logically aligned. A feature that appears in the preview but is absent from `getExportCanvas()` will not be saved correctly.

## 6. Coordinates and HiDPI

The UI works in CSS pixels while canvas `ImageData` works in device pixels.

The common conversion is:

```ts
const dpr = window.devicePixelRatio || 1;
const actualX = Math.floor(cssX * dpr);
const actualY = Math.floor(cssY * dpr);
```

Remember these rules:

- Pointer positions and crop handles are CSS-pixel coordinates.
- `canvas.width`/`canvas.height` and `ImageData` dimensions are device-pixel dimensions.
- Divide detected image coordinates by `dpr` before displaying crop points.
- Multiply CSS coordinates by `dpr` before sampling or reading pixels.
- Use `canvas.style.width`/`style.height` for layout dimensions and the intrinsic canvas dimensions for pixel dimensions.

Many apparently offset or blank-image bugs are coordinate-space bugs.

## 7. How To Make A Typical Tweak

### Change a filter algorithm

1. Find the function in `Services/ImageFilter.ts`.
2. Confirm whether it mutates `ImageData` in place.
3. Update or add a focused test in `test/ImageFilter.test.ts`.
4. Run that test file.
5. Check that `ImagePreview.applyCurrentFilters()` and `getExportCanvas()` still use the same operation.
6. Run the build.

### Add a new filter setting

1. Add the field and default to `ImageFilterConfig` in `Services/types.ts` and `DEFAULT_FILTER_CONFIG`.
2. Add the control and local UI state in `FilterControls.ts`.
3. Add the pixel operation/order in `ImageFilter.ts`.
4. Ensure the active-filter check includes it wherever one exists.
5. Ensure display redraw and export both apply it.
6. Add service tests and at least one preview/integration-level assertion if the render wiring changes.

### Change background removal

1. Put color-distance or pixel rules in `Services/ImageBackgroundRemoval.ts`.
2. Keep sampling and state transitions in `ImagePreview.ts`.
3. Keep labels, slider values, and swatches in `BackgroundRemovalControls.ts`.
4. Apply the operation in both `redrawImage()` and `getExportCanvas()`.
5. Decide explicitly whether the action is temporary (restore snapshot) or committed (retain sampled state).
6. Test exact matches, tolerance boundaries, non-matching pixels, alpha preservation, and original-data immutability.

### Change crop behavior

1. Update geometry/validation in `CropPointManager.ts`.
2. Update pixel transformation in `ImageTransform.ts`.
3. Update pointer/UI behavior in `ImagePreview.ts` or `scannerModal.ts` only as needed.
4. Remember that crop creates a new image and resets rotation.
5. Test both geometry and the user-visible crop workflow.

### Change export or note insertion

1. Use `ImagePreview.getExportCanvas()` for image pixels.
2. Put format encoding and filename behavior in `ImageExport.ts`.
3. Put vault operations in `VaultExport.ts`.
4. Put UI notices and orchestration in `ExportControls.ts`.
5. Test the pure utility first, then build to catch Obsidian API integration errors.

### Change the interface

- Modal layout and responsive behavior: `styles.css` and `scannerModal.ts`.
- Filter panel: `FilterControls.ts` plus CSS.
- Background panel: `BackgroundRemovalControls.ts` plus CSS.
- Toolbar buttons and mode switching: `scannerModal.ts`.
- Canvas visuals, checkerboard, magnifier, crop handles: `CanvasRenderer.ts`, `ImagePreview.ts`, and CSS.

## 8. Tests and Local Development

Install dependencies once:

```bash
npm install
```

Useful commands:

```bash
npm test
npx vitest test/ImageBackgroundRemoval.test.ts
npx vitest test/ImagePreview.test.ts
npx vitest -t "test name"
npm run build
npm run dev
npm run test:coverage
```

On Windows PowerShell, use `npm.cmd` if the shell blocks `npm.ps1`:

```powershell
npm.cmd test
npm.cmd run build
```

Run the narrow test first after an edit, then run `npm.cmd run build`. The build performs TypeScript checking and production bundling.

### Test environment limitations

Vitest runs in `happy-dom`. Browser canvas, `Image`, `ImageData`, and 2D context behavior are mocked in `test/setup.ts`. The mock context is intentionally lightweight and does not behave like a real browser canvas.

When writing tests:

- Do not assume real rasterization from `drawImage`.
- Use mocked `getImageData`/`putImageData` calls for canvas wiring tests.
- Image loading is asynchronous in the mock; use fake timers and `vi.runAllTimers()` like existing tests.
- Test pure pixel algorithms with real mocked `ImageData` values.
- Use the `Services/` and `UI/` aliases only as configured by Vitest; relative imports are also valid.

## 9. Debugging Checklist

When a visual change does not appear:

1. Is the state actually updated? Add a temporary log or inspect the relevant getter/state.
2. Does the action call `redrawImage()` or another render method?
3. Does that render method reconstruct the image and overwrite the previous pixels?
4. Is the operation applied after the other operation it needs to follow?
5. Does export repeat the same operation?
6. Are CSS and device-pixel coordinates being mixed?
7. Is a debounce timer delaying the visible update?
8. Is the panel callback wired to the correct `ImagePreview` method?

When export is wrong but the preview is right, inspect `getExportCanvas()` first.

When a change works once but disappears after rotation/filtering, inspect `redrawImage()` and make the setting part of persistent state.

When Clear or mode switching behaves incorrectly, distinguish commit behavior from restore/cancel behavior. Do not use a restore method to close a panel unless closing is intentionally cancellation.

## 10. Project Conventions

- Use tabs for indentation, double quotes, and semicolons.
- Import Obsidian APIs first, then local imports separated by a blank line.
- Prefer stateless service functions and small focused methods.
- Keep public APIs stable unless a rename is intentional.
- Avoid editing generated `main.js` directly; regenerate it with the build.
- Avoid unrelated formatting changes.
- Add tests beside the behavior they cover.
- Keep comments short and explain only non-obvious reasoning.

## 11. A Safe Working Loop

```text
Choose the behavior
  -> find the owning file and nearest test
  -> state the current render/state hypothesis
  -> make the smallest edit
  -> run the narrow test immediately
  -> repair locally if needed
  -> run npm.cmd run build
  -> inspect git diff and git diff --check
```

Before considering a tweak complete, answer these questions:

- Where is the state stored?
- Which method computes the result?
- Which redraw paths can overwrite it?
- Does export apply it too?
- What is the restore/cancel behavior?
- Is there a focused test for the changed rule?

That set of questions will take you surprisingly far in this codebase.
