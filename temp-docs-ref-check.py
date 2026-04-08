import os

root = os.path.abspath(r'c:/Users/kisho/WorkSpace/Local-Service-Marketplace')
refs = {}
files = []
for dirpath, dirnames, filenames in os.walk(os.path.join(root, 'docs')):
    for fn in filenames:
        fp = os.path.join(dirpath, fn)
        rel = os.path.relpath(fp, root).replace('\\', '/')
        files.append((fp, rel))
for fp, rel in files:
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        for fn in filenames:
            fpath = os.path.join(dirpath, fn)
            if fpath == fp:
                continue
            try:
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as fh:
                    count += fh.read().count(rel)
            except Exception:
                pass
    refs[rel] = count
for rel, count in sorted(refs.items(), key=lambda x: (x[1], x[0])):
    if count == 0:
        print(rel)
