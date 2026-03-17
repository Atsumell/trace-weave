import { always, eventually, implies, not, release } from "../builder/factory.js";
import type { FormulaExpr } from "../core/formula-expr.js";

/**
 * Absence: p never holds globally.
 * LTLf: G(!p)
 */
export function absence(p: FormulaExpr): FormulaExpr {
	return always(not(p));
}

/**
 * Response: every p is eventually followed by q.
 * LTLf: G(p -> F q)
 */
export function response(p: FormulaExpr, q: FormulaExpr): FormulaExpr {
	return always(implies(p, eventually(q)));
}

/**
 * Bounded Response: every p is followed by q within N steps (N positions from current).
 * LTLf: G(p -> withinSteps(n, q))
 * Consistent with withinSteps semantics: checks positions [pos, pos+n).
 */
export function boundedResponse(p: FormulaExpr, q: FormulaExpr, steps: number): FormulaExpr {
	return always(implies(p, { kind: "withinSteps", steps, child: q }));
}

/**
 * Precedence: q can only occur after p has occurred.
 * LTLf: (!q) U p  (or equivalently, G(!q) if p never happens)
 * Weak until variant: !q W p = ((!q) U p) | G(!q)
 */
export function precedence(p: FormulaExpr, q: FormulaExpr): FormulaExpr {
	return release(p, not(q));
}

/**
 * Persistence: once p holds, it holds forever after.
 * LTLf: G(p -> G p)
 */
export function persistence(p: FormulaExpr): FormulaExpr {
	return always(implies(p, always(p)));
}

/**
 * Stability: once p holds, q holds forever after.
 * LTLf: G(p -> G q)
 */
export function stability(p: FormulaExpr, q: FormulaExpr): FormulaExpr {
	return always(implies(p, always(q)));
}
