# Ranked Search

An Obsidian plugin that searches your vault and puts the closest match first.

Searching `reading list` puts results in this order:

1. A note titled exactly **Reading List**
2. Titles that start with or contain the phrase, shorter titles first
3. Headings that match the phrase, like `## Fall reading list`
4. Lines that contain the phrase
5. Notes that contain all the words, but not next to each other

It also handles:

- **Plurals and word endings:** `reading lists` matches `Reading List`.
- **camelCase:** `reading list` finds `myReadingList`.
- **Typos:** `reding list` still finds `Reading List`. Corrected matches rank below exact ones.
- **Partial words while typing:** `reading li` already finds `Reading List`.
- **Aliases:** `aliases` in a note's frontmatter count as titles.
- **Ties:** recently edited notes come first.

Each result shows its folder and a preview line with your words highlighted. Choosing a result opens the note at the matching line with the words selected. With an empty search box, it lists your recently opened notes.

## Usage

Open the search in any of these ways:

- Run **Ranked Search: Open search** from the command palette.
- Select the search icon in the left ribbon.
- Assign a hotkey. Go to **Settings → Hotkeys**, search for **Ranked Search**, and set one. To use it in place of the built-in search, give it <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> and remove that hotkey from **Search: Search in all files**.

In the search box:

- <kbd>↑</kbd> <kbd>↓</kbd> move between results.
- <kbd>Enter</kbd> opens the selected result.
- <kbd>Cmd/Ctrl</kbd>+click opens a result in a new tab.
- <kbd>Esc</kbd> closes the search.

## Settings

**Excluded folders:** folders to leave out of search, one per line. When empty, the whole vault is searched.

## Installation

### From the Community plugins directory

1. Open **Settings → Community plugins** and turn off **Restricted mode** if it's on.
2. Select **Browse**, search for **Ranked Search**, and select **Install**.
3. Select **Enable**.

### Manually

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/mtptru/obsidian-search/releases/latest).
2. Create the folder `<your vault>/.obsidian/plugins/ranked-search/` and put the three files in it. On macOS, press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd> in Finder to show the hidden `.obsidian` folder.
3. Restart Obsidian, then turn on **Ranked Search** in **Settings → Community plugins**.

## Privacy

Ranked Search works entirely offline. It reads the notes in your vault to build its index in memory, and it doesn't send anything over the network or store anything outside your vault.

## Development

Requires [Node.js](https://nodejs.org) 22 or later.

```sh
npm install
npm run dev      # rebuild main.js on every change
npm test         # ranking tests
npm run build    # type-check and production build
npm run lint
```

To try a build in a vault, run `npm run deploy`. It builds the plugin and copies `main.js`, `manifest.json` and `styles.css` into `~/Documents/Obsidian Vault/.obsidian/plugins/ranked-search/`. To use a different vault, set `OBSIDIAN_VAULT` to its folder, without extra quotes inside the value:

```sh
OBSIDIAN_VAULT=~/Notes npm run deploy
```

Reload Obsidian afterwards.

### Code layout

| File | Purpose |
|---|---|
| `src/rank.ts` | Query parsing and scoring. It doesn't import Obsidian, so `test/rank.test.ts` runs it with plain Node. |
| `src/vault-index.ts` | Keeps each note's text in memory and updates it as files change. |
| `src/search-modal.ts` | The search popup: results, previews and opening the match. |
| `src/main.ts` | Plugin setup, the command and the settings tab. |

### Releasing

```sh
npm version patch   # or minor / major
git push --follow-tags
```

`npm version` updates `package.json`, `manifest.json` and `versions.json` and creates a tag. Pushing the tag runs the release workflow, which tests and builds the plugin and creates a draft GitHub release with `main.js`, `manifest.json` and `styles.css` attached. Add release notes and publish the draft.

## License

[MIT](LICENSE)
