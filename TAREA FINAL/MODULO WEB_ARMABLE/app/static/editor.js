'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const copy = value => structuredClone(value);
const paths = {
  layout:'M3 3h18v18H3z M3 8h18 M13 8v13', gallery:'M3 5h18v14H3z M7 5v14 M17 5v14 M10 14l2-3 3 4',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z M20 2v4 M18 4h4',
  price:'M4 4h9l8 8-9 9-8-8z M8 8h.01', quote:'M5 6h6v7H6v5H3v-6c0-4 1-5 2-6 M16 6h6v7h-5v5h-3v-6c0-4 1-5 2-6',
  help:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  mail:'M3 5h18v14H3z m0 0 9 8 9-8', arrow:'M5 12h14 m-5-5 5 5-5 5', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  folder:'M3 6h7l2 2h9v12H3z M3 8V4h7l2 2', chevron:'m9 5 7 7-7 7', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  drag:'M8 5h.01 M16 5h.01 M8 12h.01 M16 12h.01 M8 19h.01 M16 19h.01', monitor:'M3 4h18v13H3z M8 21h8 M12 17v4', phone:'M7 2h10v20H7z M11 18h2',
  undo:'M8 4 3 9l5 5 M3 9h10a7 7 0 0 1 0 14', redo:'m16 4 5 5-5 5 M21 9H11a7 7 0 0 0 0 14', save:'M4 3h13l4 4v14H3V3z M7 3v7h10V3 M7 21v-7h10v7',
  cursor:'m4 3 16 10-8 1-4 7z', lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4', external:'M14 3h7v7 M21 3l-11 11 M10 3H3v18h18v-7',
  plus:'M12 5v14 M5 12h14', search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 m-2 5 6 6', shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z m-5 10 3 3 7-7',
  close:'m6 6 12 12 M6 18 18 6', trash:'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7', duplicate:'M8 8h13v13H8z M16 8V3H3v13h5',
  up:'m6 14 6-6 6 6', down:'m6 10 6 6 6-6', upload:'M12 16V3 m-5 5 5-5 5 5 M4 14v7h16v-7', check:'m5 12 4 4L20 5', image:'M3 3h18v18H3z m0 14 6-6 5 5 3-3 4 4 M8 7h.01', download:'M12 3v13 m-5-5 5 5 5-5 M4 17v4h16v-4'
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.layout}"/></svg>`; }
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
hydrateIcons();
let project, projectId, catalog, session, usage, plans;
let selectedId, category = 'Todos', history = [], future = [], saveTimer, renderTimer, renderController;
let editVersion = 0, lastCheckpoint = 0, saveChain = Promise.resolve(), modalEpoch = 0, toastTimer;
let uploadTarget = null, busy = false;

