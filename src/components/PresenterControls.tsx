import React from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Layers,
  Sliders,
  Maximize2,
  Minimize2,
  UserCheck,
  MoveHorizontal,
  HandMetal,
} from 'lucide-react';
import { SlideStepConfig } from '../data/presentationTimeline';
import { PresentationState } from '../hooks/usePresentationSync';
import { AGMVideoItem } from '../data/videoRegistry';

interface PresenterControlsProps {
  currentSlideIndex: number;
  totalSlides: number;
  currentSlide: SlideStepConfig;
  state: PresentationState;
  activeVideo: AGMVideoItem;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  onNext: () => void;
  onPrev: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenDrawer: () => void;
  onOpenSettings: () => void;
}

export const PresenterControls: React.FC<PresenterControlsProps> = ({
  currentSlideIndex,
  totalSlides,
  currentSlide,
  state,
  activeVideo,
  isPlaying,
  isMuted,
  isFullscreen,
  onNext,
  onPrev,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onOpenDrawer,
  onOpenSettings,
}) => {
  const isFirstSlide = currentSlideIndex === 0;
  const isLastSlide = currentSlideIndex === totalSlides - 1;

  const getActionBadge = () => {
    if (state === 'WALKING') {
      return (
        <span className="hud-badge hud-badge-walk">
          <MoveHorizontal size={14} className="hud-icon-spin" />
          AGM Walking Across Slide
        </span>
      );
    }
    if (state === 'SWIPING') {
      return (
        <span className="hud-badge hud-badge-swipe">
          <HandMetal size={14} />
          AGM Swipe Gesture Transition
        </span>
      );
    }

    return (
      <span className="hud-badge hud-badge-explain">
        <UserCheck size={14} />
        AGM Explaining ({currentSlide.presenterAnchor === 'left' ? 'Left Anchor' : 'Right Anchor'})
      </span>
    );
  };

  return (
    <nav className="hud-controls-dock" aria-label="Presentation controls">
      {/* Left section: Slide Title & AGM Status */}
      <div className="hud-dock-section hud-dock-left">
        <div className="hud-slide-meta">
          <span className="hud-slide-num">
            {String(currentSlideIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </span>
          <span className="hud-slide-title" title={currentSlide.title}>
            {currentSlide.title}
          </span>
        </div>
        <div className="hud-badges-row">
          {getActionBadge()}
          {activeVideo.spokenDialogue && (
            <span className="hud-dialogue-snippet" title={activeVideo.spokenDialogue}>
              "{activeVideo.spokenDialogue}"
            </span>
          )}
        </div>
      </div>

      {/* Center section: Navigation & Playback */}
      <div className="hud-dock-section hud-dock-center">
        <button
          onClick={onPrev}
          disabled={isFirstSlide}
          className="hud-btn hud-btn-nav"
          title="Previous slide / action (Left Arrow)"
          aria-label="Previous slide"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={onTogglePlay}
          className="hud-btn hud-btn-play"
          title={isPlaying ? 'Pause Presenter' : 'Play Presenter'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button
          onClick={onNext}
          disabled={isLastSlide && state === 'IDLE_EXPLAINING'}
          className="hud-btn hud-btn-nav hud-btn-primary"
          title="Next slide / action (Right Arrow / Spacebar)"
          aria-label="Next slide"
        >
          <ChevronRight size={20} />
          <span className="hud-btn-label">{state !== 'IDLE_EXPLAINING' ? 'Skip' : 'Next'}</span>
        </button>
      </div>

      {/* Right section: Utilities & Keyboard shortcuts */}
      <div className="hud-dock-section hud-dock-right">
        <div className="hud-shortcut-hints">
          <span className="hud-kbd">Space</span> / <span className="hud-kbd">→</span> Next
          <span className="hud-kbd-divider">•</span>
          <span className="hud-kbd">←</span> Prev
        </div>

        <div className="hud-actions-group">
          <button
            onClick={onToggleMute}
            className={`hud-btn hud-btn-tool ${isMuted ? 'hud-btn-active' : ''}`}
            title={isMuted ? 'Unmute Presenter (M)' : 'Mute Presenter (M)'}
            aria-label="Toggle mute"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            onClick={onOpenDrawer}
            className="hud-btn hud-btn-tool"
            title="All Slides Grid"
            aria-label="Open slides grid"
          >
            <Layers size={18} />
          </button>

          <button
            onClick={onOpenSettings}
            className="hud-btn hud-btn-tool"
            title="Chroma Key Tuning"
            aria-label="Chroma key settings"
          >
            <Sliders size={18} />
          </button>

          <button
            onClick={onToggleFullscreen}
            className="hud-btn hud-btn-tool"
            title="Toggle Fullscreen"
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>
    </nav>
  );
};
