/**
 * Pi Notify Extension
 *
 * Sends a native terminal notification when Pi agent is done and waiting for input.
 * Only notifies if the terminal window does NOT have focus (Hyprland-specific check).
 * Supports multiple terminal protocols:
 * - OSC 777: Ghostty, iTerm2, WezTerm, rxvt-unicode
 * - OSC 99: Kitty
 * - Windows toast: Windows Terminal (WSL)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const KNOWN_TERMINALS = new Set([
	"alacritty",
	"foot",
	"footclient",
	"kitty",
	"ghostty",
	"wezterm",
	"wezterm-gui",
	"konsole",
	"gnome-terminal",
	"terminator",
	"xterm",
	"urxvt",
	"rxvt",
]);

function getParentPid(pid: number): number | null {
	try {
		const { execSync } = require("child_process");
		const result = execSync(`ps -o ppid= -p ${pid}`, { encoding: "utf-8", timeout: 1000 });
		const ppid = parseInt(result.trim(), 10);
		return isNaN(ppid) || ppid <= 1 ? null : ppid;
	} catch {
		return null;
	}
}

function getProcessComm(pid: number): string | null {
	try {
		const { execSync } = require("child_process");
		const result = execSync(`ps -o comm= -p ${pid}`, { encoding: "utf-8", timeout: 1000 });
		return result.trim().toLowerCase();
	} catch {
		return null;
	}
}

function getTerminalPid(): number | null {
	let pid = process.pid;
	const visited = new Set<number>();

	while (pid > 1 && !visited.has(pid)) {
		visited.add(pid);
		const comm = getProcessComm(pid);
		if (comm && KNOWN_TERMINALS.has(comm)) {
			return pid;
		}
		const ppid = getParentPid(pid);
		if (!ppid) break;
		pid = ppid;
	}
	return null;
}

function terminalHasFocus(): boolean {
	// Only applies to Hyprland; on other compositors we can't reliably detect focus
	if (!process.env.HYPRLAND_INSTANCE_SIGNATURE) {
		return false;
	}
	try {
		const { execSync } = require("child_process");
		const activeWindow = JSON.parse(
			execSync("hyprctl activewindow -j", { encoding: "utf-8", timeout: 1000 })
		);
		const terminalPid = getTerminalPid();
		if (!terminalPid) return false;
		return activeWindow.pid === terminalPid;
	} catch {
		return false;
	}
}

function windowsToastScript(title: string, body: string): string {
	const type = "Windows.UI.Notifications";
	const mgr = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
	const template = `[${type}.ToastTemplateType]::ToastText01`;
	const toast = `[${type}.ToastNotification]::new($xml)`;
	return [
		`${mgr} > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
		`$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body}')) > $null`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier('${title}').Show(${toast})`,
	].join("; ");
}

function notifyOSC777(title: string, body: string): void {
	process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
}

function notifyOSC99(title: string, body: string): void {
	// Kitty OSC 99: i=notification id, d=0 means not done yet, p=body for second part
	process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
	process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

function notifyWindows(title: string, body: string): void {
	const { execFile } = require("child_process");
	execFile("powershell.exe", ["-NoProfile", "-Command", windowsToastScript(title, body)]);
}

function notifySendFallback(title: string, body: string): void {
	const { execFile } = require("child_process");
	execFile("notify-send", [title, body], (err: Error | null) => {
		if (err) {
			/* Final fallback: try OSC 777 anyway */
			notifyOSC777(title, body);
		}
	});
}

function notify(title: string, body: string): void {
	if (process.env.WT_SESSION) {
		notifyWindows(title, body);
	} else if (process.env.KITTY_WINDOW_ID) {
		notifyOSC99(title, body);
	} else if (process.platform === "linux" && (process.env.DISPLAY || process.env.WAYLAND_DISPLAY)) {
		notifySendFallback(title, body);
	} else {
		notifyOSC777(title, body);
	}
}

export default function (pi: ExtensionAPI) {
	// `agent_end` fires after each low-level run; Pi may still retry, compact,
	// or continue with queued follow-ups. Notify only after the full run settles.
	pi.on("agent_settled", async () => {
		if (terminalHasFocus()) {
			return; // Don't notify if the terminal running pi already has focus
		}
		notify("Pi", "Ready for input");
	});
}