async function api(url, {method = 'GET', body, headers = {}, raw = false, signal} = {}) {
  const options = {method, headers: {'X-Editor-Request': '1', ...headers}, signal};
  if (body !== undefined) {
    if (body instanceof FormData) options.body = body;
    else { options.body = JSON.stringify(body); options.headers['Content-Type'] = 'application/json'; }
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail;
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => `${e.loc.slice(1).join('.')}: ${e.msg}`).join('; ') : detail?.message || `No se pudo completar la solicitud (${response.status}).`;
    const error = new Error(message); error.status = response.status; error.data = detail; throw error;
  }
  return raw ? response.text() : response.json();
}
function toast(message, error = false) {
  clearTimeout(toastTimer); const el = $('#toast'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, error ? 8500 : 3500);
}
function savedState(text, error = false) { $('#save-status').textContent = text; $('#save-status').classList.toggle('error', error); }
function selected() { return project?.modules.find(m => m.id === selectedId); }
function moduleName(kind) { return catalog.modules.find(m => m.kind === kind)?.name || kind; }
function checkpoint(group = false) {
  if (!project) return;
  if (group && Date.now() - lastCheckpoint < 1500) return;
  history.push(JSON.stringify(project)); if (history.length > 40) history.shift(); future = []; lastCheckpoint = Date.now(); updateUndo();
}
function updateUndo() { $('#undo-button').disabled = !history.length; $('#redo-button').disabled = !future.length; }
function getPath(object, path) { return path.split('.').reduce((o, key) => o?.[key], object); }
function setPath(object, path, value) { const keys = path.split('.'); const key = keys.pop(); keys.reduce((o, part) => o[part], object)[key] = value; }
function dirty(rerender = false) {
  editVersion++; savedState('Cambios sin guardar'); clearTimeout(saveTimer);
  if (projectId) saveTimer = setTimeout(() => saveNow().catch(error => toast(error.message, true)), 900);
  updateMeta(); if (rerender) scheduleRender();
}
function cleanDocument(data) { const {id, ...document} = data; return document; }
async function saveNow() {
  clearTimeout(saveTimer);
  if (!projectId) return;
  const version = editVersion, snapshot = copy(project), id = projectId;
  const job = saveChain.catch(() => {}).then(async () => {
    if (projectId !== id) return;
    snapshot.revision = project.revision;
    savedState('Guardando…');
    try {
      const saved = await api(`/api/projects/${id}`, {method: 'PUT', body: snapshot});
      if (projectId === id) { project.revision = saved.revision; if (version === editVersion) savedState('Todo guardado'); }
      return saved;
    } catch (error) { savedState('No se pudo guardar', true); throw error; }
  });
  saveChain = job; return job;
}
function updateMeta() {
  $('#project-title').textContent = project.name; $('#business-name').textContent = project.business.name;
  $('#document-kind').textContent = projectId ? 'Web' : 'Plantilla';
  $('#business-avatar').textContent = project.business.name[0].toUpperCase(); $('#module-count').textContent = project.modules.length;
  $('#site-address').textContent = (project.business.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mi-sitio') + '.web';
}
async function loadProject(id) {
  const data = await api(`/api/projects/${id}`);
  localStorage.setItem('modulo-project', data.id);
  await openDocument(cleanDocument(data), data.id);
}
async function openDocument(document, id = null) {
  clearTimeout(saveTimer);
  clearTimeout(renderTimer);
  project = document; projectId = id; selectedId = project.modules[0]?.id;
  history = []; future = []; editVersion = 0;
  setProjectControls(true);
  updateMeta(); renderOutline(); renderInspector(); updateUndo(); await renderCanvas();
  savedState(id ? 'Todo guardado' : 'Plantilla sin guardar');
}
async function canLeaveDocument() {
  if (project && !projectId && $('#save-status').textContent !== 'Todo guardado') {
    return confirm('Esta plantilla tiene cambios sin guardar. ¿Quieres salir del borrador?');
  }
  await saveNow();
  return true;
}
for (const link of $$('.app-brand, .editor-home')) {
  link.addEventListener('click', async event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    try {
      if (await canLeaveDocument()) location.assign(link.href);
    } catch (error) { toast(error.message, true); }
  });
}
function setProjectControls(enabled) {
  for (const id of ['business-button','business-settings','save-template-button','module-search']) {
    $('#'+id).disabled = !enabled;
  }
  for (const id of ['preview-button','finish-button','save-button']) {
    $('#'+id).disabled = !enabled || !projectId;
  }
  $('#workspace-right').inert = !enabled;
  updateUndo();
}
async function createProject(template) {
  const document = await api(`/api/templates/${template}`);
  const result = await api('/api/projects', {method: 'POST', body: document}); await loadProject(result.id);
}
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(() => renderCanvas().catch(e => { if (e.name !== 'AbortError') toast(e.message, true); }), 180); }
async function renderCanvas() {
  if (renderController) renderController.abort(); renderController = new AbortController();
  const html = await api('/api/render', {method: 'POST', body: project, raw: true, signal: renderController.signal});
  $('#canvas').innerHTML = html; selectSection();
}
function selectSection() {
  $$('.site-section', $('#canvas')).forEach(el => { el.classList.toggle('selected', el.dataset.module === selectedId); el.dataset.label = moduleName(el.dataset.kind);
    if(!el.querySelector('.module-canvas-tools')){const tools=document.createElement('div');tools.className='module-canvas-tools';tools.contentEditable='false';tools.innerHTML=`<button type="button" draggable="true" data-outline="${el.dataset.module}" title="Arrastrar para reordenar" aria-label="Arrastrar módulo">${icon('drag')}</button><button type="button" data-canvas-move="-1" title="Subir" aria-label="Subir desde lienzo">${icon('up')}</button><button type="button" data-canvas-move="1" title="Bajar" aria-label="Bajar desde lienzo">${icon('down')}</button><button type="button" data-canvas-delete title="Eliminar" aria-label="Eliminar desde lienzo">${icon('trash')}</button>`;el.prepend(tools);} });
}
function selectModule(id, scroll = false) {
  if (!project.modules.some(m => m.id === id)) return;
  selectedId = id; renderOutline(); renderInspector(); selectSection();
  if (scroll) $(`[data-module="${id}"]`, $('#canvas'))?.scrollIntoView({behavior: 'smooth', block: 'center'});
}
function renderOutline() {
  $('#outline').innerHTML = project.modules.map((m, i) => `<div class="outline-row ${m.id === selectedId ? 'active' : ''}" draggable="true" data-outline="${m.id}" role="button" tabindex="0" aria-label="${esc(moduleName(m.kind))}, posición ${i + 1}"><span class="outline-grip">${icon('drag')}</span>${icon(catalog.modules.find(c => c.kind === m.kind).icon)}<span class="module-label">${esc(moduleName(m.kind).replace(' principal', '').replace(' de imágenes', '').replace(' de productos', ''))}</span><small>${String(i + 1).padStart(2, '0')}</small></div>`).join('');
  $('#module-count').textContent = project.modules.length;
}
function inputField(label, path, value, {area = false, title = false, max = 1800} = {}) {
  return `<div class="field"><label for="field-${path}">${esc(label)}</label>${area ? `<textarea id="field-${path}" data-field="${path}" maxlength="${max}" class="${title ? 'title-input' : ''}">${esc(value)}</textarea>` : `<input id="field-${path}" data-field="${path}" maxlength="${max}" value="${esc(value)}">`}</div>`;
}
function imageFields(content, prefix = '') {
  const path = prefix + 'image';
  return `<div class="field"><label>Imagen del módulo</label>${content.image ? `<img class="inspector-image" src="${esc(content.image)}" alt="Vista previa de la imagen">` : ''}<div class="image-actions"><button class="button" data-upload="${path}">${icon('upload')}Subir imagen</button><button class="button" data-ai-image="${path}" ${projectId?'':'disabled title="Disponible al editar una web"'}>${icon('spark')}Crear con IA</button></div></div>${inputField('Descripción de imagen (accesibilidad)', prefix + 'alt', content.alt, {max:200})}`;
}
function renderInspector() {
  const m = selected(); if (!m) { $('#inspector').innerHTML = '<p class="empty-state">Selecciona un módulo para personalizarlo.</p>'; return; }
  const c = m.content;
  let html = `<div class="inspector-heading"><strong>Personalizar módulo</strong><div class="inspector-actions"><button class="icon-button" data-move="-1" title="Subir módulo" aria-label="Subir módulo">${icon('up')}</button><button class="icon-button" data-move="1" title="Bajar módulo" aria-label="Bajar módulo">${icon('down')}</button><button class="icon-button" data-duplicate title="Duplicar módulo" aria-label="Duplicar módulo">${icon('duplicate')}</button><button class="icon-button" data-delete title="Eliminar módulo" aria-label="Eliminar módulo">${icon('trash')}</button></div></div><p class="inspector-subtitle">${esc(moduleName(m.kind))}</p>`;
  html += inputField('Texto superior', 'eyebrow', c.eyebrow, {max:100});
  for (const field of ['title', 'description']) html += `<div class="field"><div class="field-head"><label for="edit-${field}">${field === 'title' ? 'Título' : 'Descripción'}</label><button class="ai-text-button" data-ai-text="${field}" ${projectId?'':'disabled title="Disponible al editar una web"'}>${icon('spark')}Mejorar con IA</button></div><textarea id="edit-${field}" data-field="${field}" maxlength="${field === 'title' ? 180 : 1800}" class="${field === 'title' ? 'title-input' : ''}">${esc(c[field])}</textarea></div>`;
  if (m.kind === 'hero') html += imageFields(c);
  if (['hero', 'cta'].includes(m.kind)) html += `<details class="inspector-details"><summary>Botón y destino</summary>${inputField('Texto del botón', 'button', c.button, {max:60})}${inputField('Enlace', 'url', c.url, {max:600})}<p class="text-help">Usa https://, mailto:, tel: o un ancla interna. Disponibles: ${project.modules.map(x => '#' + ({products:'productos',features:'servicios',pricing:'planes',contact:'contacto',hero:'inicio',carousel:'galeria',faq:'preguntas',cta:'empezar',testimonials:'opiniones'}[x.kind])).filter((x,i,a) => a.indexOf(x) === i).join(', ')}.</p></details>`;
  if (['products', 'carousel', 'features', 'pricing', 'testimonials', 'faq'].includes(m.kind)) {
    html += `<details class="inspector-details"><summary>Elementos (${c.items.length})</summary>`;
    c.items.forEach((item, i) => {
      const p = `items.${i}.`; html += `<div class="image-item-title">ELEMENTO ${String(i + 1).padStart(2, '0')}</div>`;
      html += inputField('Título', p + 'title', item.title, {max:150}) + inputField('Descripción', p + 'description', item.description, {area:true,max:1200});
      if (['products', 'carousel'].includes(m.kind)) html += imageFields(item, p);
      if (['pricing', 'products'].includes(m.kind)) html += inputField('Precio (texto)', p + 'price', item.price, {max:60}) + inputField('Etiqueta', p + 'badge', item.badge, {max:50}) + inputField('Texto del botón', p + 'button', item.button, {max:60}) + inputField('Destino del botón', p + 'url', item.url, {max:600});
      if (m.kind === 'pricing') html += `<div class="field"><label for="features-${i}">Beneficios (uno por línea)</label><textarea id="features-${i}" data-features="${i}" maxlength="1280">${esc(item.features.join('\n'))}</textarea></div>`;
      html += `<button class="card-delete" data-remove-item="${i}">Eliminar elemento ${i + 1}</button>`;
    });
    html += `<button class="button small wide" data-add-item ${c.items.length >= 8 ? 'disabled' : ''}>${icon('plus')}Agregar elemento</button></details>`;
  }
  html += `<details class="inspector-details"><summary>Colores de este módulo</summary><div class="field"><label for="module-tone">Fondo y contraste</label><select id="module-tone" data-tone>${[['inherit','Seguir paleta de la web'],['panel','Fondo suave de la paleta'],['light','Claro'],['dark','Nocturno (texto claro)'],['primary','Color principal'],['secondary','Color secundario'],['custom','Color personalizado']].map(([value,label])=>`<option value="${value}" ${(m.tone||'inherit')===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label for="module-background">Fondo personalizado</label><input id="module-background" type="color" data-background value="${esc(m.background||'#ffffff')}"></div><p class="text-help">El texto y los detalles se ajustan automáticamente para mantener contraste.</p></details>`;
  html += `<details class="inspector-details"><summary>Notas para el diseñador</summary><div class="field"><label for="module-notes">Detalles que quieres afinar</label><textarea id="module-notes" data-notes maxlength="1500" placeholder="Ej.: Un tono más cercano y destacar el diseño local…">${esc(m.notes)}</textarea></div><p class="text-help">El diseñador usará estas notas al revisar los textos con IA.</p></details>`;
  $('#inspector').innerHTML = html;
}
function thumbnail(kind) {
  const lines = '<span class="mini-line heading"></span><span class="mini-line"></span><span class="mini-line short"></span>';
  if (['hero', 'cta', 'contact'].includes(kind)) return `<div class="module-thumb ${kind === 'contact' ? 'mini-contact' : ''}"><span class="mini-nav"></span><div class="mini-copy">${lines}<span class="mini-line cta"></span></div><div class="mini-picture"></div></div>`;
  if (kind === 'faq') return '<div class="module-thumb"><div class="mini-faq"><span></span><span></span><span></span><span></span></div></div>';
  if (kind === 'carousel') return '<div class="module-thumb"><div class="mini-gallery"><div class="mini-picture"></div><div class="mini-picture"></div><div class="mini-picture"></div></div></div>';
  return `<div class="module-thumb ${kind === 'pricing' ? 'mini-pricing' : ''}"><div class="mini-cards">${[0,1,2].map(() => `<div class="mini-card">${kind === 'products' ? '<div class="mini-picture"></div>' : ''}${lines}</div>`).join('')}</div></div>`;
}
function renderLibrary() {
  const term = $('#module-search').value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matches = catalog.modules.filter(m => (category === 'Todos' || m.category === category) && `${m.name} ${m.description} ${m.category}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term));
  $('#module-library').innerHTML = matches.length ? matches.map(m => `<article class="module-card" draggable="true" data-kind="${m.kind}">${thumbnail(m.kind)}<div class="module-card-info"><div><h3>${esc(m.name)}</h3><p>${esc(m.description)}</p></div><button class="add-module" data-add="${m.kind}" aria-label="Agregar ${esc(m.name)}">${icon('plus')}</button></div></article>`).join('') : '<div class="empty-state">No encontramos ese módulo.<br>Prueba con «productos» o «carrusel».</div>';
  $('#library-result-count').textContent = matches.length;
}
function newId() { return 'm-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12); }
function addModule(kind, index) {
  if (project.modules.length >= 30) { toast('Puedes añadir hasta 30 módulos por web.', true); return; }
  checkpoint(); const m = {id:newId(), kind, content:copy(catalog.defaults[kind]), notes:''};
  // Normalize optional card properties using the same bounded defaults as the API.
  m.content = {eyebrow:'', title:'', description:'', button:'Hablemos', url:'#contacto', image:'', alt:'', items:[], ...m.content};
  m.content.items = m.content.items.map(c => ({title:'',description:'',price:'',badge:'',image:'',alt:'',button:'Conocer más',url:'#contacto',features:[],...c}));
  project.modules.splice(index ?? project.modules.length, 0, m); selectedId = m.id;
  renderOutline(); renderInspector(); dirty(true); toast(`${moduleName(kind)} agregado`);
}
function moveModule(id, destination) {
  const source = project.modules.findIndex(m => m.id === id); if (source < 0) return;
  checkpoint(); const [m] = project.modules.splice(source, 1); if (destination > source) destination--;
  project.modules.splice(Math.max(0, destination), 0, m); renderOutline(); dirty(true);
}

$('#outline').addEventListener('click', e => { const row = e.target.closest('[data-outline]'); if (row) selectModule(row.dataset.outline, true); });
$('#outline').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const row = e.target.closest('[data-outline]'); if (row) {e.preventDefault();selectModule(row.dataset.outline, true);} } });
$('#canvas').addEventListener('click', e => {
  const tool=e.target.closest('.module-canvas-tools button');
  if(tool){e.preventDefault();const id=tool.closest('[data-module]').dataset.module;selectModule(id);const index=project.modules.findIndex(m=>m.id===id);if(tool.hasAttribute('data-canvas-delete')){checkpoint();project.modules.splice(index,1);selectedId=project.modules[Math.min(index,project.modules.length-1)]?.id;renderOutline();renderInspector();dirty(true);toast('Módulo eliminado. Puedes deshacer.');}else if(tool.hasAttribute('data-canvas-move')){const d=Number(tool.dataset.canvasMove);if(index+d>=0&&index+d<project.modules.length)moveModule(id,index+(d>0?2:-1));}return;}

  const section = e.target.closest('[data-module]'); if (section && section.dataset.module !== selectedId) selectModule(section.dataset.module);
  const link = e.target.closest('a'); if (link) { e.preventDefault(); const href = link.getAttribute('href'); if (href?.startsWith('#')) { const dest = document.getElementById(href.slice(1)); if (dest && $('#canvas').contains(dest)) dest.scrollIntoView({behavior:'smooth',block:'center'}); } }
});
$('#canvas').addEventListener('beforeinput', e => { if (e.target.matches('[contenteditable]')) checkpoint(true); });
$('#canvas').addEventListener('site-theme-changed',e=>{if(!project)return;checkpoint();project.color_mode=e.detail.mode;dirty();});
$('#canvas').addEventListener('paste', e => { if (e.target.closest('[contenteditable]')) {e.preventDefault(); const text = e.clipboardData.getData('text/plain'); const selection = getSelection(); if (selection.rangeCount) {const range=selection.getRangeAt(0);range.deleteContents();range.insertNode(document.createTextNode(text));range.collapse(false);e.target.dispatchEvent(new Event('input',{bubbles:true}));}} });
$('#canvas').addEventListener('input', e => {
  const el = e.target.closest('[data-path]'); if (!el) return;
  const m = project.modules.find(m => m.id === el.closest('[data-module]').dataset.module); if (!m) return;
  const key=el.dataset.path.split('.').pop(), isCard=el.dataset.path.startsWith('items.');
  const limit={eyebrow:100,title:isCard?150:180,description:isCard?1200:1800,price:60}[key]||1800;
  let value=el.innerText.replace(/\r/g, '');
  if(value.length>limit){value=value.slice(0,limit);el.textContent=value;toast(`Este campo admite hasta ${limit} caracteres.`,true);}
  setPath(m.content, el.dataset.path, value);
  const field = $$('[data-field]', $('#inspector')).find(input => input.dataset.field === el.dataset.path);
  if (field && document.activeElement !== field) field.value = getPath(m.content, el.dataset.path);
  dirty();
});
$('#inspector').addEventListener('input', e => {
  const m = selected(); if (!m) return; checkpoint(true);
  if (e.target.dataset.field) setPath(m.content, e.target.dataset.field, e.target.value);
  else if(e.target.hasAttribute('data-tone'))m.tone=e.target.value;
  else if(e.target.hasAttribute('data-background')){m.background=e.target.value;m.tone='custom';$('#module-tone').value='custom';}
  else if (e.target.hasAttribute('data-notes')) m.notes = e.target.value;
  else if (e.target.hasAttribute('data-features')) m.content.items[Number(e.target.dataset.features)].features = e.target.value.split('\n').filter(Boolean).slice(0,8).map(v => v.slice(0,160));
  else return;
  dirty(!e.target.hasAttribute('data-notes'));
});
$('#inspector').addEventListener('click', async e => {
  const button = e.target.closest('button'); const m = selected(); if (!button || !m) return;
  try {
    if (button.hasAttribute('data-move')) {const i=project.modules.indexOf(m), d=Number(button.dataset.move);if(i+d<0||i+d>=project.modules.length)return;moveModule(m.id,i+(d>0?2:-1));}
    if (button.hasAttribute('data-duplicate')) {if(project.modules.length>=30)return toast('Máximo 30 módulos.',true);checkpoint();const duplicate=copy(m);duplicate.id=newId();project.modules.splice(project.modules.indexOf(m)+1,0,duplicate);selectModule(duplicate.id);dirty(true);}
    if (button.hasAttribute('data-delete')) {checkpoint();project.modules=project.modules.filter(x=>x.id!==m.id);selectedId=project.modules[0]?.id;renderOutline();renderInspector();dirty(true);toast('Módulo eliminado. Puedes deshacer el cambio.');}
    if (button.hasAttribute('data-remove-item')) {checkpoint();m.content.items.splice(Number(button.dataset.removeItem),1);renderInspector();dirty(true);}
    if (button.hasAttribute('data-add-item')) {checkpoint();const first=catalog.defaults[m.kind].items[0];m.content.items.push({title:'Nuevo elemento',description:'Describe este elemento.',price:'',badge:'',image:'',alt:'',button:'Conocer más',url:'#contacto',features:[],...copy(first),title:'Nuevo elemento'});renderInspector();$('details', $('#inspector')).open=true;dirty(true);}
    if (button.hasAttribute('data-upload')) {uploadTarget={moduleId:m.id,path:button.dataset.upload};$('#image-upload').click();}
    if (button.hasAttribute('data-ai-text')) await openAI('text',button.dataset.aiText);
    if (button.hasAttribute('data-ai-image')) await openAI('image',button.dataset.aiImage);
  } catch(error) {toast(error.message,true);}
});
$('#image-upload').addEventListener('change', async e => {
  const file=e.target.files[0], target=uploadTarget;e.target.value='';if(!file||!target)return;
  if(file.size>8*1024*1024)return toast('La imagen debe pesar menos de 8 MB.',true);
  try {toast('Preparando la imagen…');const form=new FormData();form.append('file',file);const data=await api('/api/assets',{method:'POST',body:form});const m=project.modules.find(m=>m.id===target.moduleId);if(!m)return;checkpoint();setPath(m.content,target.path,data.url);const altPath=target.path.replace(/image$/,'alt');if(!getPath(m.content,altPath))setPath(m.content,altPath,'Imagen de '+project.business.name);renderInspector();dirty(true);toast('Imagen subida y optimizada.');} catch(error){toast(error.message,true);}
});
$('#module-search').addEventListener('input', renderLibrary);
$('#category-tabs').addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;category=button.dataset.category;$$('[data-category]').forEach(b=>b.classList.toggle('active',b===button));renderLibrary();});
$('#module-library').addEventListener('click',e=>{const button=e.target.closest('[data-add]');if(button)addModule(button.dataset.add);});

