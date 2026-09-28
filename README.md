# agm-presenter

AGM Presenter application architecture.

## Project Structure

```
agm-presenter/
│
├── public/
│   └── assets/
│       └── agm/
│           ├── reference/
│           │
│           └── videos/
│               ├── explain/
│               ├── walk/
│               └── swipe/
│
├── presentation/
│
├── src/
│   ├── components/
│   ├── data/
│   ├── hooks/
│   └── utils/
│
├── README.md
└── package.json
```

## Folder Purposes

### `public/assets/agm/videos/explain/`
AGM explaining videos.

### `public/assets/agm/videos/walk/`
AGM walking videos (e.g., Left → Right, Right → Left).

### `public/assets/agm/videos/swipe/`
AGM swipe gesture videos.

### `public/assets/agm/reference/`
AGM master reference image.

### `presentation/`
Presentation / PPT source files (to be added).

### `src/`
- `components/`: UI and presenter components.
- `data/`: Presentation metadata, slide mappings, and video index configurations.
- `hooks/`: Custom state and presenter synchronization hooks.
- `utils/`: Helper utilities and handlers.
