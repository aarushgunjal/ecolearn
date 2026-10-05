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

const families = [
  ['Acme metal food tin', 'food can', ['pet food cans'], 'Pet food cans'],
  ['BigBox shipping carton', 'corrugated box', ['corrugated cardboard'], 'Corrugated Cardboard'],
  ['CampCo flask lid', 'metal bottle cap', ['bottle caps metal'], 'Bottle Caps - Metal'],
  ['Bright brand desk calculator', 'calculator', ['calculator'], 'Calculator'],
  ['HomeCo ceramic casserole', 'ceramic cookware', ['ceramic cookware'], 'Ceramic Cookware'],
  ['Store-brand milk jug', 'milk jug', ['milk jugs'], 'Milk Jugs'],
  ['FizzCo glass bottle', 'glass beverage bottle', ['glass bottles'], 'Glass Bottles'],
  ['FreshCo peel', 'food scrap', ['food waste'], 'Food Waste'],
  ['BrandX foliage', 'leaves', ['leaves'], 'Leaves'],
  ['SoundCo receiver', 'stereo receiver', ['audio amplifiers'], 'Audio Amplifiers'],
  ['BrightCo bulb', 'LED light bulb', ['LED light bulbs'], 'LED light bulbs'],
  ['ArtCo coloring sticks', 'wax crayon', ['crayons'], 'Crayons'],
  ['SportCo cycle', 'bicycle', ['bikes'], 'Bicycles'],
  ['QuickCo brewer', 'coffee maker', ['coffee maker'], 'Coffee maker'],
  ['Acme lotion pump bottle', 'plastic bottle', ['plastic bottles'], 'Plastic bottles'],
  ['BookCo monthly issue', 'magazine', ['magazines'], 'Magazines'],
  ['BrandCo snack wrapper', 'candy wrapper', ['candy wrappers'], 'Candy wrappers'],
  ['GardenCo flexible tube', 'garden hose', ['garden hose'], 'Garden Hose'],
];
for (const [observedItem, catalogQuery, variants, title] of families) {
  test(`generic classification and equivalents match ${title}`, async () => {
    const official = { ...row(title), synonyms: title === 'Bicycles' ? [{synonym:'Bikes'}] : [] };
    const queries = dnrec.buildDnrecIdentificationQueries({observedItem,catalogQuery,material:'',variants});
    const result = await dnrec.findDelawareGuidance(catalog([official, row('Unrelated item',2)]), queries);
    assert.equal(result.match?.row.title,title);
    assert.equal(dnrec.hasUniqueDnrecMatch(result),true);
  });
}
test('conflicting exact variants never select the alphabetical winner', () => {
  const result=dnrec.lookupDnrecRows([row('Glass Bottles'),row('Glass Drinkware',2)],['glass bottles','glass drinkware']);
  assert.equal(dnrec.hasUniqueDnrecMatch(result),false);
});
test('untrusted variants are bounded and broad category hints cannot invent advice', () => {
  assert.deepEqual(dnrec.boundedNames('Paper'),[]);
  assert.deepEqual(dnrec.boundedNames([null,{},'',' Paper ','Paper']),['Paper']);
  assert.equal(dnrec.boundedNames(Array.from({length:100},(_,i)=>'x'.repeat(200)+i)).length,1);
  const found=dnrec.relatedDnrecGuidance([row('Electronics'),row('Paper',2)],['Imaginary recyclable','Electronics']);
  assert.deepEqual(found.map(g=>g.title),['Electronics']);
  assert.equal(found[0].matchConfidence,0);
});
test('safety distinctions survive material and name normalization', () => {
  for(const [name,target,hazard] of [
    ['silicone protective phone cover','Cell Phones','none'],
    ['full aerosol spray can','Aluminum cans','chemical'],
    ['pesticide bottle','Plastic bottles','chemical'],
    ['compostable plate','Paper Plates','none'],
    ['ceramic glass-look jar','Glass Jars','none'],
    ['greasy pizza box','Pizza Box Lids - Clean','none'],
    ['motor oil container','Plastic bottles','chemical'],
  ]) assert.equal(dnrec.compatibleDnrecItem(name,target,hazard),false,name);
});
test('missing condition, binding, or resin requires clarification', () => {
  for(const [name,title] of [['spray can','Aerosol Cans - Empty'],['notebook','Spiral-bound notebooks'],['plastic cup','Plastic cups #5'],['pizza box','Pizza Box Lids - Clean']]) assert.ok(dnrec.dnrecClarification(name,row(title)),title);
  assert.equal(dnrec.dnrecClarification('empty aerosol can',row('Aerosol Cans - Empty')),null);
});
test('catalog freshness is bounded and full official instructions are preserved', () => {
  const now=Date.now();
  assert.equal(dnrec.isFreshDnrecRecord({...row('Paper'),synced_at:new Date(now-1000).toISOString()},now),true);
  for(const date of [undefined,'invalid',new Date(now+1000).toISOString(),new Date(now-49*3600000).toISOString()]) assert.equal(dnrec.isFreshDnrecRecord({...row('Paper'),synced_at:date},now),false);
  const text='Official instructions. '.repeat(150)+'Keep the important final instruction.';
  assert.equal(dnrec.toGuidancePayload({row:{...row('Paper'),content_text:text},score:1}).instructions,text);
});

test('an exact item title wins over a merely similar longer title',()=>{
 const result=dnrec.lookupDnrecRows([row('Paper Cups'),row('Paper Coffee Cups',2)],'Paper Cups');
 assert.equal(result.match.row.title,'Paper Cups');assert.equal(dnrec.hasUniqueDnrecMatch(result),true);
});

test('a specific official title takes precedence over an alias in a broader record',()=>{
 const result=dnrec.lookupDnrecRows([{...row('Household Batteries'),synonyms:[{synonym:'Rechargeable Batteries'}]},row('Rechargeable Batteries',2)],'Rechargeable Batteries');
 assert.equal(result.match.row.title,'Rechargeable Batteries');assert.equal(dnrec.hasUniqueDnrecMatch(result),true);
});
