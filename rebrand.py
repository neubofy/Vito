import os

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return

    new_content = content
    # Replace combinations
    replacements = {
        'FMD': 'VETO',
        'Fmd': 'Veto',
        'fmd': 'veto',
    }
    
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
        
    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

def walk_directory(directory):
    for root, dirs, files in os.walk(directory):
        if '.git' in root or 'build' in root or 'node_modules' in root or '.next' in root:
            continue
        for file in files:
            if file.endswith(('.kt', '.java', '.xml', '.xml', '.ts', '.tsx', '.js', '.json', '.gradle', '.pro')):
                replace_in_file(os.path.join(root, file))

walk_directory('c:/Users/Pawan Kumar/Downloads/LCLD/app')
walk_directory('c:/Users/Pawan Kumar/Downloads/LCLD/website')
print("Rebranding complete.")
