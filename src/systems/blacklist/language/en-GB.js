"use strict";

module.exports = [
  { id: "banned_title", render: () => "⛔ You've been banned from Ayami" },
  { id: "banned_description", render: () =>
    "You can't use Ayami on any server while you're on the global blacklist." },
  { id: "banned_field_staff", render: () => "Responsible staff" },
  { id: "banned_field_when", render: () => "When" },
  { id: "banned_field_reason", render: () => "Reason" },
  { id: "banned_unknown", render: () => "Unknown" },
  { id: "banned_no_reason", render: () => "Not specified" },
];
