"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_INSTRUCTIONS = exports.WHY_CODE_NOTE_RULE = exports.CODE_IN_EXPRESSIONS_RULE = exports.NODE_SELECTION_STEPS = void 0;
exports.renderNodeSelectionSection = renderNodeSelectionSection;
exports.NODE_SELECTION_STEPS = [
    "The service's own node (Slack, Google Sheets, Postgres, ...). Use HTTP Request only when no node covers the operation.",
    'A native node for the job: Edit Fields (Set), Filter, IF, Switch, Merge, Aggregate, Summarize, Remove Duplicates, Sort, Limit, Split Out, Date & Time, Compare Datasets.',
    'A short expression in that node\'s field; see tools_documentation({topic: "expression_helpers"}).',
    'A Code node, only for: loops or recursion that per-item execution and Loop Over Items cannot express, state across runs, parsing no node handles, external libraries, heavy all-items work on queue-mode workers, or one short Code node that replaces four or more glue nodes.',
];
exports.CODE_IN_EXPRESSIONS_RULE = 'An expression with a function body or several statements counts as code: use a Code node for it, not a long expression.';
exports.WHY_CODE_NOTE_RULE = 'When a Code node is the right choice, start its notes with "Why Code:" and the reason; validate_workflow then does not suggest a native node for it.';
const NUMBERED_STEPS = exports.NODE_SELECTION_STEPS.map((step, index) => `${index + 1}. ${step}`);
exports.SERVER_INSTRUCTIONS = [
    'n8n-mcp provides n8n node documentation, validation and workflow management tools. tools_documentation() gives the overview.',
    'Choose nodes native first, taking the first option that does the job:',
    ...NUMBERED_STEPS,
    exports.CODE_IN_EXPRESSIONS_RULE,
    exports.WHY_CODE_NOTE_RULE,
    'Call get_node with detail "standard" before configuring a node: its options list many settings that make a Code node unnecessary.',
].join('\n');
function renderNodeSelectionSection() {
    return `## Choosing Nodes (native first)
Take the first option that does the job:
${NUMBERED_STEPS.join('\n')}

${exports.CODE_IN_EXPRESSIONS_RULE}
${exports.WHY_CODE_NOTE_RULE} Read tools_documentation({topic: "javascript_code_node_guide"}) or tools_documentation({topic: "python_code_node_guide"}) first.`;
}
//# sourceMappingURL=native-first.js.map