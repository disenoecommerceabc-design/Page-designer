import { env } from "cloudflare:workers";
import { z } from "zod";
import { ApiError, bucket, database } from "./store";
export const costs = { text: 1, design: 3, image: 10 };
export function positive(value:string|undefined,fallback:number,max=100000){
 const number=Number(value);
 return Number.isInteger(number)&&number>0&&number<=max?number:fallback;
}
export function settings(){
 const variant=env.KIE_IMAGE_VARIANT==="sunburst"?"sunburst":"flare";
 return {
  enabled:env.AI_ENABLED==="true"&&!!env.KIE_API_KEY?.trim(),
  text:env.KIE_TEXT_MODEL||"gpt-6-luna",
  design:env.KIE_DESIGN_MODEL||"gpt-6-1-terra",
  variant,
  resolution:env.KIE_IMAGE_RESOLUTION==="2K"?"2K":"1K",
  daily:positive(env.AI_USER_DAILY_CREDITS,30),
  global:positive(env.AI_GLOBAL_DAILY_CREDITS,100),
  requests:positive(env.AI_DAILY_REQUESTS,20,1000),
  cooldown:positive(env.AI_COOLDOWN_SECONDS,5,3600)
 };
}
export function aiAllowed(user:string){return settings().enabled&&(user.startsWith("chatgpt:")||env.AI_ALLOW_GUESTS==="true");}
export function object(value:unknown):Record<string,unknown>{
 return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
export class ProviderFailure extends Error {
 constructor(public definite:boolean,message:string){super(message);}
}
export async function kieRequest(path:string,body?:unknown,upload=false){
 const url=upload?"https://kieai.redpandaai.co/api/file-base64-upload":"https://api.kie.ai"+path;
 const response=await fetch(url,{
  method:body===undefined?"GET":"POST",
  headers:{Authorization:"Bearer "+env.KIE_API_KEY,"Content-Type":"application/json"},
  body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(90000),
  redirect:"error"
 });
 const raw=await response.text();
 if(raw.length>2*1024*1024)throw new ProviderFailure(false,"La respuesta del proveedor supera el tamaño permitido.");
 let result:Record<string,unknown>;
 try{result=object(JSON.parse(raw));}catch{throw new ProviderFailure(false,"El proveedor devolvió una respuesta que no pudimos interpretar.");}
 const code=typeof result.code==="number"?result.code:response.status;
 if(!response.ok||code!==200||result.error||result.success===false){
  const definite=[400,401,402,403,422,429].includes(code);
  throw new ProviderFailure(definite,code===402?"Saldo insuficiente en Kie.ai.":code===401?"Revisa la configuración de acceso de Kie.ai.":code===429?"Kie.ai ha limitado temporalmente las solicitudes.":"Kie.ai no pudo completar la solicitud. Revisa la actividad antes de reintentar.");
 }
 return result;
}
export async function responseJson(model:string,instructions:string,input:unknown,schema:Record<string,unknown>,name:string,imageData?:string){
 const content:Record<string,unknown>[]=[{type:"input_text",text:JSON.stringify(input)}];
 if(imageData)content.push({type:"input_image",image_url:imageData});
 const result=await kieRequest("/codex/v1/responses",{
  model,stream:false,reasoning:{effort:"high"},
  input:[{role:"developer",content:[{type:"input_text",text:instructions}]},{role:"user",content}],
  text:{format:{type:"json_schema",name,strict:true,schema}},
  max_output_tokens:6000
 });
 if(result.status!=="completed")throw new ProviderFailure(false,"La generación no se completó. Revisa la actividad antes de reintentar.");
 const output=Array.isArray(result.output)?result.output:[];
 const text=output.flatMap(item=>{
  const message=object(item);return message.type==="message"&&Array.isArray(message.content)?message.content:[];
 }).filter(item=>object(item).type==="output_text").map(item=>object(item).text).filter(value=>typeof value==="string").join("");
 if(!text)throw new ProviderFailure(false,"El modelo no devolvió una propuesta de texto.");
 let value:unknown;
 try{value=JSON.parse(text);}catch{throw new ProviderFailure(false,"El modelo no devolvió el formato esperado.");}
 const usage=object(result.usage);
 return {value,metrics:{input:positive(String(usage.input_tokens),0,10000000),output:positive(String(usage.output_tokens),0,10000000),credits:typeof result.credits_consumed==="number"?String(result.credits_consumed):"0"}};
}
export function safeAssetUrl(raw:string){
 let url:URL;
 try{url=new URL(raw);}catch{throw new ApiError(502,"El proveedor devolvió una URL de imagen inválida.");}
 const allowed=(env.KIE_ASSET_HOSTS||"file.aiquickdraw.com,static.aiquickdraw.com,tempfile.redpandaai.co").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(url.protocol!=="https:"||url.username||url.password||(url.port&&url.port!=="443")||!allowed.includes(url.hostname.toLowerCase()))throw new ApiError(502,"El host de imagen del proveedor no está autorizado. Revisa KIE_ASSET_HOSTS.");
 return url.href;
}
export async function referenceImage(path:string,user:string){
 const filename=path.slice("/assets/".length);
 if(!/^\/assets\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(path))throw new ApiError(422,"Selecciona una imagen subida.");
 const row=await database().prepare("SELECT mime FROM builder_assets WHERE filename=? AND owner=?").bind(filename,user).first<{mime:string}>();
 if(!row)throw new ApiError(403,"La referencia no pertenece a tu espacio.");
 const file=await bucket().get(user+"/"+filename);
 if(!file||file.size>8*1024*1024)throw new ApiError(422,"La referencia no está disponible o supera 8 MB.");
 const bytes=new Uint8Array(await file.arrayBuffer());
 let binary="";
 for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return {dataUrl:"data:"+row.mime+";base64,"+btoa(binary),filename};
}
export async function uploadReference(reference:{dataUrl:string;filename:string}){
 const response=await kieRequest("",{base64Data:reference.dataUrl,uploadPath:"page-builder/references",fileName:crypto.randomUUID()+"-"+reference.filename},true);
 const url=object(response.data).downloadUrl;
 if(typeof url!=="string")throw new ProviderFailure(false,"Kie.ai no devolvió la referencia subida.");
 return safeAssetUrl(url);
}
export async function downloadImage(url:string){
 let current=safeAssetUrl(url);
 for(let redirects=0;redirects<=3;redirects++){
  const response=await fetch(current,{redirect:"manual",signal:AbortSignal.timeout(45000)});
  if([301,302,303,307,308].includes(response.status)){
   const next=response.headers.get("location");if(!next)throw new ApiError(502,"Redirección de imagen inválida.");
   current=safeAssetUrl(new URL(next,current).href);continue;
  }
  if(!response.ok||!response.body)throw new ApiError(502,"La imagen generada todavía no se puede descargar.");
  if(Number(response.headers.get("content-length")||0)>8*1024*1024)throw new ApiError(413,"La imagen generada supera 8 MB.");
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];
  let size=0;
  try{
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw new ApiError(413,"La imagen generada supera 8 MB.");}chunks.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const type=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?{ext:"png",mime:"image/png"}:bytes[0]===255&&bytes[1]===216&&bytes[2]===255?{ext:"jpg",mime:"image/jpeg"}:String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"?{ext:"webp",mime:"image/webp"}:null;
  if(!type)throw new ApiError(502,"El proveedor no devolvió una imagen PNG, JPEG o WebP válida.");
  return {bytes,...type};
 }
 throw new ApiError(502,"Demasiadas redirecciones al descargar la imagen.");
}
export const briefSchema=z.object({
 prompt:z.string().min(3).max(4000),alt:z.string().min(1).max(200),summary:z.string().max(500),
 aspect_ratio:z.enum(["1:1","3:2","2:3","4:3","3:4","16:9","9:16"]),
 focal_x:z.number().int().min(0).max(100),focal_y:z.number().int().min(0).max(100)
}).strict();
export const briefJsonSchema={
 type:"object",additionalProperties:false,required:["prompt","alt","summary","aspect_ratio","focal_x","focal_y"],
 properties:{prompt:{type:"string"},alt:{type:"string"},summary:{type:"string"},aspect_ratio:{type:"string",enum:["1:1","3:2","2:3","4:3","3:4","16:9","9:16"]},focal_x:{type:"integer"},focal_y:{type:"integer"}}
};
