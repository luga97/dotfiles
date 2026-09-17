/**
 * Permission Gate Extension
 *
 * Prompts for confirmation before running potentially dangerous bash commands.
 * The dialog shows the command plus a short, best-effort description of what
 * it does (built with local pattern rules — no model or network involved).
 *
 * Patterns checked: rm -rf, chmod/chown 777
 *
 * Note: `sudo` is not gated on its own — NOPASSWD sudo is part of the normal
 * workflow (e.g. managing the home-server over SSH).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** A description rule: matches a command segment and returns a short description ("" = no match). */
interface Rule {
	re: RegExp;
	describe: (m: RegExpMatchArray) => string;
}

const MAX_TARGET = 60;

function truncate(s: string): string {
	return s.length > MAX_TARGET ? `${s.slice(0, MAX_TARGET - 1)}…` : s;
}

function hasFlag(args: string, short: string, long: string): boolean {
	return new RegExp(`(^|\\s)-[a-z]*${short}|--${long}`).test(args);
}

function describeSegment(segment: string): string {
	// Strip leading env assignments like FOO=bar
	const cmd = segment.trim().replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, "");

	const rules: Rule[] = [
		// sudo: describe the wrapped command and add the privilege note
		{
			re: /^sudo\s+(.+)$/s,
			describe: (m) => {
				const inner = describeSegment(m[1]);
				return inner ? `${inner} (con privilegios de root)` : "ejecuta un comando con privilegios de root";
			},
		},
		{
			re: /^rm\b(.*)$/s,
			describe: (m) => {
				const args = m[1];
				const target =
					truncate(args.replace(/--?\S+/g, "").replace(/^\s*--\s*/, "").trim()) || "los archivos indicados";
				const parts = [`borra ${target}`];
				if (hasFlag(args, "r", "recursive")) parts.push("recursivamente");
				if (hasFlag(args, "f", "force")) parts.push("sin pedir confirmación (irreversible)");
				return parts.join(" ");
			},
		},
		{
			re: /^chmod\b.*\b777\b/,
			describe: () => "da permisos de lectura/escritura/ejecución a todos los usuarios (777)",
		},
		{
			re: /^chown\b.*\b777\b/,
			describe: () => "cambia propietario/grupo asignando permisos totales (777)",
		},
	];

	for (const rule of rules) {
		const m = cmd.match(rule.re);
		if (m) return rule.describe(m);
	}
	return "";
}

function describeCommand(command: string): string {
	// curl/wget piped straight into a shell is dangerous as a whole
	const pipeExec = command.match(/(curl|wget)\b[^(]*\|\s*(?:sudo\s+)?\w*sh\b/);
	if (pipeExec) return `descarga contenido con ${pipeExec[1]} y lo ejecuta directamente en la shell`;

	const segments = command
		.split(/\|\||&&|;|\|/)
		.map((s) => s.trim())
		.filter(Boolean);
	const descriptions = [...new Set(segments.map(describeSegment).filter(Boolean))];
	return descriptions.join("; ") || "ejecuta un comando potencialmente peligroso";
}

export default function (pi: ExtensionAPI) {
	const dangerousPatterns = [/\brm\s+(-rf?|--recursive)/i, /\b(chmod|chown)\b.*777/i];

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;
		const isDangerous = dangerousPatterns.some((p) => p.test(command));

		if (isDangerous) {
			if (!ctx.hasUI) {
				// In non-interactive mode, block by default
				return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
			}

			const description = describeCommand(command);
			const choice = await ctx.ui.select(
				`⚠️ Comando potencialmente peligroso\n\n  ${command}\n\n  Qué hace: ${description}\n\n¿Ejecutar?`,
				["Sí, ejecutar", "No, cancelar"],
			);

			if (choice !== "Sí, ejecutar") {
				return { block: true, reason: "Blocked by user" };
			}
		}

		return undefined;
	});
}
