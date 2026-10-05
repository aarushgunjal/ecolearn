import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const code=ts.transpileModule(await readFile(new URL('../../supabase/functions/sync-delaware-recyclopedia/index.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function syncWorker({known=false,detailFails=false}={}) {
  let handler; const writes=[]; const fetches=[];
  const topics=Array.from({length:463},(_,i)=>({topic_id:i+1,topic:`Item ${i+1}`,seo_name:`item-${i+1}`,updated_at:'2026-10-01'}));
  const db={from:table=>{let value,action;const chain={insert:v=>{value=v;action='insert';return chain;},update:v=>{value=v;action='update';return chain;},upsert:v=>{value=v;action='upsert';return chain;},select:()=>chain,in:()=>chain,eq:()=>chain,single:()=>Promise.resolve({data:{id:1},error:null}),then:resolve=>{if(action)writes.push({table,value,action});return Promise.resolve({data:known?topics.map(t=>({source_topic_id:t.topic_id,source_updated_at:t.updated_at})):[],error:null}).then(resolve);}};return chain;}};
  const require=name=>name.includes('supabase')?{createClient:()=>db}:name.includes('server')?{serve:fn=>{handler=fn;}}:{DNREC_API_BASE:'https://official.test',DNREC_RECYLOPEDIA_URL:'https://dnrec.delaware.gov',normalizeDnrecText:s=>s.toLowerCase(),stripHtml:s=>s};
  new Function('exports','require','Deno','fetch',code)({},require,{env:{get:()=> 'test-secret'}},async url=>{
    fetches.push(url);if(url.includes('/topic?'))return Response.json({data:topics});
    if(detailFails)return new Response('unavailable',{status:503});
    const id=Number(url.match(/topic\/(\d+)/)[1]);return Response.json({...topics[id-1],content_body:'Official record.'});
  });
  return {writes,fetches,run:async(offset)=>{const r=await handler(new Request('https://test.invalid/sync',{method:'POST',headers:{'Content-Type':'application/json','x-dnrec-sync-secret':'test-secret'},body:JSON.stringify({offset})}));return {status:r.status,body:await r.json()};}};
}
test('DNREC refresh batches reach every topic, including the final page',async()=>{
 const worker=syncWorker(); let offset=0; const ids=[];
 do {const {body,status}=await worker.run(offset);assert.equal(status,200);assert.ok(body.topicsSeen<=32);offset=body.nextOffset;} while(offset!==null);
 for(const write of worker.writes.filter(w=>w.action==='upsert'))ids.push(...write.value.map(r=>r.source_topic_id));
 assert.equal(new Set(ids).size,463);assert.ok(ids.includes(463));
});
test('unchanged records become fresh without downloading their details',async()=>{
 const worker=syncWorker({known:true});const {body}=await worker.run(0);assert.equal(body.skipped,32);assert.equal(worker.fetches.length,1);
 assert.ok(worker.writes.some(w=>w.table==='delaware_guidance_items'&&w.value.synced_at));
});
test('failed details remain visible and malformed offsets are rejected',async()=>{
 const worker=syncWorker({detailFails:true});const {body}=await worker.run(0);assert.ok(body.errors.length>0);assert.equal(body.updated,0);assert.equal(worker.writes.filter(w=>w.action==='upsert').length,0);
 assert.equal((await worker.run(-1)).status,400);
});
