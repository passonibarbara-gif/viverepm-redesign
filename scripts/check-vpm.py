from pathlib import Path
import re,subprocess,tempfile
source=Path('index.html').read_text()
for name in ['vpm-expenses.js','vpm-services.js','vpm-rooms.js','vpm-codes.js','vpm-integration.js']:
    assert Path(name).read_text() in source, f'Rebuild required: {name}'
for code in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',source,re.S):
    with tempfile.NamedTemporaryFile(suffix='.js',mode='w') as f:
        f.write(code);f.flush();subprocess.run(['node','--check',f.name],check=True)
assert source.count('// VPM MODULES START')==1
assert source.count('// VPM MODULES END')==1
print('PASS: embedded module versions, all inline script syntax, single integration block.')
