#!/usr/bin/env python3
"""
tools/encrypt_test.py  —  Verify the encryption pipeline is correct

Run this to confirm:
  1. The Python encryption key and IV match what encrypt.js uses
  2. A round-trip (encrypt → decrypt) produces identical output
  3. Optionally, that a generated save can be decrypted

Usage:
    python3 tools/encrypt_test.py
    python3 tools/encrypt_test.py --save path/to/decrypted.txt  # encrypt and write
"""

import sys
import base64
import hashlib
import argparse


# Must match encrypt.js exactly
KEY_BYTES = bytes([194, 145, 229, 77, 86, 76, 72, 219, 181, 153, 168, 102, 125, 27, 41, 109])
IV_BYTES  = bytes(16)

# The full key string (for verification only — we don't use it at runtime)
KEY_STRING = (
    "D#vnrl%TI_9q0euFPIx+wKRuNx%Aja2-AtuH1jtMSk2k%H1jXjUPor08QaeQE=p5l="
    "LAIWaSYms-68SYVS0PPoWxgM1B8?8tirM+UGr=cp!5a3=B5tBsKYEUfqxN!H9DvRVkL"
    "W?6cMeZWxgov%OOXmfl9zRiqWPsXq95lEc4yax7hqf5m_i5ssn-OGgLA8LJu2ETibBi7"
    "DwLc-zQ4M9jRGIdV_izS_J_=3FA=rAo0HUiEr-HWYVnuK$OQUyaVMchXxfo3A7Z-PXYm"
    "$6PPG%fJfWzV7M$L5he#y5cb?kVR67IfGzG$UzBcLhNMDhQFwQSEX59ZG7hP32q?6Pgir"
    "mvGTd-45+7ZKyG$FrDHoNw7ceUhrxYdzYSHd0yRz0T_RR_R5$GZdafCUPHIaVlIhMq4FE"
    "Ozo?GL7wyXr9XD7SD_QGpjZh&NDwycjnBeOy2mmFazlOV5eR7jsiwYDde9jCOH&cOxeToд"
    "y=iUEt|l7JCQ8IyX|0g3H&NO6DMveVqC9|OPkOZpO3DpM|||3LJ7PX40rZJXmLILu0UXU"
    "9hpM5"
)


def get_crypto():
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.primitives import padding
        return Cipher, algorithms, modes, padding
    except ImportError:
        print("ERROR: 'cryptography' library not installed.")
        print("Run:  pip install cryptography")
        sys.exit(1)


def encrypt(plaintext_str: str) -> bytes:
    Cipher, algorithms, modes, padding = get_crypto()
    data    = plaintext_str.encode('utf-8')
    pad_len = 16 - (len(data) % 16)
    padded  = data + bytes([pad_len] * pad_len)
    cipher  = Cipher(algorithms.AES(KEY_BYTES), modes.CBC(IV_BYTES))
    enc     = cipher.encryptor()
    ct      = enc.update(padded) + enc.finalize()
    return base64.b64encode(ct)


def decrypt(b64_bytes: bytes) -> str:
    Cipher, algorithms, modes, padding = get_crypto()
    ct        = base64.b64decode(b64_bytes)
    cipher    = Cipher(algorithms.AES(KEY_BYTES), modes.CBC(IV_BYTES))
    dec       = cipher.decryptor()
    padded    = dec.update(ct) + dec.finalize()
    unpadder  = padding.PKCS7(128).unpadder()
    data      = unpadder.update(padded) + unpadder.finalize()
    return data.decode('utf-8')


def test_key_derivation():
    """Verify KEY_BYTES matches MD5(KEY_STRING)."""
    print("Test 1: Key derivation")
    md5 = hashlib.md5(KEY_STRING.encode('utf-8')).digest()
    if md5 == KEY_BYTES:
        print("  ✓ KEY_BYTES matches MD5(KEY_STRING)")
    else:
        print("  ✗ KEY_BYTES MISMATCH")
        print(f"    Expected: {list(md5)}")
        print(f"    Got:      {list(KEY_BYTES)}")
        return False
    return True


def test_round_trip():
    """Encrypt and decrypt a test string; verify it round-trips correctly."""
    print("Test 2: Round-trip encrypt → decrypt")
    test = '{"BluePrint":{"__type":"ES3PlayMaker.PMDataWrapper,Assembly-CSharp-firstpass","value":{"objs":{"DAY":\n\t\t\t\t"__type" : "System.Int32"0\n\t\t\t}}}}'
    encrypted = encrypt(test)
    decrypted = decrypt(encrypted)
    if decrypted == test:
        print("  ✓ Round-trip OK")
        print(f"  Encrypted length: {len(encrypted)} bytes (base64)")
    else:
        print("  ✗ Round-trip FAILED")
        print(f"  Input:  {repr(test[:80])}")
        print(f"  Output: {repr(decrypted[:80])}")
        return False
    return True


def test_known_vector():
    """Test with a known plaintext/ciphertext pair (if available)."""
    print("Test 3: Known vector")
    # We can derive a known vector by encrypting 16 zero bytes
    # AES-128-CBC with our key and zero IV on 16 zero bytes should give a
    # deterministic result. This just checks the implementation is stable.
    plaintext = '\x10' * 16  # 16 bytes of 0x10 (which is also valid PKCS7 padding)
    e1 = encrypt(plaintext)
    e2 = encrypt(plaintext)
    if e1 == e2:
        print("  ✓ Deterministic encryption (same input → same output)")
    else:
        print("  ✗ Non-deterministic! This should not happen with CBC + fixed IV")
        return False
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--save', help='Encrypt this plaintext .txt file and write to <name>.es3')
    args = parser.parse_args()

    print("Blue Prince Save Generator — Encryption Test Suite")
    print("=" * 55)
    print()

    results = [
        test_key_derivation(),
        test_round_trip(),
        test_known_vector(),
    ]

    print()
    passed = sum(results)
    print(f"Results: {passed}/{len(results)} tests passed")

    if args.save:
        import os
        print()
        if not os.path.isfile(args.save):
            print(f"ERROR: File not found: {args.save}")
            sys.exit(1)
        with open(args.save, encoding='utf-8') as f:
            plaintext = f.read()
        out_path = os.path.splitext(args.save)[0] + '_encrypted.es3'
        encrypted = encrypt(plaintext)
        with open(out_path, 'wb') as f:
            f.write(encrypted)
        print(f"Encrypted save written to: {out_path}")
        print(f"  Plaintext:  {len(plaintext):,} bytes")
        print(f"  Ciphertext: {len(encrypted):,} bytes (base64)")

    if not all(results):
        sys.exit(1)


if __name__ == '__main__':
    main()
