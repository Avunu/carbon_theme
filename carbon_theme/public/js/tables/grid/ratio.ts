// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// Child-table column widths as a RATIO of the grid's width.
//
// A docfield's `columns` (1-12, the "Columns" property in the doctype and in
// Customize Form) is the share of the row the field is designed to take. frappe
// 16.50 no longer reads it as a share: `Grid#get_column_width`
// (grid.js:1531-1538) turns it into a fixed pixel width through
// `LEGACY_COLSIZE_TO_PX` (1 -> 60, 2 -> 100, 3 -> 140, 4 -> 200, ... 12 -> 600),
// and `.grid-data-last` (grid_row.js:766-768) hands whatever is left of the
// row to the last column. A five-column grid on a 1280px screen therefore drew
// four columns at 60-140px, too narrow for their contents, and one column that
// took the other half of the screen.
//
// This module is the replacement, kept pure (numbers in, numbers out) so the
// unit suite can pin it without a DOM: each data column carries a WEIGHT, and
// the grid's free width is shared out in proportion to the weights, every
// column at least its FLOOR. ./grid.ts measures the width and gathers the
// weights, floors and user-fixed widths from frappe's metadata.

/** One column, as {@link ratioWidths} sees it. */
export interface RatioColumn {
	/** The column's share; only its size relative to the others matters. */
	weight: number;
	/** The narrowest the column may be drawn, in px. */
	floor: number;
	/**
	 * A width somebody chose (a header drag, a Configure Columns width): drawn at
	 * exactly this many px, and the other columns share what is left.
	 */
	fixed?: number | undefined;
}

/** `{ weight -> px }`: frappe's `LEGACY_COLSIZE_TO_PX`, passed in so this module needs no frappe. */
export type ColumnScale = Readonly<Record<number, number>>;

/** The scale's points, sorted by weight. */
function points(scale: ColumnScale): Array<[number, number]> {
	return Object.entries(scale)
		.map(([w, px]): [number, number] => [Number(w), px])
		.filter(([w, px]) => Number.isFinite(w) && Number.isFinite(px))
		.sort((a, b) => a[0] - b[0]);
}

/**
 * The weight a pixel width stands for on frappe's scale: the inverse of
 * `LEGACY_COLSIZE_TO_PX`, linear between its points and held to its ends. So a
 * column frappe would have drawn at 140px (the default for a Data or Link field)
 * weighs exactly what `columns: 3` weighs, and a 100px Currency default what
 * `columns: 2` does; the proportions frappe gave unconfigured fields survive.
 */
export function weightOfPx(px: number, scale: ColumnScale): number {
	const pts = points(scale);
	const first = pts[0];
	const last = pts[pts.length - 1];
	if (!first || !last) return 1;
	if (!(px > first[1])) return first[0];
	if (px >= last[1]) return last[0];
	for (let i = 1; i < pts.length; i++) {
		const [w1, p1] = pts[i - 1] ?? first;
		const [w2, p2] = pts[i] ?? last;
		if (px <= p2) return w1 + ((px - p1) / (p2 - p1)) * (w2 - w1);
	}
	return last[0];
}

/** The pixel width frappe's scale gives a weight; the inverse of {@link weightOfPx}. */
export function pxOfWeight(weight: number, scale: ColumnScale): number {
	const pts = points(scale);
	const first = pts[0];
	const last = pts[pts.length - 1];
	if (!first || !last) return 0;
	if (!(weight > first[0])) return first[1];
	if (weight >= last[0]) return last[1];
	for (let i = 1; i < pts.length; i++) {
		const [w1, p1] = pts[i - 1] ?? first;
		const [w2, p2] = pts[i] ?? last;
		if (weight <= w2) return p1 + ((weight - w1) / (w2 - w1)) * (p2 - p1);
	}
	return last[1];
}

/** What {@link columnWeight} reads off a docfield. */
export interface WeightSource {
	/** `df.columns`: the field's span, 1-12. Anything else is ignored, as frappe ignores it. */
	columns?: number | null | undefined;
	/** The px width frappe falls back to: a docfield `width`, else the fieldtype default, else 140. */
	px: number;
}

/**
 * A column's weight: its `columns` span when it has one, otherwise the span its
 * fallback pixel width stands for on the same scale.
 */
export function columnWeight({ columns, px }: WeightSource, scale: ColumnScale): number {
	if (typeof columns === "number" && Number.isInteger(columns) && columns >= 1 && columns <= 12)
		return columns;
	return weightOfPx(px, scale);
}

