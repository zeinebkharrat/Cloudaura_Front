const ENCRYPTED_V1_PREFIX = 'enc:v1:';
const ENCRYPTED_V2_PREFIX = 'enc:v2:';
const ITERATIONS = 120000;

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const view = bytes.buffer;
  if (view instanceof ArrayBuffer) {
    return view.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(utf8Bytes(passphrase)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedV1Payload(value: string | null | undefined): boolean {
  return !!value && value.startsWith(ENCRYPTED_V1_PREFIX);
}

export function isEncryptedV2Payload(value: string | null | undefined): boolean {
  return !!value && value.startsWith(ENCRYPTED_V2_PREFIX);
}

export async function encryptLegacyV1Text(plainText: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveAesKey(passphrase, salt);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(utf8Bytes(plainText))
  );

  const cipherBytes = new Uint8Array(encryptedBuffer);
  return `${ENCRYPTED_V1_PREFIX}${toBase64(salt)}:${toBase64(iv)}:${toBase64(cipherBytes)}`;
}

export async function decryptLegacyV1Text(encryptedPayload: string, passphrase: string): Promise<string> {
  if (!isEncryptedV1Payload(encryptedPayload)) {
    return encryptedPayload;
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted payload format');
  }

  const salt = fromBase64(parts[2]);
  const iv = fromBase64(parts[3]);
  const cipher = fromBase64(parts[4]);

  const key = await deriveAesKey(passphrase, salt);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(cipher)
  );

  return new TextDecoder().decode(plainBuffer);
}

export function formatV2Payload(
  receiverEncryptedKey: string,
  senderEncryptedKey: string,
  iv: string,
  ciphertext: string
): string {
  return `${ENCRYPTED_V2_PREFIX}${receiverEncryptedKey}:${senderEncryptedKey}:${iv}:${ciphertext}`;
}

export function parseV2Payload(payload: string): {
  receiverEncryptedKey: string;
  senderEncryptedKey?: string;
  iv: string;
  ciphertext: string;
} | null {
  if (!isEncryptedV2Payload(payload)) {
    return null;
  }

  const parts = payload.split(':');
  if (parts.length !== 5 && parts.length !== 6) {
    return null;
  }

  if (parts.length === 6) {
    return {
      receiverEncryptedKey: parts[2],
      senderEncryptedKey: parts[3],
      iv: parts[4],
      ciphertext: parts[5],
    };
  }

  return {
    receiverEncryptedKey: parts[2],
    iv: parts[3],
    ciphertext: parts[4],
  };
}
