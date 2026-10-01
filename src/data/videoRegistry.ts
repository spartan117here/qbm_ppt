export type VideoCategory = 'explain' | 'walk' | 'swipe';
export type ScreenPosition = 'left' | 'right' | 'center';

export interface AGMVideoItem {
  id: string;
  name: string;
  category: VideoCategory;
  src: string;
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  anchor: ScreenPosition;
  targetAnchor?: ScreenPosition;
  swipeTriggerTime?: number; // timestamp in video when visual swipe gesture connects
  spokenDialogue?: string;
  hasAudio: boolean;
}

export const AGM_VIDEOS: Record<string, AGMVideoItem> = {
  EXPLAIN_1: {
    id: 'EXPLAIN_1',
    name: 'explain 1.mp4',
    category: 'explain',
    src: '/assets/agm/videos/explain/explain 1.mp4',
    duration: 10.0,
    width: 1920,
    height: 1080,
    fps: 24,
    anchor: 'left',
    spokenDialogue: "Let's begin by looking at our performance. We must understand these two key factors. As you can see by the charts on this side, we are projecting strong growth this year. This will lead us to success.",
    hasAudio: true,
  },
  EXPLAIN_2: {
    id: 'EXPLAIN_2',
    name: 'explain 2.mp4',
    category: 'explain',
    src: '/assets/agm/videos/explain/explain 2.mp4',
    duration: 10.0,
    width: 1920,
    height: 1080,
    fps: 24,
    anchor: 'left',
    spokenDialogue: "Let us look at the key performance indicators. As you can see here our revenue has grown significantly this quarter. This is a great result driven by our team.",
    hasAudio: true,
  },
  EXPLAIN_3: {
    id: 'EXPLAIN_3',
    name: 'explain 3.mp4',
    category: 'explain',
    src: '/assets/agm/videos/explain/explain 3.mp4',
    duration: 10.0,
    width: 1920,
    height: 1080,
    fps: 24,
    anchor: 'right',
    spokenDialogue: "Let's take a look at our financial performance. As you can see by the chart on the left, our revenue has grown by 10% this quarter. This is a great result for us.",
    hasAudio: true,
  },
  SWIPE_NEXT: {
    id: 'SWIPE_NEXT',
    name: 'swipe next.mp4',
    category: 'swipe',
    src: '/assets/agm/videos/swipe/swipe next.mp4',
    duration: 4.0,
    width: 1920,
    height: 1080,
    fps: 24,
    anchor: 'center',
    swipeTriggerTime: 2.2, // Holographic interaction apex where next slide appears
    hasAudio: false,
  },
  SWIPE_REVERSE: {
    id: 'SWIPE_REVERSE',
    name: 'swipe reverse.mp4',
    category: 'swipe',
    src: '/assets/agm/videos/swipe/swipe reverse.mp4',
    duration: 4.0,
    width: 1920,
    height: 1080,
    fps: 24,
    anchor: 'center',
    swipeTriggerTime: 1.5, // Remote-button press moment where previous slide appears
    hasAudio: false,
  },
  WALK_L_TO_R: {
    id: 'WALK_L_TO_R',
    name: 'walkin left to right.mp4',
    category: 'walk',
    src: '/assets/agm/videos/walk/walkin left to right.mp4',
    duration: 6.0,
    width: 1920,
    height: 1080,
    fps: 24,
    anchor: 'left',
    targetAnchor: 'right',
    hasAudio: false,
  },
  WALK_R_TO_L: {
    id: 'WALK_R_TO_L',
    name: 'walkin right to left.mp4',
    category: 'walk',
    src: '/assets/agm/videos/walk/walkin right to left.mp4',
    duration: 6.0,
    width: 1920,
    height: 1080,
    fps: 24,
    anchor: 'right',
    targetAnchor: 'left',
    hasAudio: false,
  },
  WALK_L_TO_R_2: {
    id: 'WALK_L_TO_R_2',
    name: 'walkin left to right 2.mp4',
    category: 'walk',
    src: '/assets/agm/videos/walk/walkin left to right 2.mp4',
    duration: 6.0,
    width: 1920,
    height: 1080,
    fps: 24,
    anchor: 'left',
    targetAnchor: 'right',
    hasAudio: false,
  },
};
