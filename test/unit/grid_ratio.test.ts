// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	columnFloor,
	columnWeight,
	pxOfWeight,
	ratioWidths,
	weightOfPx,
} from "../../carbon_theme/public/js/tables/grid/ratio.ts";
import { headerWidth } from "../../carbon_theme/public/js/tables/widths.ts";

// frappe 16.50's LEGACY_COLSIZE_TO_PX (form/grid.js:23-36), the scale the grid
// passes in. The browser suite checks the grid against frappe's own table.
const SCALE = {
	1: 60,
	2: 100,
	3: 140,
	4: 200,
	5: 250,
	6: 300,
	7: 350,
	8: 400,
	9: 450,
	10: 500,
	11: 550,
	12: 600,
};

const sum = (xs: number[]): number => xs.reduce((n, x) => n + x, 0);

describe("weightOfPx / pxOfWeight", () => {
	it("reads frappe's own points back as their spans", () => {
		for (const [w, px] of Object.entries(SCALE)) assert.equal(weightOfPx(px, SCALE), Number(w));
	});
	it("puts the fieldtype defaults where frappe's spans put them", () => {
		assert.equal(weightOfPx(140, SCALE), 3); // Data, Link, Select: the 140 fallback
		assert.equal(weightOfPx(100, SCALE), 2); // Currency, Float, Int
		assert.equal(weightOfPx(200, SCALE), 4); // Text, Small Text
		assert.equal(weightOfPx(60, SCALE), 1); // Check
	});
	it("is linear between the points and held to the ends", () => {
		assert.equal(weightOfPx(120, SCALE), 2.5);
		assert.equal(weightOfPx(225, SCALE), 4.5);
		assert.equal(weightOfPx(30, SCALE), 1);
		assert.equal(weightOfPx(700, SCALE), 12);
		assert.equal(weightOfPx(Number.NaN, SCALE), 1);
	});
	it("inverts", () => {
		assert.equal(pxOfWeight(2.5, SCALE), 120);
		assert.equal(pxOfWeight(1, SCALE), 60);
		assert.equal(pxOfWeight(0.5, SCALE), 60);
		assert.equal(pxOfWeight(13, SCALE), 600);
		for (const px of [60, 85, 140, 333, 600]) assert.equal(pxOfWeight(weightOfPx(px, SCALE), SCALE), px);
	});
});

describe("columnWeight", () => {
	it("is the docfield's columns span when it has one, whatever its px", () => {
		assert.equal(columnWeight({ columns: 3, px: 500 }, SCALE), 3);
		assert.equal(columnWeight({ columns: 1, px: 100 }, SCALE), 1);
		assert.equal(columnWeight({ columns: 12, px: 60 }, SCALE), 12);
	});
	it("falls back to the px when the span is not 1-12, as frappe ignores it", () => {
		assert.equal(columnWeight({ columns: 0, px: 140 }, SCALE), 3);
		assert.equal(columnWeight({ columns: 13, px: 100 }, SCALE), 2);
		assert.equal(columnWeight({ columns: 2.5, px: 200 }, SCALE), 4);
		assert.equal(columnWeight({ columns: null, px: 60 }, SCALE), 1);
		assert.equal(columnWeight({ px: 120 }, SCALE), 2.5);
	});
});

describe("columnFloor", () => {
	it("is the header label's width when that is under the span's px", () => {
		assert.equal(columnFloor({ weight: 4, label: 80 }, SCALE, 60), 80); // "Item", span 4
		assert.equal(columnFloor({ weight: 3, label: 120 }, SCALE, 60), 120); // "Item Code", span 3
	});
	it("is the span's px when the label is longer, so a long label cannot starve the others", () => {
		assert.equal(columnFloor({ weight: 2, label: 144 }, SCALE, 60), 100); // "Amount (USD)", span 2
		assert.equal(columnFloor({ weight: 2.5, label: 300 }, SCALE, 60), 120);
	});
	it("keeps a columns: 1 Check at frappe's 60px whatever its label", () => {
		assert.equal(columnFloor({ weight: 1, label: 144 }, SCALE, 60), 60);
	});
	it("is never under frappe's minimum", () => {
		assert.equal(columnFloor({ weight: 3, label: 0 }, SCALE, 60), 60);
		assert.equal(columnFloor({ weight: 2, label: 40.2 }, SCALE, 60), 60);
	});
	it("builds on the header width the list estimator uses", () => {
		// "Quantity": 8 chars x 8px + the 32px cell inset + 16px for the handle
		assert.equal(headerWidth("Quantity"), 112);
		assert.equal(headerWidth(""), 0);
	});
});

