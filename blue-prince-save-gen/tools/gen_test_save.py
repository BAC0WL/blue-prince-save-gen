#!/usr/bin/env python3
"""
Simulate what the updated savegen.js produces and compare against the real save.
Parses fields.js to get field lists, builds the objs block in Python using the
same logic as buildObjsStr(), then diffs against Decrypted_Save_Dont_Use.txt.
"""
import re, sys, json

# ── Parse fields.js ──────────────────────────────────────────────────────────

with open('src/data/fields.js', encoding='utf-8') as f:
    js = f.read()

def extract_js_array(js_text, array_name):
    """Extract a JS array literal as a Python list of dicts."""
    start = js_text.find(f'const {array_name} = [')
    if start == -1:
        start = js_text.find(f'{array_name} = [')
    end = js_text.find('\n];', start) + 2
    array_text = js_text[start:end]
    array_text = re.sub(r'//[^\n]*', '', array_text)   # strip line comments
    array_text = array_text[array_text.find('['):]
    # JS allows trailing commas; JSON does not — strip them
    array_text = re.sub(r',\s*([}\]])', r'\1', array_text)
    # JS uses \uXXXX which JSON handles, but unicode escapes like – are fine
    try:
        return json.loads(array_text)
    except json.JSONDecodeError as e:
        print(f"ERROR parsing {array_name}: {e}")
        print(array_text[max(0, e.pos-50):e.pos+50])
        return []

hidden_fields   = extract_js_array(js, 'HIDDEN_FIELDS')
editable_fields = extract_js_array(js, 'EDITABLE_FIELDS')
bool_fields     = extract_js_array(js, 'BOOL_FIELDS')
hidden_bool     = extract_js_array(js, 'HIDDEN_BOOL_FIELDS')

all_fields = hidden_fields + editable_fields

print(f"HIDDEN_FIELDS    : {len(hidden_fields)}")
print(f"EDITABLE_FIELDS  : {len(editable_fields)}")
print(f"BOOL_FIELDS      : {len(bool_fields)}")
print(f"HIDDEN_BOOL_FIELDS: {len(hidden_bool)}")

# ── Simulate buildObjsStr(slot=1) ─────────────────────────────────────────────

def build_objs(slot=1):
    parts = []

    for f in all_fields:
        if f['type'] in ('System.Boolean', 'UnityEngine.Vector3,UnityEngine.CoreModule'):
            continue
        key = f['key']
        val = f['value']
        if key in ('SaveSlot', 'SaveIcon'):
            val = slot
        if f['type'] == 'System.String':
            val_str = '"' + str(val).replace('\\', '\\\\').replace('"', '\\"') + '"'
        else:
            val_str = str(val).lower() if isinstance(val, bool) else str(val)
        parts.append(f'"{key}":{{"__type" : "{f["type"]}"{val_str}}}')

    for f in bool_fields:
        val_str = 'true' if f.get('value') else 'false'
        parts.append(f'"{f["key"]}":{{" __type" : "System.Boolean"{val_str}}}')

    for f in hidden_bool:
        val_str = 'true' if f.get('value') else 'false'
        parts.append(f'"{f["key"]}":{{" __type" : "System.Boolean"{val_str}}}')

    # Vector3
    parts.append('"FoundationLocationV3":{"__type" : "UnityEngine.Vector3,UnityEngine.CoreModule"}')

    return set(p.split(':{')[0].strip('"') for p in parts)

sim_keys = build_objs()
print(f"\nSimulated objs field count: {len(sim_keys)}")

# ── Compare against real save ─────────────────────────────────────────────────

with open('Decrypted_Save_Dont_Use.txt', encoding='utf-8') as f:
    real_text = f.read()

m = re.search(r'"objs"\s*:\s*\{(.*?)\}\s*,\s*"arrays"', real_text, re.DOTALL)
real_objs = m.group(1)
real_pat  = re.compile(r'"([^"]+)":\s*\{', re.DOTALL)
real_keys = set(m.group(1) for m in real_pat.finditer(real_objs))
print(f"Real save objs field count: {len(real_keys)}")

only_real = sorted(real_keys - sim_keys)
only_sim  = sorted(sim_keys - real_keys)

print(f"\nFields in real save but still missing from simulation ({len(only_real)}):")
for k in only_real:
    print(f"  {k!r}")

print(f"\nFields in simulation but not in real save ({len(only_sim)}):")
for k in only_sim:
    print(f"  {k!r}")
