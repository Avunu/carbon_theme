// Copyright (c) 2026, Avunu LLC and contributors
// For license information, please see license.txt

// The prompt line's model picker: a ghost menu button in the `message-actions` slot, beside the
// attach button. "Default" (the agent's own model) plus every enabled Flow Model.
//
//   div.cf-ai-model[slot=message-actions][hidden?]      hidden while fewer than two models are enabled
//     cds-menu-button[kind=ghost][size=sm]              label: the current model's title
//       cds-menu
//         cds-menu-item-radio-group[label=Model]
//           cds-menu-item[data-model=""]                "Default"; disabled on a session with an override
//           cds-menu-item[data-model=<name>] …
//
// The menu elements are imported on demand, the first time two models are enabled, not in register.ts:
// a site with one model never loads them, and the first open stays inside its gzip budget. Until they are
// defined the wrapper is empty and hidden.
//
// flow ignores an empty model on an existing session, so "Default" cannot undo an override there; it is
// disabled rather than offered as a choice that silently does nothing.
import type { Announcer } from "../announce.ts";
import type { Controller, FlowModelOption } from "../controller.ts";
import { el } from "../dom.ts";
import {
	EVENTS,
	createMenu,
	createMenuButton,
	createMenuItem,
	createMenuItemRadioGroup,
	isMenuItemChangedDetail,
	listenDetail,
} from "../elements.ts";
import type { MenuButtonElement, MenuItemElement, MenuItemRadioGroupElement } from "../elements.ts";
import type { Translate } from "../i18n.ts";
import type { ChatStore } from "../store.ts";

export interface ModelPickerDeps {
	translate: Translate;
	store: ChatStore;
	controller: Controller;
	announcer: Announcer;
	/** Defines cds-menu-button and the cds-menu family. Tests pass their own. */
	loadElements?: () => Promise<unknown>;
}

export interface ModelPicker {
	/** `div.cf-ai-model[slot=message-actions]`. The caller appends it to the prompt line shell. */
	readonly element: HTMLElement;
	dispose(): void;
}

/** `data-model` of the "Default" item. */
const DEFAULT_VALUE = "";

const importMenuElements = (): Promise<unknown> =>
	import("@carbon/web-components/es/components/menu-button/index.js");

interface Parts {
	button: MenuButtonElement;
	group: MenuItemRadioGroupElement;
}

export function createModelPicker(deps: ModelPickerDeps): ModelPicker {
	const __ = deps.translate;
	const { store, controller, announcer } = deps;
	const loadElements = deps.loadElements ?? importMenuElements;
	const cleanups: (() => void)[] = [];
	let disposed = false;

	const element = el("div", "cf-ai-model");
	element.slot = "message-actions";
	element.hidden = true;

	let parts: Parts | null = null;
	let loading = false;
	let items = new Map<string, MenuItemElement>();
	let rendered: readonly FlowModelOption[] | null = null;

	function titleOf(name: string | null): string {
		if (name === null) return __("Default");
		return controller.models.get().find((model) => model.name === name)?.title ?? name;
	}

	function build(): Parts {
		const button = createMenuButton();
		button.className = "cf-ai-model__button";
		button.kind = "ghost";
		button.size = "sm";
		button.menuAlignment = "top-start";
		const menu = createMenu();
		const group = createMenuItemRadioGroup();
		group.label = __("Model");
		menu.append(group);
		button.append(menu);
		element.append(button);
		cleanups.push(listenDetail(group, EVENTS.menuItemChanged, isMenuItemChangedDetail, onChange));
		return { button, group };
	}

	/** Defines the elements once; a failed import is retried on the next model list. */
	function ensureParts(): void {
		if (parts !== null || loading) return;
		loading = true;
		loadElements().then(
			() => {
				loading = false;
				if (disposed) return;
				parts = build();
				apply();
			},
			(error: unknown) => {
				loading = false;
				console.error(error);
			},
		);
	}

	/** Rebuilds the items only when the list itself changed; selection is a property update. */
	function renderItems(group: MenuItemRadioGroupElement): void {
		const models = controller.models.get();
		if (models === rendered) return;
		rendered = models;
		items = new Map();
		const add = (value: string, label: string): void => {
			const item = createMenuItem();
			item.label = label;
			item.dataset["model"] = value;
			items.set(value, item);
		};
		add(DEFAULT_VALUE, __("Default"));
		for (const model of models) add(model.name, model.title);
		group.replaceChildren(...items.values());
	}

	function apply(): void {
		if (disposed) return;
		if (controller.models.get().length < 2) {
			element.hidden = true;
			return;
		}
		if (parts === null) {
			element.hidden = true;
			ensureParts();
			return;
		}
		const { button, group } = parts;
		renderItems(group);
		const state = store.get();
		element.hidden = false;
		button.disabled =
			state.status === "loading" || state.status === "submitted" || state.status === "streaming";
		button.label = titleOf(state.model);
		group.selectedItem = items.get(state.model ?? DEFAULT_VALUE) ?? null;
		const fallback = items.get(DEFAULT_VALUE);
		if (fallback !== undefined) {
			const locked = state.session !== null && state.model !== null;
			fallback.disabled = locked;
			fallback.title = locked ? __("Start a new chat to use the agent's default model.") : "";
		}
	}

	function onChange(detail: { triggeredBy: EventTarget }): void {
		const item = detail.triggeredBy;
		if (!(item instanceof HTMLElement)) return;
		const raw = item.dataset["model"];
		if (raw === undefined) return;
		const value = raw === DEFAULT_VALUE ? null : raw;
		// The group selected the clicked item itself; a disabled or refused pick must be put back.
		// Carbon dispatches the change twice, so a pick that is already the model does nothing.
		const disabled = "disabled" in item && item.disabled === true;
		if (!disabled && value !== store.get().model) {
			controller.setModel(value);
			if (store.get().model === value) {
				announcer.announce(__("Model set to {0}", [titleOf(value)]));
			}
		}
		apply();
	}

	cleanups.push(
		controller.models.subscribe(apply),
		store.select((state) => state.model, apply),
		store.select((state) => state.status, apply),
		store.select((state) => state.session, apply),
	);
	apply();

	return {
		element,
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const cleanup of cleanups) cleanup();
		},
	};
}
