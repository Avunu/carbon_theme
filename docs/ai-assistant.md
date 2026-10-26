---
title: Use the AI assistant
description: Chat with flow's AI assistant from the Carbon header, attach files, rate replies, and find, rename and delete past conversations.
nav_title: AI assistant
order: 5
updated: 2026-10-26
---

When Frappe's [flow](https://github.com/frappe/flow_client) app is installed on the site, the header gets an **AI assistant** button directly before the switcher. It opens a chat panel built from Carbon AI Chat that talks to flow's assistant. The panel replaces flow's own panel; the assistant, its tools and what it may do are flow's.

Without flow, or on a site in read-only mode, there is no button. On a phone-sized window (below 768px) there is no header and so no assistant.

## Open and close the panel

- Click **AI assistant** in the header, or press Ctrl+I.
- The panel docks to the right, 360px wide. **Expand** widens it to the whole window and **Collapse** brings it back. In a narrow window it always takes the full width.
- To close it, click **AI assistant** again, press Ctrl+I, or use **Close** in the panel's header. The panel remembers whether it was open and expanded, and which conversation you had open, when you reload.

The first time you open it, the panel loads its code, which takes a moment. If that fails, it shows "The AI assistant could not be loaded" with **Retry**, **Reload the page** and **Open the Flow panel**. See [Troubleshooting](troubleshooting.md#the-ai-assistant).

## Before the assistant is set up

Until flow has an enabled Flow Agent, the prompt is disabled and reads "Finish setup to start chatting".

- A System Manager sees the two steps: create and enable a Flow Model with your provider credentials, then enable a Flow Agent (flow creates one when a model exists). **Open Flow Models** goes to the list.
- Everyone else sees "The assistant has not been set up yet. Ask your administrator to enable it."

**Conversation history** still works while set-up is unfinished.

## Chat

Type in **Ask the assistant…** and press Enter or **Send**. The reply streams in. While it streams, **Stop response** ends it. Each message shows its time: the time alone for today, otherwise the date and time, in your own time zone.

When the assistant wants to create, change or delete records, it asks first with an approval card. Choose **Approve**, **Deny**, or tell it what to do instead, and it continues.

**New chat** starts a new conversation. The text you have typed and any files you attached stay when you switch to another conversation, and are cleared by **New chat**.

### Move around a long conversation

A long conversation opens at its last 30 or so messages. **Show earlier messages** at the top adds 30 more at a time.

From the keyboard: press the Up arrow in an empty prompt to move to the last message, then use the arrow keys to move between messages, Home and End to go to the first and last, and Escape to return to the prompt.

## Attach files

Click **Attach files** beside the prompt, drop files anywhere on the panel, or paste them into the prompt.

- Up to five files go with one message.
- The file types are the ones flow can read (such as plain text, CSV, JSON, Markdown, PDF, DOCX, XLSX, HTML and images), and the size limit is the site's maximum file size.
- Each file shows as a chip while it uploads, with a **Cancel** bar while anything is in flight. Reading a PDF or an image can take a few seconds, because flow reads its text.
- A message cannot be only files: add some text.
- While the assistant waits for an approval, you cannot attach files.

A file the panel refuses is named in a line under the prompt with the reason, for example "Not a supported file type: …" or "You can attach at most 5 files."

If flow does not say which file types it reads (an older flow), there is no **Attach files** button and dropping or pasting a file does nothing in the panel.

> [!NOTE]
> Attached files are stored on the site as private files. A file you remove before sending is deleted again. A file you sent stays after you delete the conversation, until flow's own clean-up removes it 30 days after the conversation was last used.

## Rate a reply

A finished reply has **Good response** and **Bad response** buttons. A good rating is sent at once. A bad one opens a box for a comment, sent with the rating. Click the selected button again to withdraw your rating.

When flow's agent has memory enabled, it may keep a bad rating's comment and use it in other people's conversations, as the comment box says.

## Find past conversations

**Conversation history** in the panel's header opens a list of your conversations, newest first, grouped as Today, Yesterday, Previous 7 days, Previous 30 days and Older. Conversations started by flow's triggers are not listed.

- **Search conversations** filters by title. It searches your 100 most recent conversations, and says so when you have more.
- Click a conversation to open it. A conversation that was waiting for an approval opens with the approval card ready.
- Each row's menu has **Rename** and **Delete**. Delete asks first and cannot be undone.

If the same conversation is replying in another browser tab, opening or deleting it there waits: "This conversation is replying in another tab. Try again when it has finished."

## What the assistant does not know

The assistant is not told which document you are looking at. Name the document in your message.

## Related

- [Use the header](ui-shell.md)
- [How it works](development/architecture.md#the-ai-assistant) for how the panel uses flow and what it stores in the browser
