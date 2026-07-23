'use strict';

const STAFF_IDS = new Set(['1438170698580361287', '1143305900078149664']);

function isStaff(userId) {
    return STAFF_IDS.has(userId);
}

module.exports = { STAFF_IDS, isStaff };
