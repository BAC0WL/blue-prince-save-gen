#!/usr/bin/env python3
"""Spot-check SaveFileInfo and CurrentSave structure in both files."""

with open('WebsiteSaveFile.txt', encoding='utf-8') as f:
    web_lines = f.readlines()
with open('Decrypted_Save_Dont_Use.txt', encoding='utf-8') as f:
    real_lines = f.readlines()

def find_section(lines, key, n=25):
    for i, line in enumerate(lines):
        if key in line:
            return i, lines[i:i+n]
    return -1, []

for label, lines in [('REAL SAVE', real_lines), ('WEBSITE (OLD)', web_lines)]:
    print(f'=== {label} — SaveFileInfo ===')
    idx, section = find_section(lines, '"SaveFileInfo"')
    for j, l in enumerate(section):
        print(f'{idx+j+1}: {l}', end='')
    print()
