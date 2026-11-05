import { Kuroshiro } from 'kuroshiro-browser';
import { pinyin } from 'pinyin-pro';
import { romanizeKorean } from './korean-romanizer';

const hangul = /[\uac00-\ud7af]/;
const kana = /[\u3040-\u30ff]/;
const han = /[\u3400-\u9fff]/;

let japanese: Promise<InstanceType<typeof Kuroshiro> | null> | undefined;
const readings = new Map<string, string | null>();
async function japaneseReader() {
  japanese ??= Kuroshiro.buildAndInitWithKuromoji(import.meta.env.PROD).catch(() => null);
  return japanese;
}

/** Offline pronunciation hints for Korean, Japanese, and Mandarin lyrics. */
export async function lyricReading(text: string): Promise<string | null> {
  const line = text.trim();
  if (!line || !/[\u3400-\u9fff\uac00-\ud7af]/.test(line) && !kana.test(line)) return null;
  if (readings.has(line)) return readings.get(line)!;

  let result: string | null = null;
  try {
    if (hangul.test(line)) {
      result = romanizeKorean(line);
    } else if (kana.test(line)) {
      // Kuromoji resolves Kanji readings in context; a Kana-only heuristic cannot.
      const reader = await japaneseReader();
      if (reader) result = (await reader.convert(line, { to: 'romaji', romajiSystem: 'hepburn' })).trim();
    } else if (han.test(line)) {
      result = pinyin(line, { toneType: 'symbol', type: 'string' }).trim();
    }
  } catch {
    result = null;
  }
  if (result === line || !result) result = null;
  if (readings.size > 3000) readings.clear();
  readings.set(line, result);
  return result;
}
