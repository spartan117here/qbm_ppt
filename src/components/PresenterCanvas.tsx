import React, { useRef, useEffect, useCallback } from 'react';
import { useChromaKey } from '../hooks/useChromaKey';
import { ChromaKeyParams } from '../utils/chromaKeyShader';
import { AGM_VIDEOS, AGMVideoItem } from '../data/videoRegistry';

interface PresenterCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeVideo: AGMVideoItem;
  chromaParams: ChromaKeyParams;
  isPlaying: boolean;
  isMuted: boolean;
  onVideoTimeUpdate: (currentTime: number) => void;
  onVideoEnded: () => void;
}

export const PresenterCanvas: React.FC<PresenterCanvasProps> = ({
  canvasRef,
  activeVideo,
  chromaParams,
  isPlaying,
  isMuted,
  onVideoTimeUpdate,
  onVideoEnded,
}) => {
  // Preloaded Video Elements Pool (all 9 clips stay in memory for zero-gap cuts)
  const videoElementsRef = useRef<Record<string, HTMLVideoElement>>({});
  const activeVideoRef = useRef<AGMVideoItem>(activeVideo);
  activeVideoRef.current = activeVideo;

  const getActiveVideoElement = useCallback(() => {
    return videoElementsRef.current[activeVideoRef.current.id] || null;
  }, []);

  // Real-time WebGL Chroma Key processor with zero-flicker frame retention
  useChromaKey(getActiveVideoElement, canvasRef, chromaParams);

  // Synchronize active video playback when activeVideo changes
  useEffect(() => {
    const activeEl = videoElementsRef.current[activeVideo.id];
    if (!activeEl) return;

    // Pause all other video elements in the pool
    Object.entries(videoElementsRef.current).forEach(([id, el]) => {
      if (id !== activeVideo.id && !el.paused) {
        el.pause();
      }
    });

    activeEl.muted = isMuted;
    activeEl.currentTime = 0;

    if (isPlaying) {
      const playPromise = activeEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Fallback to muted autoplay if browser blocks audio
          console.warn('Autoplay unmuted blocked, falling back to muted:', err);
          activeEl.muted = true;
          activeEl.play().catch(console.error);
        });
      }
    } else {
      activeEl.pause();
    }
  }, [activeVideo.id, isPlaying, isMuted]);

  // Synchronize play/pause state
  useEffect(() => {
    const activeEl = videoElementsRef.current[activeVideo.id];
    if (!activeEl) return;

    if (isPlaying) {
      activeEl.play().catch(() => {});
    } else {
      activeEl.pause();
    }
  }, [isPlaying, activeVideo.id]);

  // Synchronize mute state
  useEffect(() => {
    const activeEl = videoElementsRef.current[activeVideo.id];
    if (activeEl) {
      activeEl.muted = isMuted;
    }
  }, [isMuted, activeVideo.id]);

  return (
    <div className="presenter-canvas-container">
      {/* Preloaded Video Pool: all 9 AGM clips primed in memory */}
      <div className="presenter-video-pool" style={{ display: 'none' }}>
        {Object.values(AGM_VIDEOS).map((videoItem) => (
          <video
            key={videoItem.id}
            ref={(el) => {
              if (el) videoElementsRef.current[videoItem.id] = el;
            }}
            src={videoItem.src}
            preload="auto"
            playsInline
            muted={videoItem.id === activeVideo.id ? isMuted : true}
            crossOrigin="anonymous"
            onTimeUpdate={(e) => {
              if (activeVideo.id === videoItem.id) {
                onVideoTimeUpdate(e.currentTarget.currentTime);
              }
            }}
            onEnded={() => {
              if (activeVideo.id === videoItem.id) {
                // If explain clip in idle mode, loop seamlessly to keep presenter alive
                if (videoItem.category === 'explain') {
                  const el = videoElementsRef.current[videoItem.id];
                  if (el) {
                    el.currentTime = 0;
                    el.play().catch(() => {});
                  }
                }
                onVideoEnded();
              }
            }}
          />
        ))}
      </div>

      {/* Foreground transparent canvas with real-time green-screen removal */}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="presenter-output-canvas"
      />
    </div>
  );
};
