// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	FlowStreamRefused,
	RunAdapter,
	SessionStream,
	parseEntriesSnapshot,
	type EntriesSnapshot,
	type FlowSocket,
	type HarnessEvent,
} from "../../../carbon_theme/public/js/ai_chat/flow/stream.ts";
import {
	parseFlowQuestions,
	pendingCallQuestion,
} from "../../../carbon_theme/public/js/ai_chat/flow/events.ts";

const SESSION = "S-1";

function adapt(events: HarnessEvent[]): unknown[] {
	const adapter = new RunAdapter();
	return events.flatMap((event) => adapter.push(event));
}

describe("RunAdapter", () => {
	it("passes text deltas through and adds only what the durable message adds", () => {
		assert.deepEqual(
			adapt([
				{ type: "text_delta", text: "Hel" },
				{ type: "assistant_message", content: [{ type: "text", text: "Hello!" }] },
			]),
			[
				{ type: "text", delta: "Hel" },
				{ type: "text", delta: "lo!" },
			],
		);
	});

	it("does not repeat delivered text when the preview is replayed", () => {
		assert.deepEqual(
			adapt([
				{ type: "text_delta", text: "Hello" },
				{ type: "preview_replay_started" },
				{ type: "text_delta", text: "Hel" },
				{ type: "text_delta", text: "lo wor" },
				{ type: "text_delta", text: "ld" },
			]),
			[
				{ type: "text", delta: "Hello" },
				{ type: "text", delta: " wor" },
				{ type: "text", delta: "ld" },
			],
		);
	});

	it("turns tool calls into tool_started (bare, then with arguments) and results into tool_ended", () => {
		assert.deepEqual(
			adapt([
				{ type: "tool_call_started", id: "c1", name: "read" },
				{ type: "tool_call_display_ready", id: "c1", name: "read", arguments: { path: "a" } },
				{
					type: "assistant_message",
					content: [{ type: "tool_call", id: "c1", name: "read", arguments: { path: "a", limit: 5 } }],
				},
				{ type: "tool_result", tool_call_id: "c1", name: "read", content: "text" },
			]),
			[
				{ type: "tool_started", id: "c1", name: "read", arguments: {} },
				{ type: "tool_started", id: "c1", name: "read", arguments: { path: "a" } },
				{ type: "tool_started", id: "c1", name: "read", arguments: { path: "a", limit: 5 } },
				{ type: "tool_ended", id: "c1", name: "read", result: "text" },
			],
		);
	});

	it("drops a sub-agent's events", () => {
		assert.deepEqual(adapt([{ type: "text_delta", text: "x", subagent_id: "sub" }]), []);
	});

	it("ends a failed run with the run_error message", () => {
		assert.deepEqual(
			adapt([
				{ type: "run_error", message: "Provider down" },
				{ type: "run_ended", reason: "error" },
			]),
			[{ type: "error", message: "Provider down" }],
		);
	});

	it("ends a denied resume with no output, and ignores events after the end", () => {
		const adapter = new RunAdapter();
		adapter.push({ type: "assistant_message", content: [{ type: "text", text: "earlier" }] });
		assert.deepEqual(adapter.push({ type: "run_ended", reason: "denied" }), [
			{ type: "done", status: "Completed", iterations: 0, output: null, usage: {}, questions: [] },
		]);
		assert.equal(adapter.finished, true);
		assert.deepEqual(adapter.push({ type: "text_delta", text: "late" }), []);
	});
});

describe("pending calls as questions", () => {
	it("asks Approve or Deny, keyed by the call id, with a prompt of its own when Flow gave none", () => {
		assert.deepEqual(pendingCallQuestion({ id: "c2", name: "delete", args: {}, prompt: "" }), {
			prompt: "Approve `delete`?",
			options: ["Approve", "Deny"],
			multi_select: false,
			allow_other: true,
			key: "c2",
		});
		assert.equal(pendingCallQuestion({ name: "delete" }), null);
	});

	it("reads a Paused Flow Run's questions JSON in the built-in shape", () => {
		const questions = parseFlowQuestions(
			JSON.stringify([{ id: "c3", name: "write", args: {}, prompt: "Write?" }]),
		);
		assert.equal(questions[0]?.key, "c3");
		assert.equal(questions[0]?.prompt, "Write?");
	});
});

