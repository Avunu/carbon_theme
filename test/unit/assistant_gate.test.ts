// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isFlowLauncher } from "../../carbon_theme/public/js/anatomy/shell/assistant_gate.ts";

describe("isFlowLauncher", () => {
	it("accepts Frappe's window.flow", () => {
		assert.equal(isFlowLauncher({ toggle() {}, open() {} }), true);
	});

	it("rejects a missing or foreign window.flow", () => {
		for (const value of [undefined, null, {}, { toggle: true }, "flow"]) {
			assert.equal(isFlowLauncher(value), false);
		}
	});
});
