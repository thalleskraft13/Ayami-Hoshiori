// Templates/infancia.js
'use strict';

const BaseImage = require('../BaseImage');
const Canvas    = require('../Canvas');
const Effects   = require('../Effects');

class CinemaTemplate extends BaseImage {
    static get templateName() { return 'infancia'; }

  async render(data, context) {
    const { canvas: canvasModule } = context;
    const { avatarUrl, avatarBuffer } = data;

    const bg = await this.loadAsset(context, 'backgrounds', 'cinema');
    const W  = bg.width;
    const H  = bg.height;

    const { canvas, ctx } = Canvas.create(canvasModule, W, H);

    // ── 1. Avatar/imagem do usuário ocupa a tela inteira (fica atrás) ────
    if (avatarUrl || avatarBuffer) {
        const avatarImg = avatarBuffer
            ? await context.loadImage(avatarBuffer)
            : await this.loadAvatar(context, avatarUrl, W);

        // Posiciona exatamente na área da tela verde
        // tela começa ~x:160, y:30 e termina ~x:1080, y:370 (736x414 original)
        ctx.drawImage(avatarImg, 130, 30, 480, 250);
    }

    // ── 2. Background com chroma key por cima ────────────────────────────
    const { canvas: bgCanvas, ctx: bgCtx } = Canvas.create(canvasModule, W, H);
    bgCtx.drawImage(bg, 0, 0, W, H);

    

    ctx.drawImage(bgCanvas, 0, 0);

    return Canvas.toBuffer(canvas);
}
}

module.exports = CinemaTemplate;