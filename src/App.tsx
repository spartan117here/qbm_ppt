import React, { useRef, useState, useCallback, useEffect } from 'react';
import { PresentationStage } from './components/PresentationStage';
import { SlideDrawer } from './components/SlideDrawer';
import { ChromaKeySettingsModal } from './components/ChromaKeySettingsModal';
import { usePresentationSync } from './hooks/usePresentationSync';
import { DEFAULT_CHROMA_PARAMS, ChromaKeyParams } from './utils/chromaKeyShader';
import { PRESENTATION_DATA } from './data/presentationTimeline';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [chromaParams, setChromaParams] = useState<ChromaKeyParams>(DEFAULT_CHROMA_PARAMS);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    currentSlideIndex,
    displayedSlideIndex,
    currentSlide,
    totalSlides,
    state,
    activeVideo,
    currentAnchor,
    transitionDirection,
    isPlaying,
    isMuted,
    next,
    prev,
    jumpToSlide,
    toggleMute,
    onVideoTimeUpdate,
    onVideoEnded,
  } = usePresentationSync();

  const handleUpdateChromaParam = useCallback(
    <K extends keyof ChromaKeyParams>(key: K, value: ChromaKeyParams[K]) => {
      setChromaParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleResetChroma = useCallback(() => {
    setChromaParams(DEFAULT_CHROMA_PARAMS);
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(console.warn);
    }
  }, []);

  // Secret keyboard shortcuts to open utility overlays (Chroma / Drawer)
  useEffect(() => {
    (window as any).__TEST_JUMP__ = jumpToSlide;
    (window as any).__AGM_STATE__ = {
      state,
      activeVideo,
      currentSlideIndex,
      displayedSlideIndex,
      currentAnchor,
      transitionDirection,
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'g' || e.key === 'G') setIsDrawerOpen(true);
      if (e.key === 'c' || e.key === 'C') setIsSettingsOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jumpToSlide, state, activeVideo, currentSlideIndex, displayedSlideIndex, currentAnchor, transitionDirection]);

  return (
    <div className="agm-app-root" ref={containerRef}>
      {/* Full-viewport cinematic presentation stage */}
      <PresentationStage
        pdfPath={PRESENTATION_DATA.pdfPath}
        displayedSlideNumber={displayedSlideIndex + 1}
        currentSlide={currentSlide}
        activeVideo={activeVideo}
        currentAnchor={currentAnchor}
        canvasRef={canvasRef}
        chromaParams={chromaParams}
        isPlaying={isPlaying}
        isMuted={isMuted}
        onVideoTimeUpdate={onVideoTimeUpdate}
        onVideoEnded={onVideoEnded}
        isTransitioning={state !== 'IDLE_EXPLAINING'}
        slideTransitionDirection={transitionDirection}
        currentSlideIndex={currentSlideIndex}
        totalSlides={totalSlides}
        onNext={next}
        onPrev={prev}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Slide overview drawer (triggered by G key) */}
      <SlideDrawer
        isOpen={isDrawerOpen}
        currentSlideIndex={currentSlideIndex}
        onSelectSlide={jumpToSlide}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Chroma key tuning modal (triggered by C key) */}
      <ChromaKeySettingsModal
        isOpen={isSettingsOpen}
        params={chromaParams}
        onUpdateParam={handleUpdateChromaParam}
        onReset={handleResetChroma}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
export default App;
