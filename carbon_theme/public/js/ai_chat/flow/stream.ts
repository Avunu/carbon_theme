// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// Live events of Frappe's built-in Flow (Frappe 16.60+), and their translation into the
// `FlowEvent`s the reducer was written against.
//
// The built-in Flow does not stream a run's reply in the HTTP response. A turn is started
// with `frappe.flow.api.run` (or `resume`), which answers at once; the flow server's events
// reach the browser through Frappe's socket.io process, which relays the session's Redis
// channel to a room the page joins (`flow:subscribe`, realtime/flow_handlers.js). Durable
// events carry a `seq` and can be fetched again (`frappe.flow.api.entries`); live-only
// events (text and tool-call previews) carry a `revision` instead.
//
// Two parts, both free of DOM and frappe so node:test covers them:
//
//   SessionStream  joins the room, then fetches the log since a cursor, and yields every
//                  event once, in order. A gap in `seq`, a resync notice, a reconnect or a
//                  new `stream_id` fetches the log again. A port of SessionStream in
//                  apps/frappe/flow/frontend/src/api/stream.js.
//   RunAdapter     folds those events into the six-event `FlowEvent` stream of one run
//                  (run_started is the caller's, from the API's answer). See its comment.

import type { FlowEvent, FlowQuestion } from "./events.ts";
import { pendingCallQuestion } from "./events.ts";
import { isRecord } from "../types.ts";

const SUBSCRIBE_TIMEOUT_MS = 15_000;

/** The slice of a socket.io client this module uses: `frappe.realtime.socket` on the desk. */
export interface FlowSocket {
	on(name: string, listener: (payload: unknown) => void): unknown;
	off(name: string, listener: (payload: unknown) => void): unknown;
	emit(name: string, ...args: unknown[]): unknown;
}

/** One harness event as it came off the wire: a JSON object with at least `type`. */
export type HarnessEvent = Record<string, unknown>;

/** `frappe.flow.api.entries`: durable rows after `since`, plus the preview of a reply in flight. */
export interface EntriesSnapshot {
	entries: HarnessEvent[];
	preview: HarnessEvent[];
	latest_seq: number;
	stream_id: string | null;
	revision: number | null;
}

export function parseEntriesSnapshot(value: unknown): EntriesSnapshot {
	const data = isRecord(value) ? value : {};
	const rows = (key: string): HarnessEvent[] => {
		const list = data[key];
		return Array.isArray(list) ? list.filter(isRecord) : [];
	};
	const latest = data["latest_seq"];
	const streamId = data["stream_id"];
	const revision = data["revision"];
	return {
		entries: rows("entries"),
		preview: rows("preview"),
		latest_seq: typeof latest === "number" ? latest : 0,
		stream_id: typeof streamId === "string" ? streamId : null,
		revision: typeof revision === "number" ? revision : null,
	};
}

/** The relay refused the room, or never answered. */
export class FlowStreamRefused extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FlowStreamRefused";
	}
}

type QueueItem = { kind: "event"; event: HarnessEvent } | { kind: "resync" } | { kind: "reconnect" };

export interface SessionStreamOptions {
	socket: FlowSocket;
	session: string;
	/** The last `seq` already seen; events at or before it are skipped. */
	since: number;
	fetchEntries: (since: number) => Promise<EntriesSnapshot>;
	/** The refusal's text, translated by the caller. */
	refusedMessage: string;
	subscribeTimeoutMs?: number;
}

export class SessionStream implements AsyncIterable<HarnessEvent> {
	private readonly socket: FlowSocket;
	private readonly session: string;
	private readonly fetchEntries: (since: number) => Promise<EntriesSnapshot>;
	private readonly refusedMessage: string;
	private readonly timeoutMs: number;
	private cursor: number;
	private closed = false;
	private subscribed = false;
	private unsubscribeOnAck = false;
	private streamId: string | null = null;
	private revision = 0;
	private readonly queue: QueueItem[] = [];
	private waiting: ((item: QueueItem | null) => void) | null = null;
	private readonly listeners: Record<string, (payload: unknown) => void>;

	constructor(options: SessionStreamOptions) {
		this.socket = options.socket;
		this.session = options.session;
		this.cursor = options.since;
		this.fetchEntries = options.fetchEntries;
		this.refusedMessage = options.refusedMessage;
		this.timeoutMs = options.subscribeTimeoutMs ?? SUBSCRIBE_TIMEOUT_MS;
		const forSession = (payload: unknown, key: string): boolean =>
			isRecord(payload) && payload[key] === this.session;
		this.listeners = {
			"flow:event": (payload) => {
				if (isRecord(payload) && forSession(payload, "session_id"))
					this.push({ kind: "event", event: payload });
			},
			"flow:resync": (payload) => {
				if (forSession(payload, "session")) this.push({ kind: "resync" });
			},
			connect: () => {
				if (this.subscribed) this.push({ kind: "reconnect" });
			},
			// the relay dropped the room on an access check: join again, as after a reconnect
			"flow:resubscribe": (payload) => {
				if (forSession(payload, "session")) this.push({ kind: "reconnect" });
			},
		};
	}

	/** Leaves the room. A pending iteration ends without an error. */
	close(): void {
		if (this.closed) return;
		this.closed = true;
		for (const [name, listener] of Object.entries(this.listeners)) this.socket.off(name, listener);
		if (this.subscribed) this.socket.emit("flow:unsubscribe", this.session);
		else this.unsubscribeOnAck = true;
		this.wake();
	}

	private push(item: QueueItem): void {
		this.queue.push(item);
		this.wake();
	}

	private wake(): void {
		const resolve = this.waiting;
		if (!resolve) return;
		this.waiting = null;
		resolve(this.queue.shift() ?? null);
	}

	private next(): Promise<QueueItem | null> {
		const item = this.queue.shift();
		if (item) return Promise.resolve(item);
		if (this.closed) return Promise.resolve(null);
		return new Promise((resolve) => {
			this.waiting = resolve;
		});
	}

	/** Resolves once the relay has joined the session's channel; false when refused or silent. */
	private subscribe(): Promise<boolean> {
		return new Promise((resolve) => {
			const timer = setTimeout(() => resolve(false), this.timeoutMs);
			this.socket.emit("flow:subscribe", this.session, (ack: unknown) => {
				clearTimeout(timer);
				const ok = isRecord(ack) && ack["subscribed"] === true;
				this.subscribed = ok;
				if (ok && this.unsubscribeOnAck) this.socket.emit("flow:unsubscribe", this.session);
				resolve(ok);
			});
		});
	}

	/** Joins the room. Call before starting the turn, so none of its events are missed. */
	async open(): Promise<void> {
		for (const [name, listener] of Object.entries(this.listeners)) this.socket.on(name, listener);
		if (!(await this.subscribe())) {
			this.close();
			throw new FlowStreamRefused(this.refusedMessage);
		}
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<HarnessEvent> {
		try {
			yield* this.resnapshot();
			while (!this.closed) {
				// oxlint-disable-next-line no-await-in-loop -- one event at a time, in order, by design
				const item = await this.next();
				if (item === null) return;
				if (item.kind === "resync") {
					yield* this.resnapshot();
					continue;
				}
				if (item.kind === "reconnect") {
					// oxlint-disable-next-line no-await-in-loop -- the room must be joined again before catching up
					if (!(await this.subscribe())) throw new FlowStreamRefused(this.refusedMessage);
					yield* this.resnapshot();
					continue;
				}
				const { event } = item;
				const streamId = typeof event["stream_id"] === "string" ? event["stream_id"] : null;
				if (streamId !== null && this.streamId !== null && streamId !== this.streamId) {
					this.streamId = streamId;
					this.revision = 0;
					yield* this.resnapshot();
				}
				if (streamId !== null && this.streamId === null) this.streamId = streamId;
				const seq = event["seq"];
				const revision = event["revision"];
				if (typeof seq === "number") {
					if (seq <= this.cursor) continue;
					if (seq > this.cursor + 1) {
						yield* this.resnapshot(); // the log covers the gap, and this event with it
						if (seq <= this.cursor) continue;
					}
					this.cursor = seq;
				} else if (typeof revision === "number" && revision <= this.revision) {
					continue; // a replayed live-only event
				}
				if (typeof revision === "number") this.revision = revision;
				yield event;
			}
		} finally {
			this.close();
		}
	}

	/** Durable rows after the cursor, then the in-flight preview of a running turn. */
	private async *resnapshot(): AsyncGenerator<HarnessEvent> {
		const data = await this.fetchEntries(this.cursor);
		if (this.closed) return;
		if (data.stream_id !== null) this.streamId = data.stream_id;
		if (data.revision !== null) this.revision = data.revision;
		const rows = data.entries
			.filter((row): row is HarnessEvent & { seq: number } => typeof row["seq"] === "number")
			.filter((row) => row.seq > this.cursor)
			.sort((a, b) => a.seq - b.seq);
		for (const row of rows) {
			this.cursor = row.seq;
			yield row;
		}
		if (data.preview.length > 0) yield { type: "preview_replay_started" };
		for (const event of data.preview) yield event;
	}
}

// -- RunAdapter ---------------------------------------------------------------

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/**
 * Folds the built-in Flow's events into the `FlowEvent`s of one run, the shape the separate
 * flow app streamed and `reduce.ts` consumes:
 *
 *   text_delta                     → text, but only the characters not delivered yet
 *   assistant_message (durable)    → text for whatever the deltas missed (none on a live
 *                                    stream, all of it on a replay), then tool_started
 *                                    with the full arguments for each tool call block
 *   tool_call_started              → tool_started with no arguments
 *   tool_call_display_ready        → tool_started with the streamed arguments
 *   tool_result                    → tool_ended
 *   approval_required              → tool_ended "" for each waiting call (the old pause)
 *   run_ended paused               → done Paused, with a question per waiting call
 *   run_ended error                → error, with the run_error message before it
 *   run_ended (any other reason)   → done Completed
 *
 * A sub-agent's events (`subagent_id`) are its own thread and are dropped, as Flow's own
 * transcript recorder does. `preview_replay_started` restarts the in-flight message from
 * its first character; the characters already delivered are skipped, so a resync never
 * repeats text. Everything else (thinking, usage, model and title changes, compaction,
 * suggested replies, rewind, user_message, run_started) is not shown by this chat.
 */
export class RunAdapter {
	/** The in-flight message's text as the deltas built it. */
	private streamed = "";
	/** How many characters of the in-flight message have been handed to the reducer. */
	private delivered = 0;
	private questions: FlowQuestion[] = [];
	private error: string | null = null;
	private lastText = "";
	private ended = false;

