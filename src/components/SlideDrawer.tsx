import React from 'react';
import { X, CheckCircle, Video, Footprints, Sparkles } from 'lucide-react';
import { PRESENTATION_DATA } from '../data/presentationTimeline';

interface SlideDrawerProps {
  isOpen: boolean;
  currentSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onClose: () => void;
}

export const SlideDrawer: React.FC<SlideDrawerProps> = ({
  isOpen,
  currentSlideIndex,
  onSelectSlide,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="slide-drawer-overlay" onClick={onClose}>
      <div className="slide-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-drawer-header">
          <div className="slide-drawer-title-group">
            <h3 className="slide-drawer-heading">Presentation Deck Overview</h3>
            <span className="slide-drawer-count">{PRESENTATION_DATA.totalSlides} Executive Slides</span>
          </div>
          <button className="slide-drawer-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="slide-drawer-grid">
          {PRESENTATION_DATA.slides.map((slide, idx) => {
            const isCurrent = idx === currentSlideIndex;
            return (
              <div
                key={slide.slideNumber}
                className={`slide-card ${isCurrent ? 'slide-card-active' : ''}`}
                onClick={() => {
                  onSelectSlide(idx);
                  onClose();
                }}
              >
                <div className="slide-card-header">
                  <span className="slide-card-num">Slide {String(slide.slideNumber).padStart(2, '0')}</span>
                  {isCurrent && (
                    <span className="slide-card-active-pill">
                      <CheckCircle size={12} /> Active
                    </span>
                  )}
                </div>

                <div className="slide-card-body">
                  <h4 className="slide-card-title">{slide.title}</h4>
                  {slide.subtitle && <p className="slide-card-subtitle">{slide.subtitle}</p>}
                </div>

                <div className="slide-card-footer">
                  <span className="slide-card-badge">
                    <Video size={12} /> {slide.explainVideo.name}
                  </span>
                  {slide.transitionRecipe !== 'none' && (
                    <span className="slide-card-badge slide-card-badge-trans">
                      {slide.transitionRecipe.includes('walk') ? <Footprints size={12} /> : <Sparkles size={12} />}
                      {slide.transitionRecipe.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className="slide-card-anchor">
                    Anchor: {slide.presenterAnchor}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
