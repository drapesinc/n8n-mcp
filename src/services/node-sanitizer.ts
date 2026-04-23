/**
 * Node Sanitizer Service
 *
 * Ensures nodes have complete metadata required by n8n UI.
 * Based on n8n AI Workflow Builder patterns:
 * - Merges node type defaults with user parameters
 * - Auto-adds required metadata for filter-based nodes (IF v2.2+, Switch v3.2+)
 * - Fixes operator structure
 * - Prevents "Could not find property option" errors
 */

import { INodeParameters } from 'n8n-workflow';
import { logger } from '../utils/logger';
import { WorkflowNode } from '../types/n8n-api';

/** Legacy operator names that n8n no longer recognizes, mapped to their correct names. */
const OPERATOR_CORRECTIONS: Record<string, string> = {
  'isEmpty': 'empty',
  'isNotEmpty': 'notEmpty',
};

/** Operators that take no right-hand value and require singleValue: true. */
const UNARY_OPERATORS = new Set([
  'true',
  'false',
  'isNumeric',
  'empty',
  'notEmpty',
  'exists',
  'notExists',
]);

/**
 * Known fixedCollection paths where n8n stores collection-type parameters as
 * `{itemName: [...entries]}` (multipleValues: true). When AI agents or external
 * callers pass a bare array for the container, or wrap it incorrectly, n8n's
 * runtime throws "propertyValues[itemName] is not iterable" and the editor UI
 * crashes when rendering the node. This map lets us normalize the shape back
 * to the form n8n expects before the workflow is persisted.
 *
 * Structure: nodeType (short form) -> container param name -> expected item name.
 * Multiple container params per node are supported.
 *
 * IMPORTANT: Only register fixedCollections with `multipleValues: true` here.
 * Single-value fixedCollections (like IF node's `conditions`) use a different
 * on-disk shape and are handled by node-specific sanitizers.
 */
const FIXED_COLLECTION_SHAPES: Record<string, Record<string, string>> = {
  // Notion is the primary trigger for this repair — propertiesUi corruption
  // causes n8n to throw "propertyValues[itemName] is not iterable" and
  // freezes the editor. Both propertiesUi and blockUi are top-level
  // fixedCollection params with multipleValues: true in Notion's node
  // descriptions.
  'n8n-nodes-base.notion': {
    propertiesUi: 'propertyValues',
    blockUi: 'blockValues',
  },
};

/**
 * Sanitize a single node by adding required metadata
 */
export function sanitizeNode(node: WorkflowNode): WorkflowNode {
  const sanitized = { ...node };

  // Apply node-specific sanitization
  if (isFilterBasedNode(node.type, node.typeVersion)) {
    sanitized.parameters = sanitizeFilterBasedNode(
      sanitized.parameters as INodeParameters,
      node.type,
      node.typeVersion
    );
  }

  // Generic fixedCollection shape repair — fires on every node so that
  // ANY callsite that modifies node parameters gets a last-chance fix
  // before the workflow is handed back to the n8n API. See #90 and the
  // Notion propertiesUi regression for context.
  sanitized.parameters = normalizeFixedCollections(
    node.type,
    sanitized.parameters as INodeParameters
  );

  return sanitized;
}

/**
 * Normalize fixedCollection-with-multipleValues parameters to the shape n8n
 * expects on disk: `{container: {itemName: [...entries]}}`.
 *
 * Handles these corruption patterns (in order):
 *   1. Bare array at container level:  `container = [...]` → `{itemName: [...]}`
 *   2. Item is a single object (not array): `{itemName: {...}}` → `{itemName: [{...}]}`
 *   3. Double-wrapped item: `{itemName: {itemName: [...]}}` → `{itemName: [...]}`
 *   4. Mis-named item key: `{wrongName: [...]}` when only one key present and its
 *      value is array-shaped → renamed to the expected `itemName`.
 *
 * Unknown node types and unknown container params are passed through untouched.
 * This is safe-by-default: we never drop data, we only re-shape.
 */
