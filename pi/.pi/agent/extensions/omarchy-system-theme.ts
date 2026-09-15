/**
 * Syncs pi's theme with the active Omarchy theme.
 *
 * Omarchy renders its active theme to:
 *   ~/.local/state/omarchy/current/theme/pi.json
 * Monitors the file for changes and applies it dynamically.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const home = process.env.HOME ?? "";
const omarchyThemePath = join(home, ".local/state/omarchy/current/theme/pi.json");

function loadOmarchyTheme(): any | null {
	if (!existsSync(omarchyThemePath)) return null;
	try {
		const content = readFileSync(omarchyThemePath, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function getThemeMtime(): number | null {
	if (!existsSync(omarchyThemePath)) return null;
	try {
		return statSync(omarchyThemePath).mtimeMs;
	} catch {
		return null;
	}
}

export default function (pi: ExtensionAPI) {
	let intervalId: ReturnType | null = null;
	let currentMtime: number | null = null;

	pi.on("session_start", (_event, ctx) => {
		// Load initial theme
		const theme = loadOmarchyTheme();
		if (theme) {
			ctx.ui.setTheme(theme);
			currentMtime = getThemeMtime();
		}

		// Poll for theme changes (Omarchy regenerates pi.json when switching themes)
		intervalId = setInterval(() => {
			const nextMtime = getThemeMtime();
			if (nextMtime !== null && nextMtime !== currentMtime) {
				currentMtime = nextMtime;
				const nextTheme = loadOmarchyTheme();
				if (nextTheme) {
					ctx.ui.setTheme(nextTheme);
				}
			}
		}, 2000);
	});

	pi.on("session_shutdown", () => {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	});
}
