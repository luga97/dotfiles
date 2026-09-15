/**
 * /usage — Session + OpenRouter usage report
 *
 * Shows token/cost usage for the current session and, when the active
 * provider is OpenRouter, fetches the account credit balance and API-key
 * usage from the OpenRouter API.
 *
 * Usage:
 *   /usage
 *
 * Install:
 *   Drop this file into ~/.pi/agent/extensions/ and run /reload,
 *   or test it with `pi -e ./usage.ts`.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader, DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";

const OPENROUTER_API = "https://openrouter.ai/api/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionUsage {
	requests: number;
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: number;
}

interface OpenRouterCredits {
	totalCredits?: number;
	totalUsage?: number;
}

interface OpenRouterKeyInfo {
	label?: string;
	usage?: number;
	usageDaily?: number;
	usageWeekly?: number;
	usageMonthly?: number;
	limit?: number | null;
	limitRemaining?: number | null;
	limitReset?: string | null;
	isFreeTier?: boolean;
	isManagementKey?: boolean;
	isProvisioningKey?: boolean;
	rateLimit?: { requests?: number; interval?: string } | null;
}

interface Report {
	provider: string;
	model: string;
	session: SessionUsage;
	credits?: OpenRouterCredits;
	keyInfo?: OpenRouterKeyInfo;
	errors: string[];
}

interface Section {
	title: string;
	rows: Array<[string, string]>;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtInt(n: number): string {
	return Math.round(n).toLocaleString("en-US");
}

function fmtCost(n: number | null | undefined): string {
	if (n === null || n === undefined || Number.isNaN(n)) return "—";
	const abs = Math.abs(n);
	if (abs === 0) return "$0.00";
	if (abs < 0.01) return `$${n.toFixed(6)}`;
	if (abs < 1) return `$${n.toFixed(4)}`;
	return `$${n.toFixed(2)}`;
}

function fmtRate(rate: OpenRouterKeyInfo["rateLimit"]): string | undefined {
	if (!rate || rate.requests === undefined || rate.requests <= 0) return undefined;
	return `${fmtInt(rate.requests)} requests / ${rate.interval ?? "?"}`;
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

function collectSessionUsage(ctx: ExtensionContext): SessionUsage {
	const usage: SessionUsage = {
		requests: 0,
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: 0,
	};

	for (const entry of ctx.sessionManager.getBranch()) {
		const anyEntry = entry as { message?: { role?: string; usage?: any }; usage?: any };
		const u = anyEntry.message?.usage ?? anyEntry.usage;
		if (!u) continue;
		if (anyEntry.message?.role === "assistant") usage.requests += 1;
		usage.input += u.input ?? 0;
		usage.output += u.output ?? 0;
		usage.cacheRead += u.cacheRead ?? 0;
		usage.cacheWrite += u.cacheWrite ?? 0;
		usage.totalTokens += u.totalTokens ?? (u.input ?? 0) + (u.output ?? 0);
		usage.cost += u.cost?.total ?? 0;
	}

	return usage;
}

async function readAuthFileKey(): Promise<string | undefined> {
	try {
		const { readFile } = await import("node:fs/promises");
		const { homedir } = await import("node:os");
		const { join } = await import("node:path");
		const raw = await readFile(join(homedir(), ".pi", "agent", "auth.json"), "utf8");
		const parsed = JSON.parse(raw) as Record<string, { key?: unknown }>;
		const key = parsed?.openrouter?.key;
		if (typeof key === "string" && key.length > 0 && !key.startsWith("!") && !key.startsWith("$")) {
			return key;
		}
	} catch {
		// Ignore: fall back to nothing.
	}
	return undefined;
}

async function resolveApiKey(ctx: ExtensionContext): Promise<string | undefined> {
	try {
		const resolved = (await ctx.modelRegistry.getProviderAuth("openrouter")) as
			| { auth?: { apiKey?: unknown } }
			| undefined;
		const key = resolved?.auth?.apiKey;
		if (typeof key === "string" && key.length > 0) return key;
	} catch {
		// Fall through to env / auth file.
	}
	if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
	return readAuthFileKey();
}

async function fetchJson(url: string, apiKey: string, signal?: AbortSignal): Promise<any> {
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
		signal,
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`HTTP ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`);
	}
	return res.json();
}

async function gatherReport(ctx: ExtensionContext, signal?: AbortSignal): Promise<Report> {
	const provider = ctx.model?.provider ?? "unknown";
	const model = ctx.model?.id ?? "unknown";
	const report: Report = { provider, model, session: collectSessionUsage(ctx), errors: [] };

	if (provider !== "openrouter") return report;

	const apiKey = await resolveApiKey(ctx);
	if (!apiKey) {
		report.errors.push("No OpenRouter API key found. Run /login openrouter or set OPENROUTER_API_KEY.");
		return report;
	}

	const [credits, keyInfo] = await Promise.allSettled([
		fetchJson(`${OPENROUTER_API}/credits`, apiKey, signal),
		fetchJson(`${OPENROUTER_API}/key`, apiKey, signal),
	]);

	if (credits.status === "fulfilled") {
		const d = credits.value?.data ?? {};
		report.credits = { totalCredits: d.total_credits, totalUsage: d.total_usage };
	} else {
		report.errors.push(`Credits API: ${credits.reason?.message ?? credits.reason}`);
	}

	if (keyInfo.status === "fulfilled") {
		const d = keyInfo.value?.data ?? {};
		report.keyInfo = {
			label: d.label,
			usage: d.usage,
			usageDaily: d.usage_daily,
			usageWeekly: d.usage_weekly,
			usageMonthly: d.usage_monthly,
			limit: d.limit,
			limitRemaining: d.limit_remaining,
			limitReset: d.limit_reset,
			isFreeTier: d.is_free_tier,
			isManagementKey: d.is_management_key,
			isProvisioningKey: d.is_provisioning_key,
			rateLimit: d.rate_limit,
		};
	} else {
		report.errors.push(`Key API: ${keyInfo.reason?.message ?? keyInfo.reason}`);
	}

	return report;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function buildSections(report: Report): Section[] {
	const s = report.session;
	const sections: Section[] = [
		{
			title: "Session",
			rows: [
				["Provider", report.provider],
				["Model", report.model],
				["Requests", fmtInt(s.requests)],
				["Input tokens", fmtInt(s.input)],
				["Output tokens", fmtInt(s.output)],
				["Cache read", fmtInt(s.cacheRead)],
				["Cache write", fmtInt(s.cacheWrite)],
				["Total tokens", fmtInt(s.totalTokens)],
				["Session cost", fmtCost(s.cost)],
			],
		},
	];

	if (report.credits) {
		const total = report.credits.totalCredits;
		const used = report.credits.totalUsage;
		const remaining = total !== undefined && used !== undefined ? total - used : undefined;
		sections.push({
			title: "OpenRouter account",
			rows: [
				["Credits purchased", fmtCost(total)],
				["Credits used", fmtCost(used)],
				["Credits remaining", fmtCost(remaining)],
			],
		});
	}

	if (report.keyInfo) {
		const k = report.keyInfo;
		const rows: Array<[string, string]> = [];
		if (k.label) rows.push(["Key label", k.label]);
		rows.push(["Key type", k.isProvisioningKey ? "provisioning" : k.isManagementKey ? "management" : "standard"]);
		rows.push(["Key usage", fmtCost(k.usage)]);
		if (k.usageDaily !== undefined) rows.push(["Usage today", fmtCost(k.usageDaily)]);
		if (k.usageWeekly !== undefined) rows.push(["Usage this week", fmtCost(k.usageWeekly)]);
		if (k.usageMonthly !== undefined) rows.push(["Usage this month", fmtCost(k.usageMonthly)]);
		rows.push(["Key limit", k.limit === null || k.limit === undefined ? "unlimited" : fmtCost(k.limit)]);
		rows.push([
			"Key limit remaining",
			k.limitRemaining === null || k.limitRemaining === undefined ? "—" : fmtCost(k.limitRemaining),
		]);
		if (k.limitReset) rows.push(["Limit resets", k.limitReset]);
		rows.push(["Free tier", k.isFreeTier ? "yes" : "no"]);
		const rate = fmtRate(k.rateLimit);
		if (rate) rows.push(["Rate limit", rate]);
		sections.push({ title: "OpenRouter API key", rows });
	}

	if (report.errors.length > 0) {
		sections.push({
			title: "Warnings",
			rows: report.errors.map((error, i) => [`#${i + 1}`, error]),
		});
	}

	return sections;
}

function renderSections(sections: Section[], theme?: any): string[] {
	const labelWidth = sections.reduce(
		(max, section) => Math.max(max, ...section.rows.map(([label]) => label.length)),
		0,
	);

	const lines: string[] = [];
	sections.forEach((section, index) => {
		if (index > 0) lines.push("");
		lines.push(theme ? theme.fg("accent", theme.bold(section.title)) : section.title);
		for (const [label, value] of section.rows) {
			const padded = label.padEnd(labelWidth, " ");
			if (theme) {
				lines.push(`  ${theme.fg("muted", padded)}  ${theme.fg("text", value)}`);
			} else {
				lines.push(`  ${padded}  ${value}`);
			}
		}
	});
	return lines;
}

class UsagePanel extends Container {
	private onClose: () => void;

	constructor(lines: string[], theme: any, onClose: () => void) {
		super();
		this.onClose = onClose;
		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
		this.addChild(new Text(theme.fg("accent", theme.bold(" Usage")), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(lines.join("\n"), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", " esc / enter / q close"), 1, 0));
		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter) || data === "q") {
			this.onClose();
		}
	}
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function usageExtension(pi: ExtensionAPI) {
	pi.registerCommand("usage", {
		description: "Show session token/cost usage and OpenRouter account credits",
		handler: async (_args, ctx) => {
			const isOpenRouter = ctx.model?.provider === "openrouter";
			let report: Report | null = null;

			if (ctx.mode === "tui" && isOpenRouter) {
				// Show a cancellable loader while the OpenRouter API is queried.
				report = await ctx.ui.custom<Report | null>((tui, theme, _keybindings, done) => {
					const loader = new BorderedLoader(tui, theme, "Fetching OpenRouter usage…");
					loader.onAbort = () => done(null);
					gatherReport(ctx, loader.signal)
						.then((result) => done(result))
						.catch((error) => {
							done({
								provider: ctx.model?.provider ?? "unknown",
								model: ctx.model?.id ?? "unknown",
								session: collectSessionUsage(ctx),
								errors: [error instanceof Error ? error.message : String(error)],
							});
						});
					return loader;
				});
			} else {
				report = await gatherReport(ctx);
			}

			if (!report) {
				ctx.ui.notify("Usage cancelled", "info");
				return;
			}

			const finalReport = report;

			if (ctx.mode === "tui") {
				await ctx.ui.custom<void>((_tui, theme, _keybindings, done) => {
					return new UsagePanel(renderSections(buildSections(finalReport), theme), theme, () => done());
				});
			} else {
				const text = renderSections(buildSections(finalReport)).join("\n");
				ctx.ui.notify(text, finalReport.errors.length > 0 ? "warning" : "info");
			}
		},
	});
}