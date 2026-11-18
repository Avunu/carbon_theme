---
title: Configuration
description: The Carbon Settings colours and table options, the development marker and its overrides, and a reference of everything the theme adds to a site.
nav_title: Configuration
order: 2
updated: 2026-11-17
---

The theme works without configuration. A System Manager can set brand and header colours in **Carbon Settings**, switch on two table behaviours that are not part of Carbon's own design, and switch the development marker on or off per site. This page describes each, then lists everything the app adds to your site.

## Carbon Settings

Open **Carbon Settings** from the awesome bar (search for "Carbon Settings"). Only System Manager can read or change it. Every field is optional: an empty colour keeps Carbon's own value, so a site that sets one colour still gets a coherent palette, and an unticked box keeps Carbon's own behaviour.

| Field                     | Section      | What it does                                                                                                                                                                           | Empty means                                                                        |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Brand Colour (Light)**  | Brand Colour | Carbon's interactive colour in light mode: primary buttons, links, focus rings, selected rows, the sidebar selection bar and the active tab.                                           | Carbon Blue 60, `#0f62fe`                                                          |
| **Brand Colour (Dark)**   | Brand Colour | The same in dark mode. Carbon uses a lighter tone in dark mode, because a mid-dark colour does not carry against a near-black background.                                              | The light brand colour, lightened. If that is empty too, Carbon Blue 50, `#4589ff` |
| **Header Background**     | Header       | The background of the header bar, in both modes. Hover, active, border and menu tones are derived from it, and its sub-menus and panels follow it, so a light header gets light menus. | `#161616`, Carbon's own header                                                     |
| **Header Text**           | Header       | The colour of the header's text and icons.                                                                                                                                             | Near-black or near-white, whichever reads better on the header background          |
| **Allow Column Resizing** | Tables       | A drag handle on the trailing edge of each table header. See [Table options](#table-options).                                                                                          | Off: no handle                                                                     |
| **Grow Rows to Fit Text** | Tables       | A cell's text wraps and its row grows to show it. See [Table options](#table-options).                                                                                                 | Off: one line, ending in an ellipsis                                               |

Each colour must be a hex colour such as `#0f62fe` (three or six digits). Saving another value fails with "… must be a hex colour like #0f62fe".

**View Stylesheet** on the form opens `/carbon-brand.css`, the stylesheet the settings produce. Saving clears the site's cache, and a change shows on the next page load, so reload the page after you save.

### Table options

Carbon's data table has neither of these, so both are off until a System Manager ticks them. They reach every table the theme draws: child tables, the List view and the Report and Query views.

- **Allow Column Resizing** draws a drag handle on the trailing edge of each column header. Drag it to widen or narrow the column, or double-click it to put the column back. A width a user has already saved stays in force when the box is unticked; only the handle goes. See [Work with tables](tables.md#columns) for what is saved.
- **Grow Rows to Fit Text** lets the text in a cell wrap, and the row grow to hold it. A row whose text fits on one line stays at Carbon's row height. Header labels, status badges and numbers keep to one line: a number that does not fit ends in an ellipsis rather than splitting after its currency symbol. A Report view with hundreds of rows still draws only the rows on screen, and measures each one as it appears, so its scrollbar settles as you scroll rather than being exact from the start.

The two boxes are independent. Each is read when the page loads, so reload after you save.

### How the colours are derived

The brand colour is not a header tint. It sets Carbon's interactive role, so one value reaches every control that uses it. The header is a separate setting, because colouring the bar and rebranding the controls are different decisions.

From each brand colour the theme computes the hover and active shades (darker in light mode, brighter in dark mode), the link hover colour, the pale or deep highlight behind selected text and marked rows, and the label colour on primary buttons, which turns near-black on a light brand such as yellow or lime. When a colour is Carbon's own, Carbon's hand-tuned shades are used unchanged.

A configured header colour also reaches the website's navbar and footer and the preview strip in the desk's theme switcher.

### What is not branded

Some colours keep Carbon's value whatever you set:

- Status colours. Draft and Submitted pills and information callouts stay blue, because Carbon keeps blue as the informational colour.
- Danger buttons. They stay red with white text whatever the brand colour.
- In dark mode, the focus ring, interactive icons and the tertiary button stay white, as Carbon's g100 theme draws them.
- E-mail. Outgoing e-mail is inlined without CSS variables, so it gets Carbon's default colours.
- On website pages, utility classes compiled by Bootstrap, such as `.text-primary`. They keep the **Website Theme**'s colour, so set the primary colour there as well if those matter.

## The development marker

On a site opened as `localhost`, `127.0.0.1`, `::1` or any `*.localhost` name, the header is Carbon yellow (`#f1c21b`) with near-black text and diagonal hazard stripes, so a development tab cannot be mistaken for production. The brand colours still apply. A configured header colour is replaced on the header bar but kept on the website footer. The decision is made on the server for each request, so the page never flashes the other colour first.

The first of these that is set decides:

| Override                        | Where                         | Effect                                                                                                  |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `carbon_dev_indicator`          | The site's `site_config.json` | `1` turns the marker on for every request to the site, `0` turns it off. Set it with the command below. |
| A `carbon_dev_indicator` cookie | One browser                   | `1` or `0`, for that browser only. The browser test suites use it to turn the marker off.               |
| The host name of the request    | Each request                  | On for the local names above, off for everything else.                                                  |

```bash
bench --site <SITE_NAME> set-config carbon_dev_indicator 0
```

## Roles and permissions

The theme checks one role, **System Manager**:

- Only a System Manager can open and change **Carbon Settings**.
- In the AI assistant, a System Manager also sees the set-up steps when flow is not configured yet: see [Use the AI assistant](ai-assistant.md#before-the-assistant-is-set-up).

Everything else follows Frappe's own permissions. The header shows what the sidebar shows you, the tables show what the list and report show you, and the assistant can do only what flow allows you.

## What the app adds to your site

This is the complete list.

### Doctypes and data

| Doctype         | Kind   | Module        | Notes                                                              |
| --------------- | ------ | ------------- | ------------------------------------------------------------------ |
| Carbon Settings | Single | Carbon Frappe | The four colours and two table options above. System Manager only. |

The app adds no custom fields or property setters, overrides no doctype class, registers no `doc_events`, `doctype_js`, scheduled jobs or whitelisted methods, and creates no records.

### Stylesheets

| What                                                                            | How                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desk.bundle.css`, `website.bundle.css`, `login.bundle.css`, `email.bundle.css` | The theme's own builds of these four stylesheets replace Frappe's in `sites/assets/assets.json`, for the whole bench. See [How it works](development/architecture.md).                                                      |
| `/carbon-brand.css`                                                             | A per-site stylesheet with the Carbon Settings colours and the development marker, served by a `page_renderer` and linked on desk, website and login pages. Holds only a comment until a colour is set or the marker is on. |
| `carbon_frappe_ui.bundle.css`                                                   | The Carbon tokens for frappe-ui apps, added with `/carbon-brand.css` to every page that loads a Vite module entry, by an `after_request` hook.                                                                              |

### Scripts on every desk page

| Bundle                  | What it does                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `carbon_charts.bundle`  | Gives `frappe.Chart` Carbon's categorical palettes when the caller passes no colours, and re-themes charts when the desk theme changes. |
| `carbon_desk.bundle`    | Marks formatted numbers and dates so tables show them in IBM Plex Mono.                                                                 |
| `carbon_anatomy.bundle` | The UI Shell header, the page header and the AI assistant's button. See [Use the header](ui-shell.md).                                  |
| `carbon_tables.bundle`  | The table engine behind child tables, the List view and the Report and Query views. See [Work with tables](tables.md).                  |

The AI assistant's own code is not in these bundles. It is loaded from `/assets/carbon_theme/dist/ai_chat/` the first time someone opens the assistant.

### Hooks

| Hook                                 | Runs                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `after_migrate`, `after_app_install` | `carbon_theme.build.patch_assets`, which points the stylesheet entries in `assets.json` back at the theme's files. |
| `after_request`                      | `carbon_theme.injector.inject_carbon_ui_css`, for frappe-ui apps.                                                  |
| `page_renderer`                      | `carbon_theme.brand.BrandStylesheet`, for `/carbon-brand.css`.                                                     |
| `boot_session`                       | `carbon_theme.features.boot_session`, which puts the table options on `frappe.boot.carbon_features` for the desk.  |

## Related

- [Install and upgrade](install.md)
- [How it works](development/architecture.md) for the code behind each row above
