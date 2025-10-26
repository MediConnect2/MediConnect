import { type CSSProperties } from 'react';

const LoadingSpinner = ({ size = 24, color = '#000000' }) => {
  const spinnerStyle: CSSProperties = {
    width: size,
    height: size,
    border: `4px solid ${color}`,
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const keyframes = `
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <div style={spinnerStyle}></div>
    </>
  );
};

export default LoadingSpinner;