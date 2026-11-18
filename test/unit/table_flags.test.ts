// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	BOOT_KEY,
	readTableFlags,
	tableOptionsFromFlags,
} from "../../carbon_theme/public/js/tables/flags.ts";

const OFF = { columnResize: false, autoRowHeight: false };

describe("readTableFlags", () => {
	it("is off for both flags until the server says otherwise", () => {
		assert.deepEqual(readTableFlags({}), OFF);
		assert.deepEqual(readTableFlags({ [BOOT_KEY]: {} }), OFF);
	});
	it("reads each flag on its own", () => {
		assert.deepEqual(readTableFlags({ [BOOT_KEY]: { column_resize: true } }), {
			columnResize: true,
			autoRowHeight: false,
		});
		assert.deepEqual(readTableFlags({ [BOOT_KEY]: { auto_row_height: true } }), {
			columnResize: false,
			autoRowHeight: true,
		});
	});
	it("reads both", () => {
		assert.deepEqual(readTableFlags({ [BOOT_KEY]: { column_resize: true, auto_row_height: true } }), {
			columnResize: true,
			autoRowHeight: true,
		});
	});
	it("takes 1, which is how Frappe serialises a Check, as on", () => {
		assert.equal(readTableFlags({ [BOOT_KEY]: { column_resize: 1 } }).columnResize, true);
		assert.equal(readTableFlags({ [BOOT_KEY]: { column_resize: 0 } }).columnResize, false);
	});
	it("does not take a truthy string for on: a flag is a switch, not a guess", () => {
		assert.equal(readTableFlags({ [BOOT_KEY]: { column_resize: "1" } }).columnResize, false);
		assert.equal(readTableFlags({ [BOOT_KEY]: { column_resize: "true" } }).columnResize, false);
		assert.equal(readTableFlags({ [BOOT_KEY]: { column_resize: 2 } }).columnResize, false);
	});
	it("falls back to off for a missing, null or malformed boot", () => {
		assert.deepEqual(readTableFlags(undefined), OFF);
		assert.deepEqual(readTableFlags(null), OFF);
		assert.deepEqual(readTableFlags("boot"), OFF);
		assert.deepEqual(readTableFlags([]), OFF);
		assert.deepEqual(readTableFlags({ [BOOT_KEY]: null }), OFF);
		assert.deepEqual(readTableFlags({ [BOOT_KEY]: [true, true] }), OFF);
		assert.deepEqual(readTableFlags({ [BOOT_KEY]: "column_resize" }), OFF);
	});
	it("ignores keys it does not know", () => {
		assert.deepEqual(readTableFlags({ [BOOT_KEY]: { something_else: true } }), OFF);
	});
});

describe("tableOptionsFromFlags", () => {
	it("hands the engine the two options the flags decide", () => {
		assert.deepEqual(tableOptionsFromFlags({ columnResize: true, autoRowHeight: false }), {
			resizable: true,
			autoRowHeight: false,
		});
		assert.deepEqual(tableOptionsFromFlags({ columnResize: false, autoRowHeight: true }), {
			resizable: false,
			autoRowHeight: true,
		});
	});
	it("reads frappe.boot when given no flags", () => {
		const globals = globalThis as { frappe?: unknown };
		const saved = globals.frappe;
		globals.frappe = { boot: { [BOOT_KEY]: { column_resize: true } } };
		try {
			assert.deepEqual(tableOptionsFromFlags(), { resizable: true, autoRowHeight: false });
		} finally {
			globals.frappe = saved;
		}
	});
	it("is off with no frappe at all", () => {
		const globals = globalThis as { frappe?: unknown };
		const saved = globals.frappe;
		delete globals.frappe;
		try {
			assert.deepEqual(tableOptionsFromFlags(), { resizable: false, autoRowHeight: false });
		} finally {
			globals.frappe = saved;
		}
	});
});
