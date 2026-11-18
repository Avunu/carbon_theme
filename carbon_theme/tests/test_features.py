# Copyright (c) 2026, Avunu LLC and contributors
# For license information, please see license.txt

"""Guards the opt-in features (features.py): off by default, read from Carbon
Settings, published to the desk through boot."""

import json
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from carbon_theme import features
from carbon_theme.features import BOOT_KEY, FEATURES, boot_session, get_features

ALL_OFF = {"column_resize": False, "auto_row_height": False}


class TestGetFeatures(UnitTestCase):
	def test_every_feature_is_off_when_nothing_is_set(self):
		self.assertEqual(get_features(frappe._dict()), ALL_OFF)

	def test_a_ticked_box_turns_its_feature_on(self):
		self.assertEqual(
			get_features(frappe._dict(table_column_resize=1)),
			{"column_resize": True, "auto_row_height": False},
		)
		self.assertEqual(
			get_features(frappe._dict(table_auto_row_height=1)),
			{"column_resize": False, "auto_row_height": True},
		)

	def test_the_two_features_are_independent(self):
		on = frappe._dict(table_column_resize=1, table_auto_row_height=1)
		self.assertEqual(get_features(on), {"column_resize": True, "auto_row_height": True})

	def test_a_check_stored_as_a_string_is_read_as_a_number(self):
		"""The database hands a Check back as 0/1, a form post as "0"/"1"."""
		self.assertFalse(get_features(frappe._dict(table_column_resize="0"))["column_resize"])
		self.assertTrue(get_features(frappe._dict(table_column_resize="1"))["column_resize"])

	def test_every_feature_names_a_real_field_that_defaults_to_off(self):
		"""A typo in FEATURES would read as "off" forever, so check each against the doctype."""
		path = frappe.get_app_path(
			"carbon_theme", "carbon_frappe", "doctype", "carbon_settings", "carbon_settings.json"
		)
		with open(path) as f:
			fields = {field["fieldname"]: field for field in json.load(f)["fields"]}

		for name, fieldname in FEATURES.items():
			self.assertIn(fieldname, fields, f"{name}: no field {fieldname}")
			self.assertEqual(fields[fieldname]["fieldtype"], "Check")
			self.assertEqual(fields[fieldname].get("default"), "0", f"{name} must default to off")

	def test_missing_settings_must_not_break_boot(self):
		"""Boot runs for every desk user, including on a site whose code is ahead of its migrate."""
		with patch.object(features.frappe, "get_cached_doc", side_effect=frappe.DoesNotExistError):
			self.assertEqual(get_features(), ALL_OFF)


class TestFeaturesInBoot(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		self.saved = {f: frappe.db.get_single_value("Carbon Settings", f) for f in FEATURES.values()}

	def tearDown(self):
		for field, value in self.saved.items():
			frappe.db.set_single_value("Carbon Settings", field, value)
		frappe.clear_document_cache("Carbon Settings", "Carbon Settings")
		super().tearDown()

	def _save(self, **values):
		settings = frappe.get_single("Carbon Settings")
		settings.update(values)
		settings.save()

	def test_off_until_a_system_manager_turns_them_on(self):
		self._save(table_column_resize=0, table_auto_row_height=0)
		self.assertEqual(get_features(), ALL_OFF)

	def test_saving_settings_reaches_the_flags(self):
		self._save(table_column_resize=1, table_auto_row_height=0)
		self.assertEqual(get_features(), {"column_resize": True, "auto_row_height": False})
		self._save(table_column_resize=0, table_auto_row_height=1)
		self.assertEqual(get_features(), {"column_resize": False, "auto_row_height": True})

	def test_boot_session_publishes_the_flags(self):
		self._save(table_column_resize=1, table_auto_row_height=1)
		bootinfo = frappe._dict()
		boot_session(bootinfo)
		self.assertEqual(bootinfo[BOOT_KEY], {"column_resize": True, "auto_row_height": True})

	def test_the_boot_hook_is_registered(self):
		self.assertIn("carbon_theme.features.boot_session", frappe.get_hooks("boot_session"))
