import React, { useState } from 'react';
import { Shirt } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = '', fallbackTitle, ...rest }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-zinc-100 text-zinc-400 p-4 text-center ${className}`}
        role="img"
        aria-label={alt || fallbackTitle || 'Garment preview'}
      >
        <Shirt className="w-8 h-8 mb-2 stroke-[1.25]" />
        {fallbackTitle && <span className="text-xs font-medium text-zinc-500 line-clamp-2">{fallbackTitle}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
}
