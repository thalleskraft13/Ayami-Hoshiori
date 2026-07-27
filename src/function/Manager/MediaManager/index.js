'use strict';


const path         = require('path');
const ImageManager = require('./ImageManager');
const VideoProcessManager = require('../VideoManager/VideoProcessManager');


let _image = null;

let _videoPool = null;

function _getImage() {
    if (!_image) {
        const root = path.resolve(__dirname, '../../../../');
        _image = new ImageManager({ root });
    }
    return _image;
}

function _getVideoPool() {
    if (!_videoPool) {
        const root = path.resolve(__dirname, '../../../../');
        _videoPool = new VideoProcessManager({ root });
    }
    return _videoPool;
}


const MediaManager = {


    async init(options = {}) {
        if (options.root) {
            _image     = new ImageManager(options);
            _videoPool = new VideoProcessManager(options);
        }
        await Promise.all([
            _getImage().init(),
            _getVideoPool().listTemplates(), // esquenta + valida os templates de vídeo no boot
        ]);
    },


    async Render(options) {
        return _getImage().render(options);
    },

    Image: {
        async Render(options) {
            return _getImage().render(options);
        },
    },


    Video: {
        async Render(options) {
            return _getVideoPool().render(options);
        },

        async renderFrames(options) {
            return _getVideoPool().renderFrames(options);
        },

        async listTemplates() {
            return _getVideoPool().listTemplates();
        },

        stats() {
            return _getVideoPool().stats();
        },
    },


    listTemplates() {
        return _getImage().listTemplates();
    },

    addTemplate(name, TemplateClass) {
        _getImage().addTemplate(name, TemplateClass);
    },

    stats() {
        return {
            image: _getImage().stats(),
            video: _getVideoPool().stats(),
        };
    },


};

module.exports = MediaManager;
