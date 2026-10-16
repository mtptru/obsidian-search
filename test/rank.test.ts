import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVocabulary, highlightRanges, parseQuery, prepareDoc, search } from '../src/rank.ts';

const NOW = Date.UTC(2026, 9, 16);

function doc(path: string, body = '', mtime = NOW) {
	const title = path.split('/').pop()!.replace(/\.md$/, '');
	return prepareDoc({ path, title, aliases: [], lines: body.split('\n'), mtime });
}

function titles(docs: ReturnType<typeof doc>[], query: string): string[] {
	return search(docs, query, buildVocabulary(docs), NOW).map((h) => h.doc.title);
}

test('exact title beats alphabetical partial matches', () => {
	const docs = [
		doc('A list of strings.md', 'string and list'),
		doc('Bowstring notes.md', 'list'),
		doc('Lists/Shopping List.md'),
		doc('Music/String Lists.md', 'repertoire'),
		doc('String Lists Archive.md'),
	];
	const got = titles(docs, 'String Lists');
	assert.equal(got[0], 'String Lists');
	assert.equal(got[1], 'String Lists Archive');
});

test('heading match beats scattered body words', () => {
	const docs = [
		doc('Goals.md', '# Goals\n## Prince String Lists\nstuff'),
		doc('Daily/2026-07-04.md', 'restring the cello\nmake a grocery list'),
	];
	const hits = search(docs, 'string lists', buildVocabulary(docs), NOW);
	assert.equal(hits[0]?.doc.title, 'Goals');
	assert.equal(hits[0]?.line, 1);
});

test('camelCase words are split', () => {
	const docs = [doc('Notes.md', 'see PrinceStringLists repo'), doc('Other.md', 'nothing here')];
	assert.deepEqual(titles(docs, 'string lists'), ['Notes']);
});

test('typos still find the note', () => {
	const docs = [doc('Orchestra Repertoire.md'), doc('Shopping.md', 'milk')];
	assert.equal(titles(docs, 'repertiore')[0], 'Orchestra Repertoire');
});

test('partial last word while typing', () => {
	const docs = [doc('String Lists.md'), doc('Strong Opinions.md')];
	assert.equal(titles(docs, 'string li')[0], 'String Lists');
});

test('highlight ranges cover whole words and camelCase parts', () => {
	const q = parseQuery('string list', new Set(['string', 'list', 'lists']));
	assert.deepEqual(highlightRanges('PrinceStringLists', q), [[6, 17]]);
	assert.deepEqual(highlightRanges('substring', q), []);
});
