/** Ambient types: the `jsqr` package ships without TypeScript declarations. */
declare module 'jsqr' {
  export interface JsQrOptions {
    inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst';
  }

  export interface QRCode {
    data: string;
  }

  function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: JsQrOptions
  ): QRCode | null;

  export default jsQR;
}
