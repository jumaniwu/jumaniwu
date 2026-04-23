export function formatRupiah(n) {
  if (n === null || n === undefined || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function formatRupiahShort(n) {
  if (!n) return 'Rp 0';
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)} M`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(1)} Jt`;
  if (n >= 1e3) return `Rp ${(n / 1e3).toFixed(0)} Rb`;
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function terbilang(n) {
  const angka = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const bilangan = (n) => {
    if (n < 12) return angka[n];
    if (n < 20) return angka[n - 10] + ' Belas';
    if (n < 100) return angka[Math.floor(n / 10)] + ' Puluh ' + angka[n % 10];
    if (n < 200) return 'Seratus ' + bilangan(n - 100);
    if (n < 1000) return angka[Math.floor(n / 100)] + ' Ratus ' + bilangan(n % 100);
    if (n < 2000) return 'Seribu ' + bilangan(n - 1000);
    if (n < 1000000) return bilangan(Math.floor(n / 1000)) + ' Ribu ' + bilangan(n % 1000);
    if (n < 1000000000) return bilangan(Math.floor(n / 1000000)) + ' Juta ' + bilangan(n % 1000000);
    return bilangan(Math.floor(n / 1000000000)) + ' Miliar ' + bilangan(n % 1000000000);
  };
  return bilangan(Math.round(n)).replace(/\s+/g, ' ').trim().toUpperCase();
}
