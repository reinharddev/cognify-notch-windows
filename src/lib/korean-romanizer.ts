/**
 * Romanisasi Hangul berdasarkan PELAFALAN (Revised Romanization), bukan ejaan huruf demi huruf:
 * 입술로 → "ipssullo", 빛이 → "bichi", 눈앞에 → "nunape". Sama dengan versi Mac (KoreanRomanizer.swift).
 * Aturan: sambung bunyi, huruf akhir (받침), aspirasi ㅎ, penegangan, sengau, asimilasi ㄹ, palatalisasi.
 * Teks non-Hangul dibiarkan; kata yang dipisah satu spasi dianggap satu frasa.
 */
type Syl = { onset: string; vowel: number; coda: string[] };

const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const CODAS: string[][] = [
  [], ['ㄱ'], ['ㄲ'], ['ㄱ', 'ㅅ'], ['ㄴ'], ['ㄴ', 'ㅈ'], ['ㄴ', 'ㅎ'], ['ㄷ'], ['ㄹ'],
  ['ㄹ', 'ㄱ'], ['ㄹ', 'ㅁ'], ['ㄹ', 'ㅂ'], ['ㄹ', 'ㅅ'], ['ㄹ', 'ㅌ'], ['ㄹ', 'ㅍ'], ['ㄹ', 'ㅎ'],
  ['ㅁ'], ['ㅂ'], ['ㅂ', 'ㅅ'], ['ㅅ'], ['ㅆ'], ['ㅇ'], ['ㅈ'], ['ㅊ'], ['ㅋ'], ['ㅌ'], ['ㅍ'], ['ㅎ'],
];
const VOWELS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const ONSET: Record<string, string> = {
  ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss',
  ㅇ: '', ㅈ: 'j', ㅉ: 'jj', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h',
};
const CODA: Record<string, string> = { ㄱ: 'k', ㄴ: 'n', ㄷ: 't', ㄹ: 'l', ㅁ: 'm', ㅂ: 'p', ㅇ: 'ng' };
const TENSE: Record<string, string> = { ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' };
const ASPIRATE: Record<string, string> = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅈ: 'ㅊ' };
const NASAL: Record<string, string> = { ㄱ: 'ㅇ', ㄷ: 'ㄴ', ㅂ: 'ㅁ' };
const TO_ASPIRATE: Record<string, string> = {
  ㄱ: 'ㅋ', ㄲ: 'ㅋ', ㅋ: 'ㅋ', ㄷ: 'ㅌ', ㅅ: 'ㅌ', ㅆ: 'ㅌ', ㅈ: 'ㅌ', ㅊ: 'ㅌ', ㅌ: 'ㅌ', ㅂ: 'ㅍ', ㅍ: 'ㅍ',
};

function syllable(char: string): Syl | null {
  const v = char.codePointAt(0)! - 0xac00;
  if (v < 0 || v >= 11172) return null;
  return { onset: INITIALS[Math.floor(v / 588)], vowel: Math.floor((v % 588) / 28), coda: [...CODAS[v % 28]] };
}

function representative(c: string): string {
  if ('ㄱㄲㅋ'.includes(c)) return 'ㄱ';
  if ('ㄷㅅㅆㅈㅊㅌㅎ'.includes(c)) return 'ㄷ';
  if ('ㅂㅍ'.includes(c)) return 'ㅂ';
  return c;
}

