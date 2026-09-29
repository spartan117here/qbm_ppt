import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure PDF.js worker via Vite static URL
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface RenderedPageCache {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class PDFPresentationService {
  private pdfDoc: any = null;
  private cache: Map<number, RenderedPageCache> = new Map();
  private loadingPromise: Promise<any> | null = null;
  private pdfUrl: string = '';

  constructor(pdfUrl: string) {
    this.pdfUrl = pdfUrl;
  }

  public async load(): Promise<number> {
    if (this.pdfDoc) return this.pdfDoc.numPages;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        console.log('[PDFService] Fetching PDF from:', this.pdfUrl);
        const loadingTask = pdfjsLib.getDocument({ url: this.pdfUrl });
        this.pdfDoc = await loadingTask.promise;
        console.log('[PDFService] Successfully loaded PDF! Total pages:', this.pdfDoc.numPages);
        return this.pdfDoc.numPages;
      } catch (err: any) {
        console.error('[PDFService] Error in getDocument:', err);
        throw err;
      }
    })();

    return this.loadingPromise;
  }

  public async renderPageToCanvas(
    pageNumber: number,
    targetCanvas: HTMLCanvasElement,
    scale: number = 2.0 // High DPI rendering
  ): Promise<void> {
    if (!this.pdfDoc) {
      await this.load();
    }

    const page = await this.pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    targetCanvas.width = viewport.width;
    targetCanvas.height = viewport.height;

    const ctx = targetCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');

    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  }

  public async prefetchAll(scale: number = 2.0, onProgress?: (p: number) => void): Promise<void> {
    if (!this.pdfDoc) await this.load();
    const total = this.pdfDoc.numPages;

    for (let i = 1; i <= total; i++) {
      if (this.cache.has(i)) continue;
      const offscreen = document.createElement('canvas');
      await this.renderPageToCanvas(i, offscreen, scale);
      this.cache.set(i, {
        canvas: offscreen,
        width: offscreen.width,
        height: offscreen.height,
      });
      if (onProgress) onProgress(i / total);
    }
  }

  public getCachedPage(pageNumber: number): RenderedPageCache | undefined {
    return this.cache.get(pageNumber);
  }

  public getTotalPages(): number {
    return this.pdfDoc ? this.pdfDoc.numPages : 10;
  }
}
