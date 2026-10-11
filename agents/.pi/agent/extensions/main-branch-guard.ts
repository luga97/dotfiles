/**
 * Main Branch Guard Extension
 *
 * Bloquea mutaciones git (commit / push / merge) cuando la sesión está
 * parada en `main` de un repo cuyo `origin` apunta a GitLab — donde main
 * está protegida (push = No one, aterrizaje solo vía MR con pipeline verde).
 *
 * El reason del bloqueo es instruccional: el agente recibe el procedimiento
 * correcto (fetch + rama semántica desde origin/main + MR via glab) y puede
 * autocorregirse en el mismo turno.
 *
 * Alcance deliberado: solo repos con origin en gitlab.com. En repos
 * GitHub-only (p. ej. el propio repo de dotfiles) commitear en main es el
 * flujo normal y no se toca.
 *
 * Capa 1 de 3: esta extensión (agentes pi) → .husky/pre-commit del repo
 * (auto-desviación para cualquier otro cliente) → protección server-side
 * de GitLab (ineludible).
 */

import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** git commit/push/merge al inicio, tras separadores de shell, subshells o saltos de línea. */
const GIT_MUTATION_RE =
	/(^|[;&|`$(]\s*|\n\s*)git\s+(-\S+\s+)*(commit|push|merge)\b/;

const BRANCH_TYPES = "feat|fix|chore|docs|refactor|test|ci|perf";

function instructions(): string {
	return [
		"**main-branch-guard**: estás en `main` de un repo GitLab — main está protegida (push = No one, aterrizaje solo vía MR con pipeline verde). No se puede commitear ni pushear aquí.",
		"",
		"Procede así:",
		"1. `git fetch origin`",
		`2. \`git switch -c <tipo>/<nombre-corto> origin/main\` — tipo ∈ ${BRANCH_TYPES} (si el fetch falla, usa main local como base)`,
		"3. Haz tus commits en esa rama y `git push -u origin <rama>`",
		"4. Abre y mergea la MR: `glab mr create --fill && glab mr merge` (solo mergea con pipeline verde).",
		"",
		"Este bloqueo te protege: main debe quedar siempre verde.",
	].join("\n");
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		if (!isToolCallEventType("bash", event)) return;
		if (!GIT_MUTATION_RE.test(event.input.command)) return;

		// ¿Estamos en un repo git? ¿En main?
		const branchRes = await pi.exec("git", ["branch", "--show-current"]);
		if (branchRes.code !== 0) return; // no es un repo git
		if (branchRes.stdout.trim() !== "main") return;

		// Solo repo con origin GitLab (allí main está protegida).
		const remoteRes = await pi.exec("git", ["remote", "get-url", "origin"]);
		if (remoteRes.code !== 0) return;
		if (!remoteRes.stdout.trim().toLowerCase().includes("gitlab.com")) {
			return;
		}

		return { block: true, reason: instructions() };
	});
}
