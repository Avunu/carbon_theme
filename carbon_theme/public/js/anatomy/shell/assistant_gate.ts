// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// The decisions behind the header's AI action that need neither the DOM nor frappe,
// kept apart from assistant.ts so node:test can cover them.
//
// This file ships in the always-loaded carbon_anatomy bundle, which frappe builds with
// its own esbuild (0.14.x). Write nothing that esbuild cannot parse: no `satisfies`, no
// `accessor`, no `using`. The chat module is only named by type (erased), never imported.
import type { FrappeBootPartial } from "frappe-types";
import type { ChatModule } from "../../ai_chat/entry.ts";

/** Where `scripts/build-ai-chat.ts` writes the lazy bundle (served from the app's public/dist). */
export const ASSET_BASE = "/assets/carbon_theme/dist/ai_chat/";
export const MANIFEST_URL = `${ASSET_BASE}manifest.json`;

/** localStorage: the panel's open/expanded state (written by assistant.ts). */
export const PANEL_STATE_KEY = "cf-ai-panel";
/** localStorage: the Frappe user that SESSION_KEY's value (ai_chat/storage_keys.ts) belongs to (see `reconcileSession`). */
export const SESSION_USER_KEY = "cf-ai-session-user";
/**
 * localStorage: the state of Frappe's Flow launcher, `{open, width, path, ...}`, where `path`
 * is the chat it shows (`/s/<session>`) (frappe/public/js/flow_launcher.bundle.js `STORE_KEY`).
 */
