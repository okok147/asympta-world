const MAX_PHOTO_BYTES = 160_000;
const MAX_PHOTO_SIDE = 1280;

function rejectPhoto(): never {
  throw new Error('invalid_photo');
}

/**
 * Keep the baseline JPEG scan and decoding tables. Discard every APP and
 * comment segment, including EXIF/GPS, thumbnails, ICC and XMP.
 */
export function circlePhoto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > 4 * Math.ceil(MAX_PHOTO_BYTES / 3) ||
      value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return rejectPhoto();
  }

  let input: Uint8Array;
  try {
    input = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  } catch {
    return rejectPhoto();
  }
  if (input.length < 16 || input.length > MAX_PHOTO_BYTES || input[0] !== 0xff || input[1] !== 0xd8) {
    return rejectPhoto();
  }

  const retained = [input.subarray(0, 2)];
  let components = 0;
  let hasQuantizationTable = false;
  let hasHuffmanTable = false;
  for (let offset = 2; offset + 3 < input.length;) {
    const start = offset;
    if (input[offset++] !== 0xff) return rejectPhoto();
    while (input[offset] === 0xff) offset++;
    const marker = input[offset++];
    const length = (input[offset] << 8) | input[offset + 1];
    const end = offset + length;
    if (length < 2 || end > input.length) return rejectPhoto();

    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    switch (marker) {
      case 0xc0: {
        const height = (input[offset + 3] << 8) | input[offset + 4];
        const width = (input[offset + 5] << 8) | input[offset + 6];
        const count = input[offset + 7];
        if (components || input[offset + 2] !== 8 || !width || !height ||
            width > MAX_PHOTO_SIDE || height > MAX_PHOTO_SIDE ||
            (count !== 1 && count !== 3) || length !== 8 + 3 * count) return rejectPhoto();
        components = count;
        break;
      }
      case 0xdb:
        hasQuantizationTable = true;
        break;
      case 0xc4:
        hasHuffmanTable = true;
        break;
      case 0xdd:
        if (length !== 4) return rejectPhoto();
        break;
      case 0xda: {
        if (!components || !hasQuantizationTable || !hasHuffmanTable ||
            length !== 6 + 2 * components || input[offset + 2] !== components) return rejectPhoto();
        if (input[end - 3] !== 0 || input[end - 2] !== 63 || input[end - 1] !== 0) return rejectPhoto();
        const scanEnd = baselineScanEnd(input, end);
        if (scanEnd !== input.length) return rejectPhoto();
        retained.push(input.subarray(start, scanEnd));
        return encode(retained);
      }
      default:
        if (!isMetadata) return rejectPhoto();
    }
    if (!isMetadata) retained.push(input.subarray(start, end));
    offset = end;
  }
  return rejectPhoto();
}

function baselineScanEnd(bytes: Uint8Array, start: number): number {
  if (start + 2 >= bytes.length) return rejectPhoto();
  for (let offset = start; offset < bytes.length; offset++) {
    if (bytes[offset] !== 0xff) continue;
    do { offset++; } while (bytes[offset] === 0xff);
    const marker = bytes[offset];
    if (marker === 0xd9) return offset + 1;
    if (marker !== 0x00 && !(marker >= 0xd0 && marker <= 0xd7)) return rejectPhoto();
  }
  return rejectPhoto();
}

function encode(parts: Uint8Array[]): string {
  const chunks: string[] = [];
  for (const bytes of parts) {
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
    }
  }
  return btoa(chunks.join(''));
}
