import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
test("project has no legacy provider or brand strings", async()=>{
 const result=await new Promise((resolve)=>{const p=spawn(process.execPath,["scripts/brand-check.mjs"],{stdio:["ignore","pipe","pipe"]});let stdout="",stderr="";p.stdout.on("data",x=>stdout+=x);p.stderr.on("data",x=>stderr+=x);p.on("close",code=>resolve({code,stdout,stderr}));});
 assert.equal(result.code,0,String(result.stderr));
});
