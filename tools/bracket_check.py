#!/usr/bin/env python3
"""
Find structural bracket issues by comparing the website and real save around
key section boundaries: objs close, arrays, slot transitions.
"""

with open('WebsiteSaveFile.txt', encoding='utf-8') as f:
    wlines = f.readlines()
with open('Decrypted_Save_Dont_Use.txt', encoding='utf-8') as f:
    rlines = f.readlines()

def show_around(lines, keyword, context=5, skip=0, label=''):
    count = 0
    for i, l in enumerate(lines):
        if keyword in l:
            if count < skip:
                count += 1
                continue
            print(f'--- {label} (around line {i+1}) ---')
            start = max(0, i - context)
            end = min(len(lines), i + context + 1)
            for j in range(start, end):
                marker = '>>>' if j == i else '   '
                print(f'{marker} {j+1}: {lines[j]}', end='')
            print()
            return

# 1. End of first objs block (just before first "arrays")
print('=== END OF FIRST OBJS BLOCK ===')
show_around(wlines, '"arrays"', context=8, label='WEBSITE')
show_around(rlines, '"arrays"', context=8, label='REAL')

# 2. End of first BluePrint slot (SLOT_FOOTER region)
print('=== FIRST SLOT FOOTER (obj/array null) ===')
show_around(wlines, '"obj" : null', context=6, label='WEBSITE')
show_around(rlines, '"obj" : null', context=6, label='REAL')

# 3. Transition from BluePrint to SaveFileInfo
print('=== BLUEPRINT → SAVEFILEINFO TRANSITION ===')
show_around(wlines, 'SaveFileInfo', context=4, label='WEBSITE')
show_around(rlines, 'SaveFileInfo', context=4, label='REAL')

# 4. Transition from CurrentSave to BluePrint2
print('=== CURRENTSAVE → BLUEPRINT2 TRANSITION ===')
show_around(wlines, 'BluePrint2', context=4, label='WEBSITE')
show_around(rlines, 'BluePrint2', context=4, label='REAL')