function dragStart(e) {
  const palette=e.target.closest('.module-card[data-kind]'), row=e.target.closest('[data-outline]');if(!palette&&!row)return;
  const data=palette?{kind:palette.dataset.kind}:{id:row.dataset.outline};e.dataTransfer.setData('application/x-modulo',JSON.stringify(data));e.dataTransfer.effectAllowed=palette?'copy':'move';$('#canvas-wrap').classList.add('dragging');
}
// Pointer sorting on canvas handles also supports touch devices and prevents
// native text/image dragging from competing with content editing.
let canvasSort=null;
$('#canvas').addEventListener('pointerdown',e=>{const handle=e.target.closest('.module-canvas-tools [draggable]');if(!handle||e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);canvasSort={id:handle.dataset.outline,x:e.clientX,y:e.clientY,moved:false};});
document.addEventListener('pointermove',e=>{if(!canvasSort)return;if(Math.hypot(e.clientX-canvasSort.x,e.clientY-canvasSort.y)<8&&!canvasSort.moved)return;canvasSort.moved=true;$('#canvas-wrap').classList.add('dragging');$$('.drop-before').forEach(el=>el.classList.remove('drop-before'));const index=dropIndex(e.clientY);$$('[data-module]',$('#canvas'))[index]?.classList.add('drop-before');const area=$('#canvas-scroll'),r=area.getBoundingClientRect();if(e.clientY<r.top+50)area.scrollTop-=15;else if(e.clientY>r.bottom-50)area.scrollTop+=15;});
document.addEventListener('pointerup',e=>{if(!canvasSort)return;const drag=canvasSort;canvasSort=null;$('#canvas-wrap').classList.remove('dragging');$$('.drop-before').forEach(el=>el.classList.remove('drop-before'));const r=$('#canvas-scroll').getBoundingClientRect();if(drag.moved&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)moveModule(drag.id,dropIndex(e.clientY));});
document.addEventListener('pointercancel',()=>{canvasSort=null;$('#canvas-wrap').classList.remove('dragging');$$('.drop-before').forEach(el=>el.classList.remove('drop-before'));});
document.addEventListener('dragstart',dragStart);
document.addEventListener('dragend',()=>{$('#canvas-wrap').classList.remove('dragging');$$('.drop-before').forEach(el=>el.classList.remove('drop-before'));});
function dropIndex(y) {
  const sections=$$('[data-module]',$('#canvas'));
  const before=sections.find(el=>{const r=el.getBoundingClientRect();return y<r.top+r.height/2;});
  return before?project.modules.findIndex(m=>m.id===before.dataset.module):project.modules.length;
}
$('#canvas-wrap').addEventListener('dragover',e=>{if(!e.dataTransfer.types.includes('application/x-modulo'))return;e.preventDefault();$$('.drop-before').forEach(el=>el.classList.remove('drop-before'));const index=dropIndex(e.clientY);const section=$$('[data-module]',$('#canvas'))[index];section?.classList.add('drop-before');const area=$('#canvas-scroll'),rect=area.getBoundingClientRect();if(e.clientY<rect.top+70)area.scrollTop-=18;if(e.clientY>rect.bottom-70)area.scrollTop+=18;});
$('#canvas-wrap').addEventListener('drop',e=>{e.preventDefault();let data;try{data=JSON.parse(e.dataTransfer.getData('application/x-modulo'));}catch{return;}const index=dropIndex(e.clientY);if(data.kind&&catalog.defaults[data.kind])addModule(data.kind,index);else if(data.id)moveModule(data.id,index);$('#canvas-wrap').classList.remove('dragging');$$('.drop-before').forEach(el=>el.classList.remove('drop-before'));});
$('#outline').addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-modulo'))e.preventDefault();});
$('#outline').addEventListener('drop',e=>{e.preventDefault();const row=e.target.closest('[data-outline]');let data;try{data=JSON.parse(e.dataTransfer.getData('application/x-modulo'));}catch{return;}if(data.id)moveModule(data.id,row?project.modules.findIndex(m=>m.id===row.dataset.outline):project.modules.length);});

