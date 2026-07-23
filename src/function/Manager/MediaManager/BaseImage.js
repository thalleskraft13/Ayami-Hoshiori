'use strict';


class BaseImage {


    static get templateName() {
        return 'base';
    }

    static get description() {
        return '';
    }


    async render(data, context) {
        throw new Error(
            `[BaseImage] Template "${this.constructor.templateName ?? this.constructor.name}" ` +
            `must implement the render(data, context) method.`
        );
    }


    async loadAsset(context, category, name) {
        const assetMap = context.assets[category];
        if (!assetMap) throw new Error(`[BaseImage] Unknown asset category: "${category}"`);

        const filePath = assetMap.get(name.toLowerCase());
        if (!filePath) throw new Error(`[BaseImage] Asset not found: ${category}/${name}`);

        return context.loadImage(filePath);
    }

    async loadAvatar(context, url, size = 256) {
        const buffer = await context.avatar.fetch(url, size);
        return context.loadImage(buffer);
    }
}

module.exports = BaseImage;
