// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// The ways into Frappe's built-in Flow panel, claimed for the Carbon assistant.
//
// Frappe's launcher (frappe/public/js/flow_launcher.bundle.js, Frappe 16.60+) toggles its
// panel on Cmd/Ctrl+I, caught on `window` in the capture phase and stopped there, and on a
// click on any `[data-flow-toggle]`, caught on `document`. Neither can be taken over once
// it is registered, so this module registers listeners of the same kind first: it runs
// when carbon_anatomy.bundle loads, which is before the launcher, a deferred script
// appended at the end of <body> (frappe/flow/launcher.py). Listeners on one target and
// phase run in the order they were added, so these see each event before the launcher's
// and, while claimed, stop it from reaching the launcher.
//
// Unclaimed (no assistant, or one that failed and handed Flow back), they do nothing.
//
// The launcher also reopens its panel on load when it was left open
// (`localStorage.flow_launcher.open`). That is rewritten to closed here, also before the
// launcher reads it, so its panel does not flash open under the Carbon one.
//
// Parsed by frappe's esbuild 0.14: no `satisfies`, `accessor` or `using` (see assistant_gate.ts).
import { closedFlowState, FLOW_PANEL_STATE_KEY } from "./assistant_gate.ts";

/** The id of the Carbon assistant's panel (assistant.ts), where Ctrl+I keeps toggling. */
const HOST_ID = "cf-ai-panel";
/** frappe.is_mobile's threshold: below it the UI Shell header, and the assistant, are not mounted. */
const MOBILE_WIDTH = 768;

let claimed: (() => void) | null = null;

/** Route Cmd/Ctrl+I and `[data-flow-toggle]` clicks to `toggle` instead of Frappe's launcher. */
export function claimFlowEntryPoints(toggle: () => void): void {
	claimed = toggle;
}

/** Hand Cmd/Ctrl+I and `[data-flow-toggle]` clicks back to Frappe's launcher. */
export function releaseFlowEntryPoints(): void {
	claimed = null;
}

/** Cmd/Ctrl+I, by the letter typed, or by the key's place on layouts with no Latin letters (as the launcher reads it). */
export function isToggleKey(
	event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "key" | "code">,
): boolean {
	if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
	return /^[!-~]$/.test(event.key) ? event.key.toLowerCase() === "i" : event.code === "KeyI";
}

function inPanel(path: readonly EventTarget[]): boolean {
	return path.some((node) => node instanceof HTMLElement && node.id === HOST_ID);
}

function onKeydown(event: KeyboardEvent): void {
	const toggle = claimed;
	if (toggle === null || !isToggleKey(event)) return;
	const path = event.composedPath();
	const first = path[0];
	// the page's rich text keeps Ctrl+I for italics, as the launcher lets it
	if (first instanceof HTMLElement && first.isContentEditable && !inPanel(path)) return;
	event.preventDefault();
	event.stopImmediatePropagation();
	toggle();
}

function onClick(event: MouseEvent): void {
	const toggle = claimed;
	const target = event.target;
	if (toggle === null || !(target instanceof Element) || !target.closest("[data-flow-toggle]")) return;
	// The element's own handlers have run (this is the bubble phase, on document);
	// only the launcher's listener, added after this one, is skipped.
	event.stopImmediatePropagation();
	toggle();
}

function closeLauncherOnLoad(): void {
	if (window.innerWidth < MOBILE_WIDTH) return;
	const boot = typeof frappe === "undefined" ? undefined : frappe.boot;
	if (boot && boot.read_only) return;
	try {
		const closed = closedFlowState(window.localStorage.getItem(FLOW_PANEL_STATE_KEY));
		if (closed !== null) window.localStorage.setItem(FLOW_PANEL_STATE_KEY, closed);
	} catch {
		// blocked storage: the panel opens and the takeover closes it at mount
	}
}

if (typeof window !== "undefined" && window.top === window) {
	window.addEventListener("keydown", onKeydown, true);
	document.addEventListener("click", onClick);
	closeLauncherOnLoad();
}
