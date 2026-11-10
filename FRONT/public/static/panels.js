'use strict';
(() => {
  const workspace = document.querySelector('.workspace');
  const handles = [...document.querySelectorAll('[data-panel-resizer]')];
  if (!workspace || handles.length !== 2) return;

  const STORAGE_KEY = 'modulo-panel-widths-v1';
  const DEFAULT = {left:240, right:280};
  const MIN = {left:230, right:250};
  const MAX = {left:420, right:460};
  const CENTER_MIN = 440;
  const GAPS = 20;
  const desktop = matchMedia('(min-width:961px)');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let preferred = {...DEFAULT};
  let actual = {...DEFAULT};
  let drag = null;
  let frame = 0;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    for (const side of ['left', 'right']) {
      if (Number.isFinite(saved?.[side])) preferred[side] = clamp(saved[side], MIN[side], MAX[side]);
    }
  } catch { /* A blocked or malformed preference must never prevent editing. */ }

  function savePreference() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferred)); } catch { }
  }

  function available() {
    // Narrow screens stack the panels. This fallback also handles wide OS scrollbars.
    const center = Math.min(CENTER_MIN, Math.max(0, workspace.clientWidth - GAPS - MIN.left - MIN.right));
    return workspace.clientWidth - GAPS - center;
  }

  function layout() {
    frame = 0;
    if (!desktop.matches) return;
    let left = preferred.left, right = preferred.right;
    const excess = Math.max(0, left + right - available());
    const slack = (left - MIN.left) + (right - MIN.right);
    if (excess && slack) {
      left -= excess * (left - MIN.left) / slack;
      right -= excess * (right - MIN.right) / slack;
    }
    actual = {left, right};
    workspace.style.setProperty('--left-panel-width', left + 'px');
    workspace.style.setProperty('--right-panel-width', right + 'px');
    handles.forEach(handle => {
      const side = handle.dataset.panelResizer;
      const other = side === 'left' ? 'right' : 'left';
      handle.setAttribute('aria-valuenow', Math.round(actual[side]));
      handle.setAttribute('aria-valuetext', Math.round(actual[side]) + ' píxeles');
      handle.setAttribute('aria-valuemax', Math.floor(Math.min(MAX[side], available() - actual[other])));
    });
  }

  function scheduleLayout() {
    if (!frame) frame = requestAnimationFrame(layout);
  }

  function reset(side) {
    preferred[side] = DEFAULT[side];
    layout();
    savePreference();
  }

  function finishDrag(cancel = false) {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (cancel) preferred = current.previous;
    if (current.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
    current.handle.classList.remove('resizing');
    document.body.classList.remove('panel-resizing');
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    layout();
    if (!cancel) savePreference();
  }

  handles.forEach(handle => {
    const side = handle.dataset.panelResizer;
    const other = side === 'left' ? 'right' : 'left';
    handle.addEventListener('pointerdown', event => {
      if (!desktop.matches || event.button !== 0 || drag) return;
      event.preventDefault();
      layout();
      handle.focus({preventScroll:true});
      drag = {handle, pointer:event.pointerId, x:event.clientX, width:actual[side], previous:{...preferred},
              max:Math.min(MAX[side], available() - actual[other])};
      // Keep the other panel still while the user moves this separator.
      preferred = {...actual};
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('resizing');
      document.body.classList.add('panel-resizing');
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || drag.handle !== handle || drag.pointer !== event.pointerId) return;
      const direction = side === 'left' ? 1 : -1;
      preferred[side] = clamp(drag.width + direction * (event.clientX - drag.x), MIN[side], drag.max);
      scheduleLayout();
    });
    handle.addEventListener('pointerup', event => { if (drag?.pointer === event.pointerId) finishDrag(); });
    handle.addEventListener('pointercancel', () => finishDrag(true));
    handle.addEventListener('lostpointercapture', () => finishDrag(true));
    handle.addEventListener('dblclick', () => reset(side));
    handle.addEventListener('keydown', event => {
      if (event.key === 'Escape' && drag) { event.preventDefault(); finishDrag(true); return; }
      if (!desktop.matches || !['ArrowLeft','ArrowRight','Home','End','Enter'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Enter') { reset(side); return; }
      layout();
      const max = Math.min(MAX[side], available() - actual[other]);
      const step = event.shiftKey ? 32 : 16;
      const delta = (event.key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 1 : -1) * step;
      preferred = {...actual, [side]:event.key === 'Home' ? MIN[side] : event.key === 'End' ? max : clamp(actual[side] + delta, MIN[side], max)};
      layout();
      savePreference();
    });
  });

  // Resizing the window adapts the layout, without discarding the preferred widths.
  const resize = () => { if (drag) finishDrag(true); layout(); };
  const observer = new ResizeObserver(resize);
  observer.observe(workspace);
  window.addEventListener('resize', resize);
  desktop.addEventListener('change', () => { finishDrag(true); layout(); });
  window.addEventListener('blur', () => finishDrag(true));
  window.addEventListener('pagehide', () => finishDrag(true));
  layout();
})();
