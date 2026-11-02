from pathlib import Path
p=Path('index.html')
s=p.read_text()
# Reproducible module embedding into the existing private app closure.
start='// VPM MODULES START'
end='// VPM MODULES END'
if start in s:
    a=s.index(start); b=s.index(end,a)+len(end)
    s=s[:a]+s[b:]
modules='\n'.join(Path(name).read_text() for name in ['vpm-expenses.js','vpm-services.js','vpm-rooms.js','vpm-integration.js'])
anchor='render();\nloadData().then(()=>{ checkAuthSession(); });'
assert anchor in s
s=s.replace(anchor,start+'\n'+modules+'\n'+end+'\n'+anchor)
p.write_text(s)
