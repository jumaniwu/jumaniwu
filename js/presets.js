/**
 * Presets — contoh set koordinat batas lahan (meter lokal).
 */
(function (root) {
  'use strict';

  var Presets = [
    {
      name: 'Contoh Lahan 1 (Trapesium ±1 ha)',
      coords: [[0, 0], [120, 0], [115, 85], [5, 80]]
    },
    {
      name: 'Contoh Lahan 2 (Tidak Beraturan ±1,2 ha)',
      coords: [[0, 0], [150, 10], [160, 90], [90, 100], [80, 60], [0, 70]]
    }
  ];

  root.Presets = Presets;
  if (typeof module !== 'undefined' && module.exports) module.exports = Presets;
})(typeof window !== 'undefined' ? window : globalThis);
