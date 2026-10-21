// Teks antarmuka dalam dua bahasa, sama seperti versi Mac: L('indonesia', 'english').
// Bahasa mengikuti bahasa Windows; Indonesia dan Melayu memilih Indonesia.
export const lang: 'id' | 'en' = /^(id|ms)\b/i.test(navigator.language) ? 'id' : 'en';
export const L = (id: string, en: string) => (lang === 'id' ? id : en);