export function normalizeFixedCollections(
  nodeType: string,
  parameters: INodeParameters
): INodeParameters {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    return parameters;
  }

  const shapes = FIXED_COLLECTION_SHAPES[nodeType];
  if (!shapes) {
    return parameters;
  }

  let mutated = false;
  const result: INodeParameters = { ...parameters };

  for (const [containerName, expectedItemName] of Object.entries(shapes)) {
    if (!(containerName in result)) continue;

    const container = result[containerName];
    const repaired = reshapeFixedCollectionContainer(container, expectedItemName);

    if (repaired !== container) {
      logger.debug(
        `normalizeFixedCollections: repaired ${nodeType}.${containerName} ` +
          `shape (expected item "${expectedItemName}")`
      );
      // Cast through unknown — INodeParameters values are broadly typed but
      // fixedCollection containers are always plain objects or arrays.
      (result as Record<string, unknown>)[containerName] = repaired;
      mutated = true;
    }
  }

  return mutated ? result : parameters;
}

/**
 * Reshape a single fixedCollection container value. Returns the original
 * reference unchanged if no repair was needed (so callers can cheaply detect
 * mutations via reference equality).
 */
function reshapeFixedCollectionContainer(
  container: unknown,
  expectedItemName: string
): unknown {
  // null / undefined / primitive — nothing to repair.
  if (container === null || container === undefined) return container;
  if (typeof container !== 'object') return container;

  // Case 1: bare array. Wrap with the expected item name.
  if (Array.isArray(container)) {
    return { [expectedItemName]: container };
  }

  const obj = container as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Case 2/3: expected key is present.
  if (expectedItemName in obj) {
    const item = obj[expectedItemName];

    // Case 3: double-wrapped — `{itemName: {itemName: [...]}}`.
    if (
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      expectedItemName in (item as Record<string, unknown>)
    ) {
      const inner = (item as Record<string, unknown>)[expectedItemName];
      if (Array.isArray(inner)) {
        return { ...obj, [expectedItemName]: inner };
      }
    }

    // Case 2: item is a single entry object instead of an array. Wrap it.
    // Guard: only wrap if it looks like an entry (has at least one own key)
    // AND is NOT already a recognisable collection shape. Entries in n8n
    // fixedCollections are always plain objects with primitive/expression
    // leaf values, never arrays.
    if (
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      Object.keys(item as Record<string, unknown>).length > 0
    ) {
      return { ...obj, [expectedItemName]: [item] };
    }

    return container; // Already in correct shape (array), pass through.
  }

  // Case 4: single mis-named key whose value is array-shaped. Rename it.
  // This catches flatten-then-rewrap mistakes where the container got the
  // right wrapper shape but a wrong inner key (e.g. "values" instead of
  // "propertyValues").
  if (keys.length === 1) {
    const onlyKey = keys[0];
    const onlyValue = obj[onlyKey];
    if (Array.isArray(onlyValue)) {
      return { [expectedItemName]: onlyValue };
    }
  }

  return container;
}

/**
 * Sanitize all nodes in a workflow
 */
export function sanitizeWorkflowNodes(workflow: any): any {
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return workflow;
  }

  return {
    ...workflow,
    nodes: workflow.nodes.map(sanitizeNode)
  };
}

/**
 * Check if node is filter-based (IF v2.2+, Switch v3.2+)
 */
function isFilterBasedNode(nodeType: string, typeVersion: number): boolean {
  if (nodeType === 'n8n-nodes-base.if') {
    return typeVersion >= 2.2;
  }
  if (nodeType === 'n8n-nodes-base.switch') {
    return typeVersion >= 3.2;
  }
  return false;
}

/**
 * Sanitize filter-based nodes (IF v2.2+, Switch v3.2+)
 * Ensures conditions.options has complete structure
 */
