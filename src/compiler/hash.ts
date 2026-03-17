const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a(input: string): number {
	let hash = FNV_OFFSET;
	for (let i = 0; i < input.length; i++) {
		const code = input.charCodeAt(i);
		// Handle UTF-16: XOR both bytes for codes > 0xFF
		if (code > 0xff) {
			hash ^= code >> 8;
			hash = Math.imul(hash, FNV_PRIME) >>> 0;
			hash ^= code & 0xff;
		} else {
			hash ^= code;
		}
		hash = Math.imul(hash, FNV_PRIME) >>> 0;
	}
	return hash;
}

export function contentHash(input: string): string {
	return fnv1a(input).toString(16).padStart(8, "0");
}
