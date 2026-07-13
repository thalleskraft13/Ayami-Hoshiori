"use strict";

module.exports = [
  { id: "banned_title", render: () => "⛔ Estás baneado/a de Ayami" },
  { id: "banned_description", render: () =>
    "No puedes usar a Ayami en ningún servidor mientras estés en la blacklist global." },
  { id: "banned_field_staff", render: () => "Staff responsable" },
  { id: "banned_field_when", render: () => "Cuándo" },
  { id: "banned_field_reason", render: () => "Motivo" },
  { id: "banned_unknown", render: () => "Desconocido" },
  { id: "banned_no_reason", render: () => "No especificado" },
];
