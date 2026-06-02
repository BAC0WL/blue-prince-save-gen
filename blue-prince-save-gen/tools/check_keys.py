#!/usr/bin/env python3
"""Compare KEY_STRING between encrypt.js and decrypt_save.py."""
import re

with open('src/engine/encrypt.js', encoding='utf-8') as f:
    js = f.read()
with open('tools/decrypt_save.py', encoding='utf-8') as f:
    py = f.read()

# Extract JS: everything between ES3_KEY_STRING = and the next semicolon
js_section = js[js.find('ES3_KEY_STRING'):js.find(';', js.find('ES3_KEY_STRING'))]
js_parts = re.findall(r"'([^']*)'", js_section)
js_key = ''.join(js_parts)

# Extract Python: everything between KEY_STRING = ( and the closing )
py_start = py.find("KEY_STRING = (") + len("KEY_STRING = (")
py_end = py.find("\n)\n", py_start)
py_section = py[py_start:py_end]
py_parts = re.findall(r"'([^']*)'", py_section)
py_key = ''.join(py_parts)

print(f"JS  key length : {len(js_key)} chars")
print(f"Py  key length : {len(py_key)} chars")
print(f"Keys identical : {js_key == py_key}")

if js_key != py_key:
    for i, (a, b) in enumerate(zip(js_key, py_key)):
        if a != b:
            print(f"First diff at char {i}: JS={repr(a)} ({ord(a):#06x})  Py={repr(b)} ({ord(b):#06x})")
            print(f"  Context JS: ...{repr(js_key[max(0,i-15):i+15])}...")
            print(f"  Context Py: ...{repr(py_key[max(0,i-15):i+15])}...")
            break
    if len(js_key) != len(py_key):
        print(f"Length mismatch: JS={len(js_key)} Py={len(py_key)}")
