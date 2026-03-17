import type { JsonValue } from "../core/values.js";

export const formulaDocumentSchema: JsonValue = {
	$schema: "http://json-schema.org/draft-07/schema#",
	title: "FormulaDocument",
	description: "A compiled LTLf formula document for trace-weave",
	type: "object",
	required: ["schemaVersion", "root", "nodes"],
	properties: {
		schemaVersion: { type: "number", const: 1 },
		root: { type: "string", description: "NodeId of the root formula node" },
		nodes: {
			type: "object",
			description: "Map from NodeId to FormulaNode",
			additionalProperties: {
				type: "object",
				required: ["kind"],
				properties: {
					kind: {
						type: "string",
						enum: [
							"literal",
							"predicate",
							"when",
							"capture",
							"not",
							"and",
							"or",
							"implies",
							"always",
							"eventually",
							"next",
							"weakNext",
							"until",
							"release",
							"once",
							"historically",
							"since",
							"withinSteps",
							"withinMs",
						],
					},
				},
			},
		},
		provenance: {
			type: "object",
			description: "Optional provenance information for nodes",
			additionalProperties: {
				type: "object",
				properties: {
					nodeId: { type: "string" },
					origin: { type: "string", enum: ["user", "compiler", "pattern"] },
					sourceExprKind: { type: "string" },
					meta: {
						type: "object",
						properties: {
							humanLabel: { type: "string" },
							confidence: { type: "number" },
						},
					},
				},
			},
		},
	},
};
