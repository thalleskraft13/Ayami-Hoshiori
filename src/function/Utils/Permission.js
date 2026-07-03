'use strict';

// Permission.js e GetPerm.js eram implementações idênticas e duplicadas.
// Seção 1.1 do prompt de implementação: centralizado num único módulo
// (GetPerm.js) já integrado ao GuildManager. Este arquivo é mantido apenas
// como alias, pra não quebrar os `require('.../Permission.js')` existentes.
module.exports = require('./GetPerm.js');
