from pathlib import Path
import plistlib
p=Path('ios-project/www/index.html')
s=p.read_text()
assert '<script src="ios-platform.js"></script>' not in s
p.write_text(s.replace('</head>','<script src="ios-platform.js"></script></head>',1))
p=Path('ios-project/ios/App/App/Info.plist')
with p.open('rb') as f:info=plistlib.load(f)
info['CFBundleDisplayName']='Thornhaven'
info['UIRequiresFullScreen']=True
with p.open('wb') as f:plistlib.dump(info,f)
