// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// The header's AI action: a button that opens Frappe's built-in Flow panel.
//
// Frappe owns the panel, the chat and Ctrl/Cmd+I (frappe/public/js/flow_launcher.bundle.js).
// The launcher toggles on a click on any [data-flow-toggle] element, so the button carries
// that attribute and has no click handler of its own: a second one would toggle twice.
//
// The launcher announces nothing when it opens or closes. Its panel sits in an open shadow
// root (<flow-launcher>, a child of <body>) and is `inert` while closed, so the button's
// aria-expanded follows that attribute. If the launcher's markup changes, the button still
// opens Flow; only its pressed state and the yielding to other header panels stop working.
//
// Markup, as shell/switcher.ts does for its action:
//
//   button#cf-ai-trigger.cds--header__action.cf-ai-trigger[data-flow-toggle][aria-expanded]
//     in .cds--header__global, directly before the switcher's button (ui_shell.ts)
//
// Parsed by frappe's esbuild 0.14: no `satisfies`, `accessor` or `using` (see assistant_gate.ts).
import { aiLaunch20 } from "../../generated/shell-icons.ts";
import type { FlowLauncherApi } from "./assistant_gate.ts";

export interface ShellAssistant {
	/** `button.cds--header__action.cf-ai-trigger#cf-ai-trigger`. ui_shell.ts places it directly before the switcher's button. */
	readonly button: HTMLButtonElement;
	/** Close Flow's panel if it is open. */
	close(): void;
	/** Called each time Flow's panel opens, so the switcher, bell and nav menus can yield. */
	onOpen(fn: () => void): void;
}

const BUTTON_ID = "cf-ai-trigger";

function flowPanel(): HTMLElement | null {
	const host = document.querySelector("flow-launcher");
	const panel = host && host.shadowRoot ? host.shadowRoot.querySelector(".panel") : null;
	return panel instanceof HTMLElement ? panel : null;
}

export function mountAssistant(global: HTMLElement, flow: FlowLauncherApi): ShellAssistant {
	const label = __("AI assistant");
	const button = document.createElement("button");
	button.type = "button";
	button.id = BUTTON_ID;
	button.className = "cds--header__action cf-ai-trigger";
	button.setAttribute("data-flow-toggle", "");
	button.setAttribute("aria-label", label);
	button.setAttribute("title", `${label} (Ctrl+I)`);
	button.setAttribute("aria-expanded", "false");
	button.innerHTML = aiLaunch20;
	global.appendChild(button);

	const listeners: Array<() => void> = [];
	const panel = flowPanel();
	let opened = false;

	function sync(): void {
		const now = panel !== null && !panel.inert;
		button.setAttribute("aria-expanded", now ? "true" : "false");
		button.classList.toggle("cds--header__action--active", now);
		if (now && !opened) for (const fn of listeners) fn();
		opened = now;
	}

	if (panel) {
		new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ["inert"] });
		sync();
	}

	return {
		button,
		close: () => {
			if (opened) flow.toggle();
		},
		onOpen: (fn) => {
			listeners.push(fn);
		},
	};
}
