/**
 * Node Sanitizer Tests
 * Tests for auto-adding required metadata to filter-based nodes
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeNode,
  validateNodeMetadata,
  normalizeFixedCollections,
} from '../../../src/services/node-sanitizer';
import { WorkflowNode } from '../../../src/types/n8n-api';

describe('Node Sanitizer', () => {
  describe('sanitizeNode', () => {
    it('should add complete filter options to IF v2.2 node', () => {
      const node: WorkflowNode = {
        id: 'test-if',
        name: 'IF Node',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            conditions: [
              {
                id: 'condition1',
                leftValue: '={{ $json.value }}',
                rightValue: '',
                operator: {
                  type: 'string',
                  operation: 'isNotEmpty'
                }
              }
            ]
          }
        }
      };

      const sanitized = sanitizeNode(node);

      // Check that options were added
      expect(sanitized.parameters.conditions).toHaveProperty('options');
      const options = (sanitized.parameters.conditions as any).options;

      expect(options).toEqual({
        version: 2,
        leftValue: '',
        caseSensitive: true,
        typeValidation: 'strict'
      });
    });

    it('should preserve existing options while adding missing fields', () => {
      const node: WorkflowNode = {
        id: 'test-if-partial',
        name: 'IF Node Partial',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            options: {
              caseSensitive: false // User-provided value
            },
            conditions: []
          }
        }
      };

      const sanitized = sanitizeNode(node);
      const options = (sanitized.parameters.conditions as any).options;

      // Should preserve user value
      expect(options.caseSensitive).toBe(false);

      // Should add missing fields
      expect(options.version).toBe(2);
      expect(options.leftValue).toBe('');
      expect(options.typeValidation).toBe('strict');
    });

    it('should fix invalid operator structure (type field misuse)', () => {
      const node: WorkflowNode = {
        id: 'test-if-bad-operator',
        name: 'IF Bad Operator',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            conditions: [
              {
                id: 'condition1',
                leftValue: '={{ $json.value }}',
                rightValue: '',
                operator: {
                  type: 'isNotEmpty' // WRONG: type should be data type, not operation
                }
              }
            ]
          }
        }
      };

      const sanitized = sanitizeNode(node);
      const condition = (sanitized.parameters.conditions as any).conditions[0];

      // Should fix operator structure and auto-correct isNotEmpty to notEmpty
      expect(condition.operator.type).toBe('string'); // Inferred data type (default)
      expect(condition.operator.operation).toBe('notEmpty'); // Moved to operation field and auto-corrected
    });

    it('should add singleValue for unary operators', () => {
      const node: WorkflowNode = {
        id: 'test-if-unary',
        name: 'IF Unary',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            conditions: [
              {
                id: 'condition1',
                leftValue: '={{ $json.value }}',
                rightValue: '',
                operator: {
                  type: 'string',
                  operation: 'isNotEmpty'
                  // Missing singleValue
                }
              }
            ]
          }
        }
      };

      const sanitized = sanitizeNode(node);
      const condition = (sanitized.parameters.conditions as any).conditions[0];

      expect(condition.operator.singleValue).toBe(true);
    });

    it('should sanitize Switch v3.2 node rules', () => {
      const node: WorkflowNode = {
        id: 'test-switch',
        name: 'Switch Node',
        type: 'n8n-nodes-base.switch',
        typeVersion: 3.2,
        position: [0, 0],
        parameters: {
          mode: 'rules',
          rules: {
            rules: [
              {
                outputKey: 'audio',
                conditions: {
                  conditions: [
                    {
                      id: 'cond1',
                      leftValue: '={{ $json.fileType }}',
                      rightValue: 'audio',
                      operator: {
                        type: 'string',
                        operation: 'equals'
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      };

      const sanitized = sanitizeNode(node);
      const rule = (sanitized.parameters.rules as any).rules[0];

      // Check that options were added to rule conditions
      expect(rule.conditions).toHaveProperty('options');
      expect(rule.conditions.options).toEqual({
        version: 2,
        leftValue: '',
        caseSensitive: true,
        typeValidation: 'strict'
      });
    });

    it('should not modify non-filter nodes', () => {
      const node: WorkflowNode = {
        id: 'test-http',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [0, 0],
        parameters: {
          method: 'GET',
          url: 'https://example.com'
        }
      };

      const sanitized = sanitizeNode(node);

      // Should return unchanged
      expect(sanitized).toEqual(node);
    });

    it('should not modify old IF versions', () => {
      const node: WorkflowNode = {
        id: 'test-if-old',
        name: 'Old IF',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.0, // Pre-filter version
        position: [0, 0],
        parameters: {
          conditions: []
        }
      };

      const sanitized = sanitizeNode(node);

      // Should return unchanged
      expect(sanitized).toEqual(node);
    });

    it('should remove singleValue from binary operators like "equals"', () => {
      const node: WorkflowNode = {
        id: 'test-if-binary',
        name: 'IF Binary Operator',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            conditions: [
              {
                id: 'condition1',
                leftValue: '={{ $json.value }}',
                rightValue: 'test',
                operator: {
                  type: 'string',
                  operation: 'equals',
                  singleValue: true // WRONG: equals is binary, not unary
                }
              }
            ]
          }
        }
      };

      const sanitized = sanitizeNode(node);
      const condition = (sanitized.parameters.conditions as any).conditions[0];

      // Should remove singleValue from binary operator
      expect(condition.operator.singleValue).toBeUndefined();
      expect(condition.operator.type).toBe('string');
      expect(condition.operator.operation).toBe('equals');
    });

    it('should auto-correct isNotEmpty to notEmpty', () => {
      const node: WorkflowNode = {
        id: 'test-if-autocorrect',
        name: 'IF AutoCorrect',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            conditions: [
              {
                id: 'condition1',
                leftValue: '={{ $json.value }}',
                rightValue: '',
                operator: {
                  type: 'string',
                  operation: 'isNotEmpty' // Legacy operator name
                }
              }
            ]
          }
        }
      };

      const sanitized = sanitizeNode(node);
      const condition = (sanitized.parameters.conditions as any).conditions[0];

      // Should auto-correct isNotEmpty to notEmpty
      expect(condition.operator.operation).toBe('notEmpty');
      expect(condition.operator.type).toBe('string');
      expect(condition.operator.singleValue).toBe(true); // notEmpty is unary
    });
  });

  describe('validateNodeMetadata', () => {
    it('should detect missing conditions.options', () => {
      const node: WorkflowNode = {
        id: 'test',
        name: 'IF Missing Options',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            conditions: []
            // Missing options
          }
        }
      };

      const issues = validateNodeMetadata(node);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toBe('Missing conditions.options');
    });

    it('should detect missing operator.type', () => {
      const node: WorkflowNode = {
        id: 'test',
        name: 'IF Bad Operator',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            options: {
              version: 2,
              leftValue: '',
              caseSensitive: true,
              typeValidation: 'strict'
            },
            conditions: [
              {
                id: 'cond1',
                leftValue: '={{ $json.value }}',
                rightValue: '',
                operator: {
                  operation: 'equals'
                  // Missing type
                }
              }
            ]
          }
        }
      };

      const issues = validateNodeMetadata(node);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(issue => issue.includes("missing required field 'type'"))).toBe(true);
    });

    it('should detect invalid operator.type value', () => {
      const node: WorkflowNode = {
        id: 'test',
        name: 'IF Invalid Type',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            options: {
              version: 2,
              leftValue: '',
              caseSensitive: true,
              typeValidation: 'strict'
            },
            conditions: [
              {
                id: 'cond1',
                leftValue: '={{ $json.value }}',
                rightValue: '',
                operator: {
                  type: 'isNotEmpty', // WRONG: operation name, not data type
                  operation: 'isNotEmpty'
                }
              }
            ]
          }
        }
      };

      const issues = validateNodeMetadata(node);

      expect(issues.some(issue => issue.includes('invalid type "isNotEmpty"'))).toBe(true);
    });

    it('should detect missing singleValue for unary operators', () => {
      const node: WorkflowNode = {
        id: 'test',
        name: 'IF Missing SingleValue',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            options: {
              version: 2,
              leftValue: '',
              caseSensitive: true,
              typeValidation: 'strict'
            },
            conditions: [
              {
                id: 'cond1',
                leftValue: '={{ $json.value }}',
                rightValue: '',
                operator: {
                  type: 'string',
                  operation: 'notEmpty'
                  // Missing singleValue: true
                }
              }
            ]
          }
        }
      };

      const issues = validateNodeMetadata(node);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(issue => issue.includes('requires singleValue: true'))).toBe(true);
    });

    it('should detect singleValue on binary operators', () => {
      const node: WorkflowNode = {
        id: 'test',
        name: 'IF Binary with SingleValue',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            options: {
              version: 2,
              leftValue: '',
              caseSensitive: true,
              typeValidation: 'strict'
            },
            conditions: [
              {
                id: 'cond1',
                leftValue: '={{ $json.value }}',
                rightValue: 'test',
                operator: {
                  type: 'string',
                  operation: 'equals',
                  singleValue: true  // WRONG: equals is binary
                }
              }
            ]
          }
        }
      };

      const issues = validateNodeMetadata(node);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(issue => issue.includes('should not have singleValue: true'))).toBe(true);
    });

    it('should return empty array for valid node', () => {
      const node: WorkflowNode = {
        id: 'test',
        name: 'Valid IF',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [0, 0],
        parameters: {
          conditions: {
            options: {
              version: 2,
              leftValue: '',
              caseSensitive: true,
              typeValidation: 'strict'
            },
            conditions: [
              {
                id: 'cond1',
                leftValue: '={{ $json.value }}',
                rightValue: '',
                operator: {
                  type: 'string',
                  operation: 'notEmpty',
                  singleValue: true
                }
              }
            ]
          }
        }
      };

      const issues = validateNodeMetadata(node);

      expect(issues).toEqual([]);
    });
  });

  describe('normalizeFixedCollections - Notion propertiesUi', () => {
    const buildNotionNode = (parameters: Record<string, unknown>): WorkflowNode => ({
      id: 'notion-1',
      name: 'Notion',
      type: 'n8n-nodes-base.notion',
      typeVersion: 2.2,
      position: [0, 0],
      parameters: parameters as any,
    });

    it('preserves a correctly-shaped propertiesUi round-trip', () => {
      const entries = [
        { key: 'Status|status', statusValue: 'Active' },
        { key: 'Name|title', title: 'Test' },
      ];
      const node = buildNotionNode({
        resource: 'databasePage',
        operation: 'create',
        propertiesUi: { propertyValues: entries },
      });

      // First pass
      const once = sanitizeNode(node);
      expect(once.parameters.propertiesUi).toEqual({ propertyValues: entries });

      // Round-trip: serialize and re-sanitize (mimics load -> save -> load)
      const clone = JSON.parse(JSON.stringify(once));
      const twice = sanitizeNode(clone);
      expect(twice.parameters.propertiesUi).toEqual({ propertyValues: entries });
    });

    it('rewraps a bare array at propertiesUi back into {propertyValues: [...]}', () => {
      const entries = [
        { key: 'Email|email', emailValue: 'x@y.com' },
        { key: 'Status|status', statusValue: 'Active' },
      ];
      const node = buildNotionNode({
        resource: 'databasePage',
        operation: 'create',
        propertiesUi: entries as any,
      });

      const sanitized = sanitizeNode(node);
      expect(sanitized.parameters.propertiesUi).toEqual({ propertyValues: entries });
    });

    it('wraps a single-object propertyValues entry into an array', () => {
      const entry = { key: 'Clock ID|rich_text', textContent: '123' };
      const node = buildNotionNode({
        resource: 'databasePage',
        operation: 'create',
        propertiesUi: { propertyValues: entry },
      });

      const sanitized = sanitizeNode(node);
      expect(sanitized.parameters.propertiesUi).toEqual({ propertyValues: [entry] });
    });

    it('unwraps a double-wrapped propertyValues container', () => {
      const entries = [{ key: 'Push ID|rich_text', textContent: '999' }];
      const node = buildNotionNode({
        resource: 'databasePage',
        operation: 'create',
        propertiesUi: { propertyValues: { propertyValues: entries } },
      });

      const sanitized = sanitizeNode(node);
      expect(sanitized.parameters.propertiesUi).toEqual({ propertyValues: entries });
    });

    it('renames a single mis-named key holding an array to propertyValues', () => {
      const entries = [{ key: 'Joined|date', date: '2026-01-01' }];
      const node = buildNotionNode({
        resource: 'databasePage',
        operation: 'create',
        // Common AI-agent mistake: using "values" instead of "propertyValues"
        propertiesUi: { values: entries } as any,
      });

      const sanitized = sanitizeNode(node);
      expect(sanitized.parameters.propertiesUi).toEqual({ propertyValues: entries });
    });

    it('leaves unknown node types untouched', () => {
      const params = { propertiesUi: [{ key: 'foo', value: 'bar' }] };
      const result = normalizeFixedCollections(
        'n8n-nodes-base.httpRequest',
        params as any
      );
      expect(result).toBe(params);
    });

    it('leaves unknown container params untouched on known nodes', () => {
      const params = {
        resource: 'databasePage',
        operation: 'create',
        someOtherParam: [{ a: 1 }],
      };
      const result = normalizeFixedCollections('n8n-nodes-base.notion', params as any);
      expect(result).toBe(params);
    });

    it('returns the same reference when no repair is needed (cheap path)', () => {
      const params = {
        propertiesUi: { propertyValues: [{ key: 'k', textContent: 'v' }] },
      };
      const result = normalizeFixedCollections('n8n-nodes-base.notion', params as any);
      expect(result).toBe(params);
    });

    it('repairs blockUi alongside propertiesUi in the same pass', () => {
      const propEntries = [{ key: 'Name|title', title: 'x' }];
      const blockEntries = [{ type: 'paragraph', richText: [{ text: 'hello' }] }];
      const node = buildNotionNode({
        resource: 'databasePage',
        operation: 'create',
        // Both containers corrupted in different ways.
        propertiesUi: propEntries as any,
        blockUi: { blockValues: blockEntries[0] as any }, // single object, not array
      });

      const sanitized = sanitizeNode(node);
      expect(sanitized.parameters.propertiesUi).toEqual({ propertyValues: propEntries });
      expect(sanitized.parameters.blockUi).toEqual({ blockValues: blockEntries });
    });
  });
});
