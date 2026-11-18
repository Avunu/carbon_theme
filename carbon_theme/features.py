# Copyright (c) 2026, Avunu LLC and contributors
# For license information, please see license.txt

"""Opt-in behaviours, switched on per site in Carbon Settings.

A feature is something the theme can do that Carbon's own design does not ask
for, so it stays off until a System Manager ticks its box: an untouched site
is stock Carbon. Each is a Check field on Carbon Settings, named in FEATURES.

The desk reads them from `frappe.boot.carbon_features` (boot_session, below)
rather than asking the server per feature. The table engine builds its
tables synchronously, long before an RPC could answer, and boot is already
cached per user. Saving Carbon Settings clears that cache (see its on_update),
so a change shows on the next page load.
"""

import frappe
from frappe.utils import cint

SETTINGS = "Carbon Settings"
BOOT_KEY = "carbon_features"

# Feature name (the key the desk reads) -> Carbon Settings field.
FEATURES = {
	"column_resize": "table_column_resize",
	"auto_row_height": "table_auto_row_height",
}


def get_features(doc=None) -> dict[str, bool]:
	"""Each feature as an on/off flag. All off when the settings do not exist yet.

	Boot runs for every desk user on every site that has the app, including a
	site whose code is ahead of its last migrate, so this must not raise.
	"""
	if doc is None:
		try:
			doc = frappe.get_cached_doc(SETTINGS)
		except frappe.DoesNotExistError:
			return dict.fromkeys(FEATURES, False)
	return {name: bool(cint(doc.get(field))) for name, field in FEATURES.items()}


def boot_session(bootinfo) -> None:
	"""`boot_session` hook: publish the flags as `frappe.boot.carbon_features`."""
	bootinfo[BOOT_KEY] = get_features()
