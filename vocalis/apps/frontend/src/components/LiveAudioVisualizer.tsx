import React, { useEffect, useRef } from 'react';

interface LiveAudioVisualizerProps {
  isActive: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const LiveAudioVisualizer: React.FC<LiveAudioVisualizerProps> = ({
  isActive,
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let phase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!isActive) {
        // Subtle resting flat line
        ctx.strokeStyle = 'rgba(122, 50, 227, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        return;
      }

      phase += 0.08;

      // Draw dynamic multi-layered sine wave
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#7a32e3');
      grad.addColorStop(0.5, '#ec4899');
      grad.addColorStop(1, '#fd873d');

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = grad;
      ctx.shadowColor = 'rgba(122, 50, 227, 0.4)';
      ctx.shadowBlur = 8;

      // Wave 1
      ctx.beginPath();
      for (let x = 0; x < w; x += 2) {
        const norm = x / w;
        const envelope = Math.sin(norm * Math.PI);
        const y = h / 2 + Math.sin(x * 0.04 + phase) * 14 * envelope + Math.cos(x * 0.02 - phase * 0.7) * 8 * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Wave 2 (subtle secondary harmonics)
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(253, 135, 61, 0.6)';
      ctx.beginPath();
      for (let x = 0; x < w; x += 3) {
        const norm = x / w;
        const envelope = Math.sin(norm * Math.PI);
        const y = h / 2 + Math.sin(x * 0.06 - phase * 1.2) * 10 * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [isActive]);

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '38px',
        width: '160px',
        borderRadius: '12px',
        backgroundColor: isActive ? 'rgba(122, 50, 227, 0.06)' : 'transparent',
        border: isActive ? '1px solid rgba(122, 50, 227, 0.2)' : '1px solid transparent',
        overflow: 'hidden',
        padding: '0 8px',
        transition: 'all 0.3s ease',
        ...style,
      }}
    >
      <canvas ref={canvasRef} width={160} height={38} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default LiveAudioVisualizer;