function pronounce(input: Syl[]): string[] {
  const s = input.map((x) => ({ ...x, coda: [...x.coda] }));
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const c = s[i].coda;
    if (c.length === 0) continue;
    const next = i + 1 < n ? s[i + 1].onset : null;

    // Sambung bunyi: onset berikutnya kosong (ㅇ).
    if (next === 'ㅇ' && !(c.length === 1 && c[0] === 'ㅇ')) {
      let moved: string | null = null;
      if (c.length === 2) {
        if (c[1] === 'ㅎ') { moved = c[0]; s[i].coda = []; }
        else { moved = c[1] === 'ㅅ' ? 'ㅆ' : c[1]; s[i].coda = [c[0]]; }
      } else if (c[0] === 'ㅎ') {
        s[i].coda = [];
      } else {
        moved = c[0];
        s[i].coda = [];
      }
      if (moved) {
        if (s[i + 1].vowel === 20) { // ㅣ: 굳이 → 구지, 같이 → 가치
          if (moved === 'ㄷ') moved = 'ㅈ';
          else if (moved === 'ㅌ') moved = 'ㅊ';
        }
        s[i + 1].onset = moved;
      }
      continue;
    }

    if (next) {
      // Aspirasi: ㅎ + ㄱ/ㄷ/ㅈ.
      if (c.includes('ㅎ') && ASPIRATE[next]) {
        s[i + 1].onset = ASPIRATE[next];
        s[i].coda = c.length === 2 ? [c[0]] : [];
        continue;
      }
      if (c.length === 1 && c[0] === 'ㅎ' && next === 'ㅅ') {
        s[i + 1].onset = 'ㅆ';
        s[i].coda = [];
        continue;
      }
      // Aspirasi: ㄱ/ㄷ/ㅂ + ㅎ.
      if (next === 'ㅎ') {
        if (c.length === 1 && TO_ASPIRATE[c[0]]) {
          s[i + 1].onset = TO_ASPIRATE[c[0]];
          s[i].coda = [];
          continue;
        }
        if (c.length === 2 && c[0] === 'ㄹ' && !'ㅅㅁㅎ'.includes(c[1]) && TO_ASPIRATE[c[1]]) {
          s[i + 1].onset = TO_ASPIRATE[c[1]];
          s[i].coda = ['ㄹ'];
          continue;
        }
      }
    }

    // Netralisasi huruf akhir.
    const compound = c.length === 2;
    let rep: string;
    if (compound) {
      const key = c[0] + c[1];
      if (key === 'ㄱㅅ') rep = 'ㄱ';
      else if (key === 'ㅂㅅ') rep = 'ㅂ';
      else if (c[0] === 'ㄴ') rep = 'ㄴ';
      else if (key === 'ㄹㄱ') rep = next === 'ㄱ' ? 'ㄹ' : 'ㄱ';
      else if (key === 'ㄹㅁ') rep = 'ㅁ';
      else if (key === 'ㄹㅍ') rep = 'ㅂ';
      else rep = 'ㄹ';
    } else {
      rep = representative(c[0]);
    }

    if (next) {
      // Penegangan (gabungan akhir seperti 앉다, 닮고, 넓다 juga).
      if (('ㄱㄷㅂ'.includes(rep) || (compound && 'ㄴㅁㄹ'.includes(rep))) && TENSE[next]) {
        s[i + 1].onset = TENSE[next];
      }
      // Sengau dan asimilasi ㄹ.
      if ('ㄱㄷㅂ'.includes(rep)) {
        if (next === 'ㄴ' || next === 'ㅁ') rep = NASAL[rep];
        else if (next === 'ㄹ') { rep = NASAL[rep]; s[i + 1].onset = 'ㄴ'; }
      } else if ((rep === 'ㅁ' || rep === 'ㅇ') && next === 'ㄹ') {
        s[i + 1].onset = 'ㄴ';
      } else if (rep === 'ㄴ' && next === 'ㄹ') {
        rep = 'ㄹ';
      } else if (rep === 'ㄹ' && next === 'ㄴ') {
        s[i + 1].onset = 'ㄹ';
      }
    }
    s[i].coda = [rep];
  }

  return s.map((syl, i) => {
    let onset = ONSET[syl.onset] ?? '';
    if (syl.onset === 'ㄹ' && i > 0 && s[i - 1].coda.length === 1 && s[i - 1].coda[0] === 'ㄹ') onset = 'l';
    const coda = syl.coda.length ? CODA[syl.coda[0]] ?? '' : '';
    return onset + VOWELS[syl.vowel] + coda;
  });
}

/** Mengembalikan null bila teks tidak memuat Hangul. */
export function romanizeKorean(text: string): string | null {
  let out = '';
  let run: Syl[] = [];
  let spaceAfter: boolean[] = [];
  let pendingSpace = false;
  let any = false;

  const flush = () => {
    if (!run.length) return;
    const parts = pronounce(run);
    parts.forEach((p, i) => {
      out += p;
      if (i < parts.length - 1 && spaceAfter[i]) out += ' ';
    });
    run = [];
    spaceAfter = [];
  };

  for (const char of text) {
    const syl = syllable(char);
    if (syl) {
      any = true;
      if (run.length) spaceAfter.push(pendingSpace);
      pendingSpace = false;
      run.push(syl);
    } else if (char === ' ' && run.length && !pendingSpace) {
      pendingSpace = true;
    } else {
      flush();
      if (pendingSpace) out += ' ';
      pendingSpace = false;
      out += char;
    }
  }
  flush();
  if (pendingSpace) out += ' ';
  return any ? out.trim() : null;
}
