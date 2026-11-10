function toggleSiteTheme(site) {
  if(!site)return;
  const mode=site.dataset.mode==='dark'?'light':'dark';
  const accent=site.style.getPropertyValue('--accent');
  site.style.cssText='--accent:'+accent+';'+site.dataset[mode];
  site.dataset.mode=mode;
  site.querySelectorAll('.site-section').forEach(section=>{section.style.cssText=section.dataset[mode];});
  site.dispatchEvent(new CustomEvent('site-theme-changed',{bubbles:true,detail:{mode}}));
}
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='modulo-toggle-theme')toggleSiteTheme(document.querySelector('.site'));});
document.addEventListener('click', (event) => {
  const theme=event.target.closest('[data-theme-toggle]');
  if(theme){toggleSiteTheme(theme.closest('.site'));return;}
  const button = event.target.closest('[data-slide]');
  if (!button) return;
  const track = button.closest('.carousel').querySelector('.carousel-track');
  const width = track.clientWidth + 20;
  const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
  const atStart = track.scrollLeft <= 2;
  const direction = Number(button.dataset.slide);
  track.scrollTo({left: direction > 0 && atEnd ? 0 : direction < 0 && atStart ? track.scrollWidth : track.scrollLeft + direction * width, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
});
