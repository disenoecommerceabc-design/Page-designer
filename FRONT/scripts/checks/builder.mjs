import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { unzipSync, strFromU8 } from "fflate";
const mf=new Miniflare({
 modules:true, script:"export default {fetch(){return new Response('test')}}",
 d1Databases:["DB"],r2Buckets:["BUCKET"]
});
const bindings=await mf.getBindings();
globalThis.__builderTestEnv=bindings;
for(const file of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort()){
 for(const sql of readFileSync("drizzle/"+file,"utf8").split("--> statement-breakpoint")){
  if(sql.trim())await bindings.DB.prepare(sql).run();
 }
}
const bundle=await build({
 entryPoints:["app/builder/api/[...path]/route.ts"],bundle:true,platform:"node",format:"esm",write:false,
 plugins:[{name:"test-bindings",setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:"bindings",namespace:"test"}));build.onLoad({filter:/.*/,namespace:"test"},()=>({contents:"export const env=globalThis.__builderTestEnv;"}));}}]
});
const route=await import("data:text/javascript;base64,"+Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const base="https://builder.test";
async function call(path,{method="GET",body,user="one",headers={}}={}){
 const init={method,headers:{"oai-authenticated-user-id":user,"x-editor-request":"1",origin:base,...headers}};
 if(body instanceof FormData)init.body=body;
 else if(body!==undefined){init.body=JSON.stringify(body);init.headers["Content-Type"]="application/json";}
 return route[method](new Request(base+"/builder/api/"+path,init),{params:Promise.resolve({path:path.split("/")})});
}
try{
 assert.equal((await (await call("catalog")).json()).modules.length,9);
 for(const name of ["tienda","servicios","suscripciones"]){
  const p=await (await call("templates/"+name)).json();
  const created=await call("projects",{method:"POST",body:p});assert.equal(created.status,201);
  const saved=await created.json(),id=saved.id;delete saved.id;
  assert.equal((await call("projects/"+id,{user:"two"})).status,404);
  const updated=await call("projects/"+id,{method:"PUT",body:saved});assert.equal(updated.status,200);
  assert.equal((await call("projects/"+id,{method:"PUT",body:saved})).status,409);
  const review=await (await call("projects/"+id+"/review",{method:"POST"})).json();assert.equal(review.valid,true);
  const preview=await (await call("projects/"+id+"/preview")).text();assert(preview.includes("site-section"));
  const exported=await call("projects/"+id+"/export");assert.equal(exported.status,200);
  const zip=unzipSync(new Uint8Array(await exported.arrayBuffer()));
  assert(zip["index.html"]&&zip["project.json"]&&zip["site.css"]&&zip["site.js"]&&zip["images/product.svg"]);
  assert(!strFromU8(zip["index.html"]).includes('href="/static/site.css"'));
  const invalid=structuredClone(saved);invalid.modules[0].content.url="javascript:alert(1)";
  assert.equal((await call("render",{method:"POST",body:invalid})).status,422);
  const escaped=structuredClone(saved);escaped.modules[0].content.title="<script>alert(1)</script>";
  const safe=await (await call("render",{method:"POST",body:escaped})).text();
  assert(safe.includes("&lt;script&gt;")&&!safe.includes("<script>alert(1)"));
  const foreign=structuredClone(saved);foreign.modules[0].content.image="/assets/"+"a".repeat(32)+".png";
  assert.equal((await call("projects",{method:"POST",body:foreign})).status,403);
 }
 assert.equal((await call("projects",{method:"POST",body:{},headers:{origin:"https://other.test"}})).status,403);
 assert.equal((await call("render",{method:"POST",body:{font:"bad-font"}})).status,422);
 const form=new FormData();
 form.set("file",new File([Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yG1sAAAAASUVORK5CYII=","base64"))],"test.png",{type:"image/png"}));
 const uploaded=await call("assets",{method:"POST",body:form});assert.equal(uploaded.status,200);
 const url=(await uploaded.json()).url;
 const withImage=await (await call("templates/tienda")).json();withImage.modules[0].content.image=url;
 const record=await (await call("projects",{method:"POST",body:withImage})).json();
 assert.equal((await call("projects",{method:"POST",body:withImage,user:"two"})).status,403);
 const downloaded=await call("projects/"+record.id+"/export");assert.equal(downloaded.status,200);
 const files=unzipSync(new Uint8Array(await downloaded.arrayBuffer()));assert(files[url.slice(1)]);
 assert.equal((await call("projects/"+record.id+"/ai/text",{method:"POST",body:{}})).status,503);
 // An anonymous session gets an opaque, expiring cookie, rather than a shared workspace.
 const session=await route.GET(new Request(base+"/builder/api/session"),{params:Promise.resolve({path:["session"]})});
 assert.equal(session.status,200);assert(session.headers.get("set-cookie").includes("HttpOnly"));
 console.log("PASS — templates, rendering, persistence, optimistic concurrency, owner isolation, asset export, input validation, disabled AI, and browser sessions");
}finally{await mf.dispose();}
