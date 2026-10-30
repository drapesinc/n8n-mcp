export declare const NODE_SELECTION_STEPS: readonly string[];
export declare const CODE_IN_EXPRESSIONS_RULE = "An expression with a function body or several statements counts as code: use a Code node for it, not a long expression.";
export declare const WHY_CODE_NOTE_RULE = "When a Code node is the right choice, start its notes with \"Why Code:\" and the reason; validate_workflow then does not suggest a native node for it.";
export declare const SERVER_INSTRUCTIONS: string;
export declare function renderNodeSelectionSection(): string;
//# sourceMappingURL=native-first.d.ts.map