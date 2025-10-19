#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function fail(msg) {
    console.error('\n[pre-commit] ' + msg + '\n');
    process.exitCode = 1;
}

function main() {
    let staged;
    try {
        staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean);
    } catch (e) {
        // If git isn't available or returns non-zero, allow commit to continue
        console.error('[pre-commit] warning: failed to list staged files, skipping size checks');
        return;
    }

    if (staged.length === 0) return;

    const offenders = [];

    for (const file of staged) {
        // Prevent accidental commits of node_modules files
        if (file.split(path.sep).includes('node_modules') || file.startsWith('node_modules/')) {
            offenders.push({ file, reason: 'Committed path is inside node_modules' });
            continue;
        }

        let full = path.join(process.cwd(), file);
        try {
            const stat = fs.statSync(full);
            if (stat.isFile() && stat.size > MAX_BYTES) {
                offenders.push({ file, reason: `File size ${Math.round(stat.size / 1024 / 1024 * 100) / 100} MB exceeds ${MAX_BYTES / 1024 / 1024} MB` });
            }
        } catch (e) {
            // file may be removed or a submodule; ignore
        }
    }

    if (offenders.length) {
        console.error('\n[pre-commit] The following staged files are blocked:');
        for (const o of offenders) {
            console.error(` - ${o.file}: ${o.reason}`);
        }
        console.error('\n[pre-commit] To proceed, unstage or remove these files (e.g. `git restore --staged <file>`), add them to .gitignore, or reduce their size.');
        process.exit(1);
    }
}

main();