function undo(redo=false) {const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(JSON.stringify(project));const revision=project.revision;project=JSON.parse(from.pop());project.revision=revision;if(!selected())selectedId=project.modules[0]?.id;lastCheckpoint=0;renderOutline();renderInspector();updateUndo();dirty(true);}
$('#undo-button').onclick=()=>undo();$('#redo-button').onclick=()=>undo(true);
$$('[data-device]').forEach(b=>b.onclick=()=>{$$('[data-device]').forEach(x=>x.classList.toggle('active',x===b));$('#canvas-wrap').classList.toggle('mobile',b.dataset.device==='mobile');});
$('#save-button').onclick=()=>saveNow().then(()=>toast('Web guardada en Mis webs.')).catch(e=>toast(e.message,true));
$('#account-button').onclick=async()=>{try{await saveNow();await accountScreen();}catch(error){toast(error.message,true);}};
document.addEventListener('keydown',e=>{const typing=e.target.matches('input,textarea,[contenteditable]');if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('#save-button').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!typing){e.preventDefault();undo(e.shiftKey);}if(e.key==='/'&&!typing&&!$('#modal').open){e.preventDefault();$('#module-search').focus();}});
window.addEventListener('beforeunload',e=>{if(project&&$('#save-status').textContent!=='Todo guardado'){e.preventDefault();e.returnValue='';}});

function showModal(title, content, eyebrow='TU ESPACIO CREATIVO') {modalEpoch++;$('#modal-title').textContent=title;$('#modal-eyebrow').textContent=eyebrow;$('#modal-content').innerHTML=content;if(!$('#modal').open)$('#modal').showModal();return modalEpoch;}
function closeModal() {modalEpoch++;$('#modal').close();}
$('#close-modal').onclick=closeModal;
$('#modal').addEventListener('cancel',e=>{if(!session?.authenticated){e.preventDefault();return;}modalEpoch++;});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')&&session?.authenticated){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function showSaveTemplate() {
  const isWeb=Boolean(projectId);
  const epoch=showModal('Guardar como plantilla',`
    <p class="modal-description">${isWeb ? 'Guarda una copia con sus textos, imágenes y estilos. Puedes seguir editando la web desde Mis webs.' : 'Guarda este diseño en Mis plantillas para reutilizarlo.'}</p>
    <form id="save-template-form" class="field">
      <label for="template-name">Nombre de la plantilla</label>
      <input id="template-name" name="name" required maxlength="100" value="${esc(project.name)}">
      <p class="inline-error" id="template-error" role="alert" hidden></p>
      <div class="modal-footer"><button type="submit" class="button primary">Guardar plantilla</button></div>
    </form>`,'MIS PLANTILLAS');
  $('#save-template-form').onsubmit=async event=>{
    event.preventDefault();
    const button=event.submitter, name=$('#template-name').value.trim(), version=editVersion;
    const current=project;
    const body=isWeb ? {project_id:projectId,name} : {document:copy(current),name};
    button.disabled=true;
    try {
      await saveNow();
      await api('/api/saved-templates',{method:'POST',body});
      if (!isWeb && project===current && version===editVersion) {
        project.name=name;
        updateMeta();
        savedState('Todo guardado');
      }
      if (modalEpoch===epoch) closeModal();
      toast('Plantilla guardada en Mis plantillas.');
    } catch(error) {
      const message=modalEpoch===epoch && $('#template-error');
      if (message) {message.textContent=error.message;message.hidden=false;}
    } finally {button.disabled=false;}
  };
}
$('#save-template-button').onclick=showSaveTemplate;

