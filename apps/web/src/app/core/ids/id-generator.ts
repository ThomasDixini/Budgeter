import { Injectable } from '@angular/core';

const UUID_BYTES = 16;
const VERSION_BYTE = 6;
const VARIANT_BYTE = 8;

/**
 * Source of record ids. Ids are created on the client so a record exists locally before
 * the server confirms it, and a retried request cannot create a duplicate.
 */
@Injectable({ providedIn: 'root' })
export class IdGenerator {
  /**
   * A random RFC 4122 version 4 UUID. Built on `getRandomValues` because `randomUUID`
   * is missing on plain-HTTP origins, such as the dev server opened from a phone on the LAN.
   * @example inject(IdGenerator).next() // '3f2b7c1e-0d4a-4c55-9a51-6b1f6c2d8e90'
   */
  next(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES));
    bytes[VERSION_BYTE] = (bytes[VERSION_BYTE] & 0x0f) | 0x40;
    bytes[VARIANT_BYTE] = (bytes[VARIANT_BYTE] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
