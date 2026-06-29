# Dompetku - Pencatatan Keuangan & Investasi

Aplikasi Android untuk pencatatan pemasukan, pengeluaran, laporan keuangan, serta pencatatan investasi saham/crypto. UI menggunakan Tailwind CSS (NativeWind) dan data tersimpan lokal dengan SQLite.

## Fitur Utama

- Kelola pemasukan dan pengeluaran
- Laporan keuangan per hari, minggu, dan bulan
- Dashboard keuangan
- Pencatatan investasi saham/crypto
- Dashboard investasi

## Prasyarat

- Node.js LTS (disarankan 18 atau 20)
- VS Code
- Android Studio (untuk emulator) atau HP Android untuk testing
- Aplikasi Expo Go di HP (untuk testing cepat)

## Instalasi & Menjalankan di VS Code

1. Buka folder proyek di VS Code.
2. Instal dependencies.

   ```bash
   npm install
   ```

3. Jalankan aplikasi.

   ```bash
   npx expo start
   ```

4. Jalankan di perangkat:
   - Emulator: tekan `a` di terminal Expo.
   - HP Android: buka Expo Go lalu scan QR code dari terminal.

## Instal Aplikasi ke HP (APK)

Metode cepat untuk pemasangan permanen adalah membuat APK menggunakan EAS Build.

1. Login ke Expo (sekali saja).

   ```bash
   npx eas-cli login
   ```

2. Build APK untuk Android.

   ```bash
   npx eas-cli build -p android --profile preview
   ```

3. Setelah build selesai, unduh APK dari link yang diberikan terminal EAS.
4. Pindahkan APK ke HP dan install (izinkan instalasi dari sumber tidak dikenal bila diminta).

## Struktur Halaman

- `app/(tabs)/index.tsx` - Dashboard keuangan
- `app/(tabs)/transactions.tsx` - Kelola pemasukan/pengeluaran
- `app/(tabs)/reports.tsx` - Laporan harian/mingguan/bulanan
- `app/(tabs)/investments.tsx` - Dashboard & catatan investasi

## Catatan Pengembangan

- Database lokal: SQLite
- Styling: NativeWind (Tailwind CSS untuk React Native)
