import { supabase } from './supabase';

const BUCKET = 'media';

/** True for photos picked on this device (blob:, file:, content:, data:) as opposed to a link on the internet. */
export function isLocalUri(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
};

/*
 * Phones: reading a picked photo back with fetch(file://...).arrayBuffer() is unreliable in
 * React Native (it can fail or return an empty file). The image picker can hand us the photo's
 * bytes directly as base64, so we remember them here, keyed by the photo's uri, and upload those.
 * On the web we don't need this: fetch() works on blob: URLs.
 */
const pickedBase64 = new Map<string, string>();

export function rememberPickedImage(uri: string, base64?: string | null): void {
  if (base64) pickedBase64.set(uri, base64);
}

const B64_LOOKUP = (() => {
  const table = new Uint8Array(256).fill(255);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < alphabet.length; i++) table[alphabet.charCodeAt(i)] = i;
  return table;
})();

function base64ToBytes(input: string): Uint8Array {
  // Drop anything that isn't base64 (padding "=", whitespace, a data: prefix has no such chars after the comma).
  const data = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  const clean = data.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)];
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? B64_LOOKUP[clean.charCodeAt(i + 2)] : 255;
    const d = i + 3 < clean.length ? B64_LOOKUP[clean.charCodeAt(i + 3)] : 255;
    if (p < out.length) out[p++] = (a << 2) | (b >> 4);
    if (c !== 255 && p < out.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (d !== 255 && p < out.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}

function mimeFromUri(uri: string): string | undefined {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_MIME[ext];
}

/**
 * Uploads a local image to Supabase Storage and returns its public URL.
 * Files are stored at  <userId>/<folder>/<timestamp>.<ext>  so the storage policy
 * (you may only write inside your own folder) is satisfied.
 */
export async function uploadImage(
  userId: string,
  uri: string,
  folder: 'avatars' | 'posts' | 'stories',
): Promise<string> {
  let bytes: ArrayBuffer;
  let contentType: string;

  const base64 = pickedBase64.get(uri);
  if (base64) {
    // Phone path: bytes straight from the image picker.
    const array = base64ToBytes(base64);
    bytes = array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength) as ArrayBuffer;
    contentType = mimeFromUri(uri) ?? 'image/jpeg';
  } else {
    // Web path: fetch() can read blob: URLs (and works for file:// on most phones as a fallback).
    const response = await fetch(uri);
    bytes = await response.arrayBuffer();
    const headerType = response.headers.get('content-type');
    contentType =
      headerType && headerType.startsWith('image/') ? headerType : (mimeFromUri(uri) ?? 'image/jpeg');
  }

  // Never upload an empty file; it would "succeed" and then show as a blank picture.
  if (bytes.byteLength === 0) {
    throw new Error('The selected photo could not be read. Please pick it again.');
  }

  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  pickedBase64.delete(uri); // free the memory
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