class FakeSocket implements FlowSocket {
	readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
	readonly emitted: unknown[][] = [];
	ack: unknown = { subscribed: true };
	on(name: string, listener: (payload: unknown) => void): void {
		const set = this.listeners.get(name) ?? new Set();
		set.add(listener);
		this.listeners.set(name, set);
	}
	off(name: string, listener: (payload: unknown) => void): void {
		this.listeners.get(name)?.delete(listener);
	}
	emit(name: string, ...args: unknown[]): void {
		this.emitted.push([name, ...args]);
		const callback = args[1];
		if (name === "flow:subscribe" && typeof callback === "function") callback(this.ack);
	}
	deliver(name: string, payload: unknown): void {
		for (const listener of Array.from(this.listeners.get(name) ?? [])) listener(payload);
	}
}

function snapshot(entries: HarnessEvent[] = [], preview: HarnessEvent[] = []): EntriesSnapshot {
	return { entries, preview, latest_seq: 0, stream_id: null, revision: null };
}

describe("SessionStream", () => {
	it("yields the catch-up rows, then live events once each, and fetches again over a gap", async () => {
		const socket = new FakeSocket();
		const fetches: number[] = [];
		const stream = new SessionStream({
			socket,
			session: SESSION,
			since: 2,
			fetchEntries: async (since) => {
				fetches.push(since);
				return since === 2 ? snapshot([{ type: "x", seq: 3 }]) : snapshot([{ type: "gap", seq: 5 }]);
			},
			refusedMessage: "refused",
		});
		await stream.open();
		const seen: unknown[] = [];
		const done = (async () => {
			for await (const event of stream) {
				seen.push(event["seq"] ?? event["revision"]);
				if (seen.length === 5) stream.close();
			}
		})();
		await new Promise((resolve) => setTimeout(resolve, 0));
		socket.deliver("flow:event", { session_id: SESSION, type: "a", seq: 3 }); // already seen
		socket.deliver("flow:event", { session_id: "other", type: "a", seq: 4 }); // another chat
		socket.deliver("flow:event", { session_id: SESSION, type: "a", seq: 4 });
		socket.deliver("flow:event", { session_id: SESSION, type: "d", revision: 1 });
		socket.deliver("flow:event", { session_id: SESSION, type: "d", revision: 1 }); // replayed
		socket.deliver("flow:event", { session_id: SESSION, type: "b", seq: 6 }); // after a gap
		await done;
		assert.deepEqual(seen, [3, 4, 1, 5, 6]);
		assert.deepEqual(fetches, [2, 4]);
		assert.deepEqual(socket.emitted.at(-1), ["flow:unsubscribe", SESSION]);
	});

	it("throws FlowStreamRefused when the relay refuses the room", async () => {
		const socket = new FakeSocket();
		socket.ack = { subscribed: false };
		const stream = new SessionStream({
			socket,
			session: SESSION,
			since: 0,
			fetchEntries: async () => snapshot(),
			refusedMessage: "refused",
		});
		await assert.rejects(stream.open(), (error: unknown) => error instanceof FlowStreamRefused);
	});

	it("parses a snapshot leniently", () => {
		assert.deepEqual(parseEntriesSnapshot(null), snapshot());
		assert.deepEqual(
			parseEntriesSnapshot({ entries: [{ seq: 1 }, 3], latest_seq: 7, stream_id: "s", revision: 2 }),
			{
				entries: [{ seq: 1 }],
				preview: [],
				latest_seq: 7,
				stream_id: "s",
				revision: 2,
			},
		);
	});
});
