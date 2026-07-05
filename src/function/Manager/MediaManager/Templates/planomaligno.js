'use strict';

const BaseImage = require('../BaseImage');
const Canvas    = require('../Canvas');
const Effects   = require('../Effects');

class PlanoMalignoTemplate extends BaseImage {
    static get templateName() { return 'planomaligno'; }

  async render(data, context) {
    const { canvas: canvasModule } = context;
    const { avatarUrl, avatarBuffer } = data;

    const bg = await this.loadAsset(context, 'backgrounds', 'planomaligno');
    const W  = bg.width;
    const H  = bg.height;

    const { canvas, ctx } = Canvas.create(canvasModule, W, H);

  
    if (avatarUrl || avatarBuffer) {
        const avatarImg = avatarBuffer
            ? await context.loadImage(avatarBuffer)
            : await this.loadAvatar(context, avatarUrl, W);

     
        ctx.drawImage(avatarImg, 170, 30, 200, 220);
        ctx.drawImage(avatarImg, 550, 30, 200, 220);
        ctx.drawImage(avatarImg, 170, 270, 200, 220);
        ctx.drawImage(avatarImg, 550, 270, 200, 220);
        ctx.drawImage(avatarImg, 395, 515, 200, 225);
    }

   
    const { canvas: bgCanvas, ctx: bgCtx } = Canvas.create(canvasModule, W, H);
    bgCtx.drawImage(bg, 0, 0, W, H);

    ctx.drawImage(bgCanvas, 0, 0);

    return Canvas.toBuffer(canvas);
}
}

module.exports = PlanoMalignoTemplate;