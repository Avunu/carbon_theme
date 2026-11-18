// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	assetUrl,
	ASSET_BASE,
	CHAT_CONTRACT_VERSION,
	closedFlowState,
	entrySpecifier,
	isChatModule,
	isFlowLauncher,
	MANIFEST_URL,
	parseManifest,
	parsePanelState,
	reconcileSession,
	seedSession,
	serialisePanelState,
	shouldMountAssistant,
} from "../../carbon_theme/public/js/anatomy/shell/assistant_gate.ts";

describe("shouldMountAssistant", () => {
	const launcher = { toggle() {}, open() {} };
	it("needs Frappe's Flow launcher on the page", () => {
		assert.equal(shouldMountAssistant(launcher, {}), true);
		assert.equal(shouldMountAssistant(undefined, {}), false);
		assert.equal(shouldMountAssistant({ toggle() {} }, {}), false);
	});
	it("no longer reads the separate flow app's version", () => {
		assert.equal(shouldMountAssistant(undefined, { versions: { flow: "0.1.0" } }), false);
	});
	it("stays off on a read-only site, where Flow cannot write its sessions", () => {
		assert.equal(shouldMountAssistant(launcher, { read_only: true }), false);
		assert.equal(shouldMountAssistant(launcher, { read_only: false }), true);
	});
	it("tolerates a missing boot", () => {
		assert.equal(shouldMountAssistant(launcher, undefined), false);
		assert.equal(shouldMountAssistant(launcher, null), false);
	});
});

describe("panel state", () => {
	it("round-trips", () => {
		for (const open of [true, false]) {
			for (const expanded of [true, false]) {
				assert.deepEqual(parsePanelState(serialisePanelState({ open, expanded })), { open, expanded });
			}
		}
	});
	it("writes a versioned record", () => {
		assert.deepEqual(JSON.parse(serialisePanelState({ open: true, expanded: false })), {
			v: 1,
			open: true,
			expanded: false,
		});
	});
	it("falls back to closed and collapsed for nothing, junk and other versions", () => {
		const closed = { open: false, expanded: false };
		assert.deepEqual(parsePanelState(null), closed);
		assert.deepEqual(parsePanelState(undefined), closed);
		assert.deepEqual(parsePanelState(""), closed);
		assert.deepEqual(parsePanelState("{not json"), closed);
		assert.deepEqual(parsePanelState("null"), closed);
		assert.deepEqual(parsePanelState("[1]"), closed);
		assert.deepEqual(parsePanelState('{"open":true,"expanded":true}'), closed);
		assert.deepEqual(parsePanelState('{"v":2,"open":true,"expanded":true}'), closed);
	});
	it("takes only a real true as true", () => {
		assert.deepEqual(parsePanelState('{"v":1,"open":"yes","expanded":1}'), { open: false, expanded: false });
		assert.deepEqual(parsePanelState('{"v":1,"open":true}'), { open: true, expanded: false });
	});
	it("does not hand out the shared default to be mutated", () => {
		const first = parsePanelState(null);
		first.open = true;
		assert.equal(parsePanelState(null).open, false);
	});
});

describe("seedSession", () => {
	it("seeds the launcher's chat on the first run only", () => {
		assert.equal(seedSession(null, '{"open":true,"path":"/s/SESS-0001"}'), "SESS-0001");
		assert.equal(seedSession(null, '{"path":"/s/SESS-0001?tab=files"}'), "SESS-0001");
	});
	it("leaves the key alone once the chat has written it, even to a deliberate empty string", () => {
		assert.equal(seedSession("", '{"path":"/s/SESS-0001"}'), null);
		assert.equal(seedSession("SESS-0002", '{"path":"/s/SESS-0001"}'), null);
	});
	it("seeds an empty session when the launcher showed no chat or its state is unusable", () => {
		assert.equal(seedSession(null, null), "");
		assert.equal(seedSession(null, ""), "");
		assert.equal(seedSession(null, "{broken"), "");
		assert.equal(seedSession(null, '{"path":"/"}'), "");
		assert.equal(seedSession(null, '{"path":42}'), "");
		assert.equal(seedSession(null, '{"session":"SESS-OLD"}'), "");
		assert.equal(seedSession(null, "[]"), "");
	});
});

describe("reconcileSession", () => {
	const flow = '{"path":"/s/SESS-FLOW"}';
	it("keeps the seed and the hands-off rule for the user who owns the pointer", () => {
		assert.equal(reconcileSession("alice", "alice", null, flow), "SESS-FLOW");
		assert.equal(reconcileSession("alice", "alice", "SESS-0001", flow), null);
		assert.equal(reconcileSession("alice", "alice", "", flow), null);
	});
	it("seeds on the very first run, when nobody owns a pointer yet", () => {
		assert.equal(reconcileSession("alice", null, null, flow), "SESS-FLOW");
		assert.equal(reconcileSession("alice", null, null, null), "");
	});
	it("starts a new chat for another user instead of resuming the previous one's session", () => {
		assert.equal(reconcileSession("bob", "alice", "SESS-0001", flow), "");
	});
	it("does not seed another user from the launcher's remembered chat", () => {
		assert.equal(reconcileSession("bob", "alice", null, flow), "");
	});
	it("does not rewrite a pointer that is already empty", () => {
		assert.equal(reconcileSession("bob", "alice", "", flow), null);
	});
	it("drops a pointer whose owner was never recorded", () => {
		assert.equal(reconcileSession("alice", null, "SESS-0001", flow), "");
		assert.equal(reconcileSession("alice", null, "", flow), null);
	});
});

describe("closedFlowState", () => {
	it("forces open off and keeps the chat and width", () => {
		const closed = closedFlowState('{"open":true,"width":420,"path":"/s/SESS-0001"}');
		assert.deepEqual(JSON.parse(closed ?? ""), { open: false, width: 420, path: "/s/SESS-0001" });
	});
	it("adds open: false to a state that never had it", () => {
		assert.deepEqual(JSON.parse(closedFlowState('{"path":"/s/S"}') ?? ""), { path: "/s/S", open: false });
	});
	it("returns null when there is nothing to rewrite", () => {
		assert.equal(closedFlowState(null), null);
		assert.equal(closedFlowState(""), null);
		assert.equal(closedFlowState("{broken"), null);
		assert.equal(closedFlowState("[1]"), null);
		assert.equal(closedFlowState("3"), null);
	});
});

describe("isFlowLauncher", () => {
	it("accepts Frappe's window.flow", () => {
		assert.equal(isFlowLauncher({ toggle() {}, open() {} }), true);
	});
	it("rejects anything missing toggle or open", () => {
		assert.equal(isFlowLauncher(null), false);
		assert.equal(isFlowLauncher(undefined), false);
		assert.equal(isFlowLauncher("flow"), false);
		assert.equal(isFlowLauncher({}), false);
		assert.equal(isFlowLauncher({ toggle() {} }), false);
		assert.equal(isFlowLauncher({ toggle: true, open() {} }), false);
	});
});

describe("parseManifest", () => {
	const good = { entry: "entry.AB12CD34.js", css: "chat.deadbeef.css", built: "2026-10-02T09:00:00.000Z" };
	it("reads a build's manifest", () => {
		assert.deepEqual(parseManifest(good), good);
	});
	it("allows a nested relative path", () => {
		assert.deepEqual(parseManifest({ ...good, entry: "chunks/entry-1.js" })?.entry, "chunks/entry-1.js");
	});
	it("treats a missing built stamp as informational", () => {
		assert.deepEqual(parseManifest({ entry: good.entry, css: good.css }), { ...good, built: "" });
	});
	it("rejects anything that is not an object with both files", () => {
		assert.equal(parseManifest(null), null);
		assert.equal(parseManifest("entry.js"), null);
		assert.equal(parseManifest([good]), null);
		assert.equal(parseManifest({ entry: good.entry }), null);
		assert.equal(parseManifest({ css: good.css }), null);
		assert.equal(parseManifest({ entry: 1, css: good.css }), null);
	});
	it("rejects a path that leaves the bundle directory", () => {
		assert.equal(parseManifest({ ...good, entry: "../x.js" }), null);
		assert.equal(parseManifest({ ...good, entry: "chunks/../../x.js" }), null);
		assert.equal(parseManifest({ ...good, css: "../chat.css" }), null);
		assert.equal(parseManifest({ ...good, entry: "a..b.js" }), null);
	});
	it("rejects absolute and cross-origin specifiers", () => {
		assert.equal(parseManifest({ ...good, entry: "/entry.js" }), null);
		assert.equal(parseManifest({ ...good, entry: "/assets/x/entry.js" }), null);
		assert.equal(parseManifest({ ...good, entry: "https://evil.example/entry.js" }), null);
		assert.equal(parseManifest({ ...good, entry: "//evil.example/entry.js" }), null);
		assert.equal(parseManifest({ ...good, css: "https://evil.example/chat.css" }), null);
		assert.equal(parseManifest({ ...good, entry: "data:text/javascript,1.js" }), null);
	});
	it("rejects the wrong extension", () => {
		assert.equal(parseManifest({ ...good, entry: "entry.mjs" }), null);
		assert.equal(parseManifest({ ...good, entry: "entry.js.map" }), null);
		assert.equal(parseManifest({ ...good, css: "chat.js" }), null);
		assert.equal(parseManifest({ ...good, css: "chat.css.map" }), null);
	});
	it("rejects characters that could break out of a URL or attribute", () => {
		assert.equal(parseManifest({ ...good, entry: "entry.js?x=1.js" }), null);
		assert.equal(parseManifest({ ...good, entry: 'entry".js' }), null);
		assert.equal(parseManifest({ ...good, entry: "en try.js" }), null);
		assert.equal(parseManifest({ ...good, entry: "" }), null);
	});
});

describe("assetUrl", () => {
	it("resolves a manifest name under the served dist directory", () => {
		assert.equal(ASSET_BASE, "/assets/carbon_theme/dist/ai_chat/");
		assert.equal(MANIFEST_URL, "/assets/carbon_theme/dist/ai_chat/manifest.json");
		assert.equal(assetUrl("entry.AB12CD34.js"), "/assets/carbon_theme/dist/ai_chat/entry.AB12CD34.js");
	});
});

describe("entrySpecifier", () => {
	it("is the plain asset URL until an import has failed", () => {
		assert.equal(entrySpecifier("entry.AB12CD34.js", 0), assetUrl("entry.AB12CD34.js"));
	});
	it("is a new module for every failed import, so the module map cannot replay the failure", () => {
		assert.equal(entrySpecifier("entry.AB12CD34.js", 1), `${assetUrl("entry.AB12CD34.js")}?retry=1`);
		assert.notEqual(entrySpecifier("entry.AB12CD34.js", 2), entrySpecifier("entry.AB12CD34.js", 1));
	});
});

describe("isChatModule", () => {
	const mod = { CHAT_CONTRACT: CHAT_CONTRACT_VERSION, mountChat() {} };
	it("accepts a module with mountChat and this contract version", () => {
		assert.equal(isChatModule(mod), true);
	});
	it("accepts a module namespace object", () => {
		const ns = Object.freeze(Object.assign(Object.create(null), mod));
		assert.equal(isChatModule(ns), true);
	});
	it("rejects a stale entry without CHAT_CONTRACT or with another version", () => {
		assert.equal(isChatModule({ mountChat() {} }), false);
		assert.equal(isChatModule({ CHAT_CONTRACT: 0, mountChat() {} }), false);
		assert.equal(isChatModule({ CHAT_CONTRACT: 2, mountChat() {} }), false);
		assert.equal(isChatModule({ CHAT_CONTRACT: "1", mountChat() {} }), false);
	});
	it("rejects a module without a callable mountChat", () => {
		assert.equal(isChatModule({ CHAT_CONTRACT: CHAT_CONTRACT_VERSION }), false);
		assert.equal(isChatModule({ CHAT_CONTRACT: CHAT_CONTRACT_VERSION, mountChat: "mountChat" }), false);
	});
	it("rejects non-objects", () => {
		assert.equal(isChatModule(null), false);
		assert.equal(isChatModule(undefined), false);
		assert.equal(isChatModule("module"), false);
		assert.equal(isChatModule(1), false);
	});
});