	/** True once the run's terminal event went out; later events are ignored. */
	get finished(): boolean {
		return this.ended;
	}

	push(event: HarnessEvent): FlowEvent[] {
		if (this.ended) return [];
		if (typeof event["subagent_id"] === "string" && event["subagent_id"] !== "") return [];
		switch (event["type"]) {
			case "preview_replay_started":
				this.streamed = "";
				return [];
			case "text_delta":
				return this.delta(text(event["text"]));
			case "tool_call_started": {
				const id = text(event["id"]);
				const name = text(event["name"]);
				return id && name ? [{ type: "tool_started", id, name, arguments: {} }] : [];
			}
			case "tool_call_display_ready": {
				const id = text(event["id"]);
				const name = text(event["name"]);
				const args = event["arguments"];
				return id && name ? [{ type: "tool_started", id, name, arguments: isRecord(args) ? args : {} }] : [];
			}
			case "assistant_message":
				return this.message(event["content"]);
			case "tool_result": {
				const id = text(event["tool_call_id"]);
				return id
					? [{ type: "tool_ended", id, name: text(event["name"]), result: text(event["content"]) }]
					: [];
			}
			case "approval_required": {
				const calls = Array.isArray(event["calls"]) ? event["calls"].filter(isRecord) : [];
				this.questions = calls.map(pendingCallQuestion).filter((q): q is FlowQuestion => q !== null);
				return calls
					.filter((call) => text(call["id"]) !== "")
					.map((call) => ({
						type: "tool_ended",
						id: text(call["id"]),
						name: text(call["name"]),
						result: "",
					}));
			}
			case "run_error":
				this.error = text(event["message"]);
				return [];
			case "run_ended":
				return this.end(text(event["reason"]));
			default:
				return [];
		}
	}

	private delta(chunk: string): FlowEvent[] {
		const before = this.streamed.length;
		this.streamed += chunk;
		if (this.streamed.length <= this.delivered) return [];
		const fresh = this.streamed.slice(Math.max(before, this.delivered));
		this.delivered = this.streamed.length;
		return fresh ? [{ type: "text", delta: fresh }] : [];
	}

	private message(content: unknown): FlowEvent[] {
		const blocks = Array.isArray(content) ? content.filter(isRecord) : [];
		const full = blocks
			.filter((block) => block["type"] === "text")
			.map((block) => text(block["text"]))
			.join("");
		const out: FlowEvent[] = [];
		if (full.length > this.delivered) out.push({ type: "text", delta: full.slice(this.delivered) });
		if (full.trim() !== "") this.lastText = full;
		this.streamed = "";
		this.delivered = 0;
		for (const block of blocks) {
			if (block["type"] !== "tool_call") continue;
			const id = text(block["id"]);
			const name = text(block["name"]);
			const args = block["arguments"];
			if (id && name) out.push({ type: "tool_started", id, name, arguments: isRecord(args) ? args : {} });
		}
		return out;
	}

	private end(reason: string): FlowEvent[] {
		this.ended = true;
		if (reason === "error") return [{ type: "error", message: this.error ?? "" }];
		const paused = reason === "paused";
		return [
			{
				type: "done",
				status: paused ? "Paused" : "Completed",
				iterations: 0,
				// a denied resume ends without a reply of its own
				output: paused || reason === "denied" || this.lastText === "" ? null : this.lastText,
				usage: {},
				questions: paused ? this.questions : [],
			},
		];
	}
}
