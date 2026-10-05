import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code=ts.transpileModule(await readFile(new URL('../../../../packages/learning/dialog-queue.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('exports',code)(exports);
test('dialogs queue in order and repeated taps cannot run a second action',()=>{
  const queue=exports.createDialogQueue();let notifications=0;const unsubscribe=queue.subscribe(()=>notifications++);
  const first=queue.add('delete');const second=queue.add('success');
  assert.equal(queue.take(second),null);assert.equal(queue.get().value,'delete');
  assert.equal(queue.take(first),'delete');assert.equal(queue.take(first),null);assert.equal(queue.get().value,'success');
  assert.equal(queue.take(second),'success');assert.equal(queue.get(),null);assert.equal(notifications,4);
  unsubscribe();queue.add('later');assert.equal(notifications,4);
});
