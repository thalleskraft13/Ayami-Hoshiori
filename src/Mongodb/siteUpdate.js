'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const localizedTextSchema = new Schema({
    'pt-BR': { type: String, required: true },
    'en-US': { type: String, default: null },
    'en-GB': { type: String, default: null },
    es: { type: String, default: null },
}, { _id: false });

const siteUpdateSchema = new Schema({
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
    categories: { type: [String], default: [] },
    version: { type: String, default: null },

    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },

    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: null },

    order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.SiteUpdate || mongoose.model('SiteUpdate', siteUpdateSchema);
