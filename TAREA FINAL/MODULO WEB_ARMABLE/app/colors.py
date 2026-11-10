"""Deterministic HSL harmonies and WCAG relative-luminance contrast."""
import colorsys

def rgb(value):
    return tuple(int(value[i:i+2], 16) / 255 for i in (1,3,5))

def hexcolor(values):
    return '#' + ''.join(f'{max(0,min(255,round(v*255))):02x}' for v in values)

def mix(a, b, amount):
    return hexcolor(tuple(x*(1-amount)+y*amount for x,y in zip(rgb(a),rgb(b))))

def luminance(value):
    return sum(w*(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4) for c,w in zip(rgb(value),(.2126,.7152,.0722)))

def contrast(a,b):
    x,y=sorted((luminance(a),luminance(b)))
    return (y+.05)/(x+.05)

def ink(background):
    return max(('#111111','#ffffff'),key=lambda c:contrast(c,background))

def readable(color, background):
    target=ink(background)
    for n in range(101):
        candidate=mix(color,target,n/100)
        if contrast(candidate,background)>=4.5:
            return candidate
    return target

def secondary(primary,harmony):
    h,l,s=colorsys.rgb_to_hls(*rgb(primary))
    offset={'complementary':.5,'analogous':1/12,'triadic':1/3,'monochrome':0}.get(harmony,.5)
    return hexcolor(colorsys.hls_to_rgb((h+offset)%1,.44 if l>.6 else .58,max(.2,min(s,.65))))

def surfaces(primary, second, dark):
    base=mix(primary,'#000000',.86) if dark else mix(primary,'#ffffff',.97)
    panel=mix(second,'#000000',.78) if dark else mix(second,'#ffffff',.89)
    return base,panel

def surface_style(background,primary):
    fg=ink(background)
    values={'surface':background,'fg':fg,'muted':readable(mix(fg,background,.35),background),
            'accent-ink':readable(primary,background),'line':mix(fg,background,.82)}
    return ';'.join('--'+k+':'+v for k,v in values.items())

def palette(project,dark=None):
    dark=project.color_mode=='dark' if dark is None else dark
    second=project.secondary or secondary(project.accent,project.harmony)
    page,panel=surfaces(project.accent,second,dark)
    values={'page':page,'panel':panel,'primary':project.accent,'secondary':second,'button-ink':ink(project.accent)}
    return ';'.join('--'+k+':'+v for k,v in values.items())+';'+surface_style(page,project.accent)

def module_style(project,module,dark=None):
    dark=project.color_mode=='dark' if dark is None else dark
    second=project.secondary or secondary(project.accent,project.harmony)
    page,panel=surfaces(project.accent,second,dark)
    tone=module.tone
    if tone=='panel': background=panel
    elif tone=='dark': background=surfaces(project.accent,second,True)[1]
    elif tone=='light': background=surfaces(project.accent,second,False)[0]
    elif tone=='primary': background=project.accent
    elif tone=='secondary': background=second
    elif tone=='custom': background=module.background
    else: background=project.accent if module.kind=='contact' else panel if module.kind in ('features','carousel','cta') else page
    return surface_style(background,project.accent)
