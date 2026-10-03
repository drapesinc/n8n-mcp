"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRegistryReadme = normalizeRegistryReadme;
exports.extractReadmeFromTarball = extractReadmeFromTarball;
const zlib_1 = require("zlib");
const npm_readme_1 = require("../constants/npm-readme");
const DEFAULT_MAX_UNPACKED_BYTES = 64 * 1024 * 1024;
const MAX_README_LENGTH = 64 * 1024;
const TAR_BLOCK_SIZE = 512;
const README_FILE_NAME = /^readme(\.[a-z0-9]+)?$/i;
const MARKDOWN_README_FILE_NAME = /^readme\.(md|markdown)$/i;
function normalizeRegistryReadme(readme) {
    if (typeof readme !== 'string')
        return null;
    const trimmed = readme.trim();
    if (!trimmed || trimmed === npm_readme_1.NPM_MISSING_README_PLACEHOLDER)
        return null;
    return readme;
}
function extractReadmeFromTarball(gzipped, options = {}) {
    let archive;
    try {
        archive = (0, zlib_1.gunzipSync)(gzipped, { maxOutputLength: options.maxUnpackedBytes ?? DEFAULT_MAX_UNPACKED_BYTES });
    }
    catch {
        return null;
    }
    let fallback = null;
    let pendingPath = null;
    let offset = 0;
    while (offset + TAR_BLOCK_SIZE <= archive.length) {
        const header = archive.subarray(offset, offset + TAR_BLOCK_SIZE);
        if (header.every((byte) => byte === 0))
            break;
        const size = parseOctal(header.subarray(124, 136));
        const dataStart = offset + TAR_BLOCK_SIZE;
        const dataEnd = dataStart + size;
        if (size < 0 || dataEnd > archive.length)
            return fallback;
        const typeflag = String.fromCharCode(header[156]);
        const data = archive.subarray(dataStart, dataEnd);
        offset = dataStart + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
        if (typeflag === 'x') {
            pendingPath = parsePaxPath(data) ?? pendingPath;
            continue;
        }
        if (typeflag === 'L') {
            pendingPath = readString(data);
            continue;
        }
        if (typeflag === 'g')
            continue;
        const path = pendingPath ?? entryPath(header);
        pendingPath = null;
        if (typeflag !== '0' && typeflag !== '\0')
            continue;
        const fileName = rootFileName(path);
        if (!fileName || !README_FILE_NAME.test(fileName))
            continue;
        const text = data.toString('utf8').slice(0, MAX_README_LENGTH);
        if (!text.trim())
            continue;
        if (MARKDOWN_README_FILE_NAME.test(fileName))
            return text;
        fallback ?? (fallback = text);
    }
    return fallback;
}
function rootFileName(path) {
    const parts = path.replace(/^\.\//, '').split('/');
    return parts.length === 2 && parts[0] && parts[0] !== '.' && parts[0] !== '..' ? parts[1] : null;
}
function entryPath(header) {
    const name = readString(header.subarray(0, 100));
    const isUstar = header.toString('ascii', 257, 263) === 'ustar\0';
    const prefix = isUstar ? readString(header.subarray(345, 500)) : '';
    return prefix ? `${prefix}/${name}` : name;
}
function readString(bytes) {
    const end = bytes.indexOf(0);
    return bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
}
function parseOctal(field) {
    if (field[0] & 0x80)
        return -1;
    const text = readString(field).trim();
    if (!text)
        return 0;
    return /^[0-7]+$/.test(text) ? parseInt(text, 8) : -1;
}
function parsePaxPath(data) {
    for (const record of data.toString('utf8').split('\n')) {
        const match = /^\d+ path=(.*)$/.exec(record);
        if (match)
            return match[1];
    }
    return null;
}
//# sourceMappingURL=npm-readme.js.map