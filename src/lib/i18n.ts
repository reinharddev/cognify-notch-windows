// Teks antarmuka dalam dua bahasa, sama seperti versi Mac: L('indonesia', 'english').
// Bahasa mengikuti bahasa Windows; Indonesia dan Melayu memilih Indonesia.
// Pilihan di Pengaturan (id atau en) menggantikan bahasa Windows; berlaku setelah jendela dimuat ulang.
const chosen = (() => { try { return JSON.parse(localStorage.getItem('cn.lang') ?? 'null'); } catch { return null; } })();
export const lang: 'id' | 'en' = chosen === 'id' || chosen === 'en' ? chosen : /^(id|ms)\b/i.test(navigator.language) ? 'id' : 'en';
export const L = (id: string, en: string) => (lang === 'id' ? id : en);
