"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tearDownStdin = tearDownStdin;
function tearDownStdin(stdin = process.stdin, platform = process.platform) {
    if (!stdin || stdin.destroyed)
        return;
    stdin.pause();
    if (platform !== 'win32') {
        stdin.destroy();
    }
}
//# sourceMappingURL=stdin-teardown.js.map