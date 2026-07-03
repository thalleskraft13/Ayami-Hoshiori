'use strict';

/**
 * Staff global da Ayami — mesma lista usada pelos comandos internos tipo
 * eval (`_handleStaffCommands` em MessageCollectorManager.js). Centralizado
 * a mesma fonte, em vez de cada lugar reinventar a própria checagem.
 */
const STAFF_IDS = new Set(['1438170698580361287', '1143305900078149664']);

function isStaff(userId) {
    return STAFF_IDS.has(userId);
}

module.exports = { STAFF_IDS, isStaff };
