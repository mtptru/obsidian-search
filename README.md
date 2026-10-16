# Ranked Search

An Obsidian plugin that searches your vault and puts the closest match first, the way Google Docs or Chrome's address bar do, instead of listing every note that contains your words.

Searching `String Lists` gives, in order:

1. A note titled exactly **String Lists**
2. Titles that start with or contain the phrase (shorter titles first)
3. Headings that match the phrase, like `## Prince String Lists`
4. Lines containing the phrase
5. Notes that contain all the words, just not together

It also handles:

- **Plurals and word endings:** `string list` matches `String Lists`.
- **camelCase:** `string lists` finds `PrinceStringLists`.
- **Typos:** `repertiore` finds `Repertoire`. Corrected matches rank below exact ones.
- **Partial words while typing:** `string li` already finds `String Lists`.
- **Aliases:** `aliases` in a note's frontmatter count as titles.
- **Ties:** recently edited notes win.

Results show the folder and a highlighted snippet. Picking a result opens the note at the matching line with the words selected. With an empty search box, it lists recently opened notes.

## Install

### From Obsidian (once it's listed in the community directory)

1. Open **Settings → Community plugins**. If **Restricted mode** is on, select **Turn on community plugins**.
2. Select **Browse**, search for **Ranked Search**, then select **Install**.
3. Select **Enable**.

### Manually from GitHub

1. Go to the [latest release](https://github.com/mtptru/obsidian-search/releases/latest) and download `main.js`, `manifest.json` and `styles.css`.
2. In your vault, create the folder `.obsidian/plugins/ranked-search/`. On a Mac, the `.obsidian` folder is hidden in Finder; press **Cmd+Shift+.** to show it.
3. Move the three downloaded files into that folder.
4. Restart Obsidian, open **Settings → Community plugins**, and turn on **Ranked Search**. If **Restricted mode** is on, turn on community plugins first.

### From source

Requires [Node.js](https://nodejs.org) 22 or newer.

```sh
git clone https://github.com/mtptru/obsidian-search.git
cd obsidian-search
npm install
OBSIDIAN_VAULT="/path/to/your/vault" npm run deploy
```

Then restart Obsidian and turn the plugin on as in step 4 above.

## Use

- Press **Cmd+Shift+F** (once it's bound, see below), click the search icon in the left ribbon, or run **Ranked Search: Open search** from the command palette.
- **↑ ↓** move through results, **Enter** opens one, **Cmd+click** opens it in a new tab.

To use Cmd+Shift+F: go to **Settings → Hotkeys**, bind it to **Ranked Search: Open search**, and remove it from **Search: Search in all files**.

## Settings

**Excluded folders:** folders to leave out, one per line. Empty means everything is searched.

## Development

```sh
npm install
npm run dev      # rebuild main.js on every change
npm test         # ranking tests
npm run build    # type-check and production build
npm run deploy   # build, then copy into the vault
```

`npm run deploy` copies `main.js`, `manifest.json` and `styles.css` to `~/Documents/Obsidian Vault/.obsidian/plugins/ranked-search/`. Set `OBSIDIAN_VAULT` to install into a different vault. Reload Obsidian afterwards.

The ranking lives in `src/rank.ts`, which doesn't import Obsidian, so it can be tested with plain Node. `src/vault-index.ts` keeps every note's text in memory and updates it as files change. `src/search-modal.ts` is the search popup.

## Releasing a new version

```sh
npm version patch      # or minor / major: bumps manifest.json, versions.json and package.json, then tags
git push --follow-tags
```

Pushing the tag runs `.github/workflows/release.yml`, which builds the plugin and creates a draft release with `main.js`, `manifest.json` and `styles.css` attached. Open **Releases** on GitHub, add notes, and publish it. Obsidian users get the update from there.
