#!/usr/bin/env python3
"""Compare website-generated save vs real save to find structural differences."""
import re
import sys

def parse_objs(text):
    """Extract the objs block from the first BluePrint slot."""
    # Find first objs block
    m = re.search(r'"objs"\s*:\s*\{(.*?)\}\s*,\s*"arrays"', text, re.DOTALL)
    if not m:
        print("ERROR: could not find objs block")
        sys.exit(1)
    return m.group(1)

def extract_fields(objs_text):
    """
    Parse fields from objs block.
    Two formats:
      Real save:    "KEY":{  "__type" : "TYPE"VALUE  }
      Website save: "KEY":\n  "__type" : "TYPE"VALUE  (no braces)
    Returns dict of {key: (type, raw_value_str)}
    """
    fields = {}
    # Try brace format first
    brace_pat = re.compile(
        r'"([^"]+)":\s*\{\s*"__type"\s*:\s*"([^"]+)"(.*?)\s*\}',
        re.DOTALL
    )
    # Try no-brace format
    nobrace_pat = re.compile(
        r'"([^"]+)":\s*"__type"\s*:\s*"([^"]+)"([^\n,\}]*)',
        re.DOTALL
    )

    brace_matches = list(brace_pat.finditer(objs_text))
    nobrace_matches = list(nobrace_pat.finditer(objs_text))

    if len(brace_matches) >= len(nobrace_matches):
        for m in brace_matches:
            fields[m.group(1)] = (m.group(2), m.group(3).strip())
        fmt = "brace"
    else:
        for m in nobrace_matches:
            fields[m.group(1)] = (m.group(2), m.group(3).strip())
        fmt = "no-brace"

    return fields, fmt

with open('Decrypted_Save_Dont_Use.txt', encoding='utf-8') as f:
    real_text = f.read()
with open('WebsiteSaveFile.txt', encoding='utf-8') as f:
    web_text = f.read()

real_objs = parse_objs(real_text)
web_objs  = parse_objs(web_text)

real_fields, real_fmt = extract_fields(real_objs)
web_fields,  web_fmt  = extract_fields(web_objs)

print(f"Real save format : {real_fmt}  ({len(real_fields)} fields)")
print(f"Website  format  : {web_fmt}   ({len(web_fields)} fields)")
print()

real_keys = set(real_fields)
web_keys  = set(web_fields)

only_real = sorted(real_keys - web_keys)
only_web  = sorted(web_keys - real_keys)
common    = sorted(real_keys & web_keys)

print(f"=== Fields in real save but MISSING from website ({len(only_real)}) ===")
for k in only_real:
    t, v = real_fields[k]
    print(f"  {k!r:45s}  type={t.split('.')[-1]:10s}  value={v}")

print()
print(f"=== Fields in website but NOT in real save ({len(only_web)}) ===")
for k in only_web:
    t, v = web_fields[k]
    print(f"  {k!r:45s}  type={t.split('.')[-1]:10s}  value={v}")

print()
print(f"=== Value differences on common fields ({len(common)} shared) ===")
diffs = []
for k in common:
    rt, rv = real_fields[k]
    wt, wv = web_fields[k]
    if rt != wt or rv != wv:
        diffs.append((k, rt, rv, wt, wv))
if diffs:
    for k, rt, rv, wt, wv in diffs:
        print(f"  {k!r}")
        if rt != wt: print(f"    type : real={rt}  web={wt}")
        if rv != wv: print(f"    value: real={rv!r}  web={wv!r}")
else:
    print("  (none — all common fields match)")
