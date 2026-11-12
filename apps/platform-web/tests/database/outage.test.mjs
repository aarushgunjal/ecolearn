import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(new URL(`../../supabase/functions/${path}.ts`,import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const codes=Object.fromEntries(await Promise.all(['_shared/dnrec','_shared/visual-budget','delaware-guidance/index','find-disposal-sites/index','read-label/index'].map(async name=>[name,await compile(name)])));
const saved={source_topic_id:1,title:'Glass Bottles',seo_name:'glass-bottles',content_text:'Empty and rinse.',tags:[],synonyms:[],search_terms:[],source_url:'https://dnrec.delaware.gov/',synced_at:'2026-01-01T00:00:00Z'};
function endpoint(name,{rows=[saved],allowed=true,dbError=false,user=true,providerResult={text:'Paper',materials:['paper'],recyclingSymbols:[],guidance:'Check local guidance.'}}={}) {
  const calls=[];let handler;
  const env={env:{get:key=>({OPENROUTER_API_KEY:'fixture',OPENROUTER_LABEL_MODEL:'fixture'}[key])}};
  const fetcher=async(url,init)=>{
    calls.push({url:String(url),body:init?.body?JSON.parse(init.body):null});
    if(String(url).includes('openrouter')) return Response.json({choices:[{message:{content:JSON.stringify(providerResult)}}]});
    throw new Error('DNREC unavailable');
  };
  const db={auth:{getUser:async()=>({data:{user:user?{id:'fixture'}:null}})},rpc:async()=>({data:{allowed,code:'RATE_LIMITED'},error:dbError?{message:'offline'}:null}),from:()=>{
    const chain={select:()=>chain,in:()=>chain,then:resolve=>Promise.resolve({data:rows,error:dbError?{message:'offline'}:null}).then(resolve)};return chain;
  }};
  const dnrec={};new Function('exports','fetch',codes['_shared/dnrec'])(dnrec,fetcher);
  const budget={};new Function('exports','Deno',codes['_shared/visual-budget'])(budget,env);
  const require=name=>name.includes('visual-budget')?budget:name.includes('dnrec')?dnrec:name.includes('analytics')?{recordItemInteraction:async()=>{}}:name.includes('supabase')?{createClient:()=>db}:{serve:fn=>{handler=fn;}};
  new Function('exports','require','Deno','fetch',codes[`${name}/index`])({},require,env,fetcher);
  return {calls,run:async body=>{const res=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify(body)}));return {status:res.status,body:await res.json()};}};
}

test('typed search and suggestions use the saved catalog without waiting for DNREC',async()=>{
  for(const mode of [undefined,'suggestions']) {
    const api=endpoint('delaware-guidance');const result=await api.run({item:'Glass bottles',mode});
    assert.equal(result.status,200);assert.equal(api.calls.length,0);
    if(mode) assert.equal(result.body.suggestions[0].title,saved.title);
    else {assert.equal(result.body.verified,true);assert.match(result.body.guidance.sourceNotice,/2026-01-01/);}
  }
});

test('a catalog outage is not reported as an unknown item',async()=>{
  const api=endpoint('delaware-guidance',{dbError:true});assert.equal((await api.run({item:'glass bottles'})).status,503);
});

test('item maps retain DSWA facilities during a DNREC outage without guessing acceptance',async()=>{
  const api=endpoint('find-disposal-sites');
  const known=await api.run({latitude:39.74,longitude:-75.55,item:'Electronics'});
  assert.equal(known.status,200);assert.ok(known.body.sites.length>0);
  assert.ok(known.body.sites.every(s=>s.provider==='DSWA'));assert.match(known.body.notice,/temporarily unavailable/);
  const unknown=await api.run({latitude:39.74,longitude:-75.55,item:'Glass chemical bottle'});
  assert.equal(unknown.status,200);assert.deepEqual(unknown.body.sites,[]);assert.match(unknown.body.notice,/does not mean/);
  for(const item of ['Food Waste','Car Battery','Glass Drinkware']) {
    assert.deepEqual((await api.run({latitude:39.74,longitude:-75.55,item})).body.sites,[]);
  }
  assert.equal((await api.run({latitude:39.74,longitude:-75.55,type:'constructor'})).status,400);
});

test('label reading enforces privacy, output limits, authentication, and the shared budget',async()=>{
  const image='data:image/jpeg;base64,Zml4dHVyZQ==';
  const api=endpoint('read-label',{providerResult:{text:'Paper',materials:['x'.repeat(200),null,12],recyclingSymbols:[],guidance:'Visible label only.'}});
  const result=await api.run({image});assert.equal(result.status,200);assert.equal(result.body.materials.length,1);assert.equal(result.body.materials[0].length,80);
  assert.deepEqual(api.calls[0].body.provider,{data_collection:'deny'});assert.equal(api.calls[0].body.max_tokens,400);
  for(const [options,status] of [[{allowed:false},429],[{dbError:true},503],[{user:false},401]]) {
    const denied=endpoint('read-label',options);assert.equal((await denied.run({image})).status,status);assert.equal(denied.calls.length,0);
  }
  assert.equal((await endpoint('read-label',{providerResult:[]}).run({image})).status,503);
});
