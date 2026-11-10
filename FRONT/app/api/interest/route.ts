import { getDb } from "../../../db";
import { interests } from "../../../db/schema";
export async function POST(request: Request) {
 const origin=request.headers.get("origin");
 if (!origin || origin!==new URL(request.url).origin) return Response.json({error:"Solicitud no permitida."},{status:403});
 if (Number(request.headers.get("content-length") || 0)>4096) return Response.json({error:"Solicitud demasiado grande."},{status:413});
 try {
  const raw=await request.text();
  if(raw.length>4096) return Response.json({error:"Solicitud demasiado grande."},{status:413});
  const data=JSON.parse(raw);
  const email=typeof data.email==="string"?data.email.trim().toLowerCase():"";
  const name=typeof data.name==="string"?data.name.trim():"";
  const plans=["Por definir","Starter","Professional","Business","Agency"];
  if(data.website) return Response.json({ok:true});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>100||!plans.includes(data.plan)||data.consent!==true)
   return Response.json({error:"Revisa tus datos y acepta el uso de tu correo para el lanzamiento."},{status:400});
  await getDb().insert(interests).values({email,name,plan:data.plan}).onConflictDoNothing();
  return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 } catch {
  return Response.json({error:"No pudimos guardar tu solicitud. Inténtalo de nuevo en unos minutos."},{status:503});
 }
}
