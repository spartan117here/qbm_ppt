import React, { useRef, useState, useCallback, useEffect } from 'react';
import { PresentationViewer } from './PresentationViewer';
import { PresenterCanvas } from './PresenterCanvas';
import { SlideStepConfig } from '../data/presentationTimeline';
import { AGMVideoItem } from '../data/videoRegistry';
import { ChromaKeyParams } from '../utils/chromaKeyShader';
import { AnchorZone } from '../hooks/usePresentationSync';

interface PresentationStageProps {
  pdfPath: string;
  displayedSlideNumber: number;
  currentSlide: SlideStepConfig;
  activeVideo: AGMVideoItem;
  currentAnchor: AnchorZone;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  chromaParams: ChromaKeyParams;
  isPlaying: boolean;
  isMuted: boolean;
  onVideoTimeUpdate: (currentTime: number) => void;
  onVideoEnded: () => void;
  isTransitioning: boolean;
  slideTransitionDirection: 'next' | 'prev';
  currentSlideIndex: number;
  totalSlides: number;
  onNext: () => void;
  onPrev: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const PresentationStage: React.FC<PresentationStageProps> = ({
  pdfPath,
  displayedSlideNumber,
  activeVideo,
  currentAnchor,
  canvasRef,
  chromaParams,
  isPlaying,
  isMuted,
  onVideoTimeUpdate,
  onVideoEnded,
  isTransitioning,
  slideTransitionDirection,
  currentSlideIndex,
  totalSlides,
  onNext,
  onPrev,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: -300, y: -300 });
  const [cursorSide, setCursorSide] = useState<'left' | 'right'>('right');
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Direct position — no smoothing, no offset
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setCursorSide((e.clientX - rect.left) < rect.width / 2 ? 'left' : 'right');
    setIsCursorVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsCursorVisible(false);
    setIsPressed(false);
  }, []);

  const handleMouseDown = useCallback(() => setIsPressed(true), []);
  const handleMouseUp = useCallback(() => setIsPressed(false), []);

  // Click navigates — stopPropagation on fullscreen button prevents this from firing there
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if ((e.clientX - rect.left) < rect.width / 2) {
      onPrev();
    } else {
      onNext();
    }
  }, [onNext, onPrev]);

  const padNum = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      className="presentation-stage-container"
      ref={stageRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {/* ── TWO-REGION STAGE: Small AGM Presenter Rail (Left) + Huge PPT (Right) ── */}
      <div className="presentation-stage-layout">
        {/* REGION 1: DEDICATED LEFT PRESENTER RAIL (14–16% width, matching PPT white background) */}
        <div className="presenter-rail" id="presenter-rail" aria-label="AGM Presenter Rail">
          <div className={`presenter-stage-actor clip-${activeVideo.id.toLowerCase()}`}>
            <PresenterCanvas
              canvasRef={canvasRef}
              activeVideo={activeVideo}
              chromaParams={chromaParams}
              isPlaying={isPlaying}
              isMuted={isMuted}
              onVideoTimeUpdate={onVideoTimeUpdate}
              onVideoEnded={onVideoEnded}
            />
          </div>
        </div>

        {/* REGION 2: HUGE INDEPENDENT SLIDE VIEWPORT (84–86% width, maximum PPT size) */}
        <div className="slide-viewport" id="slide-viewport" aria-label="Slide Viewport">
          <PresentationViewer
            pdfPath={pdfPath}
            currentSlideNumber={displayedSlideNumber}
            isTransitioning={isTransitioning}
            transitionDirection={slideTransitionDirection}
          />
        </div>
      </div>

      {/* ── LAYER 3: Slide counter ── */}
      <div className="slide-counter-overlay" aria-label="Slide number">
        {padNum(displayedSlideNumber)} / {padNum(totalSlides)}
      </div>

      {/* ── LAYER 4: Fullscreen toggle — stacked ABOVE counter ── */}
      <button
        className={`fullscreen-btn${isFullscreen ? ' fullscreen-btn-active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        )}
      </button>

      {/* ── LAYER 5: Custom cursor — pointer-events:none, stays on top ── */}
      {isCursorVisible && (
        <div
          className={`custom-cursor custom-cursor-${cursorSide}${isPressed ? ' custom-cursor-pressed' : ''}`}
          style={{ left: cursorPos.x, top: cursorPos.y }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            {cursorSide === 'right' ? (
              <path d="M20 14l14 10-14 10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M28 14L14 24l14 10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </div>
      )}
    </div>
  );
};
