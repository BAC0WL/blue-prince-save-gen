# Blue Prince Save Generator

A tool for creating custom save files for **Blue Prince**

## Quick Start

Open `index.html` in any browser (Chrome, Firefox, Edge). No server or install needed.


---

## How to Edit Fields

All field configuration lives in **`src/data/fields.js`**. It has three sections:

### `HIDDEN_FIELDS`
Written to the save file with a fixed default value, not shown in the UI.
Edit `value:` to change the default. Don't delete entries — the game expects them.

### `EDITABLE_FIELDS`
Shown in the UI. Each entry:
```js
{ "key": "Chess Power", "type": "System.Int32", "value": 0,
  "label": "Chess Power", "desc": "Chess Piece 0–6; 6 is max." }
```
- `key` — must exactly match the save file key. Do not change.
- `label` — what the user sees in the UI.
- `desc` — one-line explanation shown under the label.
- `value` — the starting default for a fresh save.
- To hide from UI without removing: add `"hidden": true`.

### `CATEGORIES`
Controls which fields appear in which sidebar section, and in what order.
```js
"Core": [ "DAY", "Chess Power", "RANDOMSEED", "ascend" ],
```
To move a field: cut its key from one array, paste into another.
To hide a whole category: remove it (fields still write to save with their defaults).

### `BOOL_FIELDS`
Flags shown in the Flags panel. Each entry:
```js
{ "key": "sanctum key 1", "label": "Sanctum Key 1", "value": false }
```
`value: true` = checked/on by default. Delete an entry to remove it from the UI.

---

## Encryption

Blue Prince uses **Easy Save 3 (ES3)** with:
- Algorithm: AES-128-CBC
- Key: MD5 of the public key string → 16 bytes `[194, 145, 229, 77, ...]`
- IV: 16 zero bytes
- Output: Base64-encoded ciphertext

The key is pre-computed in `src/engine/encrypt.js`. Encryption runs in the browser
via the Web Crypto API.

Thanks to https://es3.tusinean.ro for helping with that and having the key
---

## Debugging Save File Issues

If Blue Prince doesn't recognize the generated save:

**Step 1 — Decrypt a real save and compare**
```bash
pip install cryptography
python3 tools/decrypt_save.py ~/AppData/LocalLow/Dogubomb/BLUE\ PRINCE/storage/MtHollyBlueprint.es3 --out real.txt
```
Then use the "Copy raw (unencrypted)" button in the app and save as `generated.txt`.
```bash
diff real.txt generated.txt
```

**Step 2 — Check slot summaries**
```bash
python3 tools/decrypt_save.py real.es3 --slot 1
```

**Step 3 — Verify encryption round-trip**
```bash
python3 tools/encrypt_test.py
python3 tools/encrypt_test.py --save generated.txt  # produces generated_encrypted.es3
```

**Step 4 — Verify round-trip fidelity**
```bash
python3 tools/decrypt_save.py generated_encrypted.es3 --verify-round-trip
```

**Common causes of rejection:**
- Wrong field order (the game may be order-sensitive in some sections)
- Missing required fields (check if new game version added fields)
- Wrong value type for a field (int vs float vs string)
- Encoding issue (file must be UTF-8, no BOM)
- Encryption mismatch (wrong key, wrong IV, wrong padding)
- Randomly missed brackets, other formatting errors (Any typos could make the save file invalid and get deleted)
---

## Save File Location

**Steam (Windows):**
```
%USERPROFILE%\AppData\LocalLow\Dogubomb\BLUE PRINCE\storage\MtHollyBlueprint.es3
```

**macOS:**
```
~/Library/Application Support/com.Dogubomb.BluePrince/storage/MtHollyBlueprint.es3
*I havent verified this but you can do it I believe in you
```

Always **close the game** and **back up your existing save** before replacing the file.

---

## In The Future

**Rarity Changes**
- If there is any interest I can try and make a rarity changes section to allow for an almost entirely custom mt holly (it only lets you change ones that you can already do via conservatory)

**Foundation Map Placement**
- Replace the Foundation & Layout section with just a map that you can drag a foundation onto and have it placed in game.
- I have the code for the map, I just don't know how the game actually determines the foundation location with the three strings.

**Testing**
- I've tested a ton of stuff but oml there is SO much more to do, if yall want, just try some stuff and see what cool shit you find.

**Other Blue Prince Bingo Related Tools**
- What day is it? (For Shelter)
- Parlor Solver
- What will my House's name be (hopefully via screenshot)
- Might add some random stuff in the future depending on interest, if you have ideas lmk
- Also none of these are guaranteed to be added just ideas.