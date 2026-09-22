# Dev Tab Autopilot

Chrome extension that sorts your tabs into **Chrome tab groups** using [TypeSafe Jev](https://console.typesafe.ai).

## How grouping works

Jev cannot invent free-text labels — it only picks among options. So for each Sort:

1. **Propose candidates** from your open tab URLs/titles (and any existing group names) — e.g. `GitHub PRs · hyperswitch`, `Local :3000`, `Slack`, `docs.rs`
2. **Jev chooses** the best group for each tab among those candidates
3. **Find-or-create** a Chrome tab group with that name (color is stable-hashed from the title)

This adapts to whatever you have open instead of a fixed Code/PRs/CI list.

## Features

- **Manual mode** (default): click the extension → **Sort this window**, or press `⌘⇧G` / `Ctrl⇧G`
- **Automatic mode**: new tabs are classified shortly after they finish loading
- Dynamic group names + find-or-create
- **Custom groups** — add your own labels in the popup or Settings; always offered to Jev
- Classification cache (7 days) when the cached group is still a candidate
- Exclude URL patterns + confidence floor → **Unsorted**

## Install (Chrome)

1. Clone this repo (or use your local folder)
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select this folder (or click **Reload** if already loaded)
5. Open **Settings** and paste your TypeSafe API key from [console.typesafe.ai/settings/keys](https://console.typesafe.ai/settings/keys)
6. Open some tabs → **Sort this window**

## Privacy

- Sends **URL + title** (and a short list of sibling tabs) to TypeSafe Jev
- API key stored in `chrome.storage.sync`
- No analytics

## Permissions

- `tabs`, `tabGroups`, `storage`
- `https://api.typesafe.ai/*`

## License

MIT
