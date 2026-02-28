import { useEffect, useRef, useMemo } from 'react';
import { colorFamilies, getRandomColorFamily, type ColorFamilyName } from '@/styles/design-system';

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

/**
 * Ambient watercolor background -- mirrors the mobile app's
 * color dot system from App.js. The mobile version renders
 * overlapping circles with random offsets and applies two
 * heavy BlurView layers (intensity 100 + 60) on top, creating
 * soft glowing orbs. On web we replicate this by drawing
 * pre-blurred radial gradients onto a canvas.
 */
export default function WatercolorBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Generate a stable set of dots on mount
  const dots = useMemo(() => generateDots(8), []);

  useEffect(() => {
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
      cancelAnimationFrame(animationRef.current);
    };
  }, [dots]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}

function generateDots(count: number): WatercolorDot[] {
  const dots: WatercolorDot[] = [];
  const family: ColorFamilyName = getRandomColorFamily();
  const familyColors = colorFamilies[family];

  for (let i = 0; i < count; i++) {
    // Mirroring App.js blotShapes generation
    const color = familyColors[Math.floor(Math.random() * familyColors.length)];
    dots.push({
      x: Math.random(),
      y: Math.random(),
      size: 120 + Math.random() * 200, // 120-320px
      color,
      opacity: 0.04 + Math.random() * 0.08, // Very subtle, 0.04-0.12
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
