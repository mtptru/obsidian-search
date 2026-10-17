import { App, Keymap, MarkdownView, SuggestModal, TFile } from 'obsidian';
import { Doc, highlightRanges, Hit, parseQuery, Query, search } from './rank';
import { VaultIndex } from './vault-index';

const MAX_RESULTS = 50;
const SNIPPET_LENGTH = 140;

export class RankedSearchModal extends SuggestModal<Hit> {
	private query: Query = { phrase: '', terms: [] };

	constructor(
		app: App,
		private index: VaultIndex,
	) {
		super(app);
		this.limit = MAX_RESULTS;
		this.emptyStateText = 'No matches.';
		this.setPlaceholder('Search notes...');
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to open' },
			{ command: 'cmd click', purpose: 'to open in new tab' },
			{ command: 'esc', purpose: 'to dismiss' },
		]);
		this.modalEl.addClass('ranked-search-modal');
	}

	getSuggestions(query: string): Hit[] {
		this.query = parseQuery(query, this.index.vocabulary());
		if (!query.trim()) return this.recentFiles();
		return search(this.index.all(), query, this.index.vocabulary(), Date.now()).slice(0, MAX_RESULTS);
	}

	renderSuggestion(hit: Hit, el: HTMLElement): void {
		const q = this.query;
		el.addClass('ranked-search-item');
		highlight(el.createDiv({ cls: 'ranked-search-title' }), hit.doc.title, q);

		const folder = hit.doc.path.includes('/') ? hit.doc.path.slice(0, hit.doc.path.lastIndexOf('/')) : '';
		if (folder) el.createDiv({ cls: 'ranked-search-path', text: folder });

		const snippet = snippetFor(hit, q);
		if (snippet) highlight(el.createDiv({ cls: 'ranked-search-snippet' }), snippet, q);
	}

	onChooseSuggestion(hit: Hit, evt: MouseEvent | KeyboardEvent): void {
		void this.openHit(hit, evt);
	}

	private async openHit(hit: Hit, evt: MouseEvent | KeyboardEvent): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(hit.doc.path);
		if (!(file instanceof TFile)) return;
		const leaf = this.app.workspace.getLeaf(Keymap.isModEvent(evt));
		await leaf.openFile(file, hit.line >= 0 ? { eState: { line: hit.line } } : {});
		if (hit.line < 0) return;

		// Select the matched words so they stand out, like find-in-page
		const view = leaf.view;
		if (!(view instanceof MarkdownView) || view.getMode() !== 'source') return;
		const text = hit.doc.lines[hit.line] ?? '';
		const ranges = highlightRanges(text, this.query);
		const first = ranges[0];
		const last = ranges[ranges.length - 1];
		const from = { line: hit.line, ch: first ? first[0] : 0 };
		const to = { line: hit.line, ch: last ? last[1] : 0 };
		view.editor.setSelection(from, to);
		view.editor.scrollIntoView({ from, to }, true);
	}

	private recentFiles(): Hit[] {
		return this.app.workspace
			.getLastOpenFiles()
			.map((path) => this.index.get(path))
			.filter((doc): doc is Doc => !!doc)
			.map((doc) => ({ doc, score: 0, line: -1 }));
	}
}

function snippetFor(hit: Hit, q: Query): string {
	const lines = hit.doc.lines;
	const text = hit.line >= 0 ? stripMarkup(lines[hit.line] ?? '') : firstContentLine(lines);
	if (!text) return '';
	if (text.length <= SNIPPET_LENGTH) return text;
	// Center long lines on the first match
	const start = highlightRanges(text, q)[0]?.[0] ?? 0;
	const from = Math.max(0, start - SNIPPET_LENGTH / 3);
	return (from > 0 ? '…' : '') + text.slice(from, from + SNIPPET_LENGTH) + '…';
}

// Drop heading, quote, list and checkbox markers so the preview reads as plain text
function stripMarkup(line: string): string {
	return line.replace(/^\s*(?:#{1,6}\s+|>\s*|(?:[-*+]|\d+\.)\s+(?:\[.\]\s*)?)/, '').trim();
}

// The first line worth previewing: skips frontmatter, dividers and empty list items
function firstContentLine(lines: string[]): string {
	let i = 0;
	if (lines[0]?.trim() === '---') {
		const end = lines.findIndex((l, j) => j > 0 && l.trim() === '---');
		i = end === -1 ? 0 : end + 1;
	}
	for (; i < lines.length; i++) {
		const line = lines[i] ?? '';
		if (/^\s*([-_*])(\s*\1){2,}\s*$/.test(line)) continue;
		const text = stripMarkup(line);
		if (text) return text;
	}
	return '';
}

function highlight(el: HTMLElement, text: string, q: Query): void {
	let pos = 0;
	for (const [start, end] of highlightRanges(text, q)) {
		if (start > pos) el.appendText(text.slice(pos, start));
		el.createSpan({ cls: 'ranked-search-match', text: text.slice(start, end) });
		pos = end;
	}
	if (pos < text.length) el.appendText(text.slice(pos));
}
