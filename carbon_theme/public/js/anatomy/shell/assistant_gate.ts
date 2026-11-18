// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// Whether the header's AI action can be shown: Frappe's built-in Flow launcher is on the page.
// Kept apart from assistant.ts (no DOM, no frappe) so node:test can cover it.
//
// Frappe adds the launcher only for users who may read Flow Session (frappe/flow/launcher.py),
// and the launcher sets `window.flow` in the top window only (flow_launcher.bundle.js).
//
// This file ships in the always-loaded carbon_anatomy bundle, which frappe builds with
// its own esbuild (0.14.x). Write nothing that esbuild cannot parse: no `satisfies`, no
// `accessor`, no `using`.

/** The part of Frappe's `window.flow` this theme uses. */
export interface FlowLauncherApi {
	toggle(): void;
}

export function isFlowLauncher(value: unknown): value is FlowLauncherApi {
	return typeof value === "object" && value !== null && typeof Reflect.get(value, "toggle") === "function";
}
