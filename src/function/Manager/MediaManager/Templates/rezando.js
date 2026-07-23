'use strict';

const BaseImage = require('../BaseImage');
const Canvas    = require('../Canvas');

class RezandoTemplate extends BaseImage {
    static get templateName() { return 'rezando'; }

    async render(data, context) {
        const { canvas: canvasModule } = context;
        const { avatarUrl, avatarBuffer } = data;

        const bg = await this.loadAsset(context, 'backgrounds', 'rezando');
        const W  = bg.width;
        const H  = bg.height;

        const { canvas, ctx } = Canvas.create(canvasModule, W, H);

     

        const topoEsquerdo  = { x:  300, y:  -5}; 
        const topoDireito   = { x: 1000, y:  0 }; 
        const baixoDireito  = { x: 1000, y: 430 }; 
        const baixoEsquerdo = { x:  370, y: 430 }; 

        const tW = topoDireito.x  - topoEsquerdo.x;
        const tH = baixoEsquerdo.y - topoEsquerdo.y;

        if (avatarUrl || avatarBuffer) {
            const img = avatarBuffer
                ? await context.loadImage(avatarBuffer)
                : await context.loadImage(await context.avatar.fetch(avatarUrl, Math.max(tW, tH)));

            const { canvas: tmpCanvas, ctx: tmpCtx } = _createCanvas(canvasModule, tW, tH);
            tmpCtx.drawImage(img, 0, 0, tW, tH);

            const skewX = (topoDireito.y  - topoEsquerdo.y)  / tW; 
            const skewY = (baixoEsquerdo.x - topoEsquerdo.x) / tH; 

            ctx.save();
            ctx.setTransform(
                1,     skewX,  // a, b
                skewY, 1,      // c, d
                topoEsquerdo.x, // e (translate x)
                topoEsquerdo.y  
            );
            ctx.drawImage(tmpCanvas, 0, 0, tW, tH);
            ctx.restore();
        }

        const { canvas: bgCanvas, ctx: bgCtx } = _createCanvas(canvasModule, W, H);
        bgCtx.drawImage(bg, 0, 0, W, H);

        _chromaKeyWhite(bgCtx, W, H);

        ctx.drawImage(bgCanvas, 0, 0);

        return canvas.toBuffer('image/png');
    }
}


function _createCanvas(canvasModule, w, h) {
    const canvas = canvasModule.createCanvas(w, h);
    const ctx    = canvas.getContext('2d');
    return { canvas, ctx };
}

function _chromaKeyWhite(ctx, w, h, threshold = 40) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data      = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const isWhite = r > 200 && g > 200 && b > 200;
        const diff    = 255 - Math.max(r, g, b);

        if (isWhite && diff < threshold) {
            data[i + 3] = Math.round((diff / threshold) * 255);
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

module.exports = RezandoTemplate;