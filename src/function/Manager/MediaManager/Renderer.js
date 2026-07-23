'use strict';

const Utils = require('./Utils');

class Renderer {
    constructor(context) {
        this._context = context;
    }


    async run(TemplateClass, data) {
        const elapsed = Utils.timer();

        const template = new TemplateClass();
        const result   = await template.render(data, this._context);

        if (!Buffer.isBuffer(result)) {
            throw new TypeError(
                `[Renderer] Template "${TemplateClass.templateName ?? TemplateClass.name}" ` +
                `must return a Buffer from render(), got: ${typeof result}`
            );
        }

        return result;
    }
}

module.exports = Renderer;
