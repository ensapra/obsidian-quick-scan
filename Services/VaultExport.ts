/**
 * Vault export utilities for saving files to Obsidian vault
 * Handles folder creation, file saving, and path validation
 */

import { Vault, TFile, TFolder } from "obsidian";
import { blobToArrayBuffer } from "./ImageExport";

/**
 * Save blob to vault as binary file
 * @param vault - Obsidian vault instance
 * @param filePath - Full path resolved by Obsidian's attachment settings
 * @param blob - Blob to save
 * @returns Created TFile
 * @throws Error if file exists or save fails
 */
export async function saveToVault(
	vault: Vault,
	filePath: string,
	blob: Blob,
): Promise<TFile> {
	// Convert blob to ArrayBuffer
	const arrayBuffer = await blobToArrayBuffer(blob);

	// Create binary file in vault
	try {
		const file = await vault.createBinary(filePath, arrayBuffer);
		return file;
	} catch (error) {
		throw new Error(`Failed to save file: ${error.message}`);
	}
}