export const FLOW_PANEL_STATE_KEY = "flow_launcher";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string | null | undefined): unknown {
	if (typeof raw !== "string" || raw === "") return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

// -- gate ---------------------------------------------------------------------

/**
 * Frappe's Flow launcher is on the page (`window.flow`, passed as `flow`), and the site is not
 * read-only, where Flow could not write its sessions. Frappe adds the launcher only for users
 * who may read Flow Session (frappe/flow/launcher.py), so this follows Flow's own permissions.
 */
export function shouldMountAssistant(flow: unknown, boot: FrappeBootPartial | null | undefined): boolean {
	if (!boot || boot.read_only === true) return false;
	return isFlowLauncher(flow);
}

// -- panel state --------------------------------------------------------------

export interface PanelState {
	open: boolean;
	expanded: boolean;
}

export const DEFAULT_PANEL_STATE: PanelState = { open: false, expanded: false };

/** The stored state, or the default for anything missing, malformed or of another version. */
export function parsePanelState(raw: string | null | undefined): PanelState {
	const parsed = parseJson(raw);
	if (!isRecord(parsed) || parsed["v"] !== 1) return { ...DEFAULT_PANEL_STATE };
	return { open: parsed["open"] === true, expanded: parsed["expanded"] === true };
}

export function serialisePanelState(state: PanelState): string {
	return JSON.stringify({ v: 1, open: state.open, expanded: state.expanded });
}

// -- flow's state -------------------------------------------------------------

/**
 * The value to write to SESSION_KEY on first use, or null to leave the key alone.
 *
 * `own` is what SESSION_KEY holds now: null only before the chat has ever run (the
 * controller writes "" for a deliberate new chat, so a cleared session is never
 * resurrected from flow). The seed is flow's remembered session, or "" when it had none.
 */
export function seedSession(own: string | null, flowStateRaw: string | null): string | null {
	if (own !== null) return null;
	const flow = parseJson(flowStateRaw);
	const path = isRecord(flow) ? flow["path"] : undefined;
	const match = typeof path === "string" ? /^\/s\/([^/?#]+)/.exec(path) : null;
	return match && match[1] ? decodeURIComponent(match[1]) : "";
}

/**
 * The value to write to SESSION_KEY at boot, or null to leave the key alone.
 *
 * localStorage belongs to the browser, not to the account, and frappe's logout leaves it
 * alone: without this the next person to sign in would have the previous one's session
 * resumed (and, with enough read access, rendered, with its running runs failed).
 * `owner` is the user SESSION_USER_KEY recorded; a different user starts a new chat, and
 * a pointer of unknown owner (written before the owner was recorded) is dropped for the
 * same reason. Flow's own remembered session is not trusted across users either.
 */
export function reconcileSession(
	user: string,
	owner: string | null,
	own: string | null,
	flowStateRaw: string | null,
): string | null {
	if (owner === user || (owner === null && own === null)) return seedSession(own, flowStateRaw);
	return own === "" ? null : "";
}

/**
 * The launcher's stored state with `open` forced false and everything else (path, width)
 * kept, or null when there is nothing parseable to rewrite. Written from a snapshot read
 * BEFORE the takeover closed the panel, so the chat it showed stays for the seed and for
 * handing the panel back.
 */
export function closedFlowState(flowStateRaw: string | null): string | null {
	const flow = parseJson(flowStateRaw);
	if (!isRecord(flow)) return null;
	return JSON.stringify({ ...flow, open: false });
}

// -- Frappe's Flow launcher --------------------------------------------------

/** The slice of Frappe's `window.flow` (flow_launcher.bundle.js) the takeover calls and stands in for. */
export interface FlowLauncherLike {
	toggle(): void;
	/** Opens the panel; with `session`, on that chat. */
	open(options?: { session?: string }): void;
}

export function isFlowLauncher(value: unknown): value is FlowLauncherLike {
	return isRecord(value) && typeof value["toggle"] === "function" && typeof value["open"] === "function";
}

// -- lazy bundle --------------------------------------------------------------

export interface ChatManifest {
	/** Entry module, relative to ASSET_BASE: `entry.<hash>.js`. */
	entry: string;
	/** Stylesheet, relative to ASSET_BASE: `chat.<hash>.css`. */
	css: string;
	/** ISO timestamp of the build; informational. */
	built: string;
}

// A file name inside the bundle directory: letters, digits, dot, dash, underscore and
// forward slash, no leading slash, no "..". The manifest is fetched from our own origin
// but is still data, and its values become a <link href> and an import() specifier.
const SAFE_ASSET = /^(?!.*\.\.)[A-Za-z0-9_-][A-Za-z0-9_.\-/]*$/;

export function parseManifest(value: unknown): ChatManifest | null {
	if (!isRecord(value)) return null;
	const entry = value["entry"];
	const css = value["css"];
	const built = value["built"];
	if (typeof entry !== "string" || !SAFE_ASSET.test(entry) || !entry.endsWith(".js")) return null;
	if (typeof css !== "string" || !SAFE_ASSET.test(css) || !css.endsWith(".css")) return null;
	return { entry, css, built: typeof built === "string" ? built : "" };
}

export function assetUrl(file: string): string {
	return `${ASSET_BASE}${file}`;
}

/**
 * The `import()` specifier for the entry module. A failed dynamic import stays in the
 * document's module map, so the same URL rejects again without a request; a changed
 * query is a new module, which makes Retry work after a failed entry fetch. A failed
 * chunk it imports is cached under its own URL and only a page reload clears that.
 */
export function entrySpecifier(entry: string, failures: number): string {
	return failures > 0 ? `${assetUrl(entry)}?retry=${failures}` : assetUrl(entry);
}

/** The contract version `entry.ts` exports as `CHAT_CONTRACT`; bump both together on a breaking change. */
export const CHAT_CONTRACT_VERSION = 1;

/** A dynamic-import result that is the chat entry of this contract version (not a stale or foreign module). */
export function isChatModule(value: unknown): value is ChatModule {
	return (
		typeof value === "object" &&
		value !== null &&
		"mountChat" in value &&
		typeof value.mountChat === "function" &&
		"CHAT_CONTRACT" in value &&
		value.CHAT_CONTRACT === CHAT_CONTRACT_VERSION
	);
}
