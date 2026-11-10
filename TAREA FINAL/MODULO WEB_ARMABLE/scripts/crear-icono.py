"""Native rendering of the existing stacked-module brand as a Windows icon."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
target = root / 'assets'
target.mkdir(exist_ok=True)
svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 40 40"><rect x="1" y="1" width="38" height="38" rx="10" fill="#356657"/><path d="m8 14 12-6 12 6-12 6Zm0 7 12 6 12-6M8 28l12 6 12-6" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>'''
(target / 'modulo.svg').write_text(svg, encoding='utf-8')
scale = 25.6
canvas = Image.new('RGBA', (1024,1024), (0,0,0,0))
draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle((scale,scale,39*scale,39*scale), radius=10*scale, fill='#356657')
for points in (
    [(8,14),(20,8),(32,14),(20,20),(8,14)],
    [(8,21),(20,27),(32,21)],
    [(8,28),(20,34),(32,28)],
):
    scaled=[(round(x*scale),round(y*scale)) for x,y in points]
    width=round(3*scale)
    draw.line(scaled,fill='white',width=width,joint='curve')
    for x,y in scaled:
        radius=width/2
        draw.ellipse((x-radius,y-radius,x+radius,y+radius),fill='white')
icon=canvas.resize((256,256),Image.Resampling.LANCZOS)
icon.save(target/'modulo.png')
icon.save(target/'modulo.ico',sizes=[(n,n) for n in (16,24,32,48,64,128,256)])
with Image.open(target/'modulo.ico') as saved:
    assert saved.ico.sizes() == {(n,n) for n in (16,24,32,48,64,128,256)}
print('Icono SVG, PNG e ICO creado en assets/.')
