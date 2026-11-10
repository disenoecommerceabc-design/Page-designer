"""Generate reviewable HTML examples from the shared component renderer."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.catalog import TEMPLATES, new_project
from app.render import render

root = Path(__file__).resolve().parent.parent
target = root / 'plantillas'
target.mkdir(exist_ok=True)
for template in TEMPLATES:
    html = render(new_project(template['id']), full=True).replace('/static/', '../app/static/')
    (target / f"{template['id']}.html").write_text(html, encoding='utf-8')
print('3 plantillas HTML generadas. Comparten app/static/site.css y los mismos módulos.')
