import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
const mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('test')}}",d1Databases:["DB"],r2Buckets:["BUCKET"]});
const bindings=await mf.getBindings();
const config={...bindings,KIE_API_KEY:"test-secret-not-real",AI_ENABLED:"true",AI_USER_DAILY_CREDITS:"1000",AI_GLOBAL_DAILY_CREDITS:"2000",AI_DAILY_REQUESTS:"100",AI_COOLDOWN_SECONDS:"1"};
globalThis.__builderTestEnv=config;
for(const file of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort()){
 for(const sql of readFileSync("drizzle/"+file,"utf8").split("--> statement-breakpoint"))if(sql.trim())await bindings.DB.prepare(sql).run();
}
const bundle=await build({entryPoints:["app/builder/api/[...path]/route.ts"],bundle:true,platform:"node",format:"esm",write:false,
 plugins:[{name:"test-bindings",setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:"bindings",namespace:"test"}));b.onLoad({filter:/.*/,namespace:"test"},()=>({contents:"export const env=globalThis.__builderTestEnv;"}));}}]});
const route=await import("data:text/javascript;base64,"+Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const originalFetch=globalThis.fetch,originalNow=Date.now;
let clock=Date.now(),providerCalls=0,taskCalls=0,responseMode="ok",resultHost="file.aiquickdraw.com";
Date.now=()=>clock;
const image=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yG1sAAAAASUVORK5CYII=","base64");
let project;
globalThis.fetch=async(url,options={})=>{
 const target=String(url);
 if(target.startsWith("https://api.kie.ai")||target.startsWith("https://kieai.redpandaai.co")){
  assert.equal(options.headers.Authorization,"Bearer test-secret-not-real");
  providerCalls++;
  if(responseMode==="credit-error")return Response.json({code:402,msg:"Insufficient credits"});
  if(responseMode==="timeout")throw new DOMException("Timeout","TimeoutError");
  if(target.includes("/codex/v1/responses")){
   const payload=JSON.parse(options.body);
   assert.equal(payload.stream,false);
   const name=payload.text.format.name;
   const value=name==="page_builder_text"?{text:"Texto mejorado con Luna"}:name==="page_builder_design"?{suggestions:[{module_id:project.modules[0].id,title:"Título revisado",description:"Descripción revisada"}]}:
    {prompt:"A warm product image",alt:"Producto sobre una mesa",summary:"Luz cálida y fondo neutro",aspect_ratio:"3:2",focal_x:50,focal_y:50};
   assert.equal(payload.model,name==="page_builder_design"?"gpt-6-1-terra":"gpt-6-luna");
   return Response.json({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}],usage:{input_tokens:50,output_tokens:20},credits_consumed:.2});
  }
  if(target.includes("file-base64-upload"))return Response.json({code:200,success:true,data:{downloadUrl:"https://tempfile.redpandaai.co/reference.png"}});
  if(target.includes("createTask")){
   taskCalls++;const payload=JSON.parse(options.body);
   assert(payload.model.startsWith("gpt-image-2-5-flare-"));assert.equal(payload.input.resolution,"1K");
   return Response.json({code:200,data:{taskId:"task_"+taskCalls}});
  }
  if(target.includes("recordInfo"))return Response.json({code:200,data:{state:"success",resultJson:JSON.stringify({resultUrls:["https://"+resultHost+"/generated.png"]}),creditsConsumed:2}});
  throw new Error("Unexpected Kie request");
 }
 if(target==="https://file.aiquickdraw.com/generated.png"){
  assert(!options.headers?.Authorization,"The download must not carry the API key");
  return new Response(image,{headers:{"Content-Type":"image/png"}});
 }
 throw new Error("Blocked unexpected host in test: "+target);
};
async function call(path,{method="GET",body,user="one",id,headers={}}={}){
 const init={method,headers:{"oai-authenticated-user-id":user,"x-editor-request":"1",origin:"https://builder.test",...headers}};
 if(id)init.headers["idempotency-key"]=id;
 if(body instanceof FormData)init.body=body;
 else if(body!==undefined){init.headers["Content-Type"]="application/json";init.body=JSON.stringify(body);}
 return route[method](new Request("https://builder.test/builder/api/"+path,init),{params:Promise.resolve({path:path.split("/")})});
}
async function generate(kind,extra={},id=crypto.randomUUID()){
 clock+=5000;
 return call("projects/"+project.id+"/ai/"+kind,{method:"POST",id,body:kind==="design"?undefined:{module_id:project.modules[0].id,prompt:"Mejora esta sección",field:"description",...extra}});
}
try{
 const template=await (await call("templates/tienda")).json();
 project=await (await call("projects",{method:"POST",body:template})).json();
 const session=await (await call("session")).json();assert.equal(session.ai_enabled,true);assert(!JSON.stringify(session).includes(config.KIE_API_KEY));
 const duplicateId=crypto.randomUUID();
 const first=await generate("text",{},duplicateId);assert.equal(first.status,200);
 const completed=await first.json();assert.equal(completed.status,"completed");assert.equal(completed.result.text,"Texto mejorado con Luna");
 const calls=providerCalls;
 const retry=await generate("text",{},duplicateId);assert.equal((await retry.json()).id,duplicateId);assert.equal(providerCalls,calls);
 assert.equal((await generate("text",{prompt:"Otra instrucción"},duplicateId)).status,409);
 const design=await (await generate("design")).json();assert.equal(design.status,"completed");assert.equal(design.result.suggestions.length,1);
 const pending=await (await generate("image")).json();assert.equal(pending.status,"running");
 const ready=await (await call("operations/"+pending.id)).json();assert.equal(ready.status,"completed");assert.equal(ready.result.applied,true);assert(ready.result.image.endsWith(".png"));
 assert.equal(taskCalls,1);
 const again=await (await call("operations/"+pending.id)).json();assert.equal(again.result.revision,ready.result.revision);assert.equal(taskCalls,1);
 assert.equal((await call("operations/"+pending.id,{user:"other"})).status,404);
 project=await (await call("projects/"+project.id)).json();assert.equal(project.modules[0].content.image,ready.result.image);
 const edit=await (await generate("image",{image:ready.result.image})).json();assert.equal(edit.status,"running");assert.equal(taskCalls,2);
 // A subsequent manual image change must survive the asynchronous generation.
 const changed={...project};delete changed.id;changed.modules=structuredClone(project.modules);changed.modules[0].content.image="/static/images/studio.svg";
 assert.equal((await call("projects/"+project.id,{method:"PUT",body:changed})).status,200);
 const retained=await (await call("operations/"+edit.id)).json();assert.equal(retained.status,"completed");assert.equal(retained.result.applied,false);
 project=await (await call("projects/"+project.id)).json();
 const blocked=await (await generate("image")).json();resultHost="127.0.0.1";
 const blockedPoll=await (await call("operations/"+blocked.id)).json();assert.equal(blockedPoll.status,"running");assert(blockedPoll.result.message.includes("host"));
 resultHost="file.aiquickdraw.com";
 responseMode="credit-error";const fail=await (await generate("text")).json();assert.equal(fail.status,"failed");assert(fail.result.message.includes("Saldo"));
 responseMode="timeout";const uncertain=await (await generate("text")).json();assert.equal(uncertain.status,"uncertain");
 responseMode="ok";
 config.AI_USER_DAILY_CREDITS="1";const before=providerCalls;assert.equal((await generate("text")).status,429);assert.equal(providerCalls,before);
 config.AI_USER_DAILY_CREDITS="1000";config.AI_GLOBAL_DAILY_CREDITS="1";assert.equal((await generate("text")).status,429);
 config.AI_GLOBAL_DAILY_CREDITS="2000";
 // Two submissions sharing the same id reserve and submit at most once.
 const simultaneousId=crypto.randomUUID(),initialCalls=providerCalls;clock+=5000;
 const body={module_id:project.modules[0].id,prompt:"Hazlo más claro",field:"description"};
 const concurrent=await Promise.all([call("projects/"+project.id+"/ai/text",{method:"POST",id:simultaneousId,body}),call("projects/"+project.id+"/ai/text",{method:"POST",id:simultaneousId,body})]);
 assert(concurrent.every(r=>r.status===200));assert.equal(providerCalls,initialCalls+1);
 const usage=await (await call("usage")).json();assert(usage.used>0);assert.equal(usage.limit,1000);
 config.AI_ENABLED="false";assert.equal((await generate("text")).status,503);
 console.log("PASS — Luna, Terra, image generation/editing, task polling, HTTP-200 provider errors, timeouts, quota enforcement, idempotency, concurrent submissions, owner isolation, restricted downloads, and newer edits preserved. All provider responses simulated.");
}finally{Date.now=originalNow;globalThis.fetch=originalFetch;await mf.dispose();}
