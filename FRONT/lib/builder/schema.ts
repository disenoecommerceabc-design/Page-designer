import { z } from "zod";
export const fonts = ["Inter","Roboto","Lato","Montserrat","Poppins","Nunito","Playfair Display","Merriweather"];
export const kinds = ["hero","carousel","products","features","pricing","testimonials","faq","contact","cta"] as const;
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const image = z.string().max(150).refine(value => !value || /^\/assets\/[a-f0-9]{32}\.(webp|png|jpg)$/.test(value) || /^\/static\/images\/(product|studio|desk)\.svg$/.test(value), "Selecciona una imagen subida.");
const link = z.string().max(600).refine(value => {
 if (!value) return true;
 if (/[\s<>"\\\x00-\x1f]/.test(value)) return false;
 if (/^#[a-zA-Z][a-zA-Z0-9_-]{0,70}$/.test(value) || /^mailto:[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(value) || /^tel:\+?[0-9()-]{6,20}$/.test(value)) return true;
 try {const url=new URL(value);return ["https:","http:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password;}catch{return false;}
}, "Usa https://, mailto:, tel: o un ancla #modulo.");
const focal={focal_x:z.number().int().min(0).max(100).default(50),focal_y:z.number().int().min(0).max(100).default(50)};
const card = z.object({
 ...focal,title:z.string().max(150).default(""),description:z.string().max(1200).default(""),
 price:z.string().max(60).default(""),badge:z.string().max(50).default(""),image:image.default(""),
 alt:z.string().max(200).default(""),button:z.string().max(60).default("Conocer más"),
 url:link.default("#contacto"),features:z.array(z.string().max(160)).max(8).default([])
}).strict();
const content=z.object({
 ...focal,eyebrow:z.string().max(100).default(""),title:z.string().max(180).default(""),
 description:z.string().max(1800).default(""),button:z.string().max(60).default("Hablemos"),
 url:link.default("#contacto"),image:image.default(""),alt:z.string().max(200).default(""),
 items:z.array(card).max(8).default([])
}).strict();
const moduleSchema=z.object({
 tone:z.enum(["inherit","light","dark","primary","secondary","custom"]).default("inherit"),
 background:color.default("#ffffff"),id:z.string().regex(/^m-[a-f0-9]{12}$/),kind:z.enum(kinds),
 content,notes:z.string().max(1500).default("")
}).strict();
const business=z.object({
 name:z.string().min(1).max(80).default("Forma Studio"),industry:z.string().max(120).default("Objetos para vivir mejor"),
 audience:z.string().max(300).default(""),description:z.string().max(1200).default(""),
 email:z.string().max(180).refine(v=>!v||/^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(v),"Correo inválido.").default(""),
 phone:z.string().max(30).refine(v=>!v||/^\+?[0-9 ()-]{6,25}$/.test(v),"Teléfono inválido.").default("")
}).strict();
export const projectSchema=z.object({
 secondary:z.union([color,z.literal("")]).default(""),
 harmony:z.enum(["complementary","analogous","triadic","monochrome"]).default("complementary"),
 color_mode:z.enum(["light","dark"]).default("light"),
 font:z.string().max(100).refine(v=>v==="default"||fonts.includes(v)||/^upload:[a-f0-9]{32}$/.test(v)).default("default"),
 name:z.string().min(1).max(100).default("Mi primera web"),
 template:z.enum(["tienda","servicios","suscripciones"]).default("tienda"),
 business:business.default({}),accent:color.default("#356657"),
 modules:z.array(moduleSchema).max(30).default([]),revision:z.number().int().nonnegative().default(0)
}).strict().refine(p=>new Set(p.modules.map(m=>m.id)).size===p.modules.length,"Los identificadores de módulos deben ser únicos.");
export type Project=z.infer<typeof projectSchema>;
export type Module=Project["modules"][number];