async function showTemplates(asDraft = false) {
  try {
    const saved=await api('/api/saved-templates');
    await refreshUsage();
    const label=asDraft?'Personalizar copia':'Crear web';
    const limits=usage.plan ? `<p>${usage.templates_used} de ${usage.templates_limit} plantillas personales guardadas.</p>` : '';
    const cards=catalog.templates.map(t=>`
      <article class="template-card" style="--template-color:${esc(t.color)};--template-secondary:${esc(t.secondary)}">
        <div class="template-preview"><img src="/static/images/${t.id==='tienda'?'product':t.id==='servicios'?'studio':'desk'}.svg" alt=""><span>${esc(t.name)}</span></div>
        <div class="template-card-content">
          <div class="template-swatches" aria-hidden="true"><i></i><i></i><i></i></div>
          <h3>${esc(t.name)}</h3><span class="tag">${esc(t.tag)}</span><p>${esc(t.description)}</p>
          <button class="button" data-base-template="${t.id}" aria-label="${label} con ${esc(t.name)}">${label} ${icon('arrow')}</button>
        </div>
      </article>`).join('');
    const personal=saved.map(t=>`<div class="template-library-row">
      <strong>${esc(t.name)}</strong>
      <button class="button" data-use-saved="${t.id}" aria-label="${label} con ${esc(t.name)}">${label}</button>
      <button class="button" data-delete-saved="${t.id}" aria-label="Eliminar ${esc(t.name)}">Eliminar</button>
    </div>`).join('') || '<p>Las plantillas que guardes aparecerán aquí.</p>';
    showModal(asDraft?'Crear plantilla personal':'Plantillas',`
      <p class="modal-description">${asDraft ? 'Elige un punto de partida, edítalo y pulsa Guardar como plantilla.' : 'Crea una web a partir de una base o de una plantilla personal.'}</p>
      <div class="document-actions template-mode"><button class="button" id="template-mode">${asDraft?'Volver a Plantillas':'Crear plantilla personal'}</button></div>
      <section class="library-section"><h3>Plantillas base</h3><p>Siempre disponibles para empezar un nuevo diseño.</p><div class="template-grid">${cards}</div></section>
      <section class="library-section"><h3>Mis plantillas</h3>${limits}${personal}</section>
      ${projectId && !asDraft ? '<div class="modal-footer"><button type="button" class="button" id="restore-template">Restaurar la base de esta web</button></div>' : ''}`,'BIBLIOTECA DE DISEÑOS');
    $('#template-mode').onclick=()=>showTemplates(!asDraft);
    $$('[data-base-template], [data-use-saved]').forEach(button=>button.onclick=async()=>{
      button.disabled=true;
      try {
        if (!await canLeaveDocument()) return;
        const url=button.dataset.baseTemplate ? '/api/templates/'+button.dataset.baseTemplate : '/api/saved-templates/'+button.dataset.useSaved;
        const document=await api(url);
        if (asDraft) {
          await openDocument(document);
          closeModal();
          toast('Edita el diseño y pulsa Guardar como plantilla.');
        } else {
          const created=await api('/api/projects',{method:'POST',body:document});
          await loadProject(created.id);
          await businessModal();
        }
      } catch(error) {toast(error.message,true);}
      finally {button.disabled=false;}
    });
    $$('[data-delete-saved]').forEach(button=>button.onclick=async()=>{
      if (!confirm('¿Eliminar esta plantilla de tu biblioteca?')) return;
      button.disabled=true;
      try {
        await api('/api/saved-templates/'+button.dataset.deleteSaved,{method:'DELETE'});
        await showTemplates(asDraft);
      } catch(error) {toast(error.message,true);}
      finally {button.disabled=false;}
    });
    if ($('#restore-template')) $('#restore-template').onclick=async event=>{
      if (!confirm('¿Reemplazar el contenido de esta web con su plantilla base? Puedes deshacerlo en esta sesión.')) return;
      const button=event.currentTarget;
      button.disabled=true;
      try {
        await saveNow();
        const original=await api('/api/templates/'+project.template);
        checkpoint();
        project={...original,name:project.name,revision:project.revision};
        selectedId=project.modules[0]?.id;
        renderOutline();renderInspector();dirty(true);await saveNow();
        closeModal();toast('Plantilla original restaurada.');
      } catch(error) {toast(error.message,true);}
      finally {button.disabled=false;}
    };
  } catch(error) {toast(error.message,true);}
}
$('#templates-button').onclick=()=>showTemplates();

