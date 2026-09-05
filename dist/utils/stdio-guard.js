"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installStdioGuard = installStdioGuard;
exports.resetStdioGuardForTests = resetStdioGuardForTests;
let installedGuard = null;
function installStdioGuard(options = {}) {
    if (installedGuard) {
        return installedGuard;
    }
    const originals = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug,
    };
    if (options.silenceConsole) {
        console.log = () => { };
        console.error = () => { };
        console.warn = () => { };
        console.info = () => { };
        console.debug = () => { };
        console.trace = () => { };
        console.dir = () => { };
        console.time = () => { };
        console.timeEnd = () => { };
        console.timeLog = () => { };
        console.group = () => { };
        console.groupEnd = () => { };
        console.table = () => { };
        console.clear = () => { };
        console.count = () => { };
        console.countReset = () => { };
    }
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const stderrWrite = process.stderr.write.bind(process.stderr);
    process.stdout.write = function (chunk, encodingOrCallback, callback) {
        const str = typeof chunk === 'string' ? chunk : chunk.toString();
        const trimmed = str.trimStart();
        if (trimmed.startsWith('{') && trimmed.includes('"jsonrpc"')) {
            return originalStdoutWrite(chunk, encodingOrCallback, callback);
        }
        return stderrWrite(chunk, encodingOrCallback, callback);
    };
    installedGuard = originals;
    return originals;
}
function resetStdioGuardForTests() {
    installedGuard = null;
}
//# sourceMappingURL=stdio-guard.js.map