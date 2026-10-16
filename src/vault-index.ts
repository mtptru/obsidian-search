import { App, TAbstractFile, TFile } from 'obsidian';
import { buildVocabulary, Doc, prepareDoc } from './rank';

const TEXT_EXTENSIONS = new Set(['md', 'canvas']);

// Keeps every note's text in memory so each keystroke can be ranked instantly
export class VaultIndex {
	private docs = new Map<string, Doc>();
	private vocab: Set<string> | null = null;

	constructor(
		private app: App,
		private isExcluded: (path: string) => boolean,
	) {}

	async build(): Promise<void> {
		this.docs.clear();
		this.vocab = null;
		await Promise.all(this.app.vault.getFiles().map((f) => this.update(f)));
	}

	async update(file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile)) return;
		if (this.isExcluded(file.path)) {
			this.remove(file.path);
			return;
		}
		let lines: string[] = [];
		if (TEXT_EXTENSIONS.has(file.extension)) {
			const text = await this.app.vault.cachedRead(file);
			lines = file.extension === 'canvas' ? canvasLines(text) : text.split('\n');
		}
		const aliases = this.app.metadataCache.getFileCache(file)?.frontmatter?.aliases as unknown;
		this.docs.set(
			file.path,
			prepareDoc({
				path: file.path,
				title: file.basename,
				aliases: Array.isArray(aliases) ? aliases.map(String) : typeof aliases === 'string' ? [aliases] : [],
				lines,
				mtime: file.stat.mtime,
			}),
		);
		this.vocab = null;
	}

	remove(path: string): void {
		if (this.docs.delete(path)) this.vocab = null;
	}

	all(): Iterable<Doc> {
		return this.docs.values();
	}

	get(path: string): Doc | undefined {
		return this.docs.get(path);
	}

	vocabulary(): Set<string> {
		this.vocab ??= buildVocabulary(this.docs.values());
		return this.vocab;
	}
}

function canvasLines(json: string): string[] {
	try {
		const data = JSON.parse(json) as { nodes?: { text?: unknown }[] };
		return (data.nodes ?? []).flatMap((n) => (typeof n.text === 'string' ? n.text.split('\n') : []));
	} catch {
		return [];
	}
}
