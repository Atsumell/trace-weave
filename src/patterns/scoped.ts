import { always, and, implies, not, once, since } from "../builder/factory.js";
import type { FormulaExpr } from "../core/formula-expr.js";

/**
 * Globally scope — the pattern holds at every step.
 * Just wraps the pattern in always(). Included for API completeness.
 */
export function globally(pattern: FormulaExpr): FormulaExpr {
	return always(pattern);
}

/**
 * After scope — the pattern holds at every step after q has occurred.
 * LTLf: G(once(q) -> pattern)
 */
export function after(q: FormulaExpr, pattern: FormulaExpr): FormulaExpr {
	return always(implies(once(q), pattern));
}

/**
 * Before scope — the pattern holds at every step before r occurs.
 * LTLf: G(!once(r) -> pattern) which simplifies to: pattern holds until r.
 * We use historically(!r) -> pattern for each step.
 */
export function before(r: FormulaExpr, pattern: FormulaExpr): FormulaExpr {
	return always(implies(not(once(r)), pattern));
}

/**
 * Between scope — the pattern holds between every occurrence of q and the next r.
 * LTLf: G( (not(r) S q) -> pattern )
 * "not(r) since q" is true when q has occurred and r has not occurred since the last q.
 * This correctly handles re-entry: q→r→q reactivates the scope.
 */
export function between(q: FormulaExpr, r: FormulaExpr, pattern: FormulaExpr): FormulaExpr {
	const inScope = since(not(r), q);
	return always(implies(inScope, pattern));
}
