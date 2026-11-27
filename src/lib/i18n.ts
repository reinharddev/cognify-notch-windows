// Notch Windows berbahasa Inggris saja, sama seperti versi Mac. Pasangan L('indonesia', 'english') yang sudah ada
// tetap dipakai; yang ditampilkan selalu teks Inggrisnya. Teks baru cukup ditulis Inggris di argumen kedua.
export const lang: 'id' | 'en' = 'en' as 'id' | 'en';
export const L = (id: string, en: string) => (lang === 'id' ? id : en);
