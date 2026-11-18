// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// Row virtualization.
//
// Report views routinely render tens of thousands of rows (frappe's own guard,
// `max_report_rows`, defaults to 100 000) and frappe-datatable used HyperList to
// cope. We use @tanstack/virtual-core, driving SPACER ROWS rather than absolute
// positioning: a <tr> holding one colspan'd <td> of the right height keeps the
// <table> element valid, so `table-layout: fixed`, <colgroup> widths and
// `position: sticky` pinned cells all keep working. Absolute positioning would
// have forced the whole grid into divs and cost us Carbon's data-table CSS.
//
// Virtualization is DISABLED, not merely bypassed, whenever a row of
// non-uniform height is on screen — an expanded Grid detail form, or an
// expanded report tree node whose child rows the adapter renders itself. Mixed
// heights under a fixed `estimateSize` produce a scrollbar that drifts out of
// step with the content, which is worse than rendering every row.
//
// The exception is `autoRowHeight` (Carbon Settings > Grow Rows to Fit Text),
// where non-uniform rows are the point and a report can still hold tens of
// thousands of them. There the rows are MEASURED: each rendered <tr> is handed
// to the virtualizer, which observes it and keeps what it finds, keyed by row id
// (not index, so a sort does not hand one row another row's height). The
// `rowHeight` is then only the estimate for a row that has not been on screen.
import { Virtualizer, elementScroll, observeElementOffset, observeElementRect } from "@tanstack/virtual-core";
import type { ScrollToOptions } from "@tanstack/virtual-core";

/** Below this many rows, windowing costs more than it saves. */
export const VIRTUAL_THRESHOLD = 100;

/**
 * `scrollToIndex`'s options, re-exported under a name that does not collide
 * with the DOM's own `ScrollToOptions`.
 */
export type RowScrollToOptions = ScrollToOptions;

/**
 * What the virtualizer needs back from CarbonTable.
 *
 * Declared here rather than importing `CarbonTable`, because table.js imports
 * THIS module: the two are mutually dependent at runtime and the dependency has
 * to point one way. `shouldVirtualize` is the "same height for every row" veto
 * described above; `scheduleRender` is the engine's rAF-coalesced re-render.
 */
export interface RowVirtualizerHost {
	shouldVirtualize(count: number): boolean;
	scheduleRender(): void;
	/** The row model's id for the row at `index`; the key a measured height is kept under. */
	rowKey(index: number): string | number;
}

/**
 * The slice of rows to render, plus the two spacer heights that stand in for
 * the rows outside it.
 */
export interface VirtualWindow {
	/** First row index to render. */
	start: number;
	/** One past the last row index to render. */
	end: number;
	/** Height of the leading spacer row, in px. */
	paddingTop: number;
	/** Height of the trailing spacer row, in px. */
	paddingBottom: number;
}

export default class RowVirtualizer {
	host: RowVirtualizerHost;
	/** `HTMLElement` scroll parent, `Element` items — the engine measures rows itself. */
	virtualizer: Virtualizer<HTMLElement, Element> | null;
	cleanup: (() => void) | null;
	enabled: boolean;
	/** Rows are measured rather than assumed to be `rowHeight` (see the header note). */
	measured: boolean;
	// The `sync()` arguments the last build was made from. Undefined until the
	// first sync, null after a teardown; either way they can only compare
	// unequal to a real count/height/element, which is what the guard wants.
	_count: number | null | undefined;
	_rowHeight: number | null | undefined;
	_scrollElement: HTMLElement | null | undefined;
	_measured: boolean | null | undefined;

	constructor(host: RowVirtualizerHost) {
		this.host = host;
		this.virtualizer = null;
		this.cleanup = null;
		this.enabled = false;
		this.measured = false;
	}

	/**
	 * (Re)build the virtualizer for a row count. Idempotent per count/height.
	 * `measured` asks for rows of differing heights (see the header note).
	 */
	sync(count: number, rowHeight: number, scrollElement: HTMLElement, measured = false): boolean {
		const want = this.host.shouldVirtualize(count);
		if (!want) {
			this.teardown();
			return false;
		}
		if (
			this.virtualizer &&
			this._count === count &&
			this._rowHeight === rowHeight &&
			this._scrollElement === scrollElement &&
			this._measured === measured
		) {
			return true;
		}

		const opts = {
			count,
			getScrollElement: () => scrollElement,
			estimateSize: () => rowHeight,
			scrollToFn: elementScroll,
			observeElementOffset,
			observeElementRect,
			// Carbon lg rows are 48px; 12 rows of overscan is roughly half a
			// viewport, enough that a fast wheel scroll never shows a gap.
			overscan: 12,
			onChange: () => this.host.scheduleRender(),
			// Measured heights are kept by key. The default key is the index,
			// which after a sort or a filter is some other row's.
			...(measured ? { getItemKey: (index: number) => this.host.rowKey(index) } : {}),
		};

		if (this.virtualizer) {
			this.virtualizer.setOptions(Object.assign({}, opts, { onChange: opts.onChange }));
		} else {
			this.virtualizer = new Virtualizer(opts);
			this.cleanup = this.virtualizer._didMount();
		}
		this._count = count;
		this._rowHeight = rowHeight;
		this._scrollElement = scrollElement;
		this._measured = measured;
		this.measured = measured;
		this.enabled = true;
		this.virtualizer.measure();
		return true;
	}

	teardown(): void {
		if (this.cleanup) this.cleanup();
		this.cleanup = null;
		this.virtualizer = null;
		this.enabled = false;
		this.measured = false;
		this._count = this._rowHeight = this._scrollElement = this._measured = null;
	}

	/**
	 * Hand the virtualizer a rendered row to measure and keep watching, so a
	 * wrap that changes with the column width is picked up. A no-op unless this
	 * build is a measured one. Call it once the row is in the document: a
	 * detached node measures 0.
	 */
	measureRow(node: HTMLElement, index: number): void {
		if (!this.enabled || !this.measured || !this.virtualizer) return;
		node.setAttribute("data-index", String(index));
		this.virtualizer.measureElement(node);
	}

	/** Forget the rows that left the document, so the observer does not hold them. */
	pruneMeasured(): void {
		if (this.enabled && this.measured && this.virtualizer) this.virtualizer.measureElement(null);
	}

	/**
	 * The window to render, as `{ start, end, paddingTop, paddingBottom }`.
	 * Returns the full range when virtualization is off, so callers never need
	 * a second code path.
	 */
	window(count: number): VirtualWindow {
		if (!this.enabled || !this.virtualizer) {
			return { start: 0, end: count, paddingTop: 0, paddingBottom: 0 };
		}
		this.virtualizer._willUpdate();
		const items = this.virtualizer.getVirtualItems();
		// `first`/`last` stand in for the `items.length` test: virtual-core
		// returns a dense array, so an absent first item IS an empty window,
		// and reading them up front is what makes the two indexed reads below
		// definite.
		const first = items[0];
		const last = items[items.length - 1];
		if (!first || !last) {
			return { start: 0, end: 0, paddingTop: 0, paddingBottom: this.virtualizer.getTotalSize() };
		}
		return {
			start: first.index,
			end: last.index + 1,
			paddingTop: first.start,
			paddingBottom: Math.max(0, this.virtualizer.getTotalSize() - last.end),
		};
	}

	scrollToIndex(index: number, opts?: RowScrollToOptions): void {
		if (this.enabled && this.virtualizer) this.virtualizer.scrollToIndex(index, opts);
	}
}
