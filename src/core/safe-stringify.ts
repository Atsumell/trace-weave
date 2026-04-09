function fallbackToString(value: unknown): string {
	try {
		return String(value);
	} catch {
		return "[Unserializable value]";
	}
}

export function safeStringify(value: unknown): string {
	const ancestors: object[] = [];

	try {
		const json = JSON.stringify(value, function (_key, current: unknown) {
			if (typeof current === "bigint") {
				return `${current}n`;
			}

			if (typeof current !== "object" || current === null) {
				return current;
			}

			while (ancestors.length > 0 && ancestors.at(-1) !== this) {
				ancestors.pop();
			}

			if (ancestors.includes(current)) {
				return "[Circular]";
			}

			ancestors.push(current);
			return current;
		});

		return json ?? fallbackToString(value);
	} catch {
		return fallbackToString(value);
	}
}
