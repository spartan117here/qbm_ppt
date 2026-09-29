import React from 'react';
import { X, RotateCcw, Sliders, Check } from 'lucide-react';
import { ChromaKeyParams, DEFAULT_CHROMA_PARAMS } from '../utils/chromaKeyShader';

interface ChromaKeySettingsModalProps {
  isOpen: boolean;
  params: ChromaKeyParams;
  onUpdateParam: <K extends keyof ChromaKeyParams>(key: K, value: ChromaKeyParams[K]) => void;
  onReset: () => void;
  onClose: () => void;
}

export const ChromaKeySettingsModal: React.FC<ChromaKeySettingsModalProps> = ({
  isOpen,
  params,
  onUpdateParam,
  onReset,
  onClose,
}) => {
  if (!isOpen) return null;

  const hexColor = (() => {
    const r = Math.round(params.keyColor[0] * 255).toString(16).padStart(2, '0');
    const g = Math.round(params.keyColor[1] * 255).toString(16).padStart(2, '0');
    const b = Math.round(params.keyColor[2] * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  })();

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    onUpdateParam('keyColor', [r, g, b]);
  };

  return (
    <div className="chroma-modal-overlay" onClick={onClose}>
      <div className="chroma-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chroma-modal-header">
          <div className="chroma-modal-title">
            <Sliders size={18} />
            <span>Chroma Key & Video Calibration</span>
          </div>
          <button className="chroma-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="chroma-modal-body">
          {/* Key Color Picker */}
          <div className="chroma-control-group">
            <div className="chroma-label-row">
              <label>Target Green Screen Key Color</label>
              <span className="chroma-val-tag">{hexColor.toUpperCase()}</span>
            </div>
            <div className="chroma-color-picker-row">
              <input
                type="color"
                value={hexColor}
                onChange={handleColorChange}
                className="chroma-color-input"
              />
              <span className="chroma-color-preview-sample" style={{ backgroundColor: hexColor }} />
              <button
                className="chroma-preset-btn"
                onClick={() => onUpdateParam('keyColor', DEFAULT_CHROMA_PARAMS.keyColor)}
              >
                Reset Studio Green
              </button>
            </div>
          </div>

          {/* Similarity Slider */}
          <div className="chroma-control-group">
            <div className="chroma-label-row">
              <label>Green Similarity Cutoff</label>
              <span className="chroma-val-tag">{params.similarity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.80"
              step="0.01"
              value={params.similarity}
              onChange={(e) => onUpdateParam('similarity', parseFloat(e.target.value))}
              className="chroma-slider"
            />
            <span className="chroma-desc">Controls how aggressively green background pixels are removed.</span>
          </div>

          {/* Smoothness Slider */}
          <div className="chroma-control-group">
            <div className="chroma-label-row">
              <label>Edge Smoothness</label>
              <span className="chroma-val-tag">{params.smoothness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.40"
              step="0.01"
              value={params.smoothness}
              onChange={(e) => onUpdateParam('smoothness', parseFloat(e.target.value))}
              className="chroma-slider"
            />
            <span className="chroma-desc">Softens the matte edge around hair, silhouette, and suit.</span>
          </div>

          {/* Despill Suppression */}
          <div className="chroma-control-group">
            <div className="chroma-label-row">
              <label>Green Spill Suppression (Despill)</label>
              <span className="chroma-val-tag">{params.spill.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.02"
              value={params.spill}
              onChange={(e) => onUpdateParam('spill', parseFloat(e.target.value))}
              className="chroma-slider"
            />
            <span className="chroma-desc">Eliminates green bounce reflections on clothing and edges.</span>
          </div>

          {/* Brightness */}
          <div className="chroma-control-group">
            <div className="chroma-label-row">
              <label>Presenter Brightness</label>
              <span className="chroma-val-tag">{params.brightness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.01"
              value={params.brightness}
              onChange={(e) => onUpdateParam('brightness', parseFloat(e.target.value))}
              className="chroma-slider"
            />
          </div>

          {/* Contrast */}
          <div className="chroma-control-group">
            <div className="chroma-label-row">
              <label>Presenter Contrast</label>
              <span className="chroma-val-tag">{params.contrast.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.01"
              value={params.contrast}
              onChange={(e) => onUpdateParam('contrast', parseFloat(e.target.value))}
              className="chroma-slider"
            />
          </div>
        </div>

        <div className="chroma-modal-footer">
          <button className="chroma-btn-reset" onClick={onReset}>
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <button className="chroma-btn-apply" onClick={onClose}>
            <Check size={14} /> Close & Keep
          </button>
        </div>
      </div>
    </div>
  );
};
