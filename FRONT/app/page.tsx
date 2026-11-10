"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ArrowUp, ArrowDown, Check, ChevronDown, GripVertical, LayoutTemplate, Image as ImageIcon, Type, Sparkles, Monitor, Smartphone, Plus, Menu, X, MousePointer2, Globe2, Layers, Undo2, ShieldCheck } from "lucide-react";

const plans=[
 {name:"Starter",price:9,who:"Tu primera presencia online.",sites:"1 sitio · hasta 5 páginas",features:["Editor drag & drop","Hosting y HTTPS previstos","Cuota inicial de IA prevista","Ayuda de autoservicio prevista"]},
 {name:"Professional",price:24,who:"Tu negocio, con más posibilidades.",sites:"1 sitio · hasta 30 páginas",features:["Dominio propio previsto","CMS y formularios previstos","Mayor cuota de IA prevista","Soporte por tickets previsto"]},
 {name:"Business",price:59,who:"Más sitios para tu empresa.",sites:"Hasta 3 sitios",features:["Cuotas compartidas previstas","Optimización con IA prevista","Integraciones y analítica previstas","Soporte prioritario previsto"]},
 {name:"Agency",price:149,who:"Un espacio para tus clientes.",sites:"Hasta 10 sitios",features:["Gestión de clientes prevista","Permisos de equipo previstos","Cuotas de IA compartidas previstas","Sitios adicionales previstos"]}
];
const faqs=[
 ["¿Qué puedo hacer ahora con el prototipo?","Puedes elegir entre tres plantillas, agregar y ordenar nueve tipos de módulos, editar textos directamente en el lienzo, subir imágenes y fuentes, cambiar colores, guardar proyectos y descargar tu sitio como ZIP."],
 ["¿Necesito saber programar?","No. El editor visual permite arrastrar y soltar módulos, personalizar textos, colores e imágenes y revisar el resultado sin escribir código. El ZIP contiene los archivos para que puedas alojar tu sitio."],
 ["¿Dónde se guardan mis proyectos?","El prototipo guarda los proyectos automáticamente en el servidor y los asocia al espacio al que accediste. También puedes descargar el diseño JSON para conservar una copia."],
 ["¿La inteligencia artificial ya está disponible?","El prototipo incluye interfaces para mejorar textos, generar imágenes y revisar el diseño. La integración con Kie.ai está incluida y utiliza Luna, Terra y GPT Image 2.5. El administrador debe configurar y habilitar el servicio para activar las generaciones. La edición manual funciona aunque la IA esté desactivada."],
 ["¿Los planes ya se pueden contratar?","Los planes son una propuesta comercial para el servicio completo. Los precios son mensuales, en USD y antes de impuestos, sujetos a validación. Esta versión no cobra ni aplica los límites comerciales de esos planes. Puedes probar el editor y registrar tu interés."],
 ["¿Puedo publicar mi sitio o vender productos?","Puedes exportar HTML, CSS, JavaScript e imágenes en un ZIP y subirlos a un hosting de tu elección. La publicación con dominio y hosting gestionados está prevista para una fase posterior. El catálogo de productos y los planes incluyen enlaces de contacto. Los pagos y la gestión de pedidos están pendientes."]
];
type PlanLimits = Record<string, { pages: number; templates: number; credits: number }>;
type BuilderSession = { authenticated: boolean; editor_access: boolean };
function Logo(){return <a className="logo" href="#" aria-label="Page Builder, inicio"><span className="brand-symbol"><i/><i/><i/></span>page builder<span className="logo-dot">.</span></a>}
export default function Home(){
 const [menu,setMenu]=useState(false);
 const [modal,setModal]=useState(false);
 const [selected,setSelected]=useState("Por definir");
 const [status,setStatus]=useState("idle");
 const [error,setError]=useState("");
 const [blocks,setBlocks]=useState(["Servicios","Sobre nosotros"]);
 const [tone,setTone]=useState(0);
 const [mobile,setMobile]=useState(false);
 const [announcement,setAnnouncement]=useState("");
 const [planLimits,setPlanLimits]=useState<PlanLimits|null>(null);
 const [builderSession,setBuilderSession]=useState<BuilderSession|null>(null);
 const [loggingOut,setLoggingOut]=useState(false);
 const [sessionError,setSessionError]=useState("");
 const hasAccount=builderSession?.editor_access===true;
 const signedIn=builderSession?.authenticated===true;
 const accountHref=hasAccount?"/builder":"/acceso";
 const accountLabel=hasAccount?"Abrir Page Builder":signedIn?"Elegir plan":"Iniciar sesión";
 const dialog=useRef<HTMLDialogElement>(null);
 const dragged=useRef<number|null>(null);
 useEffect(()=>{
  if (!document.documentElement.hasAttribute("data-builder-accounts")) return;
  const controller=new AbortController();
  async function refreshSession(){
   try {
    const response=await fetch("/api/session",{cache:"no-store",signal:controller.signal});
    const session=response.ok?await response.json() as BuilderSession:null;
    if(!controller.signal.aborted) setBuilderSession(session);
   } catch {
    if(!controller.signal.aborted) setBuilderSession(null);
   }
  }
  void refreshSession();
  window.addEventListener("pageshow",refreshSession);
  return ()=>{controller.abort();window.removeEventListener("pageshow",refreshSession);};
 },[]);
 async function logout(){
  setLoggingOut(true);
  setSessionError("");
  try {
   const response=await fetch("/api/logout",{method:"POST",headers:{"X-Editor-Request":"1"}});
   if(!response.ok && response.status!==401) throw new Error();
   localStorage.removeItem("modulo-project");
   window.location.replace("/");
  } catch {
   setSessionError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
   setLoggingOut(false);
  }
 }
 const secondaryAccountAction=signedIn
  ? <button type="button" className="account-action" onClick={logout} disabled={loggingOut}>{loggingOut?"Cerrando sesión…":"Cerrar sesión"}</button>
  : builderSession && <a className="account-action" href="/acceso?registro=1">Crear cuenta</a>;
 useEffect(()=>{
  if (!document.documentElement.hasAttribute("data-builder-accounts")) return;
  const controller=new AbortController();
  fetch("/api/plans",{signal:controller.signal}).then(response=>{
   if(response.ok) return response.json() as Promise<PlanLimits>;
   return null;
  }).then(limits=>{if(limits) setPlanLimits(limits);}).catch(()=>{});
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{if(modal){dialog.current?.showModal();document.body.style.overflow="hidden"}else{dialog.current?.close();document.body.style.overflow=""}return ()=>{document.body.style.overflow=""}},[modal]);
 function open(plan="Por definir"){setSelected(plan);setStatus("idle");setError("");setMenu(false);setModal(true)}
 function move(index:number,delta:number){const next=index+delta;if(next<0||next>=blocks.length)return;const copy=[...blocks];[copy[index],copy[next]]=[copy[next],copy[index]];setBlocks(copy);setAnnouncement("Orden de secciones actualizado.")}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget);setStatus("sending");setError("");
  try {const response=await fetch("/api/interest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.get("name"),email:form.get("email"),plan:selected,consent:form.get("consent")==="on",website:form.get("website")})});
   const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error || "No pudimos guardar tu solicitud.");setStatus("success");
  }catch(e){setStatus("idle");setError(e instanceof Error?e.message:"Inténtalo nuevamente.")}
 }
 return <>
 <a className="skip" href="#contenido">Saltar al contenido</a>
 <header><div className="nav wrap"><Logo/><nav className={menu?"open":""} aria-label="Principal"><a href="#beneficios" onClick={()=>setMenu(false)}>Por qué Page Builder</a><a href="#como-funciona" onClick={()=>setMenu(false)}>Cómo funciona</a><a href="#planes" onClick={()=>setMenu(false)}>Planes</a><a href={accountHref} className="mobile-editor-link">{accountLabel} ↗</a><span className="mobile-editor-link">{secondaryAccountAction}</span></nav><div className="nav-cta account-actions">{secondaryAccountAction}<a className="btn small" href={accountHref}>{accountLabel} <ArrowUpRight size={16}/></a></div><button className="menu" onClick={()=>setMenu(!menu)} aria-label={menu?"Cerrar menú":"Abrir menú"} aria-expanded={menu}>{menu?<X/>:<Menu/>}</button></div></header>
 {sessionError && <p className="wrap account-error" role="alert">{sessionError}</p>}
 <main id="contenido">
 <section className="hero wrap">
  <div className="hero-copy"><div className="eyebrow"><span className="status-dot"/> PROTOTIPO DISPONIBLE · PENSADO PARA TU NEGOCIO</div><h1>Tu negocio merece<br/>su propia <em>web.</em></h1><p className="intro">Lleva tu negocio a internet con un editor de arrastrar y soltar. Elige una plantilla, personaliza tus módulos y descarga tu sitio web. Sin saber nada de código.</p><div className="hero-actions"><a className="btn" href={hasAccount?"/builder":"#planes"}>{hasAccount?"Probar el editor":"Elegir un plan"} <ArrowRight size={18}/></a><a className="text-link" href="#como-funciona">Qué puedes crear <ArrowUpRight size={17}/></a></div><div className="hero-checks"><span><Check size={14}/> Sin conocimientos técnicos</span><span><Check size={14}/> Tú tienes el control</span></div></div>
  <div className="editor-scene" id="demo">
   <div className="floating-note"><Sparkles size={16}/> Tu idea ya tiene forma</div>
   <div className="editor"><div className="editor-top"><span className="editor-logo"><span/> Mi primer sitio</span><span className="demo-tag">DEMO INTERACTIVA</span><div className="view-buttons"><button className={!mobile?"active":""} aria-label="Vista escritorio" aria-pressed={!mobile} onClick={()=>setMobile(false)}><Monitor size={15}/></button><button className={mobile?"active":""} aria-label="Vista móvil" aria-pressed={mobile} onClick={()=>setMobile(true)}><Smartphone size={15}/></button></div></div>
   <div className="editor-body"><aside className="editor-sidebar"><span className="side-heading">CONSTRUYE</span><button onClick={()=>{if(blocks.length<3)setBlocks([...blocks,"Contacto"]);setAnnouncement("Sección de contacto agregada.")}} disabled={blocks.length>=3}><LayoutTemplate size={17}/> Secciones <Plus size={13}/></button><button onClick={()=>{setTone((tone+1)%3);setAnnouncement("Paleta de colores actualizada.")}}><ImageIcon size={17}/> Colores</button><button onClick={()=>{setBlocks(["Servicios","Sobre nosotros"]);setTone(0);setAnnouncement("Demostración reiniciada.")}}><Undo2 size={17}/> Reiniciar</button><div className="side-tip"><MousePointer2 size={17}/><p>Mueve las secciones.<br/>Hazlo a tu manera.</p></div><div className="side-bottom"><Sparkles size={16}/> Editor visual</div></aside>
   <div className={"demo-canvas tone-"+tone+(mobile?" mobile-preview":"")}><div className="sample-nav"><b>estudio calma</b><span>Espacios con intención <ArrowUpRight size={11}/></span></div><div className="sample-hero"><div><span className="sample-eyebrow">DISEÑO QUE SE SIENTE</span><h2>Un espacio<br/>para <i>habitar.</i></h2><span className="sample-cta">Conoce nuestro estudio ↗</span></div><div className="interior" role="img" aria-label="Ilustración de un espacio minimalista con una planta, un sillón y un cuadro"><div className="art"/><div className="plant"><i/><i/><i/><b/></div><div className="chair"/><div className="table"/></div></div>
   <div className="sample-blocks">{blocks.map((block,i)=><div className="sample-block" key={block} draggable onDragStart={()=>{dragged.current=i}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragged.current===null)return;const copy=[...blocks];const item=copy.splice(dragged.current,1)[0];copy.splice(i,0,item);setBlocks(copy);dragged.current=null;setAnnouncement("Orden de secciones actualizado.")}}><GripVertical size={14}/><span>{block}</span><div className="block-lines"/><button aria-label={"Subir "+block} disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={12}/></button><button aria-label={"Bajar "+block} disabled={i===blocks.length-1} onClick={()=>move(i,1)}><ArrowDown size={12}/></button></div>)}</div></div></div><div className="editor-footer"><span><span className="tiny-dot"/> Ejemplo ilustrativo</span><span>Arrastra. Personaliza. Hazlo tuyo.</span></div></div>
   <div className="cursor-label"><MousePointer2 size={19} fill="currentColor"/> Tú, creando tu web</div><p className="demo-caption">Prueba los colores y reordena los bloques. Esta demo no publica sitios.</p><span className="sr-only" aria-live="polite">{announcement}</span>
  </div>
 </section>
 <div className="audience wrap"><span>HECHO PARA QUIENES EMPRENDEN</span><p>Tu cafetería.</p><p>Tu estudio.</p><p>Tu consulta.</p><p>Tu próximo proyecto.</p></div>
 <section className="benefits section wrap" id="beneficios"><div className="section-head"><div><div className="eyebrow">MENOS COMPLICACIONES</div><h2>Una web profesional.<br/><em>A tu alcance.</em></h2></div><p>Para quienes quieren dedicar más tiempo a su negocio y menos a resolver cómo funciona una página web.</p></div>
 <div className="benefit-grid"><article><span className="icon-box"><MousePointer2/></span><h3>Arrastra, suelta y listo.</h3><p>Construye con módulos prediseñados. Mueve secciones, cambia imágenes y ajusta tu diseño con un editor visual drag & drop.</p><span className="feature-label">DISEÑO EN TUS MANOS</span></article><article><span className="icon-box"><Sparkles/></span><h3>Elige tu punto de partida.</h3><p>Empieza con Forma, Estudio o Impulso. Tres plantillas para presentar productos, servicios o planes y adaptarlas a tu negocio.</p><span className="feature-label">3 PLANTILLAS · 9 TIPOS DE MÓDULOS</span></article><article><span className="icon-box"><Globe2/></span><h3>Crea sin saber código.</h3><p>Personaliza tu sitio sin escribir una línea de programación. Ajusta la tipografía, la paleta de colores y el modo claro o nocturno.</p><span className="feature-label">SIN BARRERAS TÉCNICAS</span></article></div></section>
 <section className="workflow" id="como-funciona"><div className="wrap workflow-inner"><div><div className="eyebrow light">DE LA IDEA A INTERNET</div><h2>Tu próxima web<br/>empieza contigo.</h2><p>Un editor que puedes probar hoy. Guarda tus proyectos y exporta los archivos cuando estés listo.</p><a href="#planes" className="text-link light-link">Encuentra tu plan <ArrowRight size={17}/></a><div className="workflow-stamp"><Layers size={31}/><span>Tu contenido.<br/>Tu estilo. Tu espacio.</span></div></div><div className="steps">{[["01","Elige una plantilla","Empieza con una base para productos, servicios o planes y agrega los datos de tu negocio."],["02","Dale tu toque","Arrastra y suelta módulos, elige colores y agrega tus imágenes. Revisa cómo se ve en móvil y escritorio."],["03","Revisa y descarga tu web","Comprueba los enlaces, revisa la vista móvil y descarga un ZIP con HTML, CSS, JavaScript e imágenes para tu hosting."]].map(([number,title,body])=><article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}<span className="upcoming">Funciones disponibles en el prototipo. La publicación gestionada está prevista para más adelante.</span></div></div></section>
 <section className="control section wrap"><div className="control-visual"><div className="version-top"><span className="status-dot"/> TU SITIO, BAJO CONTROL</div><div className="version-row"><div className="version-icon"><Layers size={21}/></div><div><b>Una nueva idea para tu página</b><span>Edítala. Revísala. Descárgala cuando esté lista.</span></div><Check size={20}/></div><div className="version-row muted-row"><div className="version-icon"><Undo2 size={21}/></div><div><b>Tu diseño editable</b><span>Un archivo JSON que puedes volver a importar.</span></div><span className="version-chip">JSON</span></div><div className="version-note"><ShieldCheck size={19}/><p>Revisión de anclas, enlaces y textos alternativos antes de exportar tu sitio.</p></div><span className="illustration-caption">Guardado automático, deshacer y rehacer en el editor.</span></div><div><div className="eyebrow">MIENTRAS LE DAS FORMA</div><h2>Tu web cambia.<br/><em>Tu negocio también.</em></h2><p>Edita textos directamente en el lienzo, duplica secciones y prueba otra paleta. Deshaz cambios durante la sesión y conserva una copia editable en JSON.</p><div className="control-list"><span><Check/> Diseño adaptable a móviles</span><span><Check/> Contenidos que tú puedes actualizar</span><span><Check/> Exportación ZIP con los recursos de tu sitio</span></div></div></section>
 <section className="pricing section" id="planes"><div className="wrap"><div className="pricing-head"><div className="eyebrow">UN PLAN PARA CADA ETAPA</div><h2>Empieza a tu escala.<br/><em>Crece a tu ritmo.</em></h2><p>Prueba el prototipo hoy. Los planes corresponden al servicio completo que estamos preparando.</p><span className="price-disclaimer">Propuesta comercial futura · USD por mes · antes de impuestos</span></div><div className="plans">{plans.map((plan,i)=><article className={"plan "+(i===1?"featured":"")} key={plan.name}>{i===1&&<span className="recommend">PARA PYMES Y PROFESIONALES</span>}<h3>{plan.name}</h3><p className="plan-who">{plan.who}</p><div className="price"><span>US$</span>{plan.price}<small>/mes</small></div>{planLimits?.[plan.name.toLowerCase()] ? <>
 <div className="site-count">{planLimits[plan.name.toLowerCase()].pages} páginas al mes</div>
 <a className={"btn "+(i===1?"":"outline")} href={"/builder?plan="+plan.name.toLowerCase()}>Elegir plan <ArrowUpRight size={16}/></a>
 <p>{planLimits[plan.name.toLowerCase()].templates} plantillas guardadas · {planLimits[plan.name.toLowerCase()].credits} créditos IA al mes</p>
 </> : <><div className="site-count">{plan.sites}</div><button className={"btn "+(i===1?"":"outline")} onClick={()=>open(plan.name)}>Me interesa <ArrowUpRight size={16}/></button></>}<ul>{plan.features.map(f=><li key={f}><Check size={15}/>{f}</li>)}</ul></article>)}</div><p className="pricing-footnote">{planLimits ? "Elige un plan para probar sus cupos sin cobro. Las páginas y los créditos de IA se renuevan el primer día de cada mes. El cupo de plantillas corresponde al total guardado." : "Los planes y sus funciones previstas todavía no se comercializan. El prototipo integrado permite editar y exportar sin suscripción. Hosting gestionado, dominios, facturación y formularios están pendientes."}</p></div></section>
 <section className="faq section wrap"><div><div className="eyebrow">POR SI TE LO PREGUNTABAS</div><h2>Hablemos<br/><em>de los detalles.</em></h2><p>¿Estás pensando en tu primera web?<br/>Este es un buen lugar para empezar.</p></div><div className="faq-items">{faqs.map(([q,a])=><details key={q}><summary>{q}<Plus size={18}/></summary><p>{planLimits && q===faqs[4][0] ? "Puedes elegir un plan y usar sus cupos en el editor. Los precios son referenciales y la selección no genera cobros." : a}</p></details>)}</div></section>
 <section className="last-cta wrap"><div className="eyebrow">PAGE BUILDER YA TIENE SU PRIMER PROTOTIPO</div><h2>Tu próximo gran paso<br/>puede ser <em>tu propia web.</em></h2><p>Explora las plantillas y empieza a dar forma a tu sitio.</p><a className="btn" href={accountHref}>{accountLabel} <ArrowRight size={18}/></a><button className="notify-link" onClick={()=>open()}>Quiero recibir novedades del servicio</button><span>Prototipo en desarrollo. Sin contratación ni cobros.</span></section>
 </main>
 <footer className="wrap"><div><Logo/><p>Tu negocio, en tu propia web.</p></div><div className="footer-links"><a href="#beneficios">Beneficios</a><a href="#planes">Planes</a><button onClick={()=>document.getElementById("privacidad")?.scrollIntoView({behavior:"smooth"})}>Privacidad</button></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Page Builder</span><span>Editor disponible en versión prototipo.</span></div><details id="privacidad"><summary>Cómo usamos tus datos <ChevronDown size={14}/></summary><p>Guardamos tu nombre, correo y plan de interés para gestionar el acceso y comunicar novedades del lanzamiento de Page Builder, con tu consentimiento. No necesitas compartir información de tu negocio. Puedes solicitar la baja cuando recibas una comunicación. Esta landing no procesa pagos. Los términos finales del servicio se presentarán antes de contratar.</p></details></footer>
 <dialog ref={dialog} onCancel={()=>setModal(false)} onClick={e=>{if(e.target===dialog.current)setModal(false)}} aria-labelledby="interest-title"><button className="close" onClick={()=>setModal(false)} aria-label="Cerrar"><X size={21}/></button>{status==="success"?<div className="success"><span className="success-icon"><Check size={31}/></span><div className="eyebrow">INTERÉS REGISTRADO</div><h2 id="interest-title">Ya estás en la lista.</h2><p>Guardamos tu interés en Page Builder. Te contactaremos cuando haya novedades del lanzamiento. No se ha contratado ningún plan.</p><button className="btn" onClick={()=>setModal(false)}>Volver a explorar <ArrowRight size={17}/></button></div>:<><div className="eyebrow">NOS VEMOS PRONTO</div><h2 id="interest-title">Tu idea tiene<br/>un lugar aquí.</h2><p>Déjanos tu correo para enterarte del lanzamiento y de las opciones de acceso.</p><form onSubmit={submit}><label>Tu nombre<input name="name" required autoComplete="given-name" maxLength={100} placeholder="¿Cómo te llamas?"/></label><label>Correo electrónico<input name="email" type="email" required autoComplete="email" maxLength={254} placeholder="tu@negocio.cl"/></label><label>Plan que te interesa<select value={selected} onChange={e=>setSelected(e.target.value)}><option>Por definir</option>{plans.map(p=><option key={p.name}>{p.name}</option>)}</select></label><div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div><label className="consent"><input name="consent" type="checkbox" required/><span>Acepto que Page Builder guarde estos datos para contactarme sobre su lanzamiento.</span></label>{error&&<p className="error" role="alert">{error}</p>}<button className="btn" type="submit" disabled={status==="sending"}>{status==="sending"?"Guardando…":"Quiero estar en la lista"}<ArrowRight size={17}/></button><span className="form-note">Sin pago ni compromiso. App en desarrollo.</span></form></>}</dialog>
 </>;
}
