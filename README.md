# Dev Tab Autopilot

Chrome extension that sorts your tabs into **Chrome tab groups** using [TypeSafe Jev](https://console.typesafe.ai).

## How grouping works

Chrome can't nest tab groups, so each Chrome group is a **parent** and its tabs are kept together by **subgroup** inside it:

```
▼ GitHub · backend, hyperswitch, jev-ultrafast
▼ Docs · stripe, hyperswitch
▼ CI / Deploy · Argo CD, CircleCI
▼ typesafe.ai · blog, console
```

Jev cannot invent free-text labels — it only picks among options. So for each Sort:

1. **Propose parent candidates** from your open tabs (and existing/custom group names) — `GitHub`, `Docs`, `CI / Deploy`, `AI`, `Local`, `Chat`, `Tracker`, `Cloud`, `Media`, or the site's domain (e.g. `typesafe.ai`)
2. **Jev chooses** the best parent for each tab among those candidates
3. **Subgroup comes from the URL** (no extra Jev call) — GitHub repo, docs site, CI tool, localhost port, subdomain
4. **Find-or-create** the parent's Chrome group, order tabs by subgroup (largest first), and title it `Parent · sub1, sub2, sub3 +N`. Colors are fixed for well-known parents, hashed otherwise

Custom groups are parents with no subgroups. Groups from older versions (`GitHub PRs · backend`, `app.circleci.com`, …) are merged into the new parents on the next sort.

## Features

- **Manual mode** (default): click the extension → **Sort this window**, or press `⌘⇧G` / `Ctrl⇧G`
- **Automatic mode**: new tabs are classified shortly after they finish loading
- Parent groups with URL-derived subgroups + find-or-create
- **Custom groups** — add your own labels in the popup or Settings; always offered to Jev
- Classification cache (7 days, `chrome.storage.local`) when the cached group is still a candidate
- Exclude URL patterns + confidence floor → **Unsorted**

## Install (Chrome)

1. Clone this repo (or use your local folder)
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select this folder (or click **Reload** if already loaded)
5. Open **Settings** and paste your TypeSafe API key from [console.typesafe.ai/settings/keys](https://console.typesafe.ai/settings/keys)
6. Open some tabs → **Sort this window**

## Development

```sh
npm test   # unit tests for grouping heuristics (Node 20+)
```

## Privacy

- Sends **URL + title** (and a short list of sibling tabs) to TypeSafe Jev
- API key stored in `chrome.storage.sync`
- No analytics

## Permissions

- `tabs`, `tabGroups`, `storage`
- `https://api.typesafe.ai/*`

## License

MIT
