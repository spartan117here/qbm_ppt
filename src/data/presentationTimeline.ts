import { AGM_VIDEOS, AGMVideoItem, ScreenPosition } from './videoRegistry';

export type TransitionRecipeType = 'swipe_then_walk' | 'walk_only' | 'swipe_only' | 'none';

export interface SlideStepConfig {
  slideNumber: number; // 1-indexed (1 to 10)
  title: string;
  subtitle?: string;
  notes: string;
  presenterAnchor: ScreenPosition; // 'left' | 'right'
  explainVideo: AGMVideoItem;
  
  // Transition Recipe to next slide
  transitionRecipe: TransitionRecipeType;
  swipeVideo?: AGMVideoItem;
  walkVideo?: AGMVideoItem;
  swipeTriggerOffset?: number; // Exact second in swipe video where slide must change
  walkTriggerOffset?: number; // If walk-only, when slide should change (default 0.0s so new slide is visible during walk)
  targetAnchor?: ScreenPosition; // Anchor on the next slide
}

export interface PresentationConfig {
  title: string;
  pdfPath: string;
  totalSlides: number;
  slides: SlideStepConfig[];
}

export const PRESENTATION_DATA: PresentationConfig = {
  title: "Brand Positioning Strategy Presentation",
  pdfPath: "/presentation/Purple Green and Orange Modern Brand Positioning Presentation.pdf",
  totalSlides: 10,
  slides: [
    {
      slideNumber: 1,
      title: "Subhiksham Count Comparison",
      subtitle: "Regional store count and performance overview",
      notes: "Presenter anchors on far left, keeping all bar chart columns (TVL, CPT, etc.) fully readable.",
      presenterAnchor: "left",
      explainVideo: AGM_VIDEOS.EXPLAIN_1,
      transitionRecipe: "swipe_then_walk",
      swipeVideo: AGM_VIDEOS.SWIPE_2,
      walkVideo: AGM_VIDEOS.WALK_L_TO_R_2,
      swipeTriggerOffset: 3.58, // At hand push apex, Slide 2 appears, then AGM walks across
      targetAnchor: "right",
    },
    {
      slideNumber: 2,
      title: "Market Entry Conversion Funnel",
      subtitle: "Awareness to loyalty strengthens brand positioning strategy",
      notes: "Presenter explains on the right, pointing left to the 3D funnel stages.",
      presenterAnchor: "right",
      explainVideo: AGM_VIDEOS.EXPLAIN_3,
      transitionRecipe: "none",
      targetAnchor: "right",
    },
    {
      slideNumber: 3,
      title: "Sources of Innovative Brand Differentiation",
      subtitle: "Six creative approaches to building memorable brand positioning",
      notes: "Presenter stands on far-right safe margin, leaving all differentiation cards readable.",
      presenterAnchor: "right",
      explainVideo: AGM_VIDEOS.EXPLAIN_3,
      transitionRecipe: "walk_only",
      walkVideo: AGM_VIDEOS.WALK_R_TO_L,
      walkTriggerOffset: 0.0, // Slide 4 appears immediately, AGM walks across it from right to left
      targetAnchor: "left",
    },
    {
      slideNumber: 4,
      title: "Common Brand Positioning Pitfalls",
      subtitle: "Strategic mistakes to avoid for sustainable positioning success",
      notes: "Presenter stands in far-left safe margin, leaving both pitfall columns visible.",
      presenterAnchor: "left",
      explainVideo: AGM_VIDEOS.EXPLAIN_2,
      transitionRecipe: "swipe_only",
      swipeVideo: AGM_VIDEOS.SWIPE_1,
      swipeTriggerOffset: 2.46,
      targetAnchor: "left",
    },
    {
      slideNumber: 5,
      title: "Focused Analysis for Positioning",
      subtitle: "Key analytical lenses that generate meaningful positioning insights",
      notes: "Presenter anchors in the left whitespace, referencing the lenses on the right.",
      presenterAnchor: "left",
      explainVideo: AGM_VIDEOS.EXPLAIN_1,
      transitionRecipe: "swipe_then_walk",
      swipeVideo: AGM_VIDEOS.SWIPE_2,
      walkVideo: AGM_VIDEOS.WALK_L_TO_R,
      swipeTriggerOffset: 3.58, // Slide 6 appears, then AGM walks across the 5 timeline steps!
      targetAnchor: "right",
    },
    {
      slideNumber: 6,
      title: "Building a Brand Positioning Strategy",
      subtitle: "Systematic guide to creating a strong and competitive brand position",
      notes: "Presenter anchors on the right, referencing the strategy framework.",
      presenterAnchor: "right",
      explainVideo: AGM_VIDEOS.EXPLAIN_3,
      transitionRecipe: "walk_only",
      walkVideo: AGM_VIDEOS.WALK_R_TO_L,
      walkTriggerOffset: 0.0, // Slide 7 appears, AGM walks across from right to left
      targetAnchor: "left",
    },
    {
      slideNumber: 7,
      title: "Brand Positioning Key Elements",
      subtitle: "Core circular gear framework",
      notes: "Presenter anchors in the left safe margin, pointing to circular gear on the right.",
      presenterAnchor: "left",
      explainVideo: AGM_VIDEOS.EXPLAIN_2,
      transitionRecipe: "swipe_only",
      swipeVideo: AGM_VIDEOS.SWIPE_2,
      swipeTriggerOffset: 3.58,
      targetAnchor: "left",
    },
    {
      slideNumber: 8,
      title: "Brand Positioning Implementation Roadmap",
      subtitle: "A phased execution plan from strategy development to continuous optimization",
      notes: "Presenter explains on left, leaving the 6-phase roadmap visible.",
      presenterAnchor: "left",
      explainVideo: AGM_VIDEOS.EXPLAIN_1,
      transitionRecipe: "swipe_only",
      swipeVideo: AGM_VIDEOS.SWIPE_1,
      swipeTriggerOffset: 2.46,
      targetAnchor: "left",
    },
    {
      slideNumber: 9,
      title: "The Brand Positioning Evaluation",
      subtitle: "An ongoing process to keep positioning consistently relevant and competitive",
      notes: "Presenter occupies the left whitespace, referencing the 2x2 matrix on the right.",
      presenterAnchor: "left",
      explainVideo: AGM_VIDEOS.EXPLAIN_1,
      transitionRecipe: "swipe_then_walk",
      swipeVideo: AGM_VIDEOS.SWIPE_2,
      walkVideo: AGM_VIDEOS.WALK_L_TO_R_2,
      swipeTriggerOffset: 3.58, // Slide 10 appears, AGM walks right to closing pillars
      targetAnchor: "right",
    },
    {
      slideNumber: 10,
      title: "Pillars of Strong Brand Positioning",
      subtitle: "Core foundations that sustain long-term brand strength",
      notes: "Presenter anchors on the right, concluding with final gesture.",
      presenterAnchor: "right",
      explainVideo: AGM_VIDEOS.EXPLAIN_3,
      transitionRecipe: "none",
    },
  ],
};
