---
title: Limitations and troubleshooting
description: The known limits of Carbon Theme, what can silently undo it, and the messages it shows with their causes and fixes.
nav_title: Troubleshooting
order: 8
updated: 2026-10-26
---

## Limitations

- **The theme applies to the whole bench.** Frappe looks every stylesheet up in `sites/assets/assets.json`, which every site on a bench shares, so sites that do not have the app installed get the Carbon stylesheets too. They do not get the header, the table engine or the brand colours, which only load on sites that have the app. Run the theme on a bench of its own.
- **Partial builds and `bench watch` undo the theme.** `bench build --apps frappe` and `bench watch` point the stylesheets back at Frappe's until the next full `bench build` or `bench migrate`. Nothing errors; the desk looks like stock Frappe again. See [The desk looks like stock Frappe](#the-desk-looks-like-stock-frappe).
- **The theme depends on undocumented Frappe behaviour**: how Frappe names and merges `assets.json` entries. A change there in Frappe can stop the theme from loading.
- **Frappe 16.50 or later.** The stylesheets import files that older Frappe versions do not have, and do not compile against them.
- **No header or assistant on phones.** Below 768px Frappe's own navigation bar is kept. It is also kept on read-only sites, while impersonating a user and while an announcement widget shows.
- **Frozen columns do not stay in place in child tables.** A field marked to stick and the leading check box and expand columns scroll away when a child table scrolls sideways. The List and Report views are not affected.
- **Some tables are not replaced.** The Data Import preview and the System Console keep Frappe's own table, in Carbon colours, and Frappe's embedded lists keep their plain table.
- **frappe-ui apps on older versions are themed on a best-effort basis.** Apps on frappe-ui v0 (and flow's `beta.3`) use older token names, some of which cannot be mapped exactly. CRM's `1.0.0-beta.29` can show some coloured text one shade off.
- **E-mail gets Carbon's default colours**, not the brand colours, because e-mail styles are inlined without CSS variables. On website pages, Bootstrap utilities such as `.text-primary` keep the Website Theme's colour.
- **The AI assistant needs the flow app.** It does not tell the model which document is open, and files a user attaches stay on the site as private files until flow's 30-day clean-up.

## Troubleshooting

### The desk looks like stock Frappe

The theme's stylesheets are not being served. It shows no error: the desk has Frappe's own look.

- **After `bench watch` or a partial build.** Run a full `bench build`, or in `apps/carbon_theme` run the repair that the build runs:

  ```bash
  node scripts/patch-assets.ts
  ```

- **After a fresh install.** Run a full `bench build`. If it stopped on a missing import, run `bench setup requirements` and build again.
- **To check**, open `sites/assets/assets.json`: the `desk.bundle.css` entry must point under `/assets/carbon_theme/dist/css/`.

### The desk runs an older version of the theme after an upgrade

The theme's script bundles are written in TypeScript, and Frappe's build records them under a different name from the one the desk asks for, so the desk can keep loading an older build. `bench build`, `bench migrate` and installing an app all repair it. `bench watch` does not: after a watch session run `node scripts/patch-assets.ts` in `apps/carbon_theme`.

### "… must be a hex colour like #0f62fe"

Shown when you save **Carbon Settings** with a colour that is not a hex colour. Enter a value such as `#0f62fe` or `#06f`, or leave the field empty for Carbon's default.

### The brand colours do not show

- Reload the page: a saved change shows on the next page load.
- Open **View Stylesheet** on **Carbon Settings**. It should list your colours. If it reads "carbon_theme: brand stylesheet unavailable; see Error Log.", the site could not build it: look in **Error Log** for "carbon_theme: could not build the brand stylesheet".
- If `/carbon-brand.css` answers with a web page or a redirect instead of a stylesheet, a catch-all **Website Route Redirect** or a stale "page not found" cache entry is catching it. Saving **Carbon Settings** clears the cache; remove or narrow the redirect.
- E-mail and some website utility classes are never branded: see [What is not branded](configuration.md#what-is-not-branded).

### The header is yellow and striped

That is the development marker, shown on `localhost` and `*.localhost` sites. Turn it off with `bench --site <SITE_NAME> set-config carbon_dev_indicator 0`. See [The development marker](configuration.md#the-development-marker).

### A frappe-ui app is not themed

The theme adds its stylesheet to every page that loads a Vite module entry. If an app's page does not, add the `carbon_frappe_ui.bundle.css` stylesheet after the app's own CSS: see [frappe-ui apps](development/architecture.md#frappe-ui-apps). If the injection fails, the site's `carbon_theme` log has "SPA CSS injection failed".

### The AI assistant

| Message                                                                                                                                                             | Cause                                                                                                | Fix                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The AI assistant could not be loaded"                                                                                                                              | The panel's code could not be fetched: it was never built, the network failed, or the build changed. | Click **Retry**, then **Reload the page** if it is offered. If it persists, run `bench build` (which builds the assistant) and check the install as in [Check the install](install.md#check-the-install). **Open the Flow panel** opens flow's own panel meanwhile. |
| "The assistant has not been set up yet. Ask your administrator to enable it."                                                                                       | flow has no enabled Flow Agent.                                                                      | A System Manager creates and enables a Flow Model; flow then creates an agent.                                                                                                                                                                                      |
| "This conversation is replying in another tab. Try again when it has finished."                                                                                     | The same conversation is streaming a reply in another tab.                                           | Wait for that reply to finish.                                                                                                                                                                                                                                      |
| "Your session may have expired. Reload the page and try again."                                                                                                     | An upload was refused because you are no longer logged in.                                           | Reload the page and log in.                                                                                                                                                                                                                                         |
| "Not a supported file type: …", "Too large (over …): …", "Empty: …", "Already attached: …", "Name longer than 140 characters: …", "You can attach at most 5 files." | The file breaks one of the attachment rules.                                                         | See [Attach files](ai-assistant.md#attach-files).                                                                                                                                                                                                                   |
| "Answer the assistant's question before attaching files."                                                                                                           | The assistant is waiting for an approval.                                                            | Approve, deny or answer it, then attach the files.                                                                                                                                                                                                                  |
| "A title is required.", "Title cannot exceed 200 characters."                                                                                                       | A conversation was renamed to an empty or too long title.                                            | Enter a title of 1 to 200 characters.                                                                                                                                                                                                                               |
| No **AI assistant** button                                                                                                                                          | flow is not installed on the site, the site is read-only, or the window is narrower than 768px.      | Install flow, or widen the window.                                                                                                                                                                                                                                  |

## Get help

Report a problem or ask a question in the [GitHub issues](https://github.com/Avunu/carbon_theme/issues).
