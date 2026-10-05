import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../../supabase/functions/_shared/dnrec.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const dnrec = {};
new Function('exports', code)(dnrec);
const row = (title, id = 1) => ({ title, source_topic_id: id, seo_name: title.toLowerCase().replaceAll(' ', '-'), content_text: 'Official preparation instructions.', tags: [], synonyms: [], search_terms: [], source_url: 'https://dnrec.delaware.gov/waste-hazardous/recycling/what/', source_updated_at: null });
const catalog = (rows, error = null) => ({ from: () => ({ select: () => ({ in: async (_, titles) => ({ data: rows.filter(r => titles.includes(r.title)), error }), then: resolve => Promise.resolve({ data: rows, error }).then(resolve) }) }) });

test('branded paper notebooks resolve to paper guidance without assuming the binding', async () => {
  for (const name of ['Steno book', 'Mead steno book', 'Five Star notebook', 'Writing pad', 'Moleskine journal']) {
    assert.deepEqual(dnrec.dnrecCategoryQueries(name, 'paper'), ['Paper'], name);
    const guidance = await dnrec.findDnrecCategoryGuidance(catalog([row('Paper')]), name, 'paper');
    assert.equal(guidance[0].title, 'Paper');
    assert.equal(guidance[0].matchConfidence, 0);
    assert.match(guidance[0].basis, /covers, bindings, and coatings/);
    assert.equal(guidance[0].instructions, 'Official preparation instructions.');
  }
  assert.ok(!dnrec.buildDnrecCatalogQueries('Steno book', 'paper').includes('spiral bound notebook'));
});
test('visible notebook types match the official item despite branding', async () => {
  for (const [name, title] of [['Mead composition book', 'Composition books'], ['Five Star spiral notebook', 'Spiral-bound notebooks']]) {
    const result = await dnrec.findDelawareGuidance(catalog([row(title), row('Laptop / Notebook Computers', 2)]), dnrec.buildDnrecCatalogQueries(name, 'paper'));
    assert.equal(result.match.row.title, title);
    assert.equal(result.match.score, 1);
  }
});
test('battery devices use electronics guidance while separate batteries use battery guidance', () => {
  for (const name of ['AirPods charging case', 'Apple AirPods case', 'Samsung earbuds', 'power bank', 'wireless charger', 'notebook computer']) {
    assert.deepEqual(dnrec.dnrecCategoryQueries(name, 'plastic'), ['Electronics'], name);
  }
  assert.deepEqual(dnrec.dnrecCategoryQueries('AA batteries', 'metal', 'battery'), ['Household Batteries']);
});
test('covers, packaging, uncertain materials, and hazards cannot inherit paper or device advice', () => {
  for (const name of ['AirPods case cover', 'silicone AirPods case', 'protective laptop sleeve', 'AirPods retail box', 'empty packaging']) {
    assert.deepEqual(dnrec.dnrecCategoryQueries(name, 'plastic'), [], name);
  }
  assert.deepEqual(dnrec.dnrecCategoryQueries('notebook', 'plastic'), []);
  assert.deepEqual(dnrec.dnrecCategoryQueries('notebook', 'paper', 'chemical'), []);
  assert.deepEqual(dnrec.dnrecCategoryQueries('digital notebook', 'paper'), []);
});
test('category results use only available official records and tolerate a missing mirror', async () => {
  assert.deepEqual(await dnrec.findDnrecCategoryGuidance(catalog([row('Paper')]), 'AirPods case'), []);
  assert.deepEqual(await dnrec.findDnrecCategoryGuidance(catalog([], new Error('offline')), 'Steno book'), []);
});
