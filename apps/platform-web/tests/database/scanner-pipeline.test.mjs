import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = async path => ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const sharedCode = await compile('../../supabase/functions/_shared/dnrec.ts');
const edgeCode = await compile('../../supabase/functions/explain-scan/index.ts');
const row = (title,id=1) => ({title,source_topic_id:id,seo_name:title.toLowerCase().replaceAll(' ','-'),content_text:'Official instructions only.',tags:[],synonyms:[],search_terms:[],source_url:'https://dnrec.delaware.gov/waste-hazardous/recycling/what/',source_updated_at:null,synced_at:new Date().toISOString()});
function scanner(parsed, rows, { user=true, privacyBlocked=false }={}) {
  let handler; const requests=[]; const writes=[];
  const fetcher=async (url,init)=>{requests.push({url,body:init?.body?JSON.parse(init.body):null});
    if(url.includes('openrouter') && privacyBlocked) return Response.json({error:{message:'No endpoints found matching your data policy'}},{status:404});
    if(url.includes('openrouter'))return Response.json({choices:[{message:{content:JSON.stringify(parsed)}}]});
    throw new Error('Unexpected live request');
  };
  const dnrec={}; new Function('exports','fetch',sharedCode)(dnrec,fetcher);
  const db={auth:{getUser:async()=>({data:{user:user?{id:'test-user'}:null}})},from:table=>{
    const chain={select:()=>chain,eq:()=>chain,gte:()=>chain,in:(_,titles)=>Promise.resolve({data:rows.filter(r=>titles.includes(r.title)),error:null}),insert:value=>{writes.push({table,value});return Promise.resolve({error:null});},then:resolve=>Promise.resolve({data:table==='delaware_guidance_items'?rows:[],count:0,error:null}).then(resolve)};return chain;
  }};
  const require=name=>name.includes('dnrec')?dnrec:name.includes('analytics')?{recordItemInteraction:async()=>{}}:name.includes('supabase')?{createClient:()=>db}:{serve:fn=>{handler=fn;}};
  new Function('exports','require','Deno','fetch',edgeCode)({},require,{env:{get:key=>({SUPABASE_URL:'https://test.invalid',OPENROUTER_API_KEY:'fixture',OPENROUTER_EXPLAIN_MODEL:'fixture-model'}[key])}},fetcher);
  return {requests,writes,run:async()=>{const response=await handler(new Request('https://test.invalid/scan',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({image:'data:image/jpeg;base64,Zml4dHVyZQ=='})}));return {status:response.status,body:await response.json()};}};
}
const identity={image_status:'single_item',observed_item:'BrandCo food tin',object_class:'food can',catalog_query:'food tin',material:'metal',confidence:0.95,possible_hazard:'none',visible_evidence:'One metal food tin.',equivalent_names:['pet food cans'],related_categories:['Metal'],clarification:null};
test('one model request identifies, classifies, and batches variants without a redundant live call',async()=>{
  const s=scanner(identity,[row('Pet food cans')]);const result=await s.run();
  assert.equal(result.body.verified,true);assert.equal(result.body.observedItem,identity.observed_item);assert.equal(result.body.objectClass,'food can');
  assert.equal(result.body.guidance.title,'Pet food cans');assert.equal(result.body.guidance.instructions,'Official instructions only.');assert.equal(s.requests.length,1);assert.equal(s.requests[0].body.provider.data_collection,'deny');
  assert.equal(s.writes.filter(w=>w.table==='ai_request_log').length,1);
  const prompt=s.requests[0].body.messages[0].content; assert.match(prompt,/equivalent_names/);assert.match(prompt,/untrusted/);
});
test('conflicting model variants ask the user instead of inventing a verified result',async()=>{
  const s=scanner({...identity,catalog_query:'glass vessel',observed_item:'glass vessel',material:'glass',equivalent_names:['glass bottles','glass drinkware']},[row('Glass Bottles'),row('Glass Drinkware',2)]);
  const {body}=await s.run();assert.equal(body.verified,false);assert.equal(body.guidance,null);assert.equal(body.candidates.length,2);
});
test('a missing safety detail prevents verification even when an official synonym matches exactly',async()=>{
  const s=scanner({...identity,observed_item:'Deodorant aerosol can',catalog_query:'aerosol can',possible_hazard:'chemical',equivalent_names:['deodorant aerosol cans']},[{...row('Aerosol Cans - Empty'),synonyms:[{synonym:'deodorant aerosol cans'}]}]);
  const {body}=await s.run();assert.equal(body.verified,false);assert.match(body.clarification,/empty/);assert.equal(body.needsAdultHelp,true);assert.ok(body.nextSteps.some(step=>step.includes('grown-up')));
});
test('broad categories remain official, attributed, and unverified',async()=>{
  const s=scanner({...identity,observed_item:'Acme wearable tracker',catalog_query:'fitness tracker',equivalent_names:['activity tracker'],related_categories:['Electronics','Imaginary advice'],possible_hazard:'electronics'},[row('Electronics')]);
  const {body}=await s.run();assert.equal(body.verified,false);assert.deepEqual(body.categoryGuidance.map(g=>g.title),['Electronics']);assert.equal(body.categoryGuidance[0].matchConfidence,0);
});
test('unclear photos and malformed model output cannot become verified matches',async()=>{
  for(const parsed of [null,[],{...identity,image_status:'multiple_items'},{...identity,confidence:0.2}]) {
    const {body,status}=await scanner(parsed,[row('Pet food cans')]).run();
    if(parsed===null||Array.isArray(parsed)) assert.equal(status,502); else assert.equal(body.verified,false);
  }
});
test('authentication rejects a request before contacting the model',async()=>{
  const s=scanner(identity,[row('Pet food cans')],{user:false});assert.equal((await s.run()).status,401);assert.equal(s.requests.length,0);
});
test('concurrent live lookups share catalog and detail requests; failures can retry',async()=>{
  let listingCalls=0,detailCalls=0,fail=true;
  const topic={topic_id:77,topic:'Glass Bottles',seo_name:'glass-bottles',content_body:'<p>Official instructions.</p>'};
  const fetcher=async url=>{
    if(url.includes('/topic?')){listingCalls++;return Response.json({data:[topic]});}
    detailCalls++;if(fail)return new Response('Unavailable',{status:503});return Response.json(topic);
  };
  const dnrec={};new Function('exports','fetch',sharedCode)(dnrec,fetcher);
  await assert.rejects(()=>dnrec.findLiveDelawareGuidance('Glass bottles'));
  fail=false;
  const found=await Promise.all([dnrec.findLiveDelawareGuidance('Glass bottles'),dnrec.findLiveDelawareGuidance('Glass bottles')]);
  assert.equal(listingCalls,1);assert.equal(detailCalls,2);assert.ok(found.every(f=>f.match.row.content_text==='Official instructions.'));
});

test('privacy-incompatible providers fail safely with a usable text-search alternative',async()=>{
 const {status,body}=await scanner(identity,[row('Pet food cans')],{privacyBlocked:true}).run();
 assert.equal(status,503);assert.equal(body.code,'AI_PRIVACY_MODEL_UNAVAILABLE');assert.match(body.error,/Search by item name/);
});
