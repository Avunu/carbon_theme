---
title: Install and upgrade
description: Install Carbon Theme on a Frappe v16 bench, build its assets, check that the theme is served, upgrade it and remove it again.
nav_title: Install
order: 1
updated: 2026-10-26
---

Carbon Theme installs like any Frappe app. Two things are specific to it: the theme works by replacing Frappe's own stylesheets for the whole bench, and it only takes effect after a full `bench build`.

## Before you start

- A bench with Frappe v16, 16.50 or later, that serves no site you want to keep in Frappe's own look. The theme applies to every site on the bench, whether or not the app is installed on it: see [Limitations](troubleshooting.md#limitations).
- Node and yarn on the bench machine. The stylesheets are compiled from the app's npm dependencies, such as `@carbon/styles`.
- A System Manager login on the site, to open **Carbon Settings** afterwards.

## Install

Run these from the bench directory. `<SITE_NAME>` is your site, for example `site1.example.com`.

```bash
bench get-app https://github.com/Avunu/carbon_theme --branch version-16
bench --site <SITE_NAME> install-app carbon_theme
bench build
```

`version-16` is the release branch: it always holds the latest release. To follow unreleased changes, use `--branch develop` instead.

Run a full `bench build`, not `bench build --app carbon_theme` or `bench build --apps frappe`. The theme's stylesheets carry the same names as Frappe's, and the build that runs last decides which ones the site serves. After compiling, the build runs the app's own `yarn build`, which points the names back at the theme's files (`scripts/patch-assets.ts`), checks the theme against the installed Frappe and builds the AI assistant's bundle.

`bench get-app` installs the npm dependencies. If the first build stops on a missing import, run `bench setup requirements` and build again.

## What installing sets up

Installing the app adds one thing to the site's database:

- **Carbon Settings**, a single doctype in the **Carbon Frappe** module, readable and writable by System Manager. Every field starts empty, which keeps Carbon's own colours. See [Configuration](configuration.md).

It adds no custom fields, property setters, roles, fixtures or patches. Everything else the app does is code that runs while pages are served, listed in [What the app adds to your site](configuration.md#what-the-app-adds-to-your-site).

The install also runs `carbon_theme.build.patch_assets` (an `after_app_install` hook), which points the stylesheet entries in `sites/assets/assets.json` at the theme's files if they have been built. The same hook runs again after any other app is installed on the site.

## Check the install

1. Reload the desk. The header across the top is Carbon's: dark grey, with the module's links. On a site served from `localhost` or a `*.localhost` name it is yellow with diagonal stripes instead: see [The development marker](configuration.md#the-development-marker).
2. In `sites/assets/assets.json`, the `desk.bundle.css` entry points at a file under `/assets/carbon_theme/dist/css/`. If it points under `/assets/frappe/`, run `bench build` again.
3. In the browser's developer tools, the fonts are IBM Plex, loaded from `/assets/carbon_theme/fonts/`, and the `<html>` element carries `--cds-background` and the other `--cds-*` custom properties.
4. With flow installed, `/assets/carbon_theme/dist/ai_chat/manifest.json` answers and names an `entry.<hash>.js` and a `chat.<hash>.css` that exist beside it. The desk requests it only when someone first opens the assistant.

## Upgrade

Update the app the way you update any Frappe app: `bench update`, or pull the new code in `apps/carbon_theme` and then run these from the bench directory.

```bash
bench --site <SITE_NAME> migrate
bench build
```

`bench migrate` syncs **Carbon Settings** and runs `carbon_theme.build.patch_assets` again (an `after_migrate` hook), which repairs `assets.json` if a partial build has pointed it back at Frappe's stylesheets. The app ships no data patches, so an upgrade never changes your settings.

After upgrading Frappe itself, run a full `bench build` as well, because a build of Frappe alone puts Frappe's stylesheets back.

## Uninstall

```bash
bench --site <SITE_NAME> uninstall-app carbon_theme
```

Frappe removes the **Carbon Frappe** module from the site, with the **Carbon Settings** doctype and its saved colours. The site stops loading the theme's scripts and the brand stylesheet, so the UI Shell header, the table engine and the brand colours go away on that site.

What stays behind:

- The Carbon stylesheets. They are served to every site on the bench while the app is in `apps/` and built. To return the bench to Frappe's own look, uninstall the app from every site, run `bench remove-app carbon_theme` (it refuses while any site still has the app) and then `bench build`.
- A `carbon_dev_indicator` key in `site_config.json`, if you set one. Remove it with `bench --site <SITE_NAME> set-config carbon_dev_indicator None`: Frappe deletes a key whose value is `None`.
- Files that people attached to AI assistant conversations. They belong to the flow app and stay until flow removes them.

## Next

- [Configuration](configuration.md) explains the brand colours, the development marker and everything the app adds.
- [Limitations and troubleshooting](troubleshooting.md) lists what can undo the theme and how to put it back.
