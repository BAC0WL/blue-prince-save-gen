#!/usr/bin/env python3
"""
Full structural diff: compare website save vs real save line by line,
normalizing timestamps and slot-specific values so we only see real differences.
"""
import re, sys

with open('WebsiteSaveFile.txt', encoding='utf-8') as f:
    web_lines = f.readlines()
with open('Decrypted_Save_Dont_Use.txt', encoding='utf-8') as f:
    real_lines = f.readlines()

def normalize(line):
    # Replace timestamps
    line = re.sub(r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}', 'TIMESTAMP', line)
    # Replace specific numeric values that differ between a fresh save and a played save
    return line

print(f"Website lines : {len(web_lines)}")
print(f"Real save lines: {len(real_lines)}")
print()

# Walk both files, find first divergence
diffs = []
limit = min(len(web_lines), len(real_lines))
for i in range(limit):
    w = normalize(web_lines[i])
    r = normalize(real_lines[i])
    if w != r:
        diffs.append((i+1, web_lines[i].rstrip('\n'), real_lines[i].rstrip('\n')))
        if len(diffs) >= 30:
            break

if not diffs:
    print("No structural differences found in the first", limit, "lines!")
else:
    print(f"First {len(diffs)} line-level differences (up to 30):")
    for lineno, web, real in diffs:
        print(f"\nLine {lineno}:")
        print(f"  WEB : {repr(web)}")
        print(f"  REAL: {repr(real)}")
