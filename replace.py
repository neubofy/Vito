import os
import re

res_dir = r'app/src/main/res/layout'
for root, _, files in os.walk(res_dir):
    for f in files:
        if f.endswith('.xml'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Replace gold_primary with ?attr/colorPrimary
            content = content.replace('@color/gold_primary', '?attr/colorPrimary')
            
            # Strip manual corner/elevation so it uses the Glass theme
            content = re.sub(r'app:cardCornerRadius=\".*?\"', '', content)
            content = re.sub(r'app:cardElevation=\".*?\"', '', content)
            
            with open(path, 'w', encoding='utf-8') as file:
                file.write(content)
print('Layout sweep complete')
