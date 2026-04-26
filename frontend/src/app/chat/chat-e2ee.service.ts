import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { E2eePublicKeyResponse, MessageResponse } from './chat.types';
import {
  decryptLegacyV1Text,
  formatV2Payload,
  isEncryptedV1Payload,
  isEncryptedV2Payload,
  parseV2Payload,
} from './e2e-crypto.util';

interface EncryptResult {
  encryptedMessage: string;
  encryptedKey: string;
  iv: string;
}

/** Thrown when the peer has never uploaded a public key (e.g. never logged in after E2EE was added). */
export class ReceiverHasNoE2eeKeyError extends Error {
  override readonly name = 'ReceiverHasNoE2eeKeyError';
  constructor() {
    super('Receiver has no registered E2EE public key');
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

@Injectable({ providedIn: 'root' })
export class ChatE2eeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '';

  private static readonly PRIVATE_KEY_PREFIX = 'chat.e2ee.v2.private.';
  private static readonly PUBLIC_KEY_PREFIX = 'chat.e2ee.v2.public.';
  private static readonly LEGACY_V1_SECRET_KEY = 'chat.e2e.roomSecrets.v1';

  async ensureKeyPairReady(userId: number): Promise<void> {
    const privateStorageKey = this.privateKeyStorageKey(userId);
    const publicStorageKey = this.publicKeyStorageKey(userId);

    let privateJwk = localStorage.getItem(privateStorageKey);
    let publicSpki = localStorage.getItem(publicStorageKey);

    if (!privateJwk || !publicSpki) {
      const pair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );

      const exportedPrivate = await crypto.subtle.exportKey('jwk', pair.privateKey);
      const exportedPublic = await crypto.subtle.exportKey('spki', pair.publicKey);

      privateJwk = JSON.stringify(exportedPrivate);
      publicSpki = this.arrayBufferToBase64(exportedPublic);

      localStorage.setItem(privateStorageKey, privateJwk);
      localStorage.setItem(publicStorageKey, publicSpki);
    }

    await firstValueFrom(
      this.http.put(`${this.baseUrl}/chatroom/keys/me`, {
        publicKey: publicSpki,
      })
    );
  }

