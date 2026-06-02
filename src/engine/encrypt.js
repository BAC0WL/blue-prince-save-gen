// =============================================================================
// ENCRYPT.JS  —  AES-128-CBC encryption matching Blue Prince's ES3 format
//
// Blue Prince uses Easy Save 3 (ES3) with:
//   Algorithm  : AES-128-CBC
//   Key        : PBKDF2(password=KEY_STRING, salt=random_salt, dkLen=16,
//                       iterations=100, prf=HMAC-SHA1)
//   IV         : same 16 bytes as the salt
//   Padding    : PKCS7 (applied automatically by SubtleCrypto)
//   File format: [16-byte salt] + [AES-CBC ciphertext]
//   Output     : Base64-encoded raw file bytes
//
// The salt is randomly generated per save, so every encrypted file is unique
// even for identical plaintext. The salt is stored unencrypted at the start
// of the file so the game can derive the same key and IV on load.
//
// Reference implementation: github.com/crtdll/es3-modifier
// =============================================================================

const ES3_KEY_STRING =
  'D#vnrl%TI_9q0euFPIx+wKRuNx%Aja2-AtuH1jtMSk2k%H1jXjUPor08QaeQE=p5l=' +
  'LAIWaSYms-68SYVS0PPoWxgM1B8?8tirM+UGr=cp!5a3=B5tBsKYEUfqxN!H9DvRVkL' +
  'W?6cMeZWxgov%OOXmfl9zRiqWPsXq95lEc4yax7hqf5m_i5ssn-OGgLA8LJu2ETibBi7' +
  'DwLc-zQ4M9jRGIdV_izS_J_=3FA=rAo0HUiEr-HWYVnuK$OQUyaVMchXxf%EBo3A7Z-PXYm' +
  '$6PPG%fJfWzV7M$L5he#y5cb?kVR67IfGzG$UzBcLhNMDhQFwQSEX59ZG7hP32q?6Pgir' +
  'mvGTd-45+7ZKyG$FrDHoNw7ceUhrxYdzYSHd0yRz0T_RR_R5$GZda%DDfCUPHIaVlIhMq4FE' +
  'Ozo?GL7wyXr9XD7SD_QGpjZh&NDwycjnBeOy2mmFazlOV5eR7jsiwYDde9jCOH&cOxeTody' +
  '=iUEt|l7JCQ8IyX|0g3H&NO6DMveVqC9|OPkOZpO3DpM|||3LJ7PX40rZJXmLILu0UXU' +
  '9hpM5';

async function _deriveKey(salt, usage) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ES3_KEY_STRING),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100, hash: 'SHA-1' },
    keyMaterial,
    { name: 'AES-CBC', length: 128 },
    false,
    [usage]
  );
}

/**
 * Encrypt a plaintext string using AES-128-CBC (ES3 format).
 * @param {string} plaintextStr  The raw ES3 JSON string from generateSaveFile()
 * @returns {Promise<string>}    Base64 of [16-byte salt] + [ciphertext]
 */
async function es3Encrypt(plaintextStr) {
  const data = new TextEncoder().encode(plaintextStr);

  // Random salt — also used as IV. Prepended to the ciphertext so the game
  // can derive the same key on load.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key  = await _deriveKey(salt, 'encrypt');

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: salt },
    key,
    data
  );

  // Output: salt + ciphertext, base64-encoded
  const combined = new Uint8Array(16 + ciphertext.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(ciphertext), 16);

  let binary = '';
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

/**
 * Decrypt a raw .es3 file (as base64) back to plaintext — for browser console debugging.
 * @param {string} b64  Base64 of the raw .es3 file bytes ([salt][ciphertext])
 * @returns {Promise<string>}  Plaintext ES3 JSON
 */
async function es3Decrypt(b64) {
  const raw    = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const salt   = raw.slice(0, 16);
  const ct     = raw.slice(16);
  const key    = await _deriveKey(salt, 'decrypt');

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: salt },
    key,
    ct
  );

  return new TextDecoder().decode(decrypted);
}
