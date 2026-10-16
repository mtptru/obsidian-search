import { App, debounce, Plugin, PluginSettingTab, SettingDefinitionItem, TAbstractFile } from 'obsidian';
import { RankedSearchModal } from './search-modal';
import { VaultIndex } from './vault-index';

interface RankedSearchSettings {
	// One folder per line
	excludedFolders: string;
}

const DEFAULT_SETTINGS: RankedSearchSettings = {
	excludedFolders: '',
};

export default class RankedSearchPlugin extends Plugin {
	settings: RankedSearchSettings = DEFAULT_SETTINGS;
	index!: VaultIndex;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.index = new VaultIndex(this.app, (path) => this.isExcluded(path));

		this.addCommand({
			id: 'open',
			name: 'Open search',
			callback: () => new RankedSearchModal(this.app, this.index).open(),
		});
		this.addRibbonIcon('search', 'Ranked search', () => new RankedSearchModal(this.app, this.index).open());
		this.addSettingTab(new RankedSearchSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(async () => {
			await this.index.build();
			const update = (file: TAbstractFile) => void this.index.update(file);
			this.registerEvent(this.app.vault.on('create', update));
			this.registerEvent(this.app.vault.on('modify', update));
			this.registerEvent(this.app.vault.on('delete', (file) => this.index.remove(file.path)));
			this.registerEvent(
				this.app.vault.on('rename', (file, oldPath) => {
					this.index.remove(oldPath);
					update(file);
				}),
			);
			// Aliases live in frontmatter, which the metadata cache parses after the file changes
			this.registerEvent(this.app.metadataCache.on('changed', update));
		});
	}

	isExcluded(path: string): boolean {
		return this.settings.excludedFolders
			.split('\n')
			.map((line) => line.trim().replace(/^\/+|\/+$/g, ''))
			.some((folder) => folder && (path === folder || path.startsWith(folder + '/')));
	}

	rebuildSoon = debounce(() => void this.index.build(), 500, true);

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<RankedSearchSettings>);
	}
}

class RankedSearchSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: RankedSearchPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Excluded folders',
				desc: 'Folders to leave out of search, one per line. Everything is searched when this is empty.',
				control: { type: 'textarea', key: 'excludedFolders', placeholder: 'Template', rows: 4 },
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		this.plugin.rebuildSoon();
	}
}
