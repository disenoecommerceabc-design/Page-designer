import type { Project, Module } from "./schema";
import { palette, moduleStyle } from "./colors";
export const aliases:Record<string,string>={products:"productos",features:"servicios",pricing:"planes",contact:"contacto",faq:"preguntas",hero:"inicio",carousel:"galeria",testimonials:"opiniones",cta:"empezar"};
export const escapeHtml=(value:unknown="")=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function render(p:Project,editing=false,full=false){
 const e=escapeHtml;
 const text=(tag:string,value:string,path:string,cls="")=>`<${tag} class="${cls}" ${editing?`contenteditable="plaintext-only" data-path="${path}" spellcheck="true"`:""}>${e(value)}</${tag}>`;
 const image=(src:string,alt:string,x=50,y=50)=>src?`<img src="${e(src)}" alt="${e(alt)}" style="object-position:${x}% ${y}%" loading="lazy">`:'<div class="image-empty">Agrega una imagen desde el panel de edición</div>';
 const heading=(m:Module)=>`<div class="section-heading">${text("p",m.content.eyebrow,"eyebrow","eyebrow")}${text("h2",m.content.title,"title")}${text("p",m.content.description,"description","section-description")}</div>`;
 function content(m:Module){
  const c=m.content,items=c.items;
  const itemText=(tag:string,value:string,i:number,field:string,cls="")=>text(tag,value,`items.${i}.${field}`,cls);
  switch(m.kind){
   case "hero":return `<div class="hero-copy">${text("p",c.eyebrow,"eyebrow","eyebrow")}${text("h1",c.title,"title")}${text("p",c.description,"description","hero-description")}<a class="site-button" href="${e(c.url)}">${e(c.button)} <span>↗</span></a><div class="hero-caption"><span class="tiny-line"></span>${e(p.business.industry)}</div></div><div class="hero-visual">${image(c.image,c.alt,c.focal_x,c.focal_y)}<span class="visual-label">${e(p.business.name)} — Colección 01</span></div>`;
   case "features":return heading(m)+`<div class="feature-grid">${items.map((item,i)=>`<article><span class="feature-number">0${i+1} /</span>${itemText("h3",item.title,i,"title")}${itemText("p",item.description,i,"description")}</article>`).join("")}</div>`;
   case "carousel":return heading(m)+`<div class="carousel" aria-roledescription="carrusel"><div class="carousel-track">${items.map((item,i)=>`<article class="carousel-slide">${item.image?image(item.image,item.alt,item.focal_x,item.focal_y):""}<div>${itemText("h3",item.title,i,"title")}${itemText("p",item.description,i,"description")}</div></article>`).join("")}</div><div class="carousel-controls"><span>DESLIZA PARA DESCUBRIR</span><div><button type="button" data-slide="-1" aria-label="Imagen anterior">←</button><button type="button" data-slide="1" aria-label="Siguiente imagen">→</button></div></div></div>`;
   case "products":return heading(m)+`<div class="product-grid">${items.map((item,i)=>`<article class="product-card"><div class="product-image">${image(item.image,item.alt,item.focal_x,item.focal_y)}${item.badge?`<span class="product-badge">${e(item.badge)}</span>`:""}</div><div class="product-title">${itemText("h3",item.title,i,"title")}${itemText("span",item.price,i,"price")}</div>${itemText("p",item.description,i,"description")}<a class="text-link" href="${e(item.url)}">${e(item.button)} ↗</a></article>`).join("")}</div>`;
   case "pricing":return heading(m)+`<div class="price-grid">${items.map((item,i)=>`<article class="price-card ${item.badge?"recommended":""}">${item.badge?`<span class="plan-badge">${e(item.badge)}</span>`:""}${itemText("h3",item.title,i,"title")}${itemText("p",item.description,i,"description")}${itemText("div",item.price,i,"price","plan-price")}<ul>${item.features.map(f=>`<li>${e(f)}</li>`).join("")}</ul><a class="site-button" href="${e(item.url)}">${e(item.button)} ↗</a></article>`).join("")}</div>`;
   case "testimonials":return heading(m)+`<div class="quote-grid">${items.map((item,i)=>`<figure><span class="quote-mark">“</span>${itemText("blockquote",item.description,i,"description")}<figcaption>${itemText("strong",item.title,i,"title")}<span>${e(item.badge)}</span></figcaption></figure>`).join("")}</div>`;
   case "faq":return heading(m)+`<div class="faq-list">${items.map((item,i)=>`<details ${editing?"open":""}><summary>${itemText("span",item.title,i,"title")}<span aria-hidden="true">+</span></summary>${itemText("p",item.description,i,"description")}</details>`).join("")}</div>`;
   case "contact":return `<div>${text("p",c.eyebrow,"eyebrow","eyebrow")}${text("h2",c.title,"title")}${text("p",c.description,"description")}</div><div class="contact-links">${p.business.email?`<a href="mailto:${e(p.business.email)}">${e(p.business.email)} ↗</a>`:""}${p.business.phone?`<a href="tel:${e(p.business.phone.replaceAll(" ",""))}">${e(p.business.phone)} ↗</a>`:""}${!p.business.email&&!p.business.phone?"<p>Agrega tu correo o teléfono en «Tu negocio».</p>":""}</div>`;
   case "cta":return `${text("p",c.eyebrow,"eyebrow","eyebrow")}${text("h2",c.title,"title")}${text("p",c.description,"description")}<a class="site-button" href="${e(c.url)}">${e(c.button)} ↗</a>`;
  }
 }
 const seen=new Set<string>();
 const sections=p.modules.map(m=>{
  const alias=seen.has(m.kind)?"":aliases[m.kind];seen.add(m.kind);
  return `<section class="site-section section-${m.kind}" id="${m.id}" style="${moduleStyle(p,m)}" data-light="${moduleStyle(p,m,false)}" data-dark="${moduleStyle(p,m,true)}" ${editing?`data-module="${m.id}" data-kind="${m.kind}" tabindex="0" aria-label="Módulo ${m.kind}"`:""}>${alias?`<span class="site-anchor" id="${alias}"></span>`:""}${content(m)}</section>`;
 }).join("");
 let typography="";
 if(p.font.startsWith("upload:")){
  const id=p.font.slice(7);typography=`<style>@font-face{font-family:'User${id}';src:url('/fonts/${id}');font-display:swap}.site.has-font,.site.has-font h1,.site.has-font h2,.site.has-font h3,.site.has-font .site-brand,.site.has-font .site-footer>a{font-family:'User${id}',sans-serif}</style>`;
 }else if(p.font!=="default"){
  typography=`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(p.font)}:wght@400;500;600;700&amp;display=swap"><style>.site.has-font,.site.has-font h1,.site.has-font h2,.site.has-font h3,.site.has-font .site-brand,.site.has-font .site-footer>a{font-family:'${p.font}',sans-serif}</style>`;
 }
 const nav=[["products","productos","Colección"],["features","servicios","Nosotros"],["pricing","planes","Planes"],["contact","contacto","Hablemos ↗"]].filter(([kind])=>seen.has(kind)).map(([,anchor,label])=>`<a href="#${anchor}">${label}</a>`).join("");
 const body=typography+`<div class="site theme-${p.template}${p.font!=="default"?" has-font":""}" style="--accent:${p.accent};${palette(p)}" data-mode="${p.color_mode}" data-light="${palette(p,false)}" data-dark="${palette(p,true)}"><header class="site-nav"><a class="site-brand" href="#top">${e(p.business.name)}<span>®</span></a><nav aria-label="Navegación del sitio">${nav}<button type="button" class="theme-toggle" data-theme-toggle aria-label="Cambiar entre modo claro y nocturno">☾ / ☀</button></nav></header><main id="top">${sections}</main><footer class="site-footer"><a href="#top">${e(p.business.name)}®</a><span>${e(p.business.industry)}</span><small>Hecho con intención.</small></footer></div>`;
 return full?`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${e(p.business.description||p.business.industry)}"><title>${e(p.business.name)}</title><link rel="stylesheet" href="/static/site.css"><script src="/static/site.js" defer></script></head><body>${body}</body></html>`:body;
}
export function review(p:Project){
 const html=render(p);
 const issues:{level:string;message:string}[]=[];
 const ids=[...html.matchAll(/\sid="([^"]*)"/g)].map(m=>m[1]);
 for(const match of html.matchAll(/<a\s[^>]*href="([^"]*)"/g)){
  const link=match[1];
  if(!link)issues.push({level:"error",message:"Hay un botón sin destino."});
  else if(link.startsWith("#")&&!ids.includes(link.slice(1)))issues.push({level:"error",message:`El enlace ${link} no tiene un módulo de destino.`});
  else if(/^https?:/.test(link))issues.push({level:"notice",message:`Comprueba la disponibilidad del enlace externo: ${link}`});
 }
 for(const m of p.modules){
  if(!m.content.title)issues.push({level:"warning",message:`El módulo ${m.kind} no tiene título.`});
  if(["carousel","products","pricing","features","faq","testimonials"].includes(m.kind)&&!m.content.items.length)issues.push({level:"warning",message:`El módulo ${m.kind} no tiene elementos.`});
  for(const item of [m.content,...m.content.items])if(item.image&&!item.alt)issues.push({level:"warning",message:"Agrega una descripción alternativa a una imagen."});
 }
 if(!p.business.email&&!p.business.phone)issues.push({level:"warning",message:"Agrega un correo o teléfono para activar los enlaces de contacto."});
 if(!p.modules.length)issues.push({level:"error",message:"Agrega al menos un módulo."});
 return {valid:!issues.some(i=>i.level==="error"),issues,checks:["Estructura y anclas internas","Destinos y protocolos permitidos","Recursos propios de tu espacio","Textos alternativos","Identificadores únicos"],external_links:"Se valida el formato. Comprueba la disponibilidad externa antes de publicar."};
}
