<!-- Copyright (c) 2026, Avunu LLC and contributors
For license information, please see license.txt-->

<!-- frappe-nix:begin header -->

<div align="center">

<img src="carbon_theme/public/images/carbon_theme-logo.svg" width="80" alt="">

# Carbon Theme for Frappe

IBM Carbon Design System theme for the Frappe desk, website, login and email

[![CI](https://github.com/Avunu/carbon_theme/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Avunu/carbon_theme/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/Avunu/carbon_theme)](https://github.com/Avunu/carbon_theme/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](license.txt)
[![Frappe v16](https://img.shields.io/badge/Frappe-v16-blue)](https://github.com/frappe/frappe/tree/version-16)
[![Documentation](https://img.shields.io/badge/docs-docs.avunu.net-blue)](https://docs.avunu.net/carbon-theme/)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/list-view-dark.webp">
  <img src="docs/screenshots/list-view-light.webp" alt="The Sales Invoice list in Carbon: the g100 UI Shell header with the module's links, the side nav, filter fields and a Carbon data table with status tags">
</picture>

</div>

<!-- frappe-nix:end header -->

## Overview

Carbon Theme restyles Frappe and ERPNext as if they had been designed with IBM's [Carbon Design System](https://carbondesignsystem.com) (v11): IBM Plex type, square corners, Carbon's colour tokens and 2px focus rings, the Carbon UI Shell header and Carbon's chart palettes. The values come from the official `@carbon/*` npm packages.

It replaces Frappe's own stylesheets rather than adding a layer on top of them, so each surface loads one stylesheet. It is for teams that work in the Frappe desk all day and want a denser, more consistent interface, and for organisations that already use Carbon. It targets Frappe v16 (16.50 or later).

Full documentation: [docs.avunu.net/carbon-theme/docs/](https://docs.avunu.net/carbon-theme/docs/).

## Features

- **Every surface themed:** the desk, the website and portal, the login page, e-mail, charts, and the frappe-ui apps (CRM, Helpdesk, Builder, Wiki and others). Light mode uses Carbon's g10 theme and dark mode its g100 theme, following the desk's theme setting.
- **Carbon UI Shell header** built from Frappe's module sidebar: the module's links and sub-menus, with an overflow menu, search, notifications, the account menu and an app switcher.
- **One table engine** (TanStack Table, drawn as Carbon's data table) behind child tables, the List view and the Report and Query views. It adds column resizing and sorting, virtualised report rows, spreadsheet-style selection, copy and paste in the Report view, a Carbon toolbar and pagination on child tables, and child-table rows that expand into their form in place. Frappe's public JavaScript APIs and the old CSS classes keep working.
- **Brand colours** in **Carbon Settings**: separate light and dark brand colours, plus the header's background and text. Hover, active and text-on-brand tones are derived.
- **Dev indicator:** on `localhost` and `*.localhost` sites the header is yellow with hazard stripes, so a development tab is not mistaken for production.
- **Carbon charts:** `frappe.Chart` gets Carbon's 14-colour categorical palettes when the caller passes no colours, and charts re-theme when the desk theme changes.
- **IBM Plex** fonts, self-hosted, with IBM Plex Mono for numbers and dates in tables.
- **AI assistant panel:** when the [flow](https://github.com/frappe/flow_client) app is installed, the header gets a Carbon AI Chat panel that replaces flow's own, with conversation history, feedback and file attachments.
- **Drift audits** (`yarn audit:drift`) that fail when a Carbon token, a Frappe selector or the asset shadow the theme depends on has changed, because those breakages are otherwise silent.

<!-- frappe-nix:begin compatibility -->

## Compatibility

| Frappe | Branch       |
| ------ | ------------ |
| v16    | `version-16` |

<!-- frappe-nix:end compatibility -->

<!-- frappe-nix:begin installation -->

## Installation

```bash
bench get-app https://github.com/Avunu/carbon_theme --branch version-16
bench --site <site> install-app carbon_theme
```

<!-- frappe-nix:end installation -->

Then run a full `bench build`. `bench get-app` installs the npm dependencies the stylesheets are compiled from; if the first build stops on a missing import, run `bench setup requirements` and build again. [Install and upgrade](docs/install.md) explains how to check that the theme is being served, how to upgrade and what uninstalling leaves behind.

## Configuration

The theme works without configuration. Two things can be set:

- **Carbon Settings** (System Manager, in the Carbon Frappe module): **Brand Colour (Light)**, **Brand Colour (Dark)**, **Header Background** and **Header Text**. All are optional, and an empty field keeps Carbon's own value. The brand colour sets Carbon's interactive colour: primary buttons, links, focus rings, selected rows, the sidebar selection bar and the active tab. If only the light colour is set, the dark one is derived from it. A saved change shows on the next page load.
- **The dev indicator** is decided from the request's host name. Turn it off or on for a site with `bench --site <SITE_NAME> set-config carbon_dev_indicator 0` (or `1`). Where the site config does not set it, a `carbon_dev_indicator` cookie does the same for one browser.

[docs/configuration.md](docs/configuration.md) describes how the colours are derived, what is deliberately not branded and everything the app adds to a site.

## How It Works

- **Stylesheet shadowing.** The app ships stylesheets with the same bundle names as Frappe's (`desk`, `website`, `login`, `email`) that recompile Frappe's SCSS with Carbon's values. Because the app builds after Frappe, its entries replace Frappe's in `sites/assets/assets.json`; `scripts/patch-assets.ts` (run by `bench build`) and the `after_migrate` and `after_app_install` hooks repair the entries if a partial build has reset them.
- **Token mapping.** Carbon's tokens are emitted as `--cds-*` custom properties, and Frappe's colour ramps, roles, radii, focus, shadows and type scale are mapped onto them.
- **Brand stylesheet.** Carbon Settings' colours are served per site at `/carbon-brand.css` by a `page_renderer` and linked after the bundles.
- **frappe-ui apps.** An `after_request` hook adds `carbon_frappe_ui.bundle.css` and the brand stylesheet to any HTML page that loads a Vite module entry.
- **JavaScript bundles** add the chart palettes, the UI Shell header and the table engine. Each patch calls the original and falls back to Frappe's own behaviour if what it patches is missing.

[docs/development/architecture.md](docs/development/architecture.md) covers each part in detail; the user guides are [the header](docs/ui-shell.md), [tables](docs/tables.md) and [the AI assistant](docs/ai-assistant.md).

## Limitations

- **The theme applies to the whole bench.** `assets.json` is shared by every site on a bench, so sites that do not have the app installed get its stylesheets too. Run it on a bench of its own.
- **Partial builds and `bench watch` undo the theme.** `bench build --apps frappe` and `bench watch` point the shadowed bundles back at Frappe's until the next full `bench build` or `bench migrate`. Nothing errors; the desk looks like stock Frappe again. After a watch session, run `node scripts/patch-assets.ts` in the app's directory.
- **Shadowing depends on undocumented behaviour** of how Frappe names and merges `assets.json` entries. A Frappe change there can stop the theme from loading.
- **No UI Shell header or assistant on phones.** Below 768px wide Frappe's own navbar is kept. It is also kept wherever Frappe fills the header itself: on read-only sites, while impersonating a user and while an announcement widget shows.
- **Child-table columns are sized by the Columns property, not by a docfield Width.** A field's `columns` (1-12) sets its share of the table's width; a docfield `width` only sets that share when there is no `columns`, where Frappe would use it as a fixed pixel width. A width a user drags or types in Configure Columns is kept exactly.
- **Column pinning does not work on child tables.** `df.sticky` and the leading gutters do not stay fixed when a child table scrolls sideways; the List and Report views are not affected.
- **Some tables are not replaced:** the Data Import preview and the System Console keep the stock frappe-datatable (still themed), and `frappe.ui.EmbeddedList` keeps its plain table.
- **Older frappe-ui apps are themed on a best-effort basis.** Apps on frappe-ui v0 (and flow's `beta.3`) use older token names, some of which cannot be mapped exactly; CRM's `1.0.0-beta.29` can show some coloured text one shade off.
- **E-mail** is inlined by Premailer, which supports no CSS variables, so e-mail gets Carbon's default colours, not the brand colours. On website pages, Bootstrap utilities such as `.text-primary` also keep the Website Theme's colour.
- **The AI assistant** needs the flow app. It does not tell the model which document is open, and files a user attaches stay on the site as private files until flow's 30-day purge.

[docs/troubleshooting.md](docs/troubleshooting.md) lists the messages the theme shows and how to fix what undoes it.

<!-- frappe-nix:begin support -->

## Support

- Documentation: [docs.avunu.net/carbon-theme/](https://docs.avunu.net/carbon-theme/)
- Bug reports and questions: [GitHub issues](https://github.com/Avunu/carbon_theme/issues)
- E-mail: <mail@avu.nu>

<!-- frappe-nix:end support -->

<!-- frappe-nix:begin development -->

## Development

```bash
nix develop        # or: direnv allow
prek install       # the git hooks CI runs
frappe-test        # the tests, the way CI runs them
```

The managed files, checks and release flow are described in the [app standards documentation](https://docs.avunu.net/frappe-nix/docs/app-standards/).

<!-- frappe-nix:end development -->

The build, the checks and the browser test suites, the drift audits, CI and the release process are described in [docs/development/README.md](docs/development/README.md).

<!-- frappe-nix:begin license -->

## License

MIT, Copyright (c) 2026–present Avunu LLC → [license.txt](license.txt)

<!-- frappe-nix:end license -->

IBM Plex is included under the SIL Open Font License (see `carbon_theme/public/fonts/LICENSE-*.txt`).
