'use strict';

const { Schema, model, models } = require('mongoose');

const nodePositionSchema = new Schema({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
}, { _id: false });

const logicNodeSchema = new Schema({
  id:         { type: String, required: true },
  type:       { type: String, required: true },
  category:   { type: String, required: true },
  position:   { type: nodePositionSchema, default: () => ({ x: 0, y: 0 }) },
  properties: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const logicEdgeSchema = new Schema({
  id:         { type: String, required: true },
  source:     { type: String, required: true },
  sourcePort: { type: String, required: true },
  target:     { type: String, required: true },
  targetPort: { type: String, required: true },
}, { _id: false });

const logicNodeFlowSchema = new Schema(
  {
    flowId:  { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    name:    { type: String, required: true, default: 'Novo Fluxo' },

    nodes: { type: [logicNodeSchema], default: [] },
    edges: { type: [logicEdgeSchema], default: [] },
    canvas: {
      zoom: { type: Number, default: 1 },
      x:    { type: Number, default: 0 },
      y:    { type: Number, default: 0 },
    },

    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'logic_node_flows' }
);

logicNodeFlowSchema.index({ guildId: 1, updatedAt: -1 });

logicNodeFlowSchema.pre('save', function () {
  this.updatedAt = new Date();
});

module.exports = {
  LogicNodeFlowModel: models.LogicNodeFlow || model('LogicNodeFlow', logicNodeFlowSchema),
};