async function showWebs() {
  try {
    const rows=await api('/api/projects');
    showModal('Mis webs',`<p class="modal-description">Abre una web para editar sus textos, imágenes y secciones. Los cambios se guardan en esa misma web.</p>
      <div class="project-list">${rows.map(row=>`<button data-project="${row.id}"><span>${esc(row.name)}${row.id===projectId?' · Abierta':''}</span><small>Editar web · ${new Date(row.updated*1000).toLocaleDateString('es-CL')} ↗</small></button>`).join('') || '<p>Tus webs guardadas aparecerán aquí.</p>'}</div>
      <div class="modal-footer"><button class="button" id="import-button">Importar web desde JSON</button><button class="button primary" id="new-web">Crear una web</button></div>`,'TUS WEBS');
    $('#new-web').onclick=()=>showTemplates();
    $('#import-button').onclick=()=>$('#project-import').click();
    $$('[data-project]').forEach(button=>button.onclick=async()=>{
      button.disabled=true;
      try {
        if (!await canLeaveDocument()) return;
        await loadProject(button.dataset.project);
        closeModal();
      } catch(error) {toast(error.message,true);}
      finally {button.disabled=false;}
    });
  } catch(error) {toast(error.message,true);}
}
$('#projects-button').onclick=showWebs;
$('#project-import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>300000)return toast('El diseño JSON supera el tamaño permitido.',true);try{const data=JSON.parse(await file.text());if(!await canLeaveDocument())return;const saved=await api('/api/projects',{method:'POST',body:data});await loadProject(saved.id);closeModal();toast('Diseño importado. Las imágenes propias requieren sus recursos originales.');}catch(error){toast(error.message,true);}};
async function businessModal() {
  const fontCatalog = await api("/api/fonts");
  const b=project.business;
  showModal('Cuéntanos sobre tu negocio.',`<p class="modal-description">Estos datos dan contexto a tu web y a las mejoras con IA. Los textos existentes se conservan para que puedas afinarlos a tu gusto.</p><form id="business-form"><div class="field"><label for="business-logo">Logo de la cabecera</label><input type="file" id="business-logo" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG o WebP · máximo 8 MB.</small><img id="logo-preview" alt="Vista previa del logo" style="max-width:140px;max-height:54px;object-fit:contain" hidden><button type="button" class="button" id="remove-logo" hidden>Quitar logo</button><span id="logo-status" role="status"></span></div><div class="form-grid"><div class="field"><label for="project-name-input">Nombre del proyecto</label><input id="project-name-input" name="projectName" required maxlength="100" value="${esc(project.name)}"></div><div class="field"><label for="business-name-input">Nombre del negocio</label><input id="business-name-input" name="name" required maxlength="80" value="${esc(b.name)}"></div><div class="field full"><label for="business-industry">Rubro o producto</label><input id="business-industry" name="industry" maxlength="120" value="${esc(b.industry)}" placeholder="Ej.: Cerámica artesanal y objetos de diseño"></div><div class="field full"><label for="business-description">¿Qué ofreces y qué te hace diferente?</label><textarea id="business-description" name="description" maxlength="1200">${esc(b.description)}</textarea></div><div class="field full"><label for="business-audience">¿A quién te diriges?</label><input id="business-audience" name="audience" maxlength="300" value="${esc(b.audience)}" placeholder="Describe a tu cliente ideal"></div><div class="field"><label for="business-email">Correo de contacto</label><input id="business-email" type="email" name="email" maxlength="180" value="${esc(b.email)}" placeholder="hola@tunegocio.cl"></div><div class="field"><label for="business-phone">Teléfono de contacto</label><input id="business-phone" type="tel" name="phone" maxlength="30" value="${esc(b.phone)}" placeholder="+56 9 1234 5678"></div><div class="field full"><label for="business-accent">Color principal</label><div class="color-field"><input id="business-accent" type="color" name="accent" value="${esc(project.accent)}"><span>Se aplica a botones y detalles de todos los módulos.</span></div></div></div><div class="form-grid"><div class="field"><label for="color-mode">Aspecto general</label><select id="color-mode"><option value="light" ${project.color_mode!=='dark'?'selected':''}>Claro</option><option value="dark" ${project.color_mode==='dark'?'selected':''}>Nocturno</option></select></div><div class="field"><label for="color-harmony">Paleta a partir del color principal</label><select id="color-harmony">${[['complementary','Complementaria'],['analogous','Análoga'],['triadic','Triádica'],['monochrome','Monocromática']].map(([v,l])=>`<option value="${v}" ${project.harmony===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label for="manual-secondary"><input id="manual-secondary" type="checkbox" ${project.secondary?'checked':''}> Elegir color secundario manualmente</label><input id="secondary-color" type="color" value="${esc(project.secondary||'#b78865')}"></div><div class="field"><label>Paleta calculada</label><div id="palette-swatches" class="palette-swatches"></div><small id="palette-contrast"></small></div></div><div class="field"><label for="site-font">Fuente del sitio</label><select id="site-font"><option value="default">Original de la plantilla</option>${fontCatalog.google.map(name=>`<option value="${esc(name)}" ${project.font===name?'selected':''}>${esc(name)} · Google Fonts</option>`).join('')}${fontCatalog.uploads.map(f=>`<option value="${esc(f.value)}" ${project.font===f.value?'selected':''}>${esc(f.name)} · Mi fuente</option>`).join('')}</select><small>Se aplica a títulos y textos. Google Fonts requiere conexión y carga la fuente desde Google.</small><label for="custom-font">Subir mi fuente (TTF, OTF, WOFF o WOFF2 · máximo 2 MB)</label><input id="custom-font" type="file" accept=".ttf,.otf,.woff,.woff2"><small>Sube solo fuentes con permiso de uso web. Las fuentes propias se incluyen en el ZIP.</small><span id="font-upload-status" role="status"></span></div><p id="business-error" class="inline-error" hidden></p><div class="modal-footer"><p>Tu web se actualiza al guardar.</p><button type="submit" class="button primary">Guardar mi negocio ${icon('check')}</button></div></form>`,'EL CONTEXTO HACE LA DIFERENCIA');
  const updatePalette=async()=>{try{const primary=$('#business-accent').value;const options=await api('/api/palettes?primary='+encodeURIComponent(primary));if(!$('#palette-swatches'))return;const p=options.find(p=>p.harmony===$('#color-harmony').value);if(!$('#manual-secondary').checked)$('#secondary-color').value=p.secondary;$('#palette-swatches').innerHTML=[primary,$('#secondary-color').value,$('#color-mode').value==='dark'?'#151515':'#fafafa'].map(c=>`<span style="background:${c}" title="${c}"></span>`).join('');$('#palette-contrast').textContent='Texto del botón: '+p.contrast+':1 · Texto de fondos ajustado a 4,5:1.';}catch(error){toast(error.message,true);}};
  ['business-accent','color-harmony','manual-secondary','secondary-color','color-mode'].forEach(id=>$('#'+id).addEventListener('input',updatePalette));updatePalette();
  let logo=b.logo || '';
  const logoPreview=$('#logo-preview'), removeLogo=$('#remove-logo');
  function showLogo() {
    logoPreview.hidden=!logo;
    removeLogo.hidden=!logo;
    if (logo) logoPreview.src=logo;
    else logoPreview.removeAttribute('src');
  }
  showLogo();
  removeLogo.onclick=()=>{logo='';$('#business-logo').value='';showLogo();};
  $('#business-logo').onchange=async e=>{
    const file=e.target.files[0];
    if (!file) return;
    const submit=$('#business-form button[type=submit]'), status=$('#logo-status');
    submit.disabled=true;removeLogo.disabled=true;e.target.disabled=true;
    status.textContent='Subiendo logo…';
    try {
      const data=new FormData();
      data.append('file',file);
      logo=(await api('/api/assets',{method:'POST',body:data})).url;
      showLogo();
      status.textContent='Guarda los cambios para aplicar el logo.';
    } catch(error) { status.textContent=error.message; }
    finally { submit.disabled=false;removeLogo.disabled=false;e.target.disabled=false; }
  };
  $('#custom-font').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024){toast('La fuente supera 2 MB.',true);return;}const submit=$('#business-form button[type=submit]');submit.disabled=true;$('#font-upload-status').textContent='Validando fuente…';try{const form=new FormData();form.append('file',file);const result=await api('/api/fonts',{method:'POST',body:form});const option=document.createElement('option');option.value=result.value;option.textContent=result.name+' · Mi fuente';$('#site-font').append(option);$('#site-font').value=result.value;$('#font-upload-status').textContent='Fuente lista. Guarda para aplicarla.';}catch(error){$('#font-upload-status').textContent=error.message;}finally{submit.disabled=false;}};
  $('#business-form').onsubmit=async e=>{e.preventDefault();const data=new FormData(e.target),candidate=copy(project);candidate.name=data.get('projectName');candidate.accent=data.get('accent');candidate.color_mode=$('#color-mode').value;candidate.harmony=$('#color-harmony').value;candidate.secondary=$('#manual-secondary').checked?$('#secondary-color').value:'';candidate.font=$('#site-font').value;for(const key of ['name','industry','description','audience','email','phone'])candidate.business[key]=data.get(key)||'';candidate.business.logo=logo;try{await api('/api/render',{method:'POST',body:candidate,raw:true});checkpoint();project=candidate;dirty(true);await saveNow();closeModal();toast(projectId?'Información del negocio guardada.':'Cambios aplicados. Guarda la plantilla para conservarlos.');}catch(error){$('#business-error').textContent=error.message;$('#business-error').hidden=false;}};
}
$('#business-button').onclick=businessModal;$('#business-settings').onclick=businessModal;
$('#preview-button').onclick=async()=>{try{await saveNow();showModal('Así se verá tu sitio.',`<div class="preview-controls" role="group" aria-label="Opciones de vista previa"><button class="button active" data-preview-width="100%">Escritorio</button><button class="button" data-preview-width="390px">Móvil · 390 px</button><button class="button" data-preview-width="320px">Móvil pequeño · 320 px</button><button class="button" id="preview-theme">☾ / ☀ Probar modo nocturno</button></div><div class="preview-stage"><iframe class="preview-frame" title="Vista previa del sitio completo" sandbox="allow-scripts allow-same-origin allow-popups" src="/api/projects/${projectId}/preview"></iframe></div><div class="modal-footer"><p>El selector nocturno permite probar ambas versiones sin cambiar el aspecto guardado.</p><button class="button" id="preview-close">Seguir editando</button></div>`,'VISTA PREVIA');$('#preview-close').onclick=closeModal;$$('[data-preview-width]').forEach(b=>b.onclick=()=>{$('.preview-frame').style.width=b.dataset.previewWidth;$$('[data-preview-width]').forEach(x=>x.classList.toggle('active',x===b));});$('#preview-theme').onclick=()=>$('.preview-frame').contentWindow.postMessage({type:'modulo-toggle-theme'},location.origin);}catch(error){toast(error.message,true);}};

async function refreshUsage() {
  usage=await api('/api/usage');$('#ai-badge').textContent=session.ai_enabled?'Disponible':'Sin activar';
  $('#usage-progress').style.width=Math.min(100,usage.used/usage.limit*100)+'%';
  $('#usage-copy').textContent=session.ai_enabled?`${usage.used} de ${usage.limit} créditos internos · reinicio ${usage.resets}`:'Conecta tu clave de Kie para activar la IA.';
}
$('#usage-button').onclick=async()=>{try{await refreshUsage();const ops=await api('/api/operations');showModal('Cada generación, bajo control.',`<div class="ai-notice"><strong>${usage.used} / ${usage.limit} créditos · cupo ${usage.period}</strong><br>Hoy: ${usage.requests} / ${usage.request_limit} solicitudes. Texto: ${usage.costs.text}, imagen 1K: ${usage.costs.image}, diseñador: ${usage.costs.design}. Reinicio del cupo: ${usage.resets}.<br>Estos créditos son cupos del producto; no representan el precio cobrado por Kie.</div><p class="modal-description">${session.ai_enabled?'IA conectada.':'Para activarla, configura KIE_API_KEY y AI_ENABLED=true en el servidor.'} Las solicitudes fallidas o inciertas conservan la reserva para evitar reintentos que puedan duplicar el gasto.</p><table class="activity-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Estado</th><th>Cupo</th><th></th></tr></thead><tbody>${ops.map(op=>`<tr><td>${new Date(op.created*1000).toLocaleString('es-CL')}</td><td>${{text:'Texto',image:'Imagen',design:'Diseñador'}[op.kind]}</td><td>${esc({completed:'Completado',running:'En curso',uncertain:'Por verificar',failed:'Fallido'}[op.status]||op.status)}</td><td>${op.cost}</td><td>${op.kind==='image'&&op.status==='running'?`<button class="button small" data-resume="${op.id}" data-owner-project="${op.project_id}">Consultar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5">Aún no hay generaciones. Tu edición manual no consume créditos.</td></tr>'}</tbody></table>`,'CONSUMO Y ACTIVIDAD');$$('[data-resume]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const op=await api(`/api/operations/${b.dataset.resume}`);if(op.status==='completed')showModal('Tu imagen está lista.',`<div class="ai-result"><img src="${esc(op.result.image)}" alt="Imagen generada por IA"><p>La imagen está guardada en el servidor. Ábrela y súbela al módulo que prefieras.</p><a class="button" href="${esc(op.result.image)}" target="_blank" rel="noopener">Abrir imagen ${icon('external')}</a></div>`);else toast(op.status==='running'?'La imagen sigue en curso. Puedes volver a consultar.':op.result.message||'Operación terminada.');}catch(e){toast(e.message,true);}finally{b.disabled=false;}});}catch(error){toast(error.message,true);}};

