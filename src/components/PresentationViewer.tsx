import React, { useEffect, useRef, useState } from 'react';
import { PDFPresentationService } from '../utils/pdfRenderer';

interface PresentationViewerProps {
  pdfPath: string;
  currentSlideNumber: number; // 1-indexed
  isTransitioning: boolean;
  transitionDirection: 'next' | 'prev';
}

export const PresentationViewer: React.FC<PresentationViewerProps> = ({
  pdfPath,
  currentSlideNumber,
  isTransitioning,
  transitionDirection,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const serviceRef = useRef<PDFPresentationService | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderCounter, setRenderCounter] = useState(0);

  // Initialize PDF service
  useEffect(() => {
    const service = new PDFPresentationService(pdfPath);
    serviceRef.current = service;

    service
      .load()
      .then(async () => {
        setIsLoaded(true);
        // Pre-fetch all 10 pages in background for instantaneous slide changes
        service.prefetchAll(2.0).catch(console.warn);
      })
      .catch((err) => {
        console.error('Failed loading presentation PDF:', err);
        setLoadError(err.message || 'Error loading presentation PDF');
      });
  }, [pdfPath]);

  // Render current slide
  useEffect(() => {
    const service = serviceRef.current;
    const canvas = canvasRef.current;
    if (!service || !canvas || !isLoaded) return;

    let isCancelled = false;

    // Check if pre-cached
    const cached = service.getCachedPage(currentSlideNumber);
    if (cached) {
      canvas.width = cached.width;
      canvas.height = cached.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(cached.canvas, 0, 0);
      }
      setRenderCounter((c) => c + 1);
    } else {
      service
        .renderPageToCanvas(currentSlideNumber, canvas, 2.0)
        .then(() => {
          if (!isCancelled) {
            setRenderCounter((c) => c + 1);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error(`Error rendering slide ${currentSlideNumber}:`, err);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [currentSlideNumber, isLoaded]);

  if (loadError) {
    return (
      <div className="pdf-error-container">
        <div className="pdf-error-badge">⚠️ Presentation Load Notice</div>
        <p>{loadError}</p>
        <span className="pdf-error-sub">Path: {pdfPath}</span>
      </div>
    );
  }

  return (
    <div className="presentation-slide-wrapper">
      {!isLoaded && (
        <div className="presentation-loader">
          <div className="presentation-spinner" />
          <div className="presentation-loader-text">Loading Presentation Deck...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`presentation-slide-canvas ${
          isTransitioning
            ? transitionDirection === 'next'
              ? 'slide-anim-next'
              : 'slide-anim-prev'
            : 'slide-anim-settled'
        }`}
      />
    </div>
  );
};
