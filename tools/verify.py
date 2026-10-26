#!/usr/bin/env python3
"""Offline source integrity gate. Run from any working directory."""
import hashlib,json,re,subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
html=root/'app/src/main/assets/index.html'
s=html.read_text()
count=0
with tempfile.TemporaryDirectory() as tmp:
 for attrs,body in re.findall(r'<script\b([^>]*)>(.*?)</script\s*>',s,re.S|re.I):
  if 'src=' in attrs or re.search(r'type=[\"\']application/',attrs): continue
  p=Path(tmp)/f'{count}.js';p.write_text(body)
  subprocess.run(['node','--check',str(p)],check=True);count+=1
for script in html.parent.glob('*.js'):
 subprocess.run(['node','--check',str(script)],check=True)
missing=[]
for url in re.findall(r'(?:src|href)=[\"\']([^\"\']+)',s):
 if url.startswith(('http:','https:','data:','#','javascript:','mailto:')): continue
 if not (html.parent/url.split('?')[0]).exists(): missing.append(url)
if missing: raise SystemExit('Missing local assets: '+repr(missing))
report={'status':'passed','inline_scripts':count,'source_sha256':hashlib.sha256(html.read_bytes()).hexdigest(),'scope':'JavaScript syntax and static HTML asset references'}
(root/'reports').mkdir(exist_ok=True)
(root/'reports/source.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
