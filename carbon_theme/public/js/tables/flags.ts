// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// The opt-in table behaviours a System Manager switches on in Carbon Settings
// (Tables section), as the desk sees them.
//
// Carbon's own data table has neither a column-resize handle nor rows that grow
// with their text, so the theme ships both OFF. The server publishes the two
// flags as `frappe.boot.carbon_features` (carbon_theme/features.py); this reads
// them back. An absent or malformed value is "off", which is also what every
// site is until it opts in, so a stale boot cache can only ever fall back to
// stock Carbon.
//
// Kept free of the DOM and of frappe so node:test can cover it. This file ships
// in the always-loaded carbon_tables bundle, which frappe builds with its own
// esbuild (0.14.x): write nothing that esbuild cannot parse (no `satisfies`,
// no `accessor`, no `using`).

/** Where the server puts the flags on `frappe.boot`. */
export const BOOT_KEY = "carbon_features";

export interface TableFlags {
	/** Draw a drag handle on each header's trailing edge. */
	columnResize: boolean;
	/** Let a cell's text wrap and its row grow to show all of it. */
	autoRowHeight: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The flags in a `frappe.boot`-shaped object. A flag is on only when it is
 * exactly `true` (or 1, which is what Frappe serialises a Check as).
 */
export function readTableFlags(boot: unknown): TableFlags {
	const features = isRecord(boot) ? boot[BOOT_KEY] : undefined;
	const on = (name: string): boolean => {
		if (!isRecord(features)) return false;
		const value = features[name];
		return value === true || value === 1;
	};
	return { columnResize: on("column_resize"), autoRowHeight: on("auto_row_height") };
}

/** The flags for this page, read off `frappe.boot` at call time. */
export function tableFlags(): TableFlags {
	return readTableFlags(typeof frappe === "undefined" ? undefined : frappe.boot);
}

/**
 * The engine options the flags decide, for an adapter to spread into the
 * options it hands `CarbonTable`. One place, so the Grid, the List view and the
 * Report view cannot disagree about what a flag means.
 */
export function tableOptionsFromFlags(flags: TableFlags = tableFlags()): {
	resizable: boolean;
	autoRowHeight: boolean;
} {
	return { resizable: flags.columnResize, autoRowHeight: flags.autoRowHeight };
}
