'use strict';

const Utils = require('./Utils');

/**
 * Executes a single template render and returns the resulting Buffer.
 *
 * Holds the shared RenderContext and delegates the actual drawing
 * to the template's `render()` method.
 */
class Renderer {
    /**
     * @param {object} context - The shared RenderContext (built by ImageManager).
     */
    constructor(context) {
        this._context = context;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Run a template and return the output Buffer.
     *
     * @param {object} TemplateClass - A class extending BaseImage.
     * @param {object} data          - Template-specific data.
     * @returns {Promise<Buffer>}
     */
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
