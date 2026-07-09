/**
 * Configuração única do worker do pdfjs-dist.
 * Importe este módulo (side-effect) antes de usar `pdfjs.getDocument`.
 */
import * as pdfjsLib from 'pdfjs-dist';
// O `?url` do Vite garante um arquivo servido, e o import da mesma major que
// `pdfjs-dist` evita mismatch de versão entre main thread e worker.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (!(pdfjsLib.GlobalWorkerOptions as any).workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

export { pdfjsLib };
