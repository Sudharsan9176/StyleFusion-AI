import React, { useState } from 'react';
import { Columns2, MoveHorizontal } from 'lucide-react';
import { SafeImage } from './SafeImage';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Original Photo',
  afterLabel = 'AI Try-On Result',
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const [mode, setMode] = useState<'slider' | 'side-by-side'>('slider');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600">
          {mode === 'slider' ? 'Drag slider to compare Before / After' : 'Side-by-Side Comparison'}
        </span>
        <div className="inline-flex border border-zinc-200 bg-zinc-50 p-0.5">
          <button
            type="button"
            onClick={() => setMode('slider')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === 'slider' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
            <span>Slider</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('side-by-side')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === 'side-by-side' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Split View</span>
          </button>
        </div>
      </div>

      {mode === 'side-by-side' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-zinc-200 bg-zinc-50">
            <div className="px-3 py-2 border-b border-zinc-200 text-xs font-medium text-zinc-600 bg-white">
              {beforeLabel}
            </div>
            <div className="aspect-[3/4] overflow-hidden">
              <SafeImage src={beforeUrl} alt={beforeLabel} className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="border border-zinc-900 bg-zinc-50">
            <div className="px-3 py-2 border-b border-zinc-200 text-xs font-semibold text-zinc-950 bg-white">
              {afterLabel}
            </div>
            <div className="aspect-[3/4] overflow-hidden">
              <SafeImage src={afterUrl} alt={afterLabel} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative aspect-[3/4] max-h-[560px] w-full mx-auto overflow-hidden border border-zinc-200 bg-zinc-100 select-none">
          {/* After (full underneath) */}
          <SafeImage
            src={afterUrl}
            alt={afterLabel}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Before (clipped by slider position) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <SafeImage
              src={beforeUrl}
              alt={beforeLabel}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Divider Line */}
          <div
            className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.45)] pointer-events-none"
            style={{ left: `${position}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-950 text-white border-2 border-white flex items-center justify-center shadow-md">
              <MoveHorizontal className="w-4 h-4" />
            </div>
          </div>

          {/* Corner labels */}
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 text-white text-[11px] font-medium pointer-events-none">
            {beforeLabel}
          </span>
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-black/70 text-white text-[11px] font-medium pointer-events-none">
            {afterLabel}
          </span>

          {/* Accessible range input overlaid cleanly */}
          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            aria-label="Before and after comparison slider"
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
          />
        </div>
      )}
    </div>
  );
}
