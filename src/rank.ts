// Ranking logic. Kept free of Obsidian imports so it can be tested with plain Node.

export interface Doc {
	path: string;
	title: string;
	aliases: string[];
	lines: string[];
	mtime: number;
	// Filled in by prepareDoc
	titleNorm: string;
	aliasNorms: string[];
	headings: { line: number; norm: string }[];
	lineNorms: string[];
}

export interface Hit {
	doc: Doc;
	score: number;
	// Line to jump to, or -1 when the match is in the title only
	line: number;
}

interface Term {
	// Word stems that count as this term; more than one when typo correction kicks in
	variants: string[];
	fuzzy: boolean;
}

export interface Query {
	phrase: string;
	terms: Term[];
}

export function normalize(text: string): string {
	return text
		.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

export function stem(word: string): string {
	if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
	return word;
}

export function prepareDoc(
	d: Pick<Doc, 'path' | 'title' | 'aliases' | 'lines' | 'mtime'>,
): Doc {
	const headings: Doc['headings'] = [];
	d.lines.forEach((line, i) => {
		const m = /^#{1,6}\s+(.*)$/.exec(line);
		if (m?.[1]) headings.push({ line: i, norm: normalize(m[1]) });
	});
	return {
		...d,
		titleNorm: normalize(d.title),
		aliasNorms: d.aliases.map(normalize),
		headings,
		lineNorms: d.lines.map(normalize),
	};
}

export function buildVocabulary(docs: Iterable<Doc>): Set<string> {
	const vocab = new Set<string>();
	for (const doc of docs) {
		for (const w of doc.titleNorm.split(' ')) vocab.add(w);
		for (const line of doc.lineNorms) for (const w of line.split(' ')) if (w) vocab.add(w);
	}
	return vocab;
}

// Optimal string alignment distance, stopping early once it exceeds max
function editDistance(a: string, b: string, max: number): number {
	if (Math.abs(a.length - b.length) > max) return max + 1;
	let prev2: number[] = [];
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		let rowMin = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				v = Math.min(v, prev2[j - 2]! + 1);
			}
			cur.push(v);
			rowMin = Math.min(rowMin, v);
		}
		if (rowMin > max) return max + 1;
		prev2 = prev;
		prev = cur;
	}
	return prev[b.length]!;
}

export function parseQuery(raw: string, vocab: Set<string>): Query {
	const phrase = normalize(raw);
	const terms: Term[] = [];
	for (const word of phrase ? phrase.split(' ') : []) {
		const s = stem(word);
		let known = false;
		for (const v of vocab) {
			if (v.startsWith(s)) {
				known = true;
				break;
			}
		}
		if (known || s.length < 4) {
			terms.push({ variants: [s], fuzzy: false });
			continue;
		}
		// Unknown word: probably a typo, so look for close words in the vault
		const max = s.length >= 8 ? 2 : 1;
		const close: { w: string; d: number }[] = [];
		for (const v of vocab) {
			const d = editDistance(s, stem(v), max);
			if (d <= max) close.push({ w: stem(v), d });
		}
		close.sort((a, b) => a.d - b.d);
		const variants = [...new Set(close.slice(0, 5).map((c) => c.w))];
		terms.push(variants.length ? { variants, fuzzy: true } : { variants: [s], fuzzy: false });
	}
	return { phrase, terms };
}

