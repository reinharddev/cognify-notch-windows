declare module 'kuroshiro-browser' {
  export class Kuroshiro {
    static buildAndInitWithKuromoji(isProduction?: boolean): Promise<Kuroshiro>;
    convert(text: string, options: { to: 'romaji'; romajiSystem: 'hepburn' }): Promise<string>;
  }
}