async function openAI(kind, field) {
  if (!projectId) return;
  const m=selected();if(!m)return;await refreshUsage();const moduleId=m.id,source=getPath(m.content,field);
  const isImage=kind==='image',hasReference=isImage&&typeof source==='string'&&source.startsWith('/assets/');
  let referenceImage=hasReference?source:'';
  const epoch=showModal(isImage?'Una imagen para tu idea.':'Encuentra las palabras adecuadas.',`<div class="ai-notice"><strong>${isImage?'Dirección '+esc(session.models.image_director)+' · razonamiento alto + '+esc(session.models.image):session.models.text}</strong> · ${usage.costs[kind]} créditos internos por solicitud.<br>${session.ai_enabled?(isImage?'El director de imagen ajusta el encuadre y el prompt. La imagen terminada se coloca en el módulo; puedes deshacerla.':'La propuesta solo se aplicará cuando la elijas.'):'IA pendiente de configuración. Puedes seguir editando y subir imágenes sin costo de IA.'}</div><form id="ai-form">${isImage?`<div class="field"><label for="image-mode">Tipo de generación</label><select id="image-mode"><option value="new">Crear una imagen nueva</option><option value="edit" ${hasReference?'selected':''}>Usar una foto de mi producto</option></select><small>Sube la foto de tu producto y describe el ambiente. La referencia se enviará a Kie al generar.</small><label for="ai-reference">Foto de referencia (PNG, JPG o WebP · máximo 8 MB)</label><input id="ai-reference" type="file" accept="image/png,image/jpeg,image/webp"><img id="ai-reference-preview" class="reference-preview" ${hasReference?`src="${esc(source)}"`:'hidden'} alt="Foto de referencia del producto"><span id="ai-reference-status" role="status"></span></div>`:''}<div class="field"><label for="ai-prompt">${isImage?'Describe la imagen que necesitas':'¿Qué quieres mejorar?'}</label><textarea id="ai-prompt" required minlength="3" maxlength="1000" rows="4" placeholder="${isImage?'Ej.: Foto de producto sobre piedra clara, luz natural lateral y fondo cálido. Mantener la forma y el color del producto.':'Ej.: Un tono más cercano, directo y centrado en los beneficios.'}"></textarea></div><div class="modal-footer"><p>Una solicitud · sin reintentos automáticos</p><button class="button primary" type="submit" ${session.ai_enabled?'':'disabled'}>${icon('spark')}${isImage?'Generar imagen':'Proponer mejora'}</button></div></form><div id="ai-output"></div>`,'ASISTENTE CREATIVO');
  if(isImage)$('#ai-reference').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){toast('La foto supera 8 MB.',true);return;}const button=$('#ai-form button[type=submit]');button.disabled=true;$('#ai-reference-status').textContent='Subiendo referencia…';try{const data=new FormData();data.append('file',file);const result=await api('/api/assets',{method:'POST',body:data});if(modalEpoch!==epoch)return;referenceImage=result.url;$('#ai-reference-preview').src=referenceImage;$('#ai-reference-preview').hidden=false;$('#image-mode').value='edit';$('#ai-reference-status').textContent='Referencia lista. Describe el ambiente y genera la propuesta.';}catch(error){if(modalEpoch===epoch)$('#ai-reference-status').textContent=error.message;}finally{if(modalEpoch===epoch)button.disabled=!session.ai_enabled;}};
  $('#ai-form').onsubmit=async e=>{
    e.preventDefault();const button=$('button[type=submit]',e.target);button.disabled=true;
    try {
      await saveNow(); const prompt=$('#ai-prompt').value;const image=isImage&&$('#image-mode').value==='edit'?referenceImage:'';if(isImage&&$('#image-mode').value==='edit'&&!image)throw new Error('Sube una foto de tu producto antes de generar.');
      $('#ai-output').innerHTML='<div class="ai-progress"><span class="spinner"></span>'+ (isImage?'Luna está analizando el módulo y afinando la composición. Después se generará y colocará la imagen. Puede tardar unos minutos.':'Preparando una propuesta…')+'</div>';
      let op=await api(`/api/projects/${projectId}/ai/${kind}`,{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:{module_id:moduleId,prompt,field:isImage?'description':field,image,image_path:isImage?field:'image'}});
      if(isImage&&op.status==='running'){
        let polls=0;
        while(op.status==='running'&&polls++<90&&modalEpoch===epoch){await new Promise(r=>setTimeout(r,4000));if(modalEpoch!==epoch)break;op=await api(`/api/operations/${op.id}`);}
      }
      await refreshUsage();if(modalEpoch!==epoch)return;
      if(op.status!=='completed'){ $('#ai-output').innerHTML=`<div class="ai-notice">${esc(op.status==='running'?'La tarea sigue en curso. Puedes consultarla en «Consumo y actividad», incluso después de recargar.':op.result.message||'La operación no se completó. Revisa tu cuenta Kie antes de reintentar.')}</div>`;return; }
      let autoApplied=false;
      if(isImage&&op.result.applied){const target=project.modules.find(m=>m.id===moduleId);if(target&&getPath(target.content,field)===source){checkpoint();project.revision=Math.max(project.revision,op.result.revision);setPath(target.content,field,op.result.image);const base=field.replace(/image$/,'');setPath(target.content,base+'alt',op.result.brief.alt);setPath(target.content,base+'focal_x',op.result.brief.focal_x);setPath(target.content,base+'focal_y',op.result.brief.focal_y);autoApplied=true;renderInspector();dirty(true);}else{toast('La imagen quedó guardada en el servidor. Recarga para revisar la versión actual.');}}
      $('#ai-output').innerHTML=`<div class="ai-result">${isImage?`<img src="${esc(op.result.image)}" alt="${esc(op.result.brief?.alt||'Imagen generada por IA')}"><p>${esc(op.result.brief?.summary||'')}</p><p>${esc(op.result.apply_message||'')}</p><details><summary>Ver prompt afinado por Luna</summary><p>${esc(op.result.brief?.prompt||'')}</p></details>`:`<div>${esc(op.result.text)}</div>`}<div class="modal-footer"><button class="button" id="discard-ai">${autoApplied?'Deshacer imagen':'Descartar'}</button><button class="button primary" id="apply-ai">${autoApplied?'Conservar imagen':'Aplicar al módulo'} ${icon('check')}</button></div></div>`;
      $('#discard-ai').onclick=()=>{if(autoApplied)undo();closeModal();};
      $('#apply-ai').onclick=()=>{if(autoApplied){closeModal();return;}const target=project.modules.find(m=>m.id===moduleId);if(!target)return;checkpoint();setPath(target.content,field,isImage?op.result.image:op.result.text);renderInspector();dirty(true);closeModal();toast('Propuesta aplicada. Puedes seguir editándola.');};
    }catch(error){if(modalEpoch===epoch)$('#ai-output').innerHTML=`<p class="inline-error">${esc(error.message)}</p>`;await refreshUsage().catch(()=>{});}finally{if(modalEpoch===epoch)button.disabled=false;}
  };
}

