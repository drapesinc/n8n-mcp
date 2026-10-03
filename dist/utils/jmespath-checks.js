"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blankStringLiterals = blankStringLiterals;
exports.findJmespathCalls = findJmespathCalls;
exports.checkJmespathQuery = checkJmespathQuery;
const MAX_QUERY_LENGTH = 2000;
const MAX_CALLS = 100;
const MAX_TEMPLATE_DEPTH = 64;
const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', '+', '-', '*', '/', '%', '<', '>', '~', '^']);
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
function blankStringLiterals(source, options = {}) {
    const out = source.split('');
    const templates = [];
    let quote = null;
    let lastCode = '';
    let lastWord = '';
    let wordOpen = false;
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        if (quote !== null) {
            if (ch === '\\' && i + 1 < source.length) {
                out[i] = out[i + 1] = ' ';
                i += 2;
                continue;
            }
            if (ch === quote) {
                quote = null;
                lastCode = ch;
                lastWord = '';
            }
            else if (ch === '\n') {
                quote = null;
                i++;
                continue;
            }
            else {
                out[i] = ' ';
            }
            i++;
            continue;
        }
        const template = templates.length > 0 ? templates[templates.length - 1] : undefined;
        const inTemplateText = template === -1;
        if (inTemplateText) {
            if (ch === '\\' && i + 1 < source.length) {
                out[i] = out[i + 1] = ' ';
                i += 2;
                continue;
            }
            if (ch === '`') {
                templates.pop();
                lastCode = ch;
                lastWord = '';
            }
            else if (ch === '$' && source[i + 1] === '{' && templates.length < MAX_TEMPLATE_DEPTH) {
                templates[templates.length - 1] = 0;
                lastCode = '{';
                lastWord = '';
                i += 2;
                continue;
            }
            else {
                out[i] = ' ';
            }
            i++;
            continue;
        }
        if (options.comments && ch === '/' && source[i + 1] === '/') {
            while (i < source.length && source[i] !== '\n')
                out[i++] = ' ';
            continue;
        }
        if (options.comments && ch === '/' && source[i + 1] === '*') {
            const close = source.indexOf('*/', i + 2);
            const end = close === -1 ? source.length : close + 2;
            while (i < end)
                out[i++] = ' ';
            continue;
        }
        if (ch === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
            out[i] = ch;
            lastCode = ch;
            lastWord = '';
            i += 2;
            continue;
        }
        if (ch === '/' && (lastCode === '' || REGEX_PRECEDERS.has(lastCode) || REGEX_KEYWORDS.has(lastWord))) {
            i = blankRegexLiteral(source, out, i);
            lastCode = '/';
            lastWord = '';
            continue;
        }
        if (ch === "'" || ch === '"') {
            quote = ch;
        }
        else if (ch === '`') {
            templates.push(-1);
        }
        else if (template !== undefined) {
            if (ch === '{')
                templates[templates.length - 1] = template + 1;
            else if (ch === '}') {
                if (template === 0)
                    templates[templates.length - 1] = -1;
                else
                    templates[templates.length - 1] = template - 1;
            }
        }
        if (/\w/.test(ch)) {
            lastWord = wordOpen ? lastWord + ch : ch;
            wordOpen = true;
        }
        else if (/\s/.test(ch)) {
            wordOpen = false;
        }
        else {
            lastWord = '';
            wordOpen = false;
        }
        if (!/\s/.test(ch))
            lastCode = ch;
        i++;
    }
    return out.join('');
}
function blankRegexLiteral(source, out, start) {
    let i = start + 1;
    let inClass = false;
    while (i < source.length) {
        const ch = source[i];
        if (ch === '\n')
            return i;
        if (ch === '\\' && i + 1 < source.length) {
            out[i] = out[i + 1] = ' ';
            i += 2;
            continue;
        }
        if (ch === '[')
            inClass = true;
        else if (ch === ']')
            inClass = false;
        else if (ch === '/' && !inClass)
            return i + 1;
        out[i] = ' ';
        i++;
    }
    return i;
}
function findJmespathCalls(source) {
    const calls = [];
    const blanked = blankStringLiterals(source, { comments: true });
    const marker = '$jmespath';
    let from = 0;
    while (calls.length < MAX_CALLS) {
        const index = blanked.indexOf(marker, from);
        if (index === -1)
            break;
        if (index > 0 && /[\w$.]/.test(blanked[index - 1])) {
            from = index + marker.length;
            continue;
        }
        let paren = index + marker.length;
        while (paren < blanked.length && /\s/.test(blanked[paren]))
            paren++;
        if (blanked[paren] !== '(') {
            from = index + marker.length;
            continue;
        }
        const argsStart = paren + 1;
        const args = splitTopLevelArguments(blanked, argsStart);
        if (!args)
            break;
        from = argsStart;
        const first = literalArgument(source, blanked, args.spans[0]);
        const second = literalArgument(source, blanked, args.spans[1]);
        if (first !== undefined || startsWithQuote(blanked, args.spans[0])) {
            calls.push({ index, query: first, queryIsFirstArgument: true });
        }
        else {
            calls.push({ index, query: second, queryIsFirstArgument: false });
        }
    }
    return calls;
}
function startsWithQuote(blanked, span) {
    if (!span)
        return false;
    const first = blanked.slice(span[0], span[1]).trimStart()[0];
    return first === "'" || first === '"' || first === '`';
}
function literalArgument(source, blanked, span) {
    if (!span)
        return undefined;
    const blankedArg = blanked.slice(span[0], span[1]);
    const start = span[0] + (blankedArg.length - blankedArg.trimStart().length);
    const quote = source[start];
    if (!(quote === "'" || quote === '"' || quote === '`') || start >= span[1] - 1)
        return undefined;
    let body = '';
    let i = start + 1;
    while (i < span[1]) {
        const ch = source[i];
        if (ch === '\\') {
            const decoded = decodeEscape(source, i);
            if (!decoded)
                return undefined;
            body += decoded.text;
            i = decoded.next;
            continue;
        }
        if (ch === quote)
            break;
        if (quote === '`' && ch === '$' && source[i + 1] === '{')
            return undefined;
        body += ch;
        i++;
    }
    if (i >= span[1] || source[i] !== quote)
        return undefined;
    if (blanked.slice(i + 1, span[1]).trim() !== '')
        return undefined;
    return body;
}
const SIMPLE_ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' };
function decodeEscape(raw, at) {
    const ch = raw[at + 1];
    if (ch === undefined)
        return undefined;
    if (ch === 'u' && raw[at + 2] === '{') {
        const close = raw.indexOf('}', at + 3);
        if (close === -1)
            return undefined;
        const hex = raw.slice(at + 3, close);
        if (!/^[0-9a-fA-F]{1,6}$/.test(hex))
            return undefined;
        const code = parseInt(hex, 16);
        if (code > 0x10ffff)
            return undefined;
        return { text: String.fromCodePoint(code), next: close + 1 };
    }
    if (ch === 'u' || ch === 'x') {
        const width = ch === 'u' ? 4 : 2;
        const hex = raw.slice(at + 2, at + 2 + width);
        if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== width)
            return undefined;
        return { text: String.fromCharCode(parseInt(hex, 16)), next: at + 2 + width };
    }
    if (ch === '\n')
        return { text: '', next: at + 2 };
    return { text: SIMPLE_ESCAPES[ch] ?? ch, next: at + 2 };
}
function splitTopLevelArguments(blanked, start) {
    const spans = [];
    let depth = 0;
    let argStart = start;
    for (let i = start; i < blanked.length; i++) {
        const ch = blanked[i];
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
        }
        else if (ch === ')' || ch === ']' || ch === '}') {
            if (depth === 0) {
                spans.push([argStart, i]);
                return { spans, end: i + 1 };
            }
            depth--;
        }
        else if (ch === ',' && depth === 0) {
            spans.push([argStart, i]);
            argStart = i + 1;
        }
    }
    return null;
}
function checkJmespathQuery(query) {
    const findings = [];
    if (query.length > MAX_QUERY_LENGTH)
        return findings;
    const seen = new Set();
    const add = (finding) => {
        const key = `${finding.message}\n${finding.fix}`;
        if (!seen.has(key)) {
            seen.add(key);
            findings.push(finding);
        }
    };
    const code = blankJmespathLiterals(query);
    let match;
    const bareNumber = /(==|!=|<=|>=|<|>)\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w.`'"])/g;
    while ((match = bareNumber.exec(code)) !== null) {
        add({
            severity: 'error',
            message: `JMESPath literal ${match[2]} must be wrapped in backticks`,
            fix: `Write ${match[1]} \`${match[2]}\``
        });
    }
    const bareKeyword = /(==|!=|<=|>=|<|>)\s*(true|false|null)(?![\w.`'"])/g;
    while ((match = bareKeyword.exec(code)) !== null) {
        add({
            severity: 'warning',
            message: `JMESPath reads ${match[2]} as a field name, not the literal; wrap it in backticks`,
            fix: `Write ${match[1]} \`${match[2]}\``
        });
    }
    const wordOperator = /(?<=[\w`'")\]@]\s+)(and|or)(?=\s+[\w`'"(!@])/g;
    while ((match = wordOperator.exec(code)) !== null) {
        add({
            severity: 'error',
            message: `JMESPath has no "${match[1]}" operator`,
            fix: `Use ${match[1] === 'and' ? '&&' : '||'}`
        });
    }
    if (/(^|[^=!<>])=(?!=)/.test(code)) {
        add({
            severity: 'error',
            message: 'JMESPath comparisons use ==, not a single =',
            fix: 'Use == for equality'
        });
    }
    const quotedRhs = /(==|!=|<=|>=|<|>)\s*"( *)"/g;
    while ((match = quotedRhs.exec(code)) !== null) {
        const bodyStart = match.index + match[0].length - 1 - match[2].length;
        const text = query.slice(bodyStart, bodyStart + match[2].length);
        const literal = /['\\]/.test(text) ? `\`${JSON.stringify(text).replace(/`/g, '\\`')}\`` : `'${text}'`;
        add({
            severity: 'warning',
            message: `JMESPath treats "${text}" as an identifier, so this compares against the field named ${text} rather than the string; that usually matches nothing`,
            fix: `Use a string literal: ${match[1]} ${literal}`
        });
    }
    return findings;
}
function blankJmespathLiterals(query) {
    const out = query.split('');
    let quote = null;
    for (let i = 0; i < query.length; i++) {
        const ch = query[i];
        if (quote === null) {
            if (ch === "'" || ch === '"' || ch === '`')
                quote = ch;
            continue;
        }
        if (ch === '\\' && i + 1 < query.length) {
            out[i] = out[i + 1] = ' ';
            i++;
            continue;
        }
        if (ch === quote) {
            quote = null;
            continue;
        }
        out[i] = ' ';
    }
    return out.join('');
}
//# sourceMappingURL=jmespath-checks.js.map