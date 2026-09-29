import { useState, useRef, useEffect, useCallback } from 'react';
import { PRESENTATION_DATA, SlideStepConfig } from '../data/presentationTimeline';
import { AGMVideoItem } from '../data/videoRegistry';

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
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const pendingTargetIndexRef = useRef<number | null>(null);
  const slideTriggeredRef = useRef(false);

  const currentSlide = PRESENTATION_DATA.slides[currentSlideIndex];
  const totalSlides = PRESENTATION_DATA.totalSlides;

  // Determine Presenter Visual Anchor for safe positioning & continuous walking
  const currentAnchor: AnchorZone = (() => {
    if (state === 'WALKING') {
      if (activeVideo.id === 'WALK_R_TO_L') return 'walk-r-to-l';
      return 'walk-l-to-r';
    }
    if (state === 'SWIPING') {
      return activeVideo.anchor === 'right' ? 'right' : 'left';
    }
    return currentSlide.presenterAnchor === 'right' ? 'right' : 'left';
  })();

  // Handle Video TimeUpdate for exact gesture apex synchronization
  const onVideoTimeUpdate = useCallback((currentTime: number) => {
    if (state !== 'SWIPING' || slideTriggeredRef.current) return;

    const triggerOffset = currentSlide.swipeTriggerOffset ?? 2.5;

    // At exact hand push apex: flip the presentation slide
    if (currentTime >= triggerOffset) {
      slideTriggeredRef.current = true;
      if (pendingTargetIndexRef.current !== null) {
        setDisplayedSlideIndex(pendingTargetIndexRef.current);
      }
    }
  }, [state, currentSlide]);

  // Start choreographed transition to next slide
  const startTransition = useCallback((nextIndex: number) => {
    if (nextIndex >= totalSlides) return;
    const recipe = currentSlide.transitionRecipe;
    pendingTargetIndexRef.current = nextIndex;
    slideTriggeredRef.current = false;

    if (recipe === 'swipe_then_walk' && currentSlide.swipeVideo) {
      setState('SWIPING');
      setActiveVideo(currentSlide.swipeVideo);
    } else if (recipe === 'walk_only' && currentSlide.walkVideo) {
      // New slide is visible immediately behind AGM while he walks
      setDisplayedSlideIndex(nextIndex);
      setState('WALKING');
      setActiveVideo(currentSlide.walkVideo);
    } else if (recipe === 'swipe_only' && currentSlide.swipeVideo) {
      setState('SWIPING');
      setActiveVideo(currentSlide.swipeVideo);
    } else {
      // Direct slide transition
      setCurrentSlideIndex(nextIndex);
      setDisplayedSlideIndex(nextIndex);
      setActiveVideo(PRESENTATION_DATA.slides[nextIndex].explainVideo);
      setState('IDLE_EXPLAINING');
      pendingTargetIndexRef.current = null;
    }
  }, [currentSlide, totalSlides]);

  // Handle Video Ended for autonomous continuous performance
  const onVideoEnded = useCallback(() => {
    if (state === 'IDLE_EXPLAINING') {
      // 10-second explanation completed full duration!
      // Autonomously advance to the next transition without requiring user click
      if (currentSlideIndex < totalSlides - 1) {
        startTransition(currentSlideIndex + 1);
      }
    } else if (state === 'SWIPING') {
      // Swipe finished
      const targetIdx = pendingTargetIndexRef.current;
      if (currentSlide.transitionRecipe === 'swipe_then_walk' && currentSlide.walkVideo && targetIdx !== null) {
        // Automatic Progression: SWIPE -> WALK across new slide!
        setState('WALKING');
        setActiveVideo(currentSlide.walkVideo);
      } else {
        // SWIPE -> EXPLAIN
        if (targetIdx !== null) {
          setCurrentSlideIndex(targetIdx);
          setDisplayedSlideIndex(targetIdx);
          setActiveVideo(PRESENTATION_DATA.slides[targetIdx].explainVideo);
        }
        setState('IDLE_EXPLAINING');
        pendingTargetIndexRef.current = null;
        slideTriggeredRef.current = false;
      }
    } else if (state === 'WALKING') {
      // Walk finished -> AGM has reached destination safe zone on new slide!
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
  }, [state, currentSlideIndex, totalSlides, currentSlide, startTransition]);

  // Action: NEXT / Spacebar (Manual Skip / Advance Control)
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

    // In IDLE_EXPLAINING: user wants to advance early
    if (currentSlideIndex >= totalSlides - 1) return;
    startTransition(currentSlideIndex + 1);
  }, [state, currentSlideIndex, totalSlides, startTransition]);

  // Action: PREV (Back to previous slide)
  const prev = useCallback(() => {
    if (state !== 'IDLE_EXPLAINING') {
      // Cancel transition and return to current slide idle
      setState('IDLE_EXPLAINING');
      pendingTargetIndexRef.current = null;
      slideTriggeredRef.current = false;
      return;
    }

    if (currentSlideIndex <= 0) return;

    const prevIndex = currentSlideIndex - 1;
    setCurrentSlideIndex(prevIndex);
    setDisplayedSlideIndex(prevIndex);
    setActiveVideo(PRESENTATION_DATA.slides[prevIndex].explainVideo);
    setState('IDLE_EXPLAINING');
    pendingTargetIndexRef.current = null;
    slideTriggeredRef.current = false;
  }, [state, currentSlideIndex]);

  // Action: Jump to Slide
  const jumpToSlide = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= totalSlides) return;
    setCurrentSlideIndex(targetIndex);
    setDisplayedSlideIndex(targetIndex);
    setActiveVideo(PRESENTATION_DATA.slides[targetIndex].explainVideo);
    setState('IDLE_EXPLAINING');
    pendingTargetIndexRef.current = null;
    slideTriggeredRef.current = false;
  }, [totalSlides]);

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
