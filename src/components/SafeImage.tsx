import { Wrench } from 'lucide-react';
import { useState } from 'react';

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = '', fallbackTitle }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50 text-slate-500 border border-slate-200 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Wrench className="h-6 w-6 text-teal-700/70" aria-hidden="true" />
        {fallbackTitle && (
          <span className="mt-1.5 text-xs font-medium text-slate-600 px-2 text-center truncate max-w-full">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
