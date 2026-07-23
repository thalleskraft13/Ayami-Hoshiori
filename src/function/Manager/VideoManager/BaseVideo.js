'use strict';



class BaseVideo {


    static get templateName() { return 'base_video'; }

    static get description() { return ''; }

    static get meta() {
        return {
            fps:      15,
            width:    256,
            height:   256,
            duration: 1,
            format:   'gif',
        };
    }


    async renderFrame(frameIndex, totalFrames, data, context) {
        throw new Error(
            `[BaseVideo] Template "${this.constructor.templateName}" ` +
            `must implement renderFrame(frameIndex, totalFrames, data, context).`
        );
    }


    progress(frameIndex, totalFrames) {
        return totalFrames <= 1 ? 1 : frameIndex / (totalFrames - 1);
    }

    async loadAsset(context, category, name) {
        const assetMap = context.assets[category];
        if (!assetMap) throw new Error(`[BaseVideo] Unknown asset category: "${category}"`);
        const filePath = assetMap.get(name.toLowerCase());
        if (!filePath) throw new Error(`[BaseVideo] Asset not found: ${category}/${name}`);
        return context.loadImage(filePath);
    }

    async loadAvatar(context, url, size = 256) {
        const buffer = await context.avatar.fetch(url, size);
        return context.loadImage(buffer);
    }

    dispose() {}
}

module.exports = BaseVideo;
