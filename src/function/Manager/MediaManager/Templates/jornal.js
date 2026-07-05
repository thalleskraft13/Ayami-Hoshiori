'use strict';

const BaseImage = require('../BaseImage');
const Canvas    = require('../Canvas');
const Text      = require('../Text');

class MinhaTemplate extends BaseImage {
    static get templateName() { return 'minhatemplate'; }

    async render(data, context) {
    const { canvas: canvasModule } = context;
    const { avatarUrl, avatarBuffer, titulo, descricao } = data;

    const bg = await this.loadAsset(context, 'backgrounds', 'jornal');
    const W  = bg.width;
    const H  = bg.height;
   

    const { canvas, ctx } = Canvas.create(canvasModule, W, H);

    if (avatarUrl || avatarBuffer) {
        const avatarImg = avatarBuffer
            ? await context.loadImage(avatarBuffer)
            : await this.loadAvatar(context, avatarUrl, W);

        ctx.drawImage(avatarImg, 250, 30, 460, 260);
    }

  

    
    const { canvas: bgCanvas, ctx: bgCtx } = Canvas.create(canvasModule, W, H);
    bgCtx.drawImage(bg, 0, 0, W, H);

    ctx.drawImage(bgCanvas, 0, 0);

      Text.draw(ctx, {
           text: titulo,
           x: 80, y: 310,
           font: '30px sans-serif',
           color: '#FFFFFF',
    });

    Text.draw(ctx, {
        text: descricao,
        x: 140, y: 350,
        font: "30px sans-serif",
        color: '#FFFFFF',
    })


  return Canvas.toBuffer(canvas);

    }
}

module.exports = MinhaTemplate;