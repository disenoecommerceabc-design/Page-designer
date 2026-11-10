import { env } from "cloudflare:workers";
export function database(){if(!env.DB)throw new Error("Base de datos no disponible.");return env.DB;}
export function bucket(){if(!env.BUCKET)throw new Error("Almacenamiento no disponible.");return env.BUCKET;}
export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,"0")).join("");
export async function owner(request:Request){
 const user=request.headers.get("oai-authenticated-user-id");
 if(user)return "chatgpt:"+user;
 const token=request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith("pb_workspace="))?.slice(13);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await database().prepare("SELECT owner FROM builder_sessions WHERE token_hash=? AND expires>?").bind(await hash(token),Date.now()).first<{owner:string}>();
 return row?.owner??null;
}
export async function createSession(request:Request){
 const existing=await owner(request);if(existing)return {owner:existing,cookie:null};
 const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
 const id="guest:"+crypto.randomUUID();
 await database().prepare("INSERT INTO builder_sessions (token_hash,owner,expires) VALUES (?,?,?)").bind(await hash(token),id,Date.now()+30*86400000).run();
 await database().prepare("DELETE FROM builder_sessions WHERE expires<?").bind(Date.now()).run();
 const secure=new URL(request.url).protocol==="https:"?"; Secure":"";
 return {owner:id,cookie:`pb_workspace=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`};
}
export async function readProject(id:string,user:string){
 const row=await database().prepare("SELECT document FROM builder_projects WHERE id=? AND owner=?").bind(id,user).first<{document:string}>();
 if(!row)throw new ApiError(404,"Proyecto no encontrado.");
 return JSON.parse(row.document);
}
export async function validateAssets(p:import("./schema").Project,user:string){
 const images=new Set<string>();
 for(const m of p.modules)for(const item of [m.content,...m.content.items])if(item.image.startsWith("/assets/"))images.add(item.image.slice(8));
 if(p.font.startsWith("upload:")){
  const font=await database().prepare("SELECT filename FROM builder_assets WHERE owner=? AND filename LIKE ? AND mime LIKE 'font/%'").bind(user,p.font.slice(7)+".%").first();
  if(!font)throw new ApiError(403,"Selecciona una fuente de tu espacio.");
 }
 for(const name of images){
  const record=await database().prepare("SELECT filename FROM builder_assets WHERE filename=? AND owner=?").bind(name,user).first();
  if(!record)throw new ApiError(403,"Selecciona imágenes y fuentes de tu espacio. Al importar un JSON vuelve a subir sus recursos.");
 }
}
export async function resourceFile(request:Request,name:string,font=false){
 if(!new RegExp(font?"^[a-f0-9]{32}$":"^[a-f0-9]{32}\\.(webp|png|jpg)$").test(name))return new Response("No encontrado",{status:404});
 const user=await owner(request);if(!user)return new Response("Inicia sesión",{status:401});
 const row=font
  ?await database().prepare("SELECT filename,mime FROM builder_assets WHERE owner=? AND filename LIKE ? AND mime LIKE 'font/%'").bind(user,name+".%").first<{filename:string;mime:string}>()
  :await database().prepare("SELECT filename,mime FROM builder_assets WHERE filename=? AND owner=?").bind(name,user).first<{filename:string;mime:string}>();
 if(!row)return new Response("No encontrado",{status:404});
 const object=await bucket().get(user+"/"+row.filename);
 if(!object)return new Response("No encontrado",{status:404});
 return new Response(object.body,{headers:{"Content-Type":row.mime,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}});
}
