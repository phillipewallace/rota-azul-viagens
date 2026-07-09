/**
 * Carimba uma imagem de assinatura em posições especificadas de um PDF.
 * Coordenadas de entrada em percentuais (0–1) relativos ao tamanho da página
 * (origem no canto superior esquerdo, mais intuitivo pra UI).
 * Convertidas internamente para o sistema bottom-up do pdf-lib.
 */
import { PDFDocument } from 'pdf-lib';

export interface SignaturePlacement {
  pageIndex: number; // 0-based
  xPct: number;      // 0..1 (left edge)
  yPct: number;      // 0..1 (top edge, y crescendo pra baixo)
  wPct: number;      // 0..1 (largura relativa à página)
  hPct: number;      // 0..1 (altura relativa à página)
}

async function fetchAsBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar assinatura (${r.status})`);
  const blob = await r.blob();
  const buf = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buf), mime: blob.type || 'image/png' };
}

export async function stampSignatureOnPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  signatureUrl: string,
  placements: SignaturePlacement[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const { bytes: sigBytes, mime } = await fetchAsBytes(signatureUrl);
  const img = /jpe?g/i.test(mime)
    ? await pdf.embedJpg(sigBytes)
    : await pdf.embedPng(sigBytes);

  const pages = pdf.getPages();
  for (const p of placements) {
    const page = pages[p.pageIndex];
    if (!page) continue;
    const { width, height } = page.getSize();
    const w = p.wPct * width;
    const h = p.hPct * height;
    const x = p.xPct * width;
    // pdf-lib usa origem inferior-esquerda; y é a base da imagem.
    const y = height - p.yPct * height - h;
    page.drawImage(img, { x, y, width: w, height: h });
  }

  return pdf.save();
}
