import { useState, useRef, useEffect, useCallback } from 'react';
import { PRESENTATION_DATA, SlideStepConfig } from '../data/presentationTimeline';
import { AGM_VIDEOS, AGMVideoItem } from '../data/videoRegistry';

export type PresentationState =
  | 'IDLE_EXPLAINING'
  | 'SWIPING'
  | 'WALKING';

export type AnchorZone = 'left' | 'right' | 'walk-l-to-r' | 'walk-r-to-l';

export interface PresentationSyncReturn {
  currentSlideIndex: number;
  displayedSlideIndex: number;
  currentSlide: SlideStepConfig;
  totalSlides: number;
  state: PresentationState;
  activeVideo: AGMVideoItem;
  currentAnchor: AnchorZone;
  transitionDirection: 'next' | 'prev';
  isPlaying: boolean;
  isMuted: boolean;
  next: () => void;
  prev: () => void;
  jumpToSlide: (index: number) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  onVideoTimeUpdate: (currentTime: number) => void;
  onVideoEnded: () => void;
}

export function usePresentationSync(): PresentationSyncReturn {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [displayedSlideIndex, setDisplayedSlideIndex] = useState(0);
  const [state, setState] = useState<PresentationState>('IDLE_EXPLAINING');
  const [activeVideo, setActiveVideo] = useState<AGMVideoItem>(PRESENTATION_DATA.slides[0].explainVideo);
  const [transitionDirection, setTransitionDirection] = useState<'next' | 'prev'>('next');
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const pendingTargetIndexRef = useRef<number | null>(null);
  const slideTriggeredRef = useRef(false);

  const currentSlide = PRESENTATION_DATA.slides[currentSlideIndex];
  const totalSlides = PRESENTATION_DATA.totalSlides;

  // Determine Presenter Visual Anchor for safe positioning inside dedicated zone
  const currentAnchor: AnchorZone = (() => {
    if (state === 'WALKING') {
      return activeVideo.targetAnchor === 'left' ? 'left' : 'right';
    }
    // During swiping, stay anchored in current slide's presenter zone until cut to target zone
    return currentSlide.presenterAnchor === 'right' ? 'right' : 'left';
  })();

  // Handle Video TimeUpdate for exact gesture apex synchronization
  const onVideoTimeUpdate = useCallback((currentTime: number) => {
    if (state !== 'SWIPING' || slideTriggeredRef.current) return;

    // Use active swipe video's trigger time: 2.2s for holographic swipe, 1.5s for remote button press
    const triggerOffset = activeVideo.swipeTriggerTime ?? currentSlide.swipeTriggerOffset ?? 2.2;

    // At exact visual interaction moment: flip the presentation slide
    if (currentTime >= triggerOffset) {
      slideTriggeredRef.current = true;
      if (pendingTargetIndexRef.current !== null) {
        setDisplayedSlideIndex(pendingTargetIndexRef.current);
      }
    }
  }, [state, activeVideo, currentSlide]);

  // Start choreographed forward transition to next slide (ALWAYS swipe next.mp4)
  const startTransition = useCallback((nextIndex: number) => {
    if (nextIndex >= totalSlides) return;
    pendingTargetIndexRef.current = nextIndex;
    slideTriggeredRef.current = false;

    // NEXT / FORWARD: Play swipe next.mp4 (Holographic interaction)
    setTransitionDirection('next');
    setState('SWIPING');
    setActiveVideo(AGM_VIDEOS.SWIPE_NEXT);
  }, [totalSlides]);

  // Handle Video Ended for autonomous continuous performance
  const onVideoEnded = useCallback(() => {
    if (state === 'IDLE_EXPLAINING') {
      // 10-second explanation completed full duration!
      // Autonomously advance to the next transition without requiring user click
      if (currentSlideIndex < totalSlides - 1) {
        startTransition(currentSlideIndex + 1);
      }
    } else if (state === 'SWIPING') {
      // Swipe finished -> Cut cleanly to target slide & zone (no transit across PDF)
      const targetIdx = pendingTargetIndexRef.current;
      if (targetIdx !== null) {
        setCurrentSlideIndex(targetIdx);
        setDisplayedSlideIndex(targetIdx);
        setActiveVideo(PRESENTATION_DATA.slides[targetIdx].explainVideo);
      }
      setState('IDLE_EXPLAINING');
      pendingTargetIndexRef.current = null;
      slideTriggeredRef.current = false;
    } else if (state === 'WALKING') {
      const targetIdx = pendingTargetIndexRef.current;
      if (targetIdx !== null) {
        setCurrentSlideIndex(targetIdx);
        setDisplayedSlideIndex(targetIdx);
        setActiveVideo(PRESENTATION_DATA.slides[targetIdx].explainVideo);
      }
      setState('IDLE_EXPLAINING');
      pendingTargetIndexRef.current = null;
      slideTriggeredRef.current = false;
    }
  }, [state, currentSlideIndex, totalSlides, startTransition]);

  // Action: NEXT / Spacebar / Right Arrow / Right Click (Advance with swipe next.mp4)
  const next = useCallback(() => {
    // If currently in middle of transition, fast-forward to destination
    if (state !== 'IDLE_EXPLAINING') {
      const targetIdx = pendingTargetIndexRef.current;
      if (targetIdx !== null) {
        setCurrentSlideIndex(targetIdx);
        setDisplayedSlideIndex(targetIdx);
        setActiveVideo(PRESENTATION_DATA.slides[targetIdx].explainVideo);
      }
      setState('IDLE_EXPLAINING');
      pendingTargetIndexRef.current = null;
      slideTriggeredRef.current = false;
      return;
    }

    // In IDLE_EXPLAINING: advance to next slide using swipe next.mp4
    if (currentSlideIndex >= totalSlides - 1) return;
    startTransition(currentSlideIndex + 1);
  }, [state, currentSlideIndex, totalSlides, startTransition]);

  // Action: PREV / Left Arrow / Left Click (Go back with swipe reverse.mp4)
  const prev = useCallback(() => {
    if (state !== 'IDLE_EXPLAINING') {
      // If in middle of transition, fast-forward to destination
      const targetIdx = pendingTargetIndexRef.current;
      if (targetIdx !== null) {
        setCurrentSlideIndex(targetIdx);
        setDisplayedSlideIndex(targetIdx);
        setActiveVideo(PRESENTATION_DATA.slides[targetIdx].explainVideo);
      }
      setState('IDLE_EXPLAINING');
      pendingTargetIndexRef.current = null;
      slideTriggeredRef.current = false;
      return;
    }

    if (currentSlideIndex <= 0) return;

    // PREVIOUS / BACKWARD: Play swipe reverse.mp4 (Remote-button press)
    const prevIndex = currentSlideIndex - 1;
    pendingTargetIndexRef.current = prevIndex;
    slideTriggeredRef.current = false;
    setTransitionDirection('prev');
    setState('SWIPING');
    setActiveVideo(AGM_VIDEOS.SWIPE_REVERSE);
  }, [state, currentSlideIndex]);

  // Action: Jump to Slide
  const jumpToSlide = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= totalSlides) return;
    setTransitionDirection(targetIndex >= currentSlideIndex ? 'next' : 'prev');
    setCurrentSlideIndex(targetIndex);
    setDisplayedSlideIndex(targetIndex);
    setActiveVideo(PRESENTATION_DATA.slides[targetIndex].explainVideo);
    setState('IDLE_EXPLAINING');
    pendingTargetIndexRef.current = null;
    slideTriggeredRef.current = false;
  }, [totalSlides, currentSlideIndex]);

  // Action: Toggle Play/Pause
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Action: Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Keyboard navigation listener (Spacebar, Right Arrow, Left Arrow, Mute)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        next();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [next, prev, toggleMute]);

  return {
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
    togglePlay,
    toggleMute,
    onVideoTimeUpdate,
    onVideoEnded,
  };
}
