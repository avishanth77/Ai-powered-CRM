import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ size = 28, text = 'Loading...', fullScreen = false }) => {
  const content = (
    <div className="loading-spinner-container" role="status" aria-label={text || 'Loading'}>
      <Loader2 size={size} className="spinner-rotate" aria-hidden="true" />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );

  if (fullScreen) {
    return <div className="loading-fullscreen">{content}</div>;
  }

  return content;
};