  async encryptTextForParticipants(senderId: number, receiverId: number, plainText: string): Promise<EncryptResult> {
    if (!Number.isFinite(senderId)) {
      throw new Error('Missing current user for E2EE encryption');
    }

    const receiverPublicKey = await this.getReceiverPublicKey(receiverId);
    if (!receiverPublicKey) {
      throw new ReceiverHasNoE2eeKeyError();
    }
    const senderPublicKey = await this.getOwnPublicKey(senderId);

    // Generate a one-time AES key per message for forward secrecy at message granularity.
    const aesKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt']
    );

    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(plainText);

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.toArrayBuffer(iv) },
      aesKey,
      this.toArrayBuffer(plaintextBytes)
    );

    const receiverWrappedKeyBuffer = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      receiverPublicKey,
      rawAesKey
    );

    const senderWrappedKeyBuffer = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      senderPublicKey,
      rawAesKey
    );

    const receiverEncryptedKey = this.arrayBufferToBase64(receiverWrappedKeyBuffer);
    const senderEncryptedKey = this.arrayBufferToBase64(senderWrappedKeyBuffer);
    const ivB64 = this.uint8ArrayToBase64(iv);
    const cipherB64 = this.arrayBufferToBase64(cipherBuffer);

    return {
      encryptedMessage: formatV2Payload(receiverEncryptedKey, senderEncryptedKey, ivB64, cipherB64),
      encryptedKey: receiverEncryptedKey,
      iv: ivB64,
    };
  }

  async decryptTextMessage(message: MessageResponse, currentUserId: number | null): Promise<string> {
    const payload = message.content ?? '';
    const hasSeparatedV2Fields = !!message.encryptedKey && !!message.iv;

    if (isEncryptedV2Payload(payload) || hasSeparatedV2Fields) {
      if (!currentUserId) {
        return 'Encrypted message';
      }

      const parsed = isEncryptedV2Payload(payload)
        ? parseV2Payload(payload)
        : {
            receiverEncryptedKey: message.encryptedKey!,
            senderEncryptedKey: undefined,
            iv: message.iv!,
            ciphertext: payload,
          };
      if (!parsed) {
        return 'Encrypted message (invalid format)';
      }

      try {
        const privateKey = await this.getPrivateKey(currentUserId);
        const useSenderKey = message.senderId != null && message.senderId === currentUserId;
        const candidateKeys: string[] = [];

        const preferred = useSenderKey ? parsed.senderEncryptedKey : parsed.receiverEncryptedKey;
        if (preferred) {
          candidateKeys.push(preferred);
        }
        if (parsed.receiverEncryptedKey && !candidateKeys.includes(parsed.receiverEncryptedKey)) {
          candidateKeys.push(parsed.receiverEncryptedKey);
        }
        if (parsed.senderEncryptedKey && !candidateKeys.includes(parsed.senderEncryptedKey)) {
          candidateKeys.push(parsed.senderEncryptedKey);
        }

        const ivBytes = this.base64ToUint8Array(parsed.iv);
        const cipher = this.base64ToArrayBuffer(parsed.ciphertext);

        for (const candidateWrappedKey of candidateKeys) {
          try {
            const wrappedKey = this.base64ToArrayBuffer(candidateWrappedKey);
            const rawAesKey = await crypto.subtle.decrypt(
              {
                name: 'RSA-OAEP',
              },
              privateKey,
              wrappedKey
            );

            const aesKey = await crypto.subtle.importKey(
              'raw',
              rawAesKey,
              {
                name: 'AES-GCM',
                length: 256,
              },
              false,
              ['decrypt']
            );

            const plainBuffer = await crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv: this.toArrayBuffer(ivBytes),
              },
              aesKey,
              cipher
            );

            return new TextDecoder().decode(plainBuffer);
          } catch {
            // Try next wrapped key candidate.
          }
        }

        throw new Error('No wrapped key candidate decrypted successfully');
      } catch {
        return 'Encrypted message (cannot decrypt on this device)';
      }
    }

    if (isEncryptedV1Payload(payload)) {
      const roomSecrets = this.getLegacyRoomSecrets();
      const roomSecret = roomSecrets[message.chatRoomId];
      if (!roomSecret) {
        return 'Legacy encrypted message (missing old key)';
      }

      try {
        return await decryptLegacyV1Text(payload, roomSecret);
      } catch {
        return 'Legacy encrypted message (wrong old key)';
      }
    }

    return payload;
  }

  isEncryptedTextPayload(payload: string | null | undefined): boolean {
    return isEncryptedV2Payload(payload) || isEncryptedV1Payload(payload);
  }

  /** Null if the user has not registered a key yet (`PUT /chatroom/keys/me` after login). */
  private async getReceiverPublicKey(userId: number): Promise<CryptoKey | null> {
    const response = await firstValueFrom(
      this.http.get<E2eePublicKeyResponse>(`${this.baseUrl}/chatroom/keys/${userId}`)
    );

    if (!response.publicKey?.trim()) {
      return null;
    }

    return crypto.subtle.importKey(
      'spki',
      this.base64ToArrayBuffer(response.publicKey),
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );
  }

  private async getOwnPublicKey(userId: number): Promise<CryptoKey> {
    const publicSpki = localStorage.getItem(this.publicKeyStorageKey(userId));
    if (!publicSpki) {
      throw new Error('Missing local public key');
    }

    return crypto.subtle.importKey(
      'spki',
      this.base64ToArrayBuffer(publicSpki),
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );
  }

  private async getPrivateKey(userId: number): Promise<CryptoKey> {
    const privateJwkRaw = localStorage.getItem(this.privateKeyStorageKey(userId));
    if (!privateJwkRaw) {
      throw new Error('Missing private key in local storage');
    }

    const privateJwk = JSON.parse(privateJwkRaw) as JsonWebKey;
    return crypto.subtle.importKey(
      'jwk',
      privateJwk,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt']
    );
  }

  private privateKeyStorageKey(userId: number): string {
    return `${ChatE2eeService.PRIVATE_KEY_PREFIX}${userId}`;
  }

  private publicKeyStorageKey(userId: number): string {
    return `${ChatE2eeService.PUBLIC_KEY_PREFIX}${userId}`;
  }

  private getLegacyRoomSecrets(): Record<number, string> {
    try {
      const raw = localStorage.getItem(ChatE2eeService.LEGACY_V1_SECRET_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, string>;
      const normalized: Record<number, string> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        const id = Number(key);
        if (Number.isFinite(id) && typeof value === 'string' && value.trim()) {
          normalized[id] = value;
        }
      });
      return normalized;
    } catch {
      return {};
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return this.uint8ArrayToBase64(bytes);
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const bytes = this.base64ToUint8Array(base64);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const view = bytes.buffer;
    if (view instanceof ArrayBuffer) {
      return view.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
  }

}
