import { aiAllowed, settings } from "../../../../lib/builder/kie";
import { generate, poll, usage, listOperations } from "../../../../lib/builder/ai";
import { zipSync, strToU8 } from "fflate";
import catalog from "../../../../lib/builder/catalog.json";
import { projectSchema, fonts } from "../../../../lib/builder/schema";
import { render, review } from "../../../../lib/builder/render";
import { resources } from "../../../../lib/builder/resources";
import { secondary, contrast, ink } from "../../../../lib/builder/colors";
import { ApiError, database, bucket, owner, createSession, readProject, validateAssets } from "../../../../lib/builder/store";
type Context={params:Promise<{path:string[]}>};
const json=(data:unknown,status=200,extra:Record<string,string>={})=>Response.json(data,{status,headers:{"Cache-Control":"no-store",...extra}});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function newProject(template:string){
 const t=catalog.TEMPLATES.find(t=>t.id===template);
 if(!t)throw new ApiError(404,"Plantilla no encontrada.");
 const defaults=catalog.DEFAULTS as Record<string,unknown>;
 const p=projectSchema.parse({name:"Mi web · "+t.name,template,accent:t.color,modules:t.modules.map(kind=>({id:"m-"+crypto.randomUUID().replaceAll("-","").slice(0,12),kind,content:structuredClone(defaults[kind])}))});
 if(template==="servicios"){p.business.name="Estudio Norte";p.business.industry="Diseño y servicios creativos";Object.assign(p.modules[0].content,{title:"Buenas ideas.\nResultados que se ven.",eyebrow:"UN ESTUDIO PARA TU NEGOCIO",description:"Transformamos tus desafíos en soluciones claras. Un equipo cercano para llevar tu próximo proyecto más lejos.",button:"Conoce nuestros servicios",url:"#servicios",image:"/static/images/studio.svg"});}
 if(template==="suscripciones"){p.business.name="Impulso";p.business.industry="Herramientas para crecer";Object.assign(p.modules[0].content,{title:"Tu siguiente nivel\nempieza hoy.",eyebrow:"MÁS POSIBILIDADES, MENOS LÍMITES",description:"Un espacio para aprender, crear y hacer crecer tus ideas. Elige tu plan y avanza a tu ritmo.",button:"Ver los planes",url:"#planes",image:"/static/images/desk.svg"});}
 return p;
}
async function body(request:Request){
 const raw=await request.text();
 if(raw.length>300000)throw new ApiError(413,"El diseño supera el tamaño permitido.");
 try{return JSON.parse(raw);}catch{throw new ApiError(400,"El diseño JSON no es válido.");}
}
async function upload(request:Request,user:string,isFont:boolean){
 const form=await request.formData();
 const file=form.get("file");
 if(!(file instanceof File))throw new ApiError(422,"Selecciona un archivo.");
 const max=isFont?2*1024*1024:8*1024*1024;
 if(file.size>max||file.size<12)throw new ApiError(413,isFont?"La fuente debe tener menos de 2 MB.":"La imagen debe tener menos de 8 MB.");
 const bytes=new Uint8Array(await file.arrayBuffer());
 let extension="",mime="";
 if(isFont){
  const magic=String.fromCharCode(...bytes.slice(0,4));
  if(magic==="wOF2"){extension="woff2";mime="font/woff2";}
  else if(magic==="wOFF"){extension="woff";mime="font/woff";}
  else if(magic==="OTTO"){extension="otf";mime="font/otf";}
  else if(bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0){extension="ttf";mime="font/ttf";}
  if(!extension)throw new ApiError(422,"Fuente inválida. Usa TTF, OTF, WOFF o WOFF2.");
  const view=new DataView(bytes.buffer);
  const compressed=magic==="wOFF"||magic==="wOF2";
  if(compressed&& (bytes.length<48||view.getUint32(8)!==bytes.length||view.getUint16(12)<1||view.getUint16(12)>128))throw new ApiError(422,"Fuente inválida.");
  if(!compressed){
   const count=view.getUint16(4);
   if(count<1||count>128||12+count*16>bytes.length)throw new ApiError(422,"Fuente inválida.");
   const tags:string[]=[];
   for(let i=0;i<count;i++){const start=12+i*16;tags.push(String.fromCharCode(...bytes.slice(start,start+4)));if(view.getUint32(start+8)+view.getUint32(start+12)>bytes.length)throw new ApiError(422,"Fuente incompleta.");}
   if(tags.includes("SVG ")||!["name","head","cmap","maxp"].every(tag=>tags.includes(tag)))throw new ApiError(422,"Usa una fuente estándar sin gráficos SVG incrustados.");
  }
 }else{
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47){extension="png";mime="image/png";}
  else if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff){extension="jpg";mime="image/jpeg";}
  else if(String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"){extension="webp";mime="image/webp";}
  if(!extension)throw new ApiError(422,"Usa una imagen PNG, JPEG o WebP.");
 }
 const id=crypto.randomUUID().replaceAll("-",""),filename=id+"."+extension;
 const count=await database().prepare("SELECT COUNT(*) AS total FROM builder_assets WHERE owner=?").bind(user).first<{total:number}>();
 if((count?.total??0)>=200)throw new ApiError(429,"Alcanzaste el cupo de 200 archivos de este prototipo.");
 await bucket().put(user+"/"+filename,bytes,{httpMetadata:{contentType:mime}});
 try{await database().prepare("INSERT INTO builder_assets (filename,owner,mime,name) VALUES (?,?,?,?)").bind(filename,user,mime,file.name.slice(0,100)).run();}
 catch(error){await bucket().delete(user+"/"+filename);throw error;}
 return isFont?json({value:"upload:"+id,name:file.name.slice(0,100)}):json({url:"/assets/"+filename});
}
async function handle(request:Request,context:Context){
 try{
  const path=(await context.params).path;
  const key=path.join("/"),method=request.method;
  if(["POST","PUT","DELETE","PATCH"].includes(method)){
   const origin=request.headers.get("origin");
   if(request.headers.get("x-editor-request")!=="1"||(origin&&origin!==new URL(request.url).origin))throw new ApiError(403,"Origen no permitido.");
   if(Number(request.headers.get("content-length")||0)>9*1024*1024)throw new ApiError(413,"Archivo demasiado grande.");
  }
  if(key==="session"&&method==="GET"){
   const session=await createSession(request);
   return json({authenticated:true,local:true,registration_enabled:false,ai_enabled:aiAllowed(session.owner),models:{text:settings().text,design:settings().design,image:"GPT Image 2.5 "+settings().variant,image_director:settings().text}},200,session.cookie?{"Set-Cookie":session.cookie}:{});
  }
  const user=await owner(request);
  if(!user)throw new ApiError(401,"Abre el editor para iniciar tu espacio.");
  if(key==="catalog"&&method==="GET")return json({modules:catalog.CATALOG,defaults:catalog.DEFAULTS,templates:catalog.TEMPLATES});
  if(path[0]==="templates"&&path.length===2&&method==="GET")return json(newProject(path[1]));
  if(key==="usage"&&method==="GET")return json(await usage(user));
  if(key==="operations"&&method==="GET")return json(await listOperations(user));
  if(path[0]==="operations"&&path.length===2&&uuid.test(path[1])&&method==="GET")return json(await poll(path[1],user));
  if(path[0]==="projects"&&path.length===4&&uuid.test(path[1])&&path[2]==="ai"&&method==="POST"){
   const data=path[3]==="design"?null:await body(request);
   return json(await generate(request,user,path[1],path[3],data));
  }
  if(key==="fonts"&&method==="GET"){
   const records=await database().prepare("SELECT filename,name FROM builder_assets WHERE owner=? AND mime LIKE 'font/%' ORDER BY name").bind(user).all<{filename:string;name:string}>();
   return json({google:fonts,uploads:records.results.map(row=>({value:"upload:"+row.filename.split(".")[0],name:row.name}))});
  }
  if(key==="palettes"&&method==="GET"){
   const primary=new URL(request.url).searchParams.get("primary")||"#356657";
   if(!/^#[a-fA-F0-9]{6}$/.test(primary))throw new ApiError(422,"Color inválido.");
   return json(["complementary","analogous","triadic","monochrome"].map(harmony=>({harmony,secondary:secondary(primary,harmony),primary,contrast:Number(contrast(primary,ink(primary)).toFixed(2))})));
  }
  if((key==="assets"||key==="fonts")&&method==="POST")return upload(request,user,key==="fonts");
  if(key==="render"&&method==="POST"){
   const parsed=projectSchema.safeParse(await body(request));
   if(!parsed.success)throw new ApiError(422,parsed.error.issues.map(i=>i.path.join(".")+": "+i.message).join("\n"));
   await validateAssets(parsed.data,user);
   return new Response(render(parsed.data,true),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  }
  if(key==="projects"){
   if(method==="GET"){
    const rows=await database().prepare("SELECT id,document,updated FROM builder_projects WHERE owner=? ORDER BY updated DESC LIMIT 100").bind(user).all<{id:string;document:string;updated:number}>();
    return json(rows.results.map(row=>({id:row.id,name:JSON.parse(row.document).name,updated:row.updated})));
   }
   if(method==="POST"){
    const parsed=projectSchema.safeParse(await body(request));
    if(!parsed.success)throw new ApiError(422,parsed.error.issues.map(i=>i.path.join(".")+": "+i.message).join("\n"));
    const p=parsed.data;await validateAssets(p,user);
    p.revision=1;const id=crypto.randomUUID();
    const result=await database().prepare("INSERT INTO builder_projects (id,owner,document,revision,updated) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM builder_projects WHERE owner=?)<100").bind(id,user,JSON.stringify(p),1,Date.now()/1000,user).run();
    if(!result.meta.changes)throw new ApiError(429,"Alcanzaste el límite de 100 proyectos del prototipo.");
    return json({id,...p},201);
   }
  }
  if(path[0]==="projects"&&uuid.test(path[1])){
   const id=path[1];
   const document=await readProject(id,user);
   const p=projectSchema.parse(document);
   if(path.length===2){
    if(method==="GET")return json({id,...p});
    if(method==="PUT"){
     const result=projectSchema.safeParse(await body(request));
     if(!result.success)throw new ApiError(422,result.error.issues.map(i=>i.path.join(".")+": "+i.message).join("\n"));
     const next=result.data;await validateAssets(next,user);
     const previous=next.revision;next.revision++;
     const saved=await database().prepare("UPDATE builder_projects SET document=?,revision=?,updated=? WHERE id=? AND owner=? AND revision=?").bind(JSON.stringify(next),next.revision,Date.now()/1000,id,user,previous).run();
     if(!saved.meta.changes)throw new ApiError(409,"Hay una versión más reciente. Recarga el proyecto antes de guardar.");
     return json({id,...next});
    }
   }
   if(path[2]==="preview"&&method==="GET")return new Response(render(p,false,true),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'none'"}});
   if(path[2]==="review"&&method==="POST"){await validateAssets(p,user);return json(review(p));}
   if(path[2]==="export"&&method==="GET"){
    await validateAssets(p,user);const result=review(p);
    if(!result.valid)return json({detail:{message:"Corrige los enlaces antes de exportar.",review:result}},422);
    let html=render(p,false,true).replaceAll("/static/site.css","site.css").replaceAll("/static/site.js","site.js").replaceAll("/static/images/","images/").replaceAll("/assets/","assets/");
    const files:Record<string,Uint8Array>={};
    for(const [name,content] of Object.entries(resources))files[name]=strToU8(content);
    const names=new Set<string>();
    for(const m of p.modules)for(const item of [m.content,...m.content.items])if(item.image.startsWith("/assets/"))names.add(item.image.slice(8));
    if(p.font.startsWith("upload:")){
     const font=await database().prepare("SELECT filename FROM builder_assets WHERE owner=? AND filename LIKE ? AND mime LIKE 'font/%'").bind(user,p.font.slice(7)+".%").first<{filename:string}>();
     if(!font)throw new ApiError(422,"Fuente no disponible.");
     names.add(font.filename);html=html.replaceAll("/fonts/"+p.font.slice(7),"fonts/"+font.filename);
    }
    let exportBytes=0;
    for(const name of names){
     const file=await bucket().get(user+"/"+name);if(!file)throw new ApiError(422,"Un archivo del proyecto no está disponible.");
     exportBytes+=file.size;
     if(exportBytes>24*1024*1024)throw new ApiError(413,"Los recursos superan 24 MB. Reduce el peso de las imágenes antes de exportar.");
     files[(name.match(/\.(woff2?|ttf|otf)$/)?"fonts/":"assets/")+name]=new Uint8Array(await file.arrayBuffer());
    }
    files["index.html"]=strToU8(html);files["project.json"]=strToU8(JSON.stringify(p,null,2));
    files["LEEME.txt"]=strToU8("Abre index.html o sube el contenido a tu hosting. Incluye HTML, CSS, JavaScript, recursos y project.json para reimportar. Al reimportar en otra cuenta, vuelve a subir tus imágenes y fuentes. Los productos y planes enlazan al contacto y no incluyen pagos ni gestión de pedidos. Las fuentes de Google requieren internet.");
    const zip=zipSync(files,{level:6});
    return new Response(zip as unknown as BodyInit,{headers:{"Content-Type":"application/zip","Content-Disposition":'attachment; filename="page-builder-sitio.zip"',"Cache-Control":"no-store"}});
   }
  }
  throw new ApiError(404,"Ruta no encontrada.");
 }catch(error){
  if(error instanceof ApiError)return json({detail:error.message},error.status);
  console.error("Builder request failed",error instanceof Error?error.name:"unknown");
  return json({detail:"No pudimos completar la operación. Intenta de nuevo."},503);
 }
}
export const GET=handle;
export const POST=handle;
export const PUT=handle;
