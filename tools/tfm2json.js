#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import desiredFonts from './fontlist.json' with { type: 'json' };

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
        const filename = execSync(`kpsewhich ${fontname}.tfm`).toString().split('\n')[0];
        processTfmFile(fontname, filename);
    }
}

const outputFile = fs.openSync(path.join(import.meta.dirname, '../src/tfm/fonts.json'), 'w');
fs.writeFileSync(outputFile, JSON.stringify(fonts));
