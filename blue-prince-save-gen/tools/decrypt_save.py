#!/usr/bin/env python3
"""
tools/decrypt_save.py  —  Decrypt a Blue Prince .es3 save file to plaintext

Usage:
    python3 decrypt_save.py <path_to_save.es3>
    python3 decrypt_save.py <path_to_save.es3> --out decrypted.txt
    python3 decrypt_save.py <path_to_save.es3> --slot 1   # print one slot's objs

Requirements:
    pip install cryptography

This is the primary debugging tool for the save generator.
If the game rejects a save, run this on a known-good save and on the
generated save, then diff them to find discrepancies.

Typical workflow:
    1. Back up your real save:
         cp ~/AppData/LocalLow/Dogubomb/BLUE\\ PRINCE/storage/MtHollyBlueprint.es3 real_save.es3

    2. Decrypt the real save:
         python3 tools/decrypt_save.py real_save.es3 --out real_decrypted.txt

    3. Generate a test save from the app (use "Copy raw (unencrypted)" button)
         Save as generated_decrypted.txt

    4. Diff them:
         diff real_decrypted.txt generated_decrypted.txt
"""

import sys
import os
import re
import json
import base64
import argparse


# ── Encryption constants (same as encrypt.js) ────────────────────────────────
# Blue Prince uses ES3 (EasySave3) with PBKDF2-SHA1 key derivation.
# File format: [16-byte random salt] + [AES-128-CBC ciphertext]
# Key  = PBKDF2(password=KEY_STRING, salt=file[0:16], dkLen=16, count=100, SHA1)
# IV   = file[0:16]  (same bytes as the salt)
KEY_STRING = (
    'D#vnrl%TI_9q0euFPIx+wKRuNx%Aja2-AtuH1jtMSk2k%H1jXjUPor08QaeQE=p5l='
    'LAIWaSYms-68SYVS0PPoWxgM1B8?8tirM+UGr=cp!5a3=B5tBsKYEUfqxN!H9DvRVkL'
    'W?6cMeZWxgov%OOXmfl9zRiqWPsXq95lEc4yax7hqf5m_i5ssn-OGgLA8LJu2ETibBi7'
    'DwLc-zQ4M9jRGIdV_izS_J_=3FA=rAo0HUiEr-HWYVnuK$OQUyaVMchXxf%EBo3A7Z-PXYm'
    '$6PPG%fJfWzV7M$L5he#y5cb?kVR67IfGzG$UzBcLhNMDhQFwQSEX59ZG7hP32q?6Pgir'
    'mvGTd-45+7ZKyG$FrDHoNw7ceUhrxYdzYSHd0yRz0T_RR_R5$GZda%DDfCUPHIaVlIhMq4FE'
    'Ozo?GL7wyXr9XD7SD_QGpjZh&NDwycjnBeOy2mmFazlOV5eR7jsiwYDde9jCOH&cOxeTody'
    '=iUEt|l7JCQ8IyX|0g3H&NO6DMveVqC9|OPkOZpO3DpM|||3LJ7PX40rZJXmLILu0UXU'
    '9hpM5'
)


def _derive_key(salt: bytes) -> bytes:
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    kdf = PBKDF2HMAC(algorithm=hashes.SHA1(), length=16, salt=salt, iterations=100)
    return kdf.derive(KEY_STRING.encode('utf-8'))


def decrypt_es3(path: str) -> str:
    """Decrypt an ES3 file and return the plaintext string."""
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.primitives import padding
    except ImportError:
        print("ERROR: 'cryptography' library not found.")
        print("Install it with:  pip install cryptography")
        sys.exit(1)

    with open(path, 'rb') as f:
        raw = f.read()

    # File format: [16-byte salt/IV] + [AES-128-CBC ciphertext]
    salt       = raw[:16]
    ciphertext = raw[16:]
    key        = _derive_key(salt)

    cipher    = Cipher(algorithms.AES(key), modes.CBC(salt))
    decryptor = cipher.decryptor()
    padded    = decryptor.update(ciphertext) + decryptor.finalize()

    from cryptography.hazmat.primitives import padding
    unpadder = padding.PKCS7(128).unpadder()
    plaintext_bytes = unpadder.update(padded) + unpadder.finalize()

    return plaintext_bytes.decode('utf-8')


