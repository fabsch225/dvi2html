#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import https from 'follow-redirects/https.js';
import decompress from 'decompress';
import { Font } from 'fonteditor-core';

const tmpDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'tmp-'));

const kpsewhich = (s) =>
    new Promise((resolve, reject) => {
        execFile('kpsewhich', [s], (error, stdout, _stderr) => {
            if (error) reject(error);
            else resolve(stdout.trim());
        });
    });

const isWordChar = (ch) => typeof ch === 'string' && /^[._A-Za-z0-9-]$/.test(ch);

function* tokenize(chars) {
    const iterator = chars[Symbol.iterator]();
    let ch = getNextItem(iterator);
    do {
        if (ch === '%') {
            do {
                ch = getNextItem(iterator);
            } while (ch !== '\n');
        }
        if (typeof ch === 'string' && /^[[\]{}]$/.test(ch)) {
            yield ch;
        } else if (ch == '/' || isWordChar(ch)) {
            let word = '';
            do {
                word += ch;
                ch = getNextItem(iterator);
            } while (isWordChar(ch));
            yield word;
            continue;
        }
        ch = getNextItem(iterator);
        // Ignore all other characters
    } while (ch !== END_OF_SEQUENCE);
}

const END_OF_SEQUENCE = Symbol();

const getNextItem = (iterator) => {
    const item = iterator.next();
    return item.done ? END_OF_SEQUENCE : item.value;
};

const execute = (token, stack, state, list, lists) => {
    if (token == 'repeat') {
        const code = stack.pop();
        const count = stack.pop();
        for (let i = 0; i < count; i++) {
            for (const c of code) {
                execute(c, stack, state, list, lists);
            }
        }
        return;
    }

    if (token[0] == '}') {
        state.brace = false;
        return;
    }

    if (state.brace) {
        stack[stack.length - 1].push(token);
        return;
    }

    if (token[0] == '{') {
        state.brace = true;
        stack.push([]);
        return;
    }

    if (token[0] == '[') {
        state.bracket = true;
        return;
    }

    if (token[0] == ']') {
        state.bracket = false;
        while (stack.length) {
            lists[stack.pop()] = [...list];
        }
        list.length = 0;
        return;
    }

    if (!state.bracket) {
        stack.push(token.replace(/^\//, ''));
        return;
    }

    if (token[0] == '/') {
        list.push(token.slice(1));
        return;
    }

    if (/^[0-9]+$/.test(token)) {
        stack.push(parseInt(token));
        return;
    }
};

const loadGlyphNameLists = async (s) => {
    //const filename = await kpsewhich(s);
    //i checked in a modified version of dvips-all.enc where i hacked in the eulerfonts
    const filename = path.join(import.meta.dirname, s);
    const encoding = (await fs.promises.readFile(filename)).toString();
    const lists = {};
    const stack = [];
    const state = {};
    const list = [];
    for (const token of tokenize(encoding)) {
        execute(token, stack, state, list, lists);
    }
    return lists;
};

const glyphNameLists = await loadGlyphNameLists('dvips-all.enc');

const processOtfFile = async (filePath, tables) => {
    const basename = path.basename(filePath, '.otf');
    if (!glyphNameLists[basename]) return;

    console.log(`Processing ${basename}...`);
    const buffer = await fs.promises.readFile(filePath);
    const font = Font.create(buffer, { type: 'otf', hinting: true, kerning: true });

    tables[basename] = {};
    for (const glyph of font.get().glyf) {
        if (!(glyph.unicode instanceof Array)) continue;
        const unicode = Math.max(...glyph.unicode);
        const codePoint = glyphNameLists[basename].findIndex((c) => c === glyph.name);
        if (codePoint !== -1) tables[basename][codePoint] = unicode;
    }
};

const zipFile = path.join(tmpDir, 'bakoma.zip');
const file = fs.createWriteStream(zipFile);
https.get('https://us.mirrors.cicku.me/ctan/fonts/cm/ps-type1/bakoma.zip', (response) => {
    response.pipe(file);
    file.on('finish', async () => {
        const files = await decompress(zipFile, tmpDir, {
            filter: (file) => path.extname(file.path) === '.otf'
        });

        const tables = {};

        // Process BaKoMa fonts from zip
        for (const file of files) {
            await processOtfFile(path.join(tmpDir, file.path), tables);
        }

        // Process additionalFonts directory
        const additionalFontsDir = path.join(import.meta.dirname, 'additionalFonts');
        if (fs.existsSync(additionalFontsDir)) {
            const localOtfFiles = fs.readdirSync(additionalFontsDir, {recursive: true}).filter(f => f.endsWith('.otf'));
            for (const file of localOtfFiles) {
                console.log(path.join(additionalFontsDir, file))
                await processOtfFile(path.join(additionalFontsDir, file), tables);
            }
        }

        console.log(`Processed ${Object.keys(tables).length} fonts.`);

        const encodingsFile = await fs.promises.open(path.join(import.meta.dirname, '../src/tfm/encodings.json'), 'w');
        await fs.promises.writeFile(encodingsFile, JSON.stringify(tables));

        const fontListFile = await fs.promises.open(path.join(import.meta.dirname, './fontlist.json'), 'w');
        await fs.promises.writeFile(fontListFile, JSON.stringify(Object.keys(tables)));

        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });
});