/**
 * The narrowest a column is drawn: the width frappe's own scale gives its
 * weight, and never less than frappe's minimum.
 *
 * That is the width frappe 16.50 itself drew the column at, so the ratio only
 * ever adds width: wherever the grid is about as wide as frappe's pixel layout
 * assumed (a 1280px screen with the sidebar open) the ratio comes out close to
 * it, above that every column grows by its ratio, and below it the columns sit
 * at frappe's widths and the table scrolls sideways, as it always did. A floor
 * under the span's px (the header label's width, say) would let a short-label
 * column with the most content (a span-4 "Item") be squeezed first and hardest
 * on a narrow screen, narrower than every column beside it.
 */
export function columnFloor(weight: number, scale: ColumnScale, min: number): number {
	return Math.ceil(Math.max(min, pxOfWeight(weight, scale)));
}

/**
 * Share `available` px out between `columns`.
 *
 * - A column with `fixed` is exactly that wide.
 * - The rest share what is left in proportion to their weights; one whose share
 *   would fall below its floor is held at the floor and the others share what
 *   remains, until every share fits.
 * - The result is whole px and adds up to exactly `available`, the rounding
 *   remainder going to the largest fractions (the first column on a tie).
 * - When the floors and fixed widths alone need more than `available`, every
 *   column is its floor (or fixed width) and the total is more than `available`:
 *   the table scrolls sideways rather than squeezing anything below its floor.
 * - When every column is fixed and there is room left over, nothing would
 *   take it; the fixed widths then act as both weights and floors, so they
 *   grow in proportion and never shrink below what was chosen.
 */
export function ratioWidths(available: number, columns: readonly RatioColumn[]): number[] {
	if (!columns.length) return [];
	const room = Number.isFinite(available) ? Math.max(0, Math.floor(available)) : 0;
	const isFixed = (c: RatioColumn): c is RatioColumn & { fixed: number } =>
		typeof c.fixed === "number" && Number.isFinite(c.fixed) && c.fixed > 0;

	let cols = columns.map((c) => ({
		weight: Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 1,
		floor: Math.max(0, Math.ceil(Number.isFinite(c.floor) ? c.floor : 0)),
		fixed: isFixed(c) ? Math.round(c.fixed) : null,
	}));

	const fixedSum = cols.reduce((n, c) => n + (c.fixed ?? 0), 0);
	if (cols.every((c) => c.fixed !== null)) {
		if (fixedSum >= room) return cols.map((c) => c.fixed ?? 0);
		cols = cols.map((c) => ({ weight: c.fixed ?? 1, floor: c.fixed ?? 0, fixed: null }));
	}

	const out = cols.map((c) => c.fixed ?? 0);
	const flex = cols.flatMap((c, i) => (c.fixed === null ? [i] : []));
	const free = room - cols.reduce((n, c) => n + (c.fixed ?? 0), 0);
	const floorSum = flex.reduce((n, i) => n + (cols[i]?.floor ?? 0), 0);
	if (free <= floorSum) {
		for (const i of flex) out[i] = cols[i]?.floor ?? 0;
		return out;
	}

	// Hold every column whose share would be under its floor at the floor, and
	// share again among the rest, until nothing more drops under.
	const held = new Set<number>();
	let shares = new Map<number, number>();
	for (;;) {
		const active = flex.filter((i) => !held.has(i));
		const heldSum = [...held].reduce((n, i) => n + (cols[i]?.floor ?? 0), 0);
		const left = free - heldSum;
		const weights = active.reduce((n, i) => n + (cols[i]?.weight ?? 0), 0);
		shares = new Map(active.map((i) => [i, (left * (cols[i]?.weight ?? 0)) / weights]));
		const under = active.filter((i) => (shares.get(i) ?? 0) < (cols[i]?.floor ?? 0));
		if (!under.length) break;
		for (const i of under) held.add(i);
	}
	for (const i of held) out[i] = cols[i]?.floor ?? 0;

	// Largest remainder: whole px that add up to exactly the free width.
	const target = free - [...held].reduce((n, i) => n + (cols[i]?.floor ?? 0), 0);
	let given = 0;
	for (const [i, share] of shares) {
		out[i] = Math.floor(share);
		given += out[i] ?? 0;
	}
	const byFraction = [...shares.entries()].sort(
		(a, b) => b[1] - Math.floor(b[1]) - (a[1] - Math.floor(a[1])) || a[0] - b[0],
	);
	for (let k = 0; given < target && byFraction.length; k = (k + 1) % byFraction.length) {
		const entry = byFraction[k];
		if (!entry) break;
		out[entry[0]] = (out[entry[0]] ?? 0) + 1;
		given++;
	}
	return out;
}
