#!/usr/bin/env python3
"""Genera dist/bosque-de-letras.html: el juego completo en un solo archivo (CSS y JS incrustados).
Útil para enviarlo por correo o abrirlo sin servidor. Con --fragment escribe la versión sin
<html>/<head>/<body> que usan los Artifacts de Claude."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')

def inline(block_name, render):
    global html
    pat = re.compile(r'<!-- build:%s -->(.*?)<!-- endbuild -->' % block_name, re.S)
    m = pat.search(html)
    assert m, block_name
    srcs = re.findall(r'(?:href|src)="([^"]+)"', m.group(1))
    html = html[:m.start()] + ''.join(render((root / s).read_text(encoding='utf-8')) for s in srcs) + html[m.end():]

inline('css', lambda css: '<style>\n%s\n</style>\n' % css)
inline('js', lambda js: '<script>\n%s\n</script>\n' % js.replace('</script>', '<\\/script>'))

out_dir = root / 'dist'; out_dir.mkdir(exist_ok=True)
(out_dir / 'bosque-de-letras.html').write_text(html, encoding='utf-8')
print('escrito dist/bosque-de-letras.html', len(html), 'bytes')

if '--fragment' in sys.argv:
    frag = html
    frag = re.sub(r'^.*?<head>\s*', '', frag, flags=re.S)
    frag = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*|<link rel="manifest"[^>]*>\s*|<link rel="apple-touch-icon"[^>]*>\s*', '', frag)
    frag = frag.replace('</head>\n<body>\n', '').replace('</body>\n</html>\n', '')
    target = pathlib.Path(sys.argv[sys.argv.index('--fragment') + 1])
    target.write_text(frag, encoding='utf-8')
    print('escrito', target, len(frag), 'bytes')
