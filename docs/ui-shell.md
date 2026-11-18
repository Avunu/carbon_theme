---
title: Use the header
description: Find your way with the Carbon UI Shell header, its module links, search, notifications, account menu and app switcher.
nav_title: Header
order: 3
updated: 2026-10-26
---

The header across the top of the desk is Carbon's UI Shell. It shows where you are and what you can open next, and it gathers search, notifications and your account in one place. It always runs Carbon's dark g100 theme, in light and dark mode, unless an administrator has set a header colour in [Carbon Settings](configuration.md#carbon-settings).

Everything it shows comes from Frappe's module sidebar, so it changes as you move between modules and shows only what the sidebar shows you.

## What the header shows

From left to right:

| Part                | What it is                                                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menu button         | Opens and closes the sidebar, as the sidebar's own toggle does.                                                                                                                                                                                                                          |
| Name                | The app and the module you are in, for example "ERPNext Projects". On the desktop launcher at `/desk` it reads "Desktop". Click it to go to the module's landing page.                                                                                                                   |
| Links and sub-menus | The sidebar's top-level rows. A link opens its page; a section with rows under it opens as a sub-menu. The page you are on is marked. When the links do not fit, the last ones move into a **More** sub-menu.                                                                            |
| Search              | Opens Frappe's search bar.                                                                                                                                                                                                                                                               |
| Notifications       | Opens Frappe's notifications panel on the right. A badge shows the unread count.                                                                                                                                                                                                         |
| Account             | Your account menu, the same one the sidebar's user chip opens.                                                                                                                                                                                                                           |
| AI assistant        | Only when the flow app is installed. See [Use the AI assistant](ai-assistant.md).                                                                                                                                                                                                        |
| Switcher            | The far-right button. It opens a panel listing the apps on the `/desk` desktop, with the app you are in selected, and a link to the Desktop below them. On a site still set to Frappe's older **Desktop Icons** page, it lists those icons instead, with folders as rows you can expand. |

The dock of module icons and the sidebar stay where Frappe puts them, under the header. Use the dock to switch modules within an app and the switcher to switch apps.

## Narrow windows and phones

- Below 66rem (about 1056px) the header hides its links. The sidebar still has every link: open it with the menu button.
- Below 768px Frappe's own navigation bar is kept instead of the header, and the AI assistant is not available.

## When the header does not appear

Frappe fills the top of the page itself in a few cases, and the theme leaves those alone:

- on a site in read-only mode,
- while an administrator is impersonating a user,
- while an announcement widget shows,
- on a phone-sized window.

In each case the rest of the theme still applies.

> [!NOTE]
> Items that apps add to the desktop launcher's avatar menu (with `desktop_page.add_menu_item`) are not in the header's account menu, which is the sidebar's.

## Related

- [Work with tables](tables.md)
- [How it works](development/architecture.md#the-ui-shell-header) for how the header follows the sidebar