async function finishWeb() {
  try {
    await saveNow();const result=await api(`/api/projects/${projectId}/review`,{method:'POST'});
    showModal('Los últimos detalles, resueltos.',`${result.valid?'<div class="review-success"><h3>Tu estructura está lista para entregar.</h3><p>El sitio se construye con los mismos componentes de tu editor. Puedes descargarlo y volver a editar este proyecto cuando quieras.</p></div>':'<div class="review-issue error">Hay enlaces o recursos pendientes. Corrígelos para exportar la web.</div>'}<div class="check-list">${result.checks.map(check=>`<div class="review-check">${icon('check')}${esc(check)}</div>`).join('')}</div>${result.issues.map(issue=>`<div class="review-issue ${issue.level}">${esc(issue.message)}</div>`).join('')}<div class="ai-notice"><strong>Una última mirada con IA</strong><br>El diseñador Terra puede armonizar títulos y descripciones usando tus notas. Sus propuestas se pueden revisar antes de aplicarlas. No consume créditos si no lo ejecutas.</div><div id="designer-output"></div><div class="modal-footer"><button class="button" id="design-ai" ${session.ai_enabled?'':'disabled'}>${icon('spark')}Revisar con Terra · ${usage.costs.design} cr.</button><button class="button" id="download-json">Guardar diseño JSON</button><button class="button primary" id="export-site" ${result.valid?'':'disabled'}>${icon('download')}Descargar web ZIP</button></div>`,'REVISIÓN Y ENTREGA');
    $('#download-json').onclick=()=>downloadFile('project.json',JSON.stringify(project,null,2),'application/json');
    $('#export-site').onclick=async()=>{try{const response=await fetch(`/api/projects/${projectId}/export`);if(!response.ok){const data=await response.json();throw new Error(data.detail?.message||'No se pudo exportar.');}downloadBlob('mi-sitio.zip',await response.blob());toast('Web descargada con HTML, CSS, imágenes y diseño editable.');}catch(e){toast(e.message,true);}};
    $('#design-ai').onclick=async e=>{
      const epoch=modalEpoch;e.target.disabled=true;$('#designer-output').innerHTML='<div class="ai-progress"><span class="spinner"></span>El diseñador está revisando tus módulos y notas…</div>';
      try {
        const op=await api(`/api/projects/${projectId}/ai/design`,{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()}});await refreshUsage();if(modalEpoch!==epoch)return;
        if(op.status!=='completed')throw new Error(op.result.message||'La revisión no se completó.');
        const suggestions=op.result.suggestions;
        $('#designer-output').innerHTML=suggestions.length?`<h3>Propuestas del diseñador</h3>${suggestions.map(item=>`<article class="suggestion"><h4>${esc(item.title)}</h4><p>${esc(item.description)}</p></article>`).join('')}<button class="button primary" id="apply-design">Aplicar ${suggestions.length} propuestas ${icon('check')}</button>`:'<div class="review-success">El diseñador no propone cambios. Tu contenido mantiene una línea coherente.</div>';
        if(suggestions.length)$('#apply-design').onclick=async()=>{checkpoint();suggestions.forEach(item=>{const m=project.modules.find(m=>m.id===item.module_id);if(m){m.content.title=item.title;m.content.description=item.description;}});renderInspector();dirty(true);await saveNow();closeModal();toast('Revisión aplicada. Puedes modificar nuevamente cada módulo.');};
      }catch(error){if(modalEpoch===epoch)$('#designer-output').innerHTML=`<p class="inline-error">${esc(error.message)}</p>`;}
    };
  }catch(error){toast(error.message,true);}
}
$('#finish-button').onclick=finishWeb;
function downloadBlob(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function downloadFile(name,data,type){downloadBlob(name,new Blob([data],{type}));}

function planOptions(selected) {
  return Object.entries(plans).map(([key,plan])=>`<option value="${key}" ${key===selected?'selected':''}>${esc(plan.name)} · ${plan.pages} páginas/mes · ${plan.templates} plantillas · ${plan.credits} créditos/mes</option>`).join('');
}
async function logout() {
  try {
    if (!await canLeaveDocument()) return;
    await api('/api/logout',{method:'POST'});
    localStorage.removeItem('modulo-project');
    location.replace('/');
  } catch(error) {toast(error.message,true);}
}
async function accountScreen() {
  if (session.workspace) {
    showModal('Cuenta de administración','<button class="button" id="logout-button">Cerrar sesión</button>');
    $('#logout-button').onclick=logout;
    return;
  }
  await refreshUsage();
  const desired=new URLSearchParams(location.search).get('plan');
  showModal('Cuenta y plan',`<p class="modal-description">${esc(plans[usage.plan].name)} · ${usage.pages_used}/${usage.pages_limit} páginas este mes · ${usage.templates_used}/${usage.templates_limit} plantillas · ${usage.used}/${usage.limit} créditos este mes.</p><form id="plan-form" class="field"><label for="account-plan">Plan</label><select id="account-plan" name="plan">${planOptions(Object.hasOwn(plans,desired)?desired:usage.plan)}</select><small>El cambio conserva el consumo del mes y los proyectos guardados.</small><button class="button primary" type="submit">Guardar plan</button></form><button class="button" id="logout-button">Cerrar sesión</button>`);
  $('#plan-form').onsubmit=async event=>{
    event.preventDefault();
    const button=event.currentTarget.querySelector('button'), plan=$('#account-plan').value;
    button.disabled=true;
    try {
      await api('/api/account/plan',{method:'PUT',body:{plan}});
      if (desired) window.history.replaceState(null,'',location.pathname);
      await accountScreen();toast('Plan actualizado.');
    } catch(error) { toast(error.message,true); }
    finally { button.disabled=false; }
  };
  $('#logout-button').onclick=logout;
}
async function boot() {
  try {
    setProjectControls(false);
    session=await api('/api/session');plans=await api('/api/plans');
    const desired=new URLSearchParams(location.search).get('plan');
    if (!session.editor_access) {
      location.replace('/acceso');
      return;
    }
    $('#account-button').hidden=false;
    catalog=await api('/api/catalog');renderLibrary();await refreshUsage();
    const existing=localStorage.getItem('modulo-project');
    if (existing) {
      try {await loadProject(existing);}
      catch(error) {if(error.status!==404)throw error;}
    }
    if (!project) {
      const rows=await api('/api/projects');
      if (rows.length) await loadProject(rows[0].id);
      else if (session.workspace) await createProject('tienda');
      else {
        savedState('Elige una plantilla');
        $('#canvas').innerHTML='<div class="loading-canvas">Abre Plantillas para crear tu primera web o plantilla personal.</div>';
      }
    }
    if (!session.workspace && Object.hasOwn(plans,desired)) await accountScreen();
    else if (!project) await showTemplates();
  } catch(error) {
    savedState('Sin conexión',true);toast(error.message,true);
    $('#canvas').innerHTML='<div class="loading-canvas">No se pudo abrir el editor. Recarga para volver a intentar.</div>';
  }
}
boot();