function sanitizeFilterBasedNode(
  parameters: INodeParameters,
  nodeType: string,
  typeVersion: number
): INodeParameters {
  const sanitized = { ...parameters };

  // Handle IF node
  if (nodeType === 'n8n-nodes-base.if' && typeVersion >= 2.2) {
    sanitized.conditions = sanitizeFilterConditions(sanitized.conditions as any);
  }

  // Handle Switch node
  if (nodeType === 'n8n-nodes-base.switch' && typeVersion >= 3.2) {
    if (sanitized.rules && typeof sanitized.rules === 'object') {
      const rules = sanitized.rules as any;
      if (rules.rules && Array.isArray(rules.rules)) {
        rules.rules = rules.rules.map((rule: any) => ({
          ...rule,
          conditions: sanitizeFilterConditions(rule.conditions)
        }));
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize filter conditions structure
 */
function sanitizeFilterConditions(conditions: any): any {
  if (!conditions || typeof conditions !== 'object') {
    return conditions;
  }

  const sanitized = { ...conditions };

  // Ensure options has complete structure
  if (!sanitized.options) {
    sanitized.options = {};
  }

  // Add required filter options metadata
  const requiredOptions = {
    version: 2,
    leftValue: '',
    caseSensitive: true,
    typeValidation: 'strict'
  };

  // Merge with existing options, preserving user values
  sanitized.options = {
    ...requiredOptions,
    ...sanitized.options
  };

  // Sanitize conditions array
  if (sanitized.conditions && Array.isArray(sanitized.conditions)) {
    sanitized.conditions = sanitized.conditions.map(sanitizeCondition);
  }

  return sanitized;
}

/**
 * Sanitize a single condition
 */
function sanitizeCondition(condition: any): any {
  if (!condition || typeof condition !== 'object') {
    return condition;
  }

  const sanitized = { ...condition };

  // Ensure condition has an ID
  if (!sanitized.id) {
    sanitized.id = generateConditionId();
  }

  // Sanitize operator structure
  if (sanitized.operator) {
    sanitized.operator = sanitizeOperator(sanitized.operator);
  }

  return sanitized;
}

/**
 * Sanitize operator structure
 * Ensures operator has correct format: {type, operation, singleValue?}
 */
function sanitizeOperator(operator: any): any {
  if (!operator || typeof operator !== 'object') {
    return operator;
  }

  const sanitized = { ...operator };

  // Fix common mistake: type field used for operation name
  // WRONG: {type: "notEmpty"}
  // RIGHT: {type: "string", operation: "notEmpty"}
  if (sanitized.type && !sanitized.operation) {
    const typeValue = sanitized.type as string;
    if (isOperationName(typeValue)) {
      logger.debug(`Fixing operator structure: converting type="${typeValue}" to operation`);
      sanitized.type = inferDataType(typeValue);
      sanitized.operation = typeValue;
    }
  }

  // Auto-correct legacy operator names to n8n-recognized names
  if (sanitized.operation && OPERATOR_CORRECTIONS[sanitized.operation]) {
    sanitized.operation = OPERATOR_CORRECTIONS[sanitized.operation];
  }

  // Set singleValue based on operator type
  if (sanitized.operation) {
    if (isUnaryOperator(sanitized.operation)) {
      sanitized.singleValue = true;
    } else {
      // Binary operators should NOT have singleValue — remove it to prevent UI errors
      delete sanitized.singleValue;
    }
  }

  return sanitized;
}

/**
 * Check if string looks like an operation name (not a data type)
 */
function isOperationName(value: string): boolean {
  // Operation names are lowercase and don't contain dots
  // Data types are: string, number, boolean, dateTime, array, object
  const dataTypes = ['string', 'number', 'boolean', 'dateTime', 'array', 'object'];
  return !dataTypes.includes(value) && /^[a-z][a-zA-Z]*$/.test(value);
}

/**
 * Infer data type from operation name
 */
function inferDataType(operation: string): string {
  // Boolean operations
  const booleanOps = ['true', 'false'];
  if (booleanOps.includes(operation)) {
    return 'boolean';
  }

  // Number operations (partial match to catch variants like "greaterThan" containing "gt")
  const numberOps = ['isNumeric', 'gt', 'gte', 'lt', 'lte'];
  if (numberOps.some(op => operation.includes(op))) {
    return 'number';
  }

  // Date operations (partial match to catch variants like "isAfter" containing "after")
  const dateOps = ['after', 'before', 'afterDate', 'beforeDate'];
  if (dateOps.some(op => operation.includes(op))) {
    return 'dateTime';
  }

  // Object operations: empty/notEmpty/exists/notExists are generic object-level checks
  const objectOps = ['empty', 'notEmpty', 'exists', 'notExists'];
  if (objectOps.includes(operation)) {
    return 'object';
  }

  // Default to string
  return 'string';
}

/**
 * Check if operator is unary (requires singleValue: true)
 */
function isUnaryOperator(operation: string): boolean {
  return UNARY_OPERATORS.has(operation);
}

/**
 * Generate unique condition ID
 */
function generateConditionId(): string {
  return `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate that a node has complete metadata
 * Returns array of issues found
 */
export function validateNodeMetadata(node: WorkflowNode): string[] {
  const issues: string[] = [];

  if (!isFilterBasedNode(node.type, node.typeVersion)) {
    return issues; // Not a filter-based node
  }

  // Check IF node
  if (node.type === 'n8n-nodes-base.if') {
    const conditions = (node.parameters.conditions as any);
    if (!conditions?.options) {
      issues.push('Missing conditions.options');
    } else {
      const required = ['version', 'leftValue', 'typeValidation', 'caseSensitive'];
      for (const field of required) {
        if (!(field in conditions.options)) {
          issues.push(`Missing conditions.options.${field}`);
        }
      }
    }

    // Check operators
    if (conditions?.conditions && Array.isArray(conditions.conditions)) {
      for (let i = 0; i < conditions.conditions.length; i++) {
        const condition = conditions.conditions[i];
        const operatorIssues = validateOperator(condition.operator, `conditions.conditions[${i}].operator`);
        issues.push(...operatorIssues);
      }
    }
  }

  // Check Switch node
  if (node.type === 'n8n-nodes-base.switch') {
    const rules = (node.parameters.rules as any);
    if (rules?.rules && Array.isArray(rules.rules)) {
      for (let i = 0; i < rules.rules.length; i++) {
        const rule = rules.rules[i];
        if (!rule.conditions?.options) {
          issues.push(`Missing rules.rules[${i}].conditions.options`);
        } else {
          const required = ['version', 'leftValue', 'typeValidation', 'caseSensitive'];
          for (const field of required) {
            if (!(field in rule.conditions.options)) {
              issues.push(`Missing rules.rules[${i}].conditions.options.${field}`);
            }
          }
        }

        // Check operators
        if (rule.conditions?.conditions && Array.isArray(rule.conditions.conditions)) {
          for (let j = 0; j < rule.conditions.conditions.length; j++) {
            const condition = rule.conditions.conditions[j];
            const operatorIssues = validateOperator(
              condition.operator,
              `rules.rules[${i}].conditions.conditions[${j}].operator`
            );
            issues.push(...operatorIssues);
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Validate operator structure
 */
function validateOperator(operator: any, path: string): string[] {
  const issues: string[] = [];

  if (!operator || typeof operator !== 'object') {
    issues.push(`${path}: operator is missing or not an object`);
    return issues;
  }

  if (!operator.type) {
    issues.push(`${path}: missing required field 'type'`);
  } else if (!['string', 'number', 'boolean', 'dateTime', 'array', 'object'].includes(operator.type)) {
    issues.push(`${path}: invalid type "${operator.type}" (must be data type, not operation)`);
  }

  if (!operator.operation) {
    issues.push(`${path}: missing required field 'operation'`);
  }

  // Check singleValue based on operator type
  if (operator.operation) {
    if (isUnaryOperator(operator.operation)) {
      // Unary operators MUST have singleValue: true
      if (operator.singleValue !== true) {
        issues.push(`${path}: unary operator "${operator.operation}" requires singleValue: true`);
      }
    } else {
      // Binary operators should NOT have singleValue
      if (operator.singleValue === true) {
        issues.push(`${path}: binary operator "${operator.operation}" should not have singleValue: true (only unary operators need this)`);
      }
    }
  }

  return issues;
}