function hasWord(text: string, term: Term): boolean {
	const padded = ' ' + text;
	return term.variants.some((v) => padded.includes(' ' + v));
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Terms in order and next to each other, allowing word endings ("string list" ~ "string lists")
function phraseRegExp(q: Query): RegExp {
	const parts = q.terms.map((t) => '(?:' + t.variants.map(escapeRegExp).join('|') + ')\\S*');
	return new RegExp('(?:^| )' + parts.join(' '));
}

// How well one piece of text (a title, heading or line) matches the query
const EXACT = 5;
const STARTS = 4;
const PHRASE = 3;
const LOOSE_PHRASE = 2;
const ALL_WORDS = 1;

function matchLevel(text: string, q: Query, loose: RegExp): number {
	if (!text) return 0;
	if (text === q.phrase) return EXACT;
	if (text.startsWith(q.phrase) && text.charAt(q.phrase.length) === ' ') return STARTS;
	if ((' ' + text + ' ').includes(' ' + q.phrase + ' ')) return PHRASE;
	if (loose.test(text)) return LOOSE_PHRASE;
	if (q.terms.every((t) => hasWord(text, t))) return ALL_WORDS;
	return 0;
}

const TITLE_POINTS = [0, 400, 650, 600, 550, 1000];
const HEADING_POINTS = [0, 200, 330, 380, 400, 500];
const LINE_POINTS = [0, 100, 160, 180, 180, 180];

export function scoreDoc(doc: Doc, q: Query, loose: RegExp, now: number): Hit | null {
	const fuzzy = q.terms.some((t) => t.fuzzy);
	const nTerms = q.terms.length;

	// Title and aliases
	let title = 0;
	for (const [i, text] of [doc.titleNorm, ...doc.aliasNorms].entries()) {
		const level = matchLevel(text, q, loose);
		let pts = TITLE_POINTS[level]!;
		if (level === 0) {
			const found = q.terms.filter((t) => hasWord(text, t)).length;
			pts = nTerms ? (150 * found) / nTerms : 0;
		}
		// Shorter titles are closer matches: "String Lists" beats "String Lists Archive"
		if (level > 0 && level < EXACT) pts -= Math.min(100, text.length - q.phrase.length);
		if (i > 0) pts *= 0.9;
		title = Math.max(title, pts);
	}

	// Headings
	let heading = 0;
	let headingLine = -1;
	for (const h of doc.headings) {
		const level = matchLevel(h.norm, q, loose);
		if (!level) continue;
		const pts = HEADING_POINTS[level]! - Math.min(80, h.norm.length - q.phrase.length) / 2;
		if (pts > heading) {
			heading = pts;
			headingLine = h.line;
		}
	}

	// Body lines
	let body = 0;
	let bodyLine = -1;
	let lineHits = 0;
	const seen = new Array<boolean>(nTerms).fill(false);
	for (let i = 0; i < doc.lineNorms.length; i++) {
		const text = doc.lineNorms[i]!;
		if (!text) continue;
		let any = false;
		q.terms.forEach((t, k) => {
			if (hasWord(text, t)) {
				seen[k] = true;
				any = true;
			}
		});
		if (!any) continue;
		const level = matchLevel(text, q, loose);
		if (!level) continue;
		lineHits++;
		const pts = LINE_POINTS[level]!;
		if (pts > body) {
			body = pts;
			bodyLine = i;
		}
	}
	const seenCount = seen.filter(Boolean).length;
	if (!body && nTerms && seenCount === nTerms) body = 60;
	else if (!body && seenCount) body = (30 * seenCount) / nTerms;
	if (lineHits > 1) body += Math.min(lineHits, 10) * 4;

	if (!title && !heading && !body) return null;

	// The strongest field leads; the others nudge
	const parts = [title, heading, body].sort((a, b) => b - a);
	let score = parts[0]! + 0.1 * (parts[1]! + parts[2]!);

	// Recently edited notes win ties: up to 8 points, fading over about a month
	const ageDays = Math.max(0, (now - doc.mtime) / 86_400_000);
	score += 8 / (1 + ageDays / 30);

	if (fuzzy) score *= 0.7;

	// A title match opens the note at the top; otherwise jump to the best heading or line
	let line = -1;
	if (title < Math.max(heading, body)) line = heading >= body ? headingLine : bodyLine;
	return { doc, score, line };
}

export function search(docs: Iterable<Doc>, raw: string, vocab: Set<string>, now: number): Hit[] {
	const q = parseQuery(raw, vocab);
	if (!q.terms.length) return [];
	const loose = phraseRegExp(q);
	const hits: Hit[] = [];
	for (const doc of docs) {
		const hit = scoreDoc(doc, q, loose, now);
		if (hit) hits.push(hit);
	}
	hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
	return hits;
}

// Character ranges in the original text where a query word starts, for highlighting
export function highlightRanges(text: string, q: Query): [number, number][] {
	const lower = text.toLowerCase();
	if (lower.length !== text.length) return [];
	const isWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);
	const ranges: [number, number][] = [];
	for (const t of q.terms) {
		for (const v of t.variants) {
			let from = 0;
			let idx: number;
			while ((idx = lower.indexOf(v, from)) !== -1) {
				from = idx + 1;
				const before = text.charAt(idx - 1);
				const camel = /\p{Ll}/u.test(before) && /\p{Lu}/u.test(text.charAt(idx));
				if (idx > 0 && isWordChar(before) && !camel) continue;
				let end = idx + v.length;
				while (end < text.length && isWordChar(text.charAt(end)) && !/\p{Lu}/u.test(text.charAt(end))) end++;
				ranges.push([idx, end]);
			}
		}
	}
	ranges.sort((a, b) => a[0] - b[0]);
	const merged: [number, number][] = [];
	for (const r of ranges) {
		const last = merged[merged.length - 1];
		if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
		else merged.push([r[0], r[1]]);
	}
	return merged;
}
