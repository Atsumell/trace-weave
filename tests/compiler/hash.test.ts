import { describe, expect, it } from "vitest";
import { contentHash, fnv1a } from "../../src/compiler/hash.js";

describe("hash", () => {
	it("fnv1a produces consistent results", () => {
		expect(fnv1a("hello")).toBe(fnv1a("hello"));
	});

	it("fnv1a produces different results for different inputs", () => {
		expect(fnv1a("hello")).not.toBe(fnv1a("world"));
	});

	it("contentHash returns 8-char hex string", () => {
		const hash = contentHash("test");
		expect(hash).toMatch(/^[0-9a-f]{8}$/);
	});

	it("contentHash is deterministic", () => {
		expect(contentHash("abc")).toBe(contentHash("abc"));
	});
});
