# Dev Tab Autopilot

Chrome extension that sorts your tabs into **Chrome tab groups** using [TypeSafe Jev](https://console.typesafe.ai).

Groups (created automatically if missing): **Code · PRs · Issues · CI · Docs · Chat · Cloud · Learning · Distraction · Other · Unsorted**

## Features

- **Manual mode** (default): click the extension → **Sort this window**, or press `⌘⇧G` / `Ctrl⇧G`
- **Automatic mode**: new tabs are classified shortly after they finish loading
- **Find-or-create tab groups** per category (color + title)
- Classification cache (7 days) to cut Jev API cost
- Exclude URL patterns, confidence floor, enable/disable categories

## Install (Chrome)

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select this folder
5. Open **Settings** (extension details → Extension options) and paste your TypeSafe API key from [console.typesafe.ai/settings/keys](https://console.typesafe.ai/settings/keys)
6. Open some tabs → click the extension → **Sort this window**

## Privacy

- Classification uses **URL + title only** (sent to TypeSafe Jev)
- API key is stored in `chrome.storage.sync`
- No analytics / no other network calls

## Permissions

- `tabs`, `tabGroups`, `storage`
- `https://api.typesafe.ai/*`

## License

MIT