def encrypt_es3(plaintext: str, out_path: str):
    """Encrypt a plaintext ES3 string and write to out_path."""
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.primitives import padding
    except ImportError:
        print("ERROR: 'cryptography' library not found.")
        sys.exit(1)

    import os
    salt = os.urandom(16)
    key  = _derive_key(salt)

    data    = plaintext.encode('utf-8')
    pad_len = 16 - (len(data) % 16)
    padded  = data + bytes([pad_len] * pad_len)

    cipher    = Cipher(algorithms.AES(key), modes.CBC(salt))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(padded) + encryptor.finalize()

    with open(out_path, 'wb') as f:
        f.write(salt + ciphertext)
    print(f"Encrypted save written to: {out_path}")


def print_slot_summary(plaintext: str, slot: int):
    """Print a summary of the key fields in a given slot."""
    # Find the BluePrint section for this slot
    key = 'BluePrint' if slot == 1 else f'BluePrint{slot}'
    pattern = re.compile(
        r'"' + re.escape(key) + r'".*?"objs"\s*:\s*\{(.*?)\}\s*\},\s*"arrays"',
        re.DOTALL
    )
    m = pattern.search(plaintext)
    if not m:
        print(f"Could not find slot {slot} ({key}) in the file.")
        return

    objs_text = m.group(1)

    # Extract key-value pairs
    # Format: "KEY":{ "__type" : "TYPE"VALUE }
    field_pattern = re.compile(
        r'"([^"]+)":\{\s*"__type" : "([^"]+)"(.*?)\s*\}',
        re.DOTALL
    )

    interesting_keys = {
        'DAY', 'Chess Power', 'RANDOMSEED', 'SaveSlot', 'SaveIcon',
        'Magnet Coins', 'Magnet Keys', 'Aquarium Level', 'Greenhouse Level',
        'Pool Level', 'Reservoir Level', 'Well Level', 'Cavern Stability',
        'NETWORK PASSWORD', 'Hidden Riddle', 'ascend',
    }

    print(f"\n=== Slot {slot} ({key}) — selected fields ===")
    found = {}
    for fm in field_pattern.finditer(objs_text):
        k, t, v = fm.group(1), fm.group(2), fm.group(3).strip()
        found[k] = (t, v)

    for k in sorted(interesting_keys):
        if k in found:
            t, v = found[k]
            print(f"  {k:35s} = {v}  ({t.split('.')[-1]})")

    print(f"\n  Total fields in slot: {len(found)}")


def main():
    parser = argparse.ArgumentParser(description='Decrypt a Blue Prince .es3 save file')
    parser.add_argument('input',          help='Path to the .es3 file')
    parser.add_argument('--out',          help='Write decrypted plaintext to this file')
    parser.add_argument('--slot',         type=int, choices=[1,2,3,4],
                                          help='Print a field summary for this slot')
    parser.add_argument('--reencrypt',    help='Re-encrypt the decrypted text to this path')
    parser.add_argument('--verify-round-trip', action='store_true',
                                          help='Decrypt, re-encrypt, compare byte-for-byte')
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"ERROR: File not found: {args.input}")
        sys.exit(1)

    print(f"Decrypting: {args.input}")
    plaintext = decrypt_es3(args.input)
    print(f"Decrypted OK — {len(plaintext):,} bytes")

    if args.out:
        # Write in binary mode to preserve the original CRLF line endings exactly.
        with open(args.out, 'wb') as f:
            f.write(plaintext.encode('utf-8'))
        print(f"Plaintext written to: {args.out}")

    if args.slot:
        print_slot_summary(plaintext, args.slot)

    if args.reencrypt:
        encrypt_es3(plaintext, args.reencrypt)

    if args.verify_round_trip:
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.es3', delete=False) as tmp:
            tmp_path = tmp.name
        encrypt_es3(plaintext, tmp_path)
        with open(args.input, 'rb') as f:
            original = f.read().strip()
        with open(tmp_path, 'rb') as f:
            roundtrip = f.read().strip()
        os.unlink(tmp_path)
        if original == roundtrip:
            print("✓ Round-trip verified: re-encrypted output matches original byte-for-byte")
        else:
            print("✗ Round-trip MISMATCH: re-encrypted output differs from original")
            print(f"  Original length:   {len(original)}")
            print(f"  Re-encrypted length: {len(roundtrip)}")

    if not (args.out or args.slot or args.reencrypt or args.verify_round_trip):
        # Default: just print the first 2000 chars
        print("\n--- Plaintext (first 2000 chars) ---")
        print(plaintext[:2000])
        if len(plaintext) > 2000:
            print(f"\n... ({len(plaintext) - 2000:,} more chars) ...")
        print("\nTip: use --out to save the full plaintext, --slot 1 for a field summary")


if __name__ == '__main__':
    main()
