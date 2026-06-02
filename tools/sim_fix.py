#!/usr/bin/env python3
# Simulate the fixed buildObjsStr output and show the last few lines before arrays.
parts = [
    '"KEY1":{\n\t\t\t\t"__type" : "System.Single"0\n\t\t\t}',
    '"FoundationLocationV3":{\n\t\t\t\t"__type" : "UnityEngine.Vector3,UnityEngine.CoreModule",\n\t\t\t\t"x" : 35,\n\t\t\t\t"y" : 0,\n\t\t\t\t"z" : 75\n\t\t\t}',
]

# buildObjsStr now returns parts.join(',') — no outer {}
inner = ','.join(parts)

# buildSlotSection now does '\t\t"objs" : {' + objsStr, then '\t\t},'
objs_line = '\t\t"objs" : {' + inner
close_line = '\t\t},'

full = objs_line + '\n' + close_line
lines = full.split('\n')

print('Generated (last 4 lines of objs + close):')
for l in lines[-5:]:
    print(repr(l))

print()
print('Real save equivalent:')
for l in [
    '\t\t\t\t"z" : 75',
    '\t\t\t}',
    '\t\t},',
]:
    print(repr(l))
