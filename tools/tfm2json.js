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

var desiredFonts = [
  "cmbsy5", "dummy", "wncyb10", "wncyb5", "wncyb6", "wncyb7", "wncyb8", "wncyb9",
  "wncyi10", "wncyi5", "wncyi6", "wncyi7", "wncyi8", "wncyi9", "wncyr10", "wncyr5",
  "wncyr6", "wncyr7", "wncyr8", "wncyr9", "wncysc10", "wncyss10", "wncyss8", "wncyss9",
  "cmmib5", "cmb10", "cmbsy10", "cmbsy6", "cmbsy7", "cmbsy8", "cmbsy9", "cmbx10", 
  "cmbx12", "cmbx5", "cmbx6", "cmbx7", "cmbx8", "cmbx9", "cmbxsl10", 
  "cmbxti10", "cmcsc10", "cmcsc8", "cmcsc9", "cmdunh10", "cmex10", 
  "cmex7", "cmex8", "cmex9", "cmff10", "cmfi10", "cmfib8", "cminch", 
  "cmitt10", "cmmi10", "cmmi12", "cmmi5", "cmmi6", "cmmi7", "cmmi8", 
  "cmmi9", "cmmib10", "cmmib6", "cmmib7", "cmmib8", "cmmib9", "cmr10", 
  "cmr12", "cmr17", "cmr5", "cmr6", "cmr7", "cmr8", "cmr9", "cmsl10", 
  "cmsl12", "cmsl8", "cmsl9", "cmsltt10", "cmss10", "cmss12", "cmss17", 
  "cmss8", "cmss9", "cmssbx10", "cmssdc10", "cmssi10", "cmssi12", 
  "cmssi17", "cmssi8", "cmssi9", "cmssq8", "cmssqi8", "cmsy10", "cmsy5", 
  "cmsy6", "cmsy7", "cmsy8", "cmsy9", "cmtcsc10", "cmtex10", "cmtex8", 
  "cmtex9", "cmti10", "cmti12", "cmti7", "cmti8", "cmti9", "cmtt10", 
  "cmtt12", "cmtt8", "cmtt9", "cmu10", "cmvtt10", "euex10", "euex7", 
  "euex8", "euex9", "eufb10", "eufb5", "eufb6", "eufb7", "eufb8", 
  "eufb9", "eufm10", "eufm5", "eufm6", "eufm7", "eufm8", "eufm9", 
  "eurb10", "eurb5", "eurb6", "eurb7", "eurb8", "eurb9", "eurm10", 
  "eurm5", "eurm6", "eurm7", "eurm8", "eurm9", "eusb10", "eusb5", 
  "eusb6", "eusb7", "eusb8", "eusb9", "eusm10", "eusm5", "eusm6", 
  "eusm7", "eusm8", "eusm9", "msam10", "msam5", "msam6", "msam7", 
  "msam8", "msam9", "msbm10", "msbm5", "msbm6", "msbm7", "msbm8", "msbm9",
  "rsfs10", "rsfs7", "rsfs5"
];

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




