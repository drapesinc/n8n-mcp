"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPRESSION_MIN_LENGTH = void 0;
exports.isCompressedColumn = isCompressedColumn;
exports.compressColumnText = compressColumnText;
exports.decompressColumnText = decompressColumnText;
exports.compressColumnJson = compressColumnJson;
exports.decompressColumnJson = decompressColumnJson;
const zlib = __importStar(require("zlib"));
const logger_1 = require("../utils/logger");
const GZIP_BASE64_PREFIX = 'H4sI';
exports.COMPRESSION_MIN_LENGTH = 1024;
function isCompressedColumn(value) {
    return typeof value === 'string' && value.startsWith(GZIP_BASE64_PREFIX);
}
const CANONICAL_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
function inflate(value) {
    if (!isCompressedColumn(value) || value.length % 4 !== 0 || !CANONICAL_BASE64.test(value)) {
        return null;
    }
    try {
        const bytes = Buffer.from(value, 'base64');
        const { buffer, engine } = zlib.gunzipSync(bytes, { info: true });
        return engine.bytesWritten === bytes.length ? buffer.toString('utf8') : null;
    }
    catch {
        return null;
    }
}
function compressColumnText(text) {
    if (text.length < exports.COMPRESSION_MIN_LENGTH || inflate(text) !== null)
        return text;
    return zlib.gzipSync(text).toString('base64');
}
function decompressColumnText(stored) {
    if (!isCompressedColumn(stored))
        return stored;
    const text = inflate(stored);
    if (text === null) {
        logger_1.logger.debug('Stored column carries the gzip prefix but is not a compressed column; returning it unchanged');
        return stored;
    }
    return text;
}
function compressColumnJson(value) {
    return compressColumnText(JSON.stringify(value) ?? 'null');
}
function decompressColumnJson(stored, fallback) {
    if (typeof stored !== 'string' || stored === '')
        return fallback;
    try {
        return JSON.parse(decompressColumnText(stored)) ?? fallback;
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=compressed-column.js.map