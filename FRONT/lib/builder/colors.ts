import type { Project, Module } from "./schema";
type RGB=[number,number,number];
const rgb=(hex:string):RGB=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as RGB;
const hex=(values:RGB)=>"#"+values.map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,"0")).join("");
function mix(a:string,b:string,amount:number){const x=rgb(a),y=rgb(b);return hex(x.map((v,i)=>v*(1-amount)+y[i]*amount) as RGB);}
function luminance(value:string){return rgb(value).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0);}
export function contrast(a:string,b:string){const [x,y]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (y+.05)/(x+.05);}
export function ink(bg:string){return contrast("#111111",bg)>contrast("#ffffff",bg)?"#111111":"#ffffff";}
function readable(color:string,bg:string){const target=ink(bg);for(let i=0;i<=100;i++){const candidate=mix(color,target,i/100);if(contrast(candidate,bg)>=4.5)return candidate;}return target;}
export function secondary(primary:string,harmony:string){
 const [r,g,b]=rgb(primary),max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,l=(max+min)/2;
 let h=0,s=0;
 if(delta){s=l>.5?delta/(2-max-min):delta/(max+min);h=(max===r?(g-b)/delta+(g<b?6:0):max===g?(b-r)/delta+2:(r-g)/delta+4)/6;}
 const offsets:Record<string,number>={complementary:.5,analogous:1/12,triadic:1/3,monochrome:0};
 h=(h+(offsets[harmony]??.5))%1;s=Math.max(.2,Math.min(s,.65));const light=l>.6?.44:.58;
 const q=light<.5?light*(1+s):light+s-light*s,p=2*light-q;
 const hue=(t:number)=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
 return hex([hue(h+1/3),hue(h),hue(h-1/3)]);
}
function surfaces(p:Project,dark:boolean){const second=p.secondary||secondary(p.accent,p.harmony);return {page:mix(p.accent,dark?"#000000":"#ffffff",dark?.86:.97),panel:mix(second,dark?"#000000":"#ffffff",dark?.78:.89),second};}
function vars(values:Record<string,string>){return Object.entries(values).map(([key,value])=>"--"+key+":"+value).join(";");}
function surface(bg:string,primary:string){const fg=ink(bg);return vars({surface:bg,fg,muted:readable(mix(fg,bg,.35),bg),"accent-ink":readable(primary,bg),line:mix(fg,bg,.82)});}
export function palette(p:Project,dark=p.color_mode==="dark"){const {page,panel,second}=surfaces(p,dark);return vars({page,panel,primary:p.accent,secondary:second,"button-ink":ink(p.accent)})+";"+surface(page,p.accent);}
export function moduleStyle(p:Project,m:Module,dark=p.color_mode==="dark"){
 const {page,panel,second}=surfaces(p,dark);
 const tones:Record<string,string>={dark:surfaces(p,true).panel,light:surfaces(p,false).page,primary:p.accent,secondary:second,custom:m.background};
 return surface(tones[m.tone]||(m.kind==="contact"?p.accent:["features","carousel","cta"].includes(m.kind)?panel:page),p.accent);
}
