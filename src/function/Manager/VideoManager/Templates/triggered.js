'use strict';

const BaseVideo = require('../BaseVideo');

/**
 * "TRIGGERED" meme GIF.
 * Shakes the avatar randomly and overlays a red tint + TRIGGERED text.
 *
 * @example
 * const gif = await MediaManager.Video.Render({
 *     Template:  'triggered',
 *     avatarUrl: 'https://cdn.discordapp.com/avatars/…',
 * });
 */
class TriggeredTemplate extends BaseVideo {

    static get templateName() { return 'triggered'; }
    static get description()  { return 'TRIGGERED meme GIF'; }

    static get meta() {
        return {
            fps:      15,
            width:    256,
            height:   300, // extra space for the TRIGGERED bar at the bottom
            duration: 1.5,
            format:   'gif',
        };
    }

    async renderFrame(frameIndex, totalFrames, data, context) {
        const { canvas: canvasModule, loadImage } = context;
        const { avatarUrl, avatarBuffer } = data;

        const W = TriggeredTemplate.meta.width;
        const H = TriggeredTemplate.meta.height;
        const avatarSize = 256;

        const canvas = canvasModule.createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

        // ── 1. Load avatar ────────────────────────────────────────────────
        let avatarImg;
        if (avatarBuffer) {
            avatarImg = await loadImage(avatarBuffer);
        } else if (avatarUrl) {
            avatarImg = await this.loadAvatar(context, avatarUrl, avatarSize);
        }

        // ── 2. Random shake offset (different every frame) ────────────────
        const shakeX = Math.floor(Math.random() * 20) - 10; // -10 to +10
        const shakeY = Math.floor(Math.random() * 20) - 10;

        // ── 3. Draw avatar with shake ─────────────────────────────────────
        if (avatarImg) {
            ctx.drawImage(avatarImg, shakeX, shakeY, avatarSize + 10, avatarSize + 10);
        } else {
            ctx.fillStyle = '#555';
            ctx.fillRect(0, 0, W, avatarSize);
        }

        // ── 4. Red tint overlay (random intensity per frame) ──────────────
        const redIntensity = 0.2 + Math.random() * 0.25; // 0.20–0.45
        ctx.fillStyle = `rgba(255, 0, 0, ${redIntensity})`;
        ctx.fillRect(0, 0, W, avatarSize);

        // ── 5. TRIGGERED bar at the bottom ───────────────────────────────
        const barY = avatarSize;
        const barH = H - avatarSize; // 44px

        ctx.fillStyle = '#FF0000';
        ctx.fillRect(0, barY, W, barH);

        // Text shake
        const txtShakeX = Math.floor(Math.random() * 8) - 4;
        const txtShakeY = Math.floor(Math.random() * 4) - 2;

        ctx.font         = `bold ${barH - 8}px Impact, Arial Black, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = '#FFFFFF';
        ctx.strokeStyle  = '#000000';
        ctx.lineWidth    = 3;
        ctx.lineJoin     = 'round';

        const textX = W / 2 + txtShakeX;
        const textY = barY + barH / 2 + txtShakeY;

        ctx.strokeText('TRIGGERED', textX, textY);
        ctx.fillText('TRIGGERED',   textX, textY);

        return canvas.toBuffer('image/png');
    }
}

module.exports = TriggeredTemplate;
