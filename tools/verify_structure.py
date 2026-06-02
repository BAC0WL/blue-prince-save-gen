#!/usr/bin/env python3
"""Simulate the new savegen.js SaveFileInfo + CurrentSave and compare to real save."""

now = '2026-06-01 00:00:00'
slot = 1
day = 0
icon = 1

saveInfo = '\n'.join([
    '\t"SaveFileInfo" : {',
    '\t\t"__type" : "ES3PlayMaker.PMDataWrapper,Assembly-CSharp-firstpass",',
    '\t\t"value" : {',
    '\t\t"objs" : {"save_created":{',
    '\t\t\t\t"__type" : "System.String""' + now + '"',
    '\t\t\t},"data_last_modified":{',
    '\t\t\t\t"__type" : "System.String""' + now + '"',
    '\t\t\t},"game_version":{',
    '\t\t\t\t"__type" : "System.String""1.1.10.22"',
    '\t\t\t},"save_system_version":{',
    '\t\t\t\t"__type" : "System.String""2.0"',
    '\t\t\t}',
    '\t\t},',
    '\t\t"arrays" : null,',
    '\t\t"obj" : null,',
    '\t\t"array" : null',
    '\t}',
    '\t},',
])

currentSave = '\n'.join([
    '\t"CurrentSave" : {',
    '\t\t"__type" : "ES3PlayMaker.PMDataWrapper,Assembly-CSharp-firstpass",',
    '\t\t"value" : {',
    '\t\t"objs" : {"GAME CLOCK":{',
    '\t\t\t\t"__type" : "System.Single"0',
    '\t\t\t},"current save":{',
    '\t\t\t\t"__type" : "System.Int32"' + str(slot),
    '\t\t\t},"DAY":{',
    '\t\t\t\t"__type" : "System.Int32"' + str(day),
    '\t\t\t},"SaveIcon":{',
    '\t\t\t\t"__type" : "System.Int32"' + str(icon),
    '\t\t\t}',
    '\t\t},',
    '\t\t"arrays" : {',
    '\t\t},',
    '\t\t"obj" : null,',
    '\t\t"array" : null',
    '\t}',
    '\t}',
])

with open('Decrypted_Save_Dont_Use.txt', encoding='utf-8') as f:
    real_lines = f.readlines()

def find_section(lines, key, n=20):
    for i, line in enumerate(lines):
        if key in line:
            return ''.join(lines[i:i+n])
    return 'NOT FOUND'

real_saveinfo = find_section(real_lines, '"SaveFileInfo"')
real_currentsave = find_section(real_lines, '"CurrentSave"', 25)

print('=== SIMULATED SaveFileInfo ===')
print(saveInfo)
print()
print('=== REAL SAVE SaveFileInfo ===')
print(real_saveinfo)
print()
print('=== SIMULATED CurrentSave (abbreviated) ===')
print(currentSave)
print()
print('=== REAL SAVE CurrentSave ===')
print(real_currentsave)
