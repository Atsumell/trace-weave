import type { FormulaDocument } from "../core/formula-document.js";
import type { FormulaExpr } from "../core/formula-expr.js";
import type { FormulaNode } from "../core/formula-node.js";
import type { NodeId } from "../core/ids.js";
import { nodeId } from "../core/ids.js";
import type { NodeProvenance } from "../core/meta.js";
import { contentHash } from "./hash.js";

interface CompileContext {
	nodes: Record<string, FormulaNode>;
	provenance: Record<string, NodeProvenance>;
}

function canonicalKey(node: FormulaNode): string {
	return JSON.stringify(node);
}

function addNode(ctx: CompileContext, node: FormulaNode, expr: FormulaExpr): NodeId {
	const key = canonicalKey(node);
	const id = nodeId(contentHash(key));
	if (!Object.hasOwn(ctx.nodes, id)) {
		ctx.nodes[id] = node;
		if (expr.meta) {
			ctx.provenance[id] = {
				nodeId: id,
				origin: "user",
				sourceExprKind: expr.kind,
				meta: expr.meta,
			};
		}
	}
	return id;
}

function flattenVariadic(
	exprs: readonly FormulaExpr[],
	kind: "and" | "or",
	ctx: CompileContext,
): NodeId[] {
	const result: NodeId[] = [];
	for (const expr of exprs) {
		if (expr.kind === kind) {
			result.push(...flattenVariadic(expr.children, kind, ctx));
		} else {
			result.push(compileExpr(expr, ctx));
		}
	}
	return result;
}

function sortNodeIds(ids: NodeId[]): NodeId[] {
	return [...ids].sort((a, b) => a.localeCompare(b));
}

function compileExpr(expr: FormulaExpr, ctx: CompileContext): NodeId {
	switch (expr.kind) {
		case "literal":
			return addNode(ctx, { kind: "literal", value: expr.value }, expr);

		case "predicate": {
			const node: FormulaNode = expr.args
				? { kind: "predicate", predicateId: expr.predicateId, args: expr.args }
				: { kind: "predicate", predicateId: expr.predicateId };
			return addNode(ctx, node, expr);
		}

		case "when": {
			const child = compileExpr(expr.child, ctx);
			return addNode(
				ctx,
				{ kind: "when", captureName: expr.captureName, selectorId: expr.selectorId, child },
				expr,
			);
		}

		case "capture": {
			const child = compileExpr(expr.child, ctx);
			return addNode(
				ctx,
				{
					kind: "capture",
					captureName: expr.captureName,
					selectorId: expr.selectorId,
					child,
				},
				expr,
			);
		}

		case "not": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "not", child }, expr);
		}

		case "and": {
			const children = sortNodeIds(flattenVariadic(expr.children, "and", ctx));
			return addNode(ctx, { kind: "and", children }, expr);
		}

		case "or": {
			const children = sortNodeIds(flattenVariadic(expr.children, "or", ctx));
			return addNode(ctx, { kind: "or", children }, expr);
		}

		case "implies": {
			const left = compileExpr(expr.left, ctx);
			const right = compileExpr(expr.right, ctx);
			return addNode(ctx, { kind: "implies", left, right }, expr);
		}

		case "always": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "always", child }, expr);
		}

		case "eventually": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "eventually", child }, expr);
		}

		case "next": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "next", child }, expr);
		}

		case "weakNext": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "weakNext", child }, expr);
		}

		case "until": {
			const left = compileExpr(expr.left, ctx);
			const right = compileExpr(expr.right, ctx);
			return addNode(ctx, { kind: "until", left, right }, expr);
		}

		case "release": {
			const left = compileExpr(expr.left, ctx);
			const right = compileExpr(expr.right, ctx);
			return addNode(ctx, { kind: "release", left, right }, expr);
		}

		case "once": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "once", child }, expr);
		}

		case "historically": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "historically", child }, expr);
		}

		case "since": {
			const left = compileExpr(expr.left, ctx);
			const right = compileExpr(expr.right, ctx);
			return addNode(ctx, { kind: "since", left, right }, expr);
		}

		case "withinSteps": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "withinSteps", steps: expr.steps, child }, expr);
		}

		case "withinMs": {
			const child = compileExpr(expr.child, ctx);
			return addNode(ctx, { kind: "withinMs", ms: expr.ms, child }, expr);
		}
	}
}

export function compile(expr: FormulaExpr): FormulaDocument {
	const ctx: CompileContext = { nodes: {}, provenance: {} };
	const root = compileExpr(expr, ctx);
	return {
		schemaVersion: 1,
		root,
		nodes: ctx.nodes as Record<NodeId, FormulaNode>,
		...(Object.keys(ctx.provenance).length > 0
			? { provenance: ctx.provenance as Record<NodeId, NodeProvenance> }
			: {}),
	};
}
