#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import desiredFonts from './fontlist.json' with { type: 'json' };

// Parse command line arguments
// Usage: node tfm2json.js docker <container-name>
let dockerContainer = null;
const args = process.argv.slice(2);

if (args.length >= 2 && args[0] === 'docker') {
    dockerContainer = args[1];
    console.log(`Using Docker container: ${dockerContainer}`);
} else {
    console.log('Using local system');
}

const fonts = {};

const processTfmFile = (fontname, filename) => {
    console.log(fontname, filename);

    const buffer = fs.readFileSync(filename);
    fonts[fontname] = buffer.toString('base64');
};

const additionalTfmDir = path.join(import.meta.dirname, 'additionalFonts');

for (const fontname of desiredFonts) {
    const localFilename = path.join(additionalTfmDir, `${fontname}.tfm`);
    if (fs.existsSync(localFilename)) {
        processTfmFile(fontname, localFilename);
    } else {
        let filename;
        
        if (dockerContainer) {
            // Use docker exec to run kpsewhich in the container
            const result = execSync(`docker exec ${dockerContainer} kpsewhich ${fontname}.tfm`).toString().trim();
            
            if (!result) {
                console.log(`\x1b[31mUnable to locate ${fontname}.tfm in container.\x1b[0m`);
                continue;
            }
            
            // Copy file from container to temporary location
            const tmpDir = fs.mkdtempSync(path.join(tmpdir(), 'tfm-'));
            const tmpFile = path.join(tmpDir, `${fontname}.tfm`);
            
            try {
                execSync(`docker cp ${dockerContainer}:${result} ${tmpFile}`);
                processTfmFile(fontname, tmpFile);
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (err) {
                console.log(`\x1b[31mFailed to copy ${fontname}.tfm from container.\x1b[0m`);
                fs.rmSync(tmpDir, { recursive: true, force: true });
                continue;
            }
        } else {
            // Use local kpsewhich
            filename = execSync(`kpsewhich ${fontname}.tfm`).toString().split('\n')[0];
            processTfmFile(fontname, filename);
        }
    }
}

const outputFile = fs.openSync(path.join(import.meta.dirname, '../src/tfm/fonts.json'), 'w');
fs.writeFileSync(outputFile, JSON.stringify(fonts));
