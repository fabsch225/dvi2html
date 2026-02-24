import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.join(__dirname,'../src/tfm/fonts.json');

const fonts = {};

function processTfmFile( fontname, filename ) {
  console.log( fontname, filename );

  var buffer = fs.readFileSync( filename );
  fonts[fontname] = buffer.toString('base64');
}

var desiredFonts = JSON.parse(fs.readFileSync(path.join(__dirname, 'desired-fonts.json')));

const additionalTfmDir = path.join(__dirname, 'additionalFonts');

for (const fontname of desiredFonts) {
    const localFilename = path.join(additionalTfmDir, `${fontname}.tfm`);
    if (fs.existsSync(localFilename)) {
        processTfmFile(fontname, localFilename);
    } else {
        let filename;
        if (os.type() === "Windows_NT") {
            filename = execSync('kpsewhich ' + fontname + '.tfm').toString().split("\r\n")[0];
        } else {
            filename = execSync('kpsewhich ' + fontname + '.tfm').toString().split("\n")[0];
        }
        processTfmFile(fontname, filename);
    }
}

const outputFile = fs.openSync(outputPath, 'w');
fs.writeFileSync(outputFile, JSON.stringify(fonts));




