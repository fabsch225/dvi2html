import type { Buffer } from 'buffer';
import { Machine, type Rule } from './machine';
import type { Writable } from 'stream';

import * as glyphs from './tfm/encodings.json';

export default class HTMLMachine extends Machine {
    output: Writable;
    pointsPerDviUnit = 0;

    svgDepth: number;
    color: string;
    colorStack: string[];

    paperwidth = 0;
    paperheight = 0;

    pushColor(c: string) {
        this.colorStack.push(this.color);
        this.color = c;
    }

    popColor() {
        const result = this.colorStack.pop();
        if (result) this.color = result;
        else throw new Error('Popped from empty color stack');
    }

    setPapersize(width: number, height: number) {
        this.paperwidth = width;
        this.paperheight = height;
    }

    getCurrentPosition(): [number, number] {
        return [this.position.h * this.pointsPerDviUnit, this.position.v * this.pointsPerDviUnit];
    }

    setCurrentPosition(x: number, y: number) {
        this.position.h = x / this.pointsPerDviUnit;
        this.position.v = y / this.pointsPerDviUnit;
    }

    putHTML(html: string) {
        this.output.write(html);
    }

    putSVG(svg: string) {
        const left = this.position.h * this.pointsPerDviUnit;
        const top = this.position.v * this.pointsPerDviUnit;

        if (svg.includes('<svg beginpicture>')) {
            if (this.svgDepth > 0) {
                // In this case we are inside another svg element so drop the svg start tags.
                svg = svg.replace('<svg beginpicture>', '');
            } else {
                svg = svg.replace(
                    '<svg beginpicture>',
                    '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" ' +
                        'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
                        `width="${this.paperwidth.toString()}pt" height="${this.paperheight.toString()}pt" ` +
                        `viewBox="-72 -72 ${this.paperwidth.toString()} ${this.paperheight.toString()}">`
                );
            }
        }

        if (/<\/svg endpicture>/.exec(svg)) {
            // If we are inside another svg element, then drop the svg end tag.
            // Otherwise just remove the " endpicture" bit.
            svg = svg.replace('</svg endpicture>', this.svgDepth > 0 ? '' : '</svg>');
        }

        svg = svg.replace(/{\?x}/g, left.toString());
        svg = svg.replace(/{\?y}/g, top.toString());

        this.svgDepth += (svg.match(/<svg.*>/g) || []).length;
        this.svgDepth -= (svg.match(/<\/svg.*>/g) || []).length;

    this.output.write( svg );
  }
  
  constructor( o : Writable ) {
    super();
    this.output = o;
    this.color = 'black';
    this.colorStack = [];
    this.svgDepth = 0;
  }

  preamble ( numerator : number, denominator : number, magnification : number, comment : string ) {
    let dviUnit = magnification * numerator / 1000.0 / denominator;

    let resolution = 300.0; // ppi
    let tfm_conv = (25400000.0 / numerator) * (denominator / 473628672) / 16.0;
    let conv = (numerator / 254000.0) * (resolution / denominator);
    conv = conv * (magnification / 1000.0);

    this.pointsPerDviUnit = dviUnit * 72.27 / 100000.0 / 2.54;
  }

  putRule( rule : Rule ) {
    let a = rule.a * this.pointsPerDviUnit;
    let b = rule.b * this.pointsPerDviUnit;
    let left = this.position.h * this.pointsPerDviUnit;
    let bottom = this.position.v * this.pointsPerDviUnit;
    let top = bottom - a;

	this.output.write(`<rect x="${left}" y="${top}" width="${b}" height="${a}" fill="${this.color}"` +
					  `${this.matrix.toSVGTransform()}></rect>`);
  }

  putText( text : Buffer ) : number {
    let textWidth = 0;
    let textHeight = 0;
    let textDepth = 0;

        let htmlText = '';

        for (const c of text) {
            const metrics = this.font.metrics.characters.get(c);
            if (metrics === undefined) throw new Error(`Could not find font metric for ${c.toString()}`);

            textWidth += metrics.width;
            textHeight = Math.max(textHeight, metrics.height);
            textDepth = Math.max(textDepth, metrics.depth);

            const codes = glyphs[this.font.name as keyof typeof glyphs] as Record<string, number>;
            const codepoint = codes[c.toString()];
            htmlText += `&#x${codepoint.toString(16).padStart(4, '0')};`;
        }

        // tfm is based on 1/2^16 pt units, rather than dviunit which is 10^−7 meters
        const dviUnitsPerFontUnit = ((this.font.metrics.designSize / 1048576.0) * 65536) / 1048576;

        const left = this.position.h * this.pointsPerDviUnit;
        const height = textHeight * this.pointsPerDviUnit * dviUnitsPerFontUnit;
        const top = this.position.v * this.pointsPerDviUnit;

        const fontsize = ((this.font.metrics.designSize / 1048576.0) * this.font.scaleFactor) / this.font.designSize;

        if (this.svgDepth == 0) {
            this.output.write(
                `<span style="line-height: 0; color: ${this.color}; font-family: ${this.font.name}; ` +
                    `font-size: ${fontsize.toString()}pt; position: absolute; top: ${(top - height).toString()}pt; ` +
                    `left: ${left.toString()}pt; overflow: visible;">` +
                    `<span style="margin-top: -${fontsize.toString()}pt; line-height: 0pt; height: ` +
                    `${fontsize.toString()}pt; display: inline-block; vertical-align: baseline; ">${htmlText}</span>` +
                    `<span style="display: inline-block; vertical-align: ${height.toString()}pt; ` +
                    'height: 0pt; line-height: 0;"></span></span>'
            );
        } else {
            const bottom = this.position.v * this.pointsPerDviUnit;
            // No 'pt' on fontsize since those units are potentially scaled
            this.output.write(
                `<text alignment-baseline="baseline" y="${bottom.toString()}" x="${left.toString()}" ` +
                    `font-family="${this.font.name}" font-size="${fontsize.toString()}" ` +
                    `fill="${this.color}"${this.matrix.toSVGTransform()}>` +
                    `${htmlText}</text>`
            );
        }

        return (textWidth * dviUnitsPerFontUnit * this.font.scaleFactor) / this.font.designSize;
    }
}
