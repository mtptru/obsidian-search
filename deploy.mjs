// Copies the built plugin into an Obsidian vault.
// Vault path comes from OBSIDIAN_VAULT, or defaults to ~/Documents/Obsidian Vault.
import { copyFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const vault = process.env.OBSIDIAN_VAULT ?? join(homedir(), 'Documents', 'Obsidian Vault');
const target = join(vault, '.obsidian', 'plugins', 'ranked-search');

mkdirSync(target, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
	copyFileSync(file, join(target, file));
}
console.log(`Installed to ${target}`);
