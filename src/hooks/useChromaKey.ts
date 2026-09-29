import { useEffect, useRef, useState, useCallback } from 'react';
import { WebGLChromaKeyer, ChromaKeyParams, DEFAULT_CHROMA_PARAMS } from '../utils/chromaKeyShader';

export function useChromaKey(
  videoSource: React.RefObject<HTMLVideoElement | null> | (() => HTMLVideoElement | null),
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  params: ChromaKeyParams = DEFAULT_CHROMA_PARAMS
) {
  const [isReady, setIsReady] = useState(false);
  const keyerRef = useRef<WebGLChromaKeyer | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize WebGL keyer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure fixed 1080p canvas buffer to prevent buffer reallocations & frame drops
    if (canvas.width !== 1920) canvas.width = 1920;
    if (canvas.height !== 1080) canvas.height = 1080;

    const keyer = new WebGLChromaKeyer(canvas);
    keyerRef.current = keyer;
    setIsReady(true);

    return () => {
      keyer.destroy();
      keyerRef.current = null;
    };
  }, [canvasRef]);

  // Main rendering loop: continuous 60fps WebGL processing
  const renderFrame = useCallback(() => {
    const video = typeof videoSource === 'function' ? videoSource() : videoSource.current;
    const canvas = canvasRef.current;
    const keyer = keyerRef.current;

    // Only render when video frame data is ready; preserves previous frame on transition
    if (video && canvas && keyer && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      keyer.render(video, params);
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [videoSource, canvasRef, params]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [renderFrame]);

  return {
    isReady,
  };
}
