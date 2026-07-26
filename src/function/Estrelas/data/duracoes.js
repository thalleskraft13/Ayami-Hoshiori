'use strict';

// Duração das expedições e seu multiplicador de recompensa.
// Expedições mais longas rendem mais, mas ocupam o companheiro por mais tempo.
module.exports = {
  '15min': { label: '15 minutos', minutos: 15,  multiplicador: 1 },
  '1h':    { label: '1 hora',     minutos: 60,  multiplicador: 3 },
  '6h':    { label: '6 horas',    minutos: 360, multiplicador: 10 },
  '12h':   { label: '12 horas',   minutos: 720, multiplicador: 18 },
};