describe("Sales Invoice Item's list columns", () => {
	// item_code 4, qty 2, rate 2, amount 2, warehouse (Link, no span: 140px = 3),
	// in the 663px a 1280px screen leaves them, and the 1303px of a 1920px one.
	const cols = [
		{ weight: 4, floor: columnFloor({ weight: 4, label: headerWidth("Item") }, SCALE, 60) },
		{ weight: 2, floor: columnFloor({ weight: 2, label: headerWidth("Quantity") }, SCALE, 60) },
		{ weight: 2, floor: columnFloor({ weight: 2, label: headerWidth("Rate (USD)") }, SCALE, 60) },
		{ weight: 2, floor: columnFloor({ weight: 2, label: headerWidth("Amount (USD)") }, SCALE, 60) },
		{ weight: 3, floor: columnFloor({ weight: 3, label: headerWidth("Warehouse") }, SCALE, 60) },
	];
	it("come out near frappe's own px at 1280px, with nothing left over for a last column", () => {
		assert.deepEqual(ratioWidths(663, cols), [204, 102, 102, 102, 153]);
	});
	it("grow by their ratio at 1920px", () => {
		assert.deepEqual(ratioWidths(1303, cols), [401, 201, 200, 200, 301]);
	});
});

describe("ratioWidths", () => {
	const flex = (weight: number, floor = 0) => ({ weight, floor });

	it("shares the width in the ratio of the weights, exactly", () => {
		assert.deepEqual(ratioWidths(1000, [flex(4), flex(2), flex(2), flex(2)]), [400, 200, 200, 200]);
	});
	it("gives no column the remainder: there is no last-column fill", () => {
		const out = ratioWidths(1200, [flex(1), flex(1), flex(1), flex(1)]);
		assert.deepEqual(out, [300, 300, 300, 300]);
	});
	it("rounds to whole px that add up to the width, largest fraction first", () => {
		assert.deepEqual(ratioWidths(100, [flex(1), flex(1), flex(1)]), [34, 33, 33]);
		assert.deepEqual(ratioWidths(10, [flex(1), flex(2)]), [3, 7]);
		assert.deepEqual(ratioWidths(999.7, [flex(1), flex(1)]), [500, 499]);
	});
	it("holds a column at its floor and shares the rest among the others", () => {
		const out = ratioWidths(500, [flex(1, 150), flex(4, 60), flex(5, 60)]);
		assert.deepEqual(out, [150, 156, 194]);
		assert.equal(sum(out), 500);
	});
	it("uses the floors, and overflows, when the floors do not fit", () => {
		assert.deepEqual(ratioWidths(200, [flex(1, 100), flex(1, 150)]), [100, 150]);
		assert.deepEqual(ratioWidths(0, [flex(1, 60), flex(2, 80)]), [60, 80]);
		assert.deepEqual(ratioWidths(Number.NaN, [flex(1, 60)]), [60]);
	});
	it("keeps a fixed column exactly and shares what is left", () => {
		const out = ratioWidths(1000, [{ weight: 3, floor: 60, fixed: 250 }, flex(1, 60), flex(3, 60)]);
		assert.deepEqual(out, [250, 188, 562]);
		assert.equal(sum(out), 1000);
	});
	it("keeps a fixed column exactly when the rest are at their floors", () => {
		assert.deepEqual(ratioWidths(300, [{ weight: 1, floor: 60, fixed: 250 }, flex(1, 100)]), [250, 100]);
	});
	it("grows all-fixed columns in proportion to fill the room, never shrinking them", () => {
		assert.deepEqual(
			ratioWidths(1000, [
				{ weight: 1, floor: 0, fixed: 200 },
				{ weight: 9, floor: 0, fixed: 300 },
			]),
			[400, 600],
		);
		assert.deepEqual(
			ratioWidths(400, [
				{ weight: 1, floor: 0, fixed: 200 },
				{ weight: 1, floor: 0, fixed: 300 },
			]),
			[200, 300],
		);
	});
	it("treats a missing or nonsense weight as 1", () => {
		assert.deepEqual(ratioWidths(100, [flex(0), flex(Number.NaN)]), [50, 50]);
	});
	it("is empty for no columns", () => {
		assert.deepEqual(ratioWidths(500, []), []);
	});
	it("always fills the width exactly when the floors fit", () => {
		let seed = 7;
		const rand = (): number => {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		};
		for (let t = 0; t < 200; t++) {
			const n = 1 + Math.floor(rand() * 12);
			const cols = Array.from({ length: n }, () => ({
				weight: 1 + Math.floor(rand() * 12),
				floor: 60 + Math.floor(rand() * 60),
				fixed: rand() < 0.2 ? 60 + Math.floor(rand() * 200) : undefined,
			}));
			const available = 300 + Math.floor(rand() * 2000);
			const out = ratioWidths(available, cols);
			const need = sum(cols.map((c) => c.fixed ?? c.floor));
			const allFixed = cols.every((c) => c.fixed !== undefined);
			cols.forEach((c, i) => {
				const w = out[i] ?? 0;
				if (c.fixed === undefined) assert.ok(w >= c.floor, `column ${i} under its floor`);
				else if (allFixed) assert.ok(w >= c.fixed, `column ${i} under its fixed width`);
				else assert.equal(w, c.fixed);
			});
			if (need <= available) assert.equal(sum(out), available, JSON.stringify({ available, cols, out }));
		}
	});
});
