import { useEffect, useRef, useMemo } from 'react';

/**
 * Ambient watercolor background -- mirrors the mobile app's
 * color dot system from App.js. The mobile version renders
 * overlapping circles with random offsets and applies two
 * heavy BlurView layers (intensity 100 + 60) on top, creating
 * soft glowing orbs. On web we replicate this by drawing
 * pre-blurred radial gradients onto a canvas.
 *
 * Self-contained -- no dependency on design-system.ts exports.
 * Uses a muted palette of 8 colors drawn as soft radial gradients
 * at very low opacity (0.03-0.08) for an ambient effect.
 */

// Muted palette for ambient orbs (works in both light and dark themes)
const PALETTE = [
  '#C4B8D8', // soft lavender
  '#D4A5A5', // pale rose
  '#A8C5A0', // muted sage
  '#E8D5B7', // warm cream
  '#B8C8D8', // steel blue mist
  '#D8C4D8', // dusty mauve
  '#8B7355', // warm umber
  '#7A9E7E', // forest sage
];

interface WatercolorDot {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export default function WatercolorBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate a stable set of dots on mount
  const dots = useMemo(() => generateDots(8), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDots(ctx, dots, window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, [dots]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}

function generateDots(count: number): WatercolorDot[] {
  const dots: WatercolorDot[] = [];

  for (let i = 0; i < count; i++) {
    const color = PALETTE[i % PALETTE.length];
    dots.push({
      x: Math.random(),
      y: Math.random(),
      size: 120 + Math.random() * 200,
      color,
      opacity: 0.03 + Math.random() * 0.05, // Very subtle: 0.03-0.08
      scaleX: 0.6 + Math.random() * 0.8,
      scaleY: 0.6 + Math.random() * 0.8,
      rotation: Math.random() * Math.PI * 2,
    });
  }

  return dots;
}

function drawDots(
  ctx: CanvasRenderingContext2D,
  dots: WatercolorDot[],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);

  for (const dot of dots) {
    const x = dot.x * width;
    const y = dot.y * height;
    const radius = dot.size / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dot.rotation);
    ctx.scale(dot.scaleX, dot.scaleY);
    ctx.globalAlpha = dot.opacity;

    // Soft radial gradient to mimic the blur effect
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, dot.color);
    gradient.addColorStop(0.4, dot.color);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
