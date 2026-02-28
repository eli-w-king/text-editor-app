/**
 * OnboardingPage -- Animated 3-slide first-time user flow
 *
 * PLATFORM: Web (Desktop/Browser)
 * AESTHETIC: visionOS-inspired frosted glass, premium, minimal
 *
 * Shown once after a user's first login. Completion state is persisted
 * to localStorage so it never appears again for the same user.
 *
 * Slides:
 *   1. Welcome -- introduces the app identity
 *   2. Features -- highlights core capabilities
 *   3. Get Started -- final CTA to enter the editor
 *
 * Animation: slides cross-fade with a subtle translateY shift.
 * Keyboard navigation: ArrowLeft, ArrowRight, Enter.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONBOARDING_COMPLETE_KEY = 'inlay_onboarding_complete';
const TRANSITION_MS = 500;
const TOTAL_SLIDES = 3;

// ---------------------------------------------------------------------------
// Persistence helpers (exported for route guards in main.tsx)
// ---------------------------------------------------------------------------

/** Check if onboarding has been completed. Scoped by userId when available. */
export function hasCompletedOnboarding(userId?: string): boolean {
  try {
    if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true') return true;
    if (userId && localStorage.getItem(`${ONBOARDING_COMPLETE_KEY}_${userId}`) === 'true') return true;
    // Migration: check old key name for backward compatibility
    if (localStorage.getItem('writer_onboarding_complete') === 'true') return true;
    if (userId && localStorage.getItem(`writer_onboarding_complete_${userId}`) === 'true') return true;
    return false;
  } catch { return false; }
}

/** Mark onboarding as completed. Sets both global and user-scoped keys. */
export function markOnboardingComplete(userId?: string): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    if (userId) localStorage.setItem(`${ONBOARDING_COMPLETE_KEY}_${userId}`, 'true');
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

function usePrefersDark(): boolean {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      // Check both old and new key names for backward compatibility
      const s = localStorage.getItem('writer-theme');
      if (s === 'dark') return true;
      if (s === 'light') return false;
    } catch { /* ignore */ }
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => { try { if (!localStorage.getItem('writer-theme')) setDark(e.matches); } catch { setDark(e.matches); } };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return dark;
}

interface Palette { pageBg: string; cardBg: string; cardBorder: string; cardShadow: string; innerGlow: string; text: string; textMuted: string; textSubtle: string; dotActive: string; dotInactive: string; btnBg: string; btnText: string; btnHoverBg: string; btn2Bg: string; btn2Border: string; btn2Text: string; btn2HoverBg: string; featBg: string; featBorder: string; featIconBg: string; featIconColor: string; }

const dark: Palette = { pageBg:'linear-gradient(145deg,#0a0a0a 0%,#111118 35%,#0e1117 65%,#0a0a10 100%)', cardBg:'rgba(255,255,255,0.04)', cardBorder:'1px solid rgba(255,255,255,0.08)', cardShadow:'0 16px 72px rgba(0,0,0,0.5),0 2px 20px rgba(0,0,0,0.3)', innerGlow:'linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.01) 50%,transparent 100%)', text:'#ECEDEE', textMuted:'rgba(236,237,238,0.4)', textSubtle:'rgba(236,237,238,0.55)', dotActive:'rgba(255,255,255,0.9)', dotInactive:'rgba(255,255,255,0.15)', btnBg:'rgba(255,255,255,0.95)', btnText:'#0a0a0a', btnHoverBg:'rgba(255,255,255,1)', btn2Bg:'rgba(255,255,255,0.06)', btn2Border:'1px solid rgba(255,255,255,0.12)', btn2Text:'rgba(236,237,238,0.7)', btn2HoverBg:'rgba(255,255,255,0.1)', featBg:'rgba(255,255,255,0.03)', featBorder:'1px solid rgba(255,255,255,0.06)', featIconBg:'rgba(255,255,255,0.06)', featIconColor:'rgba(236,237,238,0.7)' };
const light: Palette = { pageBg:'linear-gradient(145deg,#faf9f7 0%,#f5f0eb 35%,#efe8e0 65%,#f2ede7 100%)', cardBg:'rgba(255,255,255,0.55)', cardBorder:'1px solid rgba(255,255,255,0.7)', cardShadow:'0 16px 72px rgba(0,0,0,0.06),0 2px 20px rgba(0,0,0,0.04)', innerGlow:'linear-gradient(135deg,rgba(255,255,255,0.8) 0%,rgba(255,255,255,0.3) 50%,transparent 100%)', text:'#1C1C1E', textMuted:'rgba(28,28,30,0.4)', textSubtle:'rgba(28,28,30,0.55)', dotActive:'rgba(28,28,30,0.8)', dotInactive:'rgba(28,28,30,0.12)', btnBg:'#1C1C1E', btnText:'#FFFFFF', btnHoverBg:'#2C2C2E', btn2Bg:'rgba(0,0,0,0.04)', btn2Border:'1px solid rgba(0,0,0,0.08)', btn2Text:'rgba(28,28,30,0.6)', btn2HoverBg:'rgba(0,0,0,0.07)', featBg:'rgba(255,255,255,0.5)', featBorder:'1px solid rgba(0,0,0,0.04)', featIconBg:'rgba(0,0,0,0.04)', featIconColor:'rgba(28,28,30,0.6)' };

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PenIcon({ color }: { color: string }) {
  return (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>);
}
function CloudIcon({ color }: { color: string }) {
  return (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>);
}
function SparkleIcon({ color }: { color: string }) {
  return (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>);
}
const icons = [PenIcon, CloudIcon, SparkleIcon];

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

const features = [
  { title: 'Distraction-Free Writing', desc: 'A minimal, beautiful editor that lets your words take center stage.' },
  { title: 'Cloud Sync', desc: 'Your documents sync seamlessly across all your devices.' },
  { title: 'AI-Powered Tools', desc: 'Intelligent writing assistance to help you craft your best work.' },
];

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

function injectKeyframes(): void {
  if (typeof document === 'undefined') return;
  const id = 'onboarding-kf';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = '@keyframes ob-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}';
  document.head.appendChild(s);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const [slide, setSlide] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [dir, setDir] = useState<'fwd'|'back'>('fwd');
  const [hovered, setHovered] = useState<string|null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDark = usePrefersDark();
  const p = isDark ? dark : light;
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const ease = 'cubic-bezier(0.4,0,0.2,1)';

  useEffect(() => { injectKeyframes(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  const go = useCallback((target: number) => {
    if (transitioning || target === slide || target < 0 || target >= TOTAL_SLIDES) return;
    setDir(target > slide ? 'fwd' : 'back');
    setTransitioning(true);
    timerRef.current = setTimeout(() => { setSlide(target); setTransitioning(false); }, TRANSITION_MS / 2);
  }, [transitioning, slide]);

  const next = useCallback(() => { if (slide < TOTAL_SLIDES - 1) go(slide + 1); }, [slide, go]);
  const back = useCallback(() => { if (slide > 0) go(slide - 1); }, [slide, go]);
  const done = useCallback(() => { markOnboardingComplete(user?.id); navigate('/'); }, [navigate, user?.id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); slide === TOTAL_SLIDES - 1 ? done() : next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [slide, next, back, done]);

  // Styles
  const pageS: React.CSSProperties = { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:p.pageBg, fontFamily:"'Inter',system-ui,-apple-system,sans-serif", padding:'40px 20px', overflow:'hidden', position:'relative' };
  const glowS: React.CSSProperties = { position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:700, height:700, borderRadius:'50%', background:isDark?'radial-gradient(circle,rgba(255,255,255,0.015) 0%,transparent 70%)':'radial-gradient(circle,rgba(0,0,0,0.015) 0%,transparent 70%)', pointerEvents:'none' };
  const cardS: React.CSSProperties = { width:'100%', maxWidth:520, minHeight:440, padding:'56px 52px 48px', borderRadius:28, background:p.cardBg, backdropFilter:'blur(48px) saturate(160%)', WebkitBackdropFilter:'blur(48px) saturate(160%)', border:p.cardBorder, boxShadow:p.cardShadow, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' };
  const igS: React.CSSProperties = { position:'absolute', top:0, left:0, right:0, height:'50%', background:p.innerGlow, borderRadius:'28px 28px 0 0', pointerEvents:'none' };
  const slideS: React.CSSProperties = { opacity:transitioning?0:1, transform:transitioning?`translateY(${dir==='fwd'?'12px':'-12px'})`:'translateY(0)', transition:`opacity ${TRANSITION_MS/2}ms ${ease},transform ${TRANSITION_MS/2}ms ${ease}`, display:'flex', flexDirection:'column', alignItems:'center', width:'100%', position:'relative', zIndex:1 };
  const btn1: React.CSSProperties = { padding:'15px 40px', fontSize:15, fontWeight:600, fontFamily:"'Inter',system-ui,sans-serif", borderRadius:16, border:'none', background:hovered==='pri'?p.btnHoverBg:p.btnBg, color:p.btnText, cursor:'pointer', transition:`all 350ms ${ease}`, transform:hovered==='pri'?'translateY(-1px)':'translateY(0)', letterSpacing:'0.3px', minWidth:160, boxShadow:hovered==='pri'?(isDark?'0 8px 32px rgba(255,255,255,0.1)':'0 8px 32px rgba(0,0,0,0.15)'):(isDark?'0 4px 16px rgba(255,255,255,0.05)':'0 4px 16px rgba(0,0,0,0.08)') };
  const btn2: React.CSSProperties = { padding:'14px 28px', fontSize:14, fontWeight:500, fontFamily:"'Inter',system-ui,sans-serif", borderRadius:14, border:p.btn2Border, background:hovered==='sec'?p.btn2HoverBg:p.btn2Bg, color:p.btn2Text, cursor:'pointer', transition:`all 350ms ${ease}`, backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', letterSpacing:'0.2px' };
  const skipS: React.CSSProperties = { position:'absolute', top:20, right:24, padding:'8px 16px', fontSize:13, fontWeight:400, fontFamily:"'Inter',system-ui,sans-serif", borderRadius:10, border:'none', background:'transparent', color:hovered==='skip'?p.textSubtle:p.textMuted, cursor:'pointer', transition:`color 300ms ${ease}`, zIndex:2, letterSpacing:'0.2px' };
  const dotsS: React.CSSProperties = { display:'flex', gap:10, marginTop:36, zIndex:1, position:'relative' };
  const dotS = (i: number): React.CSSProperties => ({ width:i===slide?24:8, height:8, borderRadius:4, background:i===slide?p.dotActive:p.dotInactive, transition:`all 400ms ${ease}`, cursor:'pointer', border:'none', padding:0 });

  // Slide 1: Welcome
  const slide1 = () => (
    <div style={slideS}>
      <div style={{ width:72, height:72, borderRadius:22, background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:isDark?'1px solid rgba(255,255,255,0.08)':'1px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:32, animation:'ob-float 4s ease-in-out infinite', boxShadow:isDark?'0 8px 32px rgba(0,0,0,0.3),inset 0 0.5px 0 rgba(255,255,255,0.08)':'0 8px 32px rgba(0,0,0,0.06),inset 0 0.5px 0 rgba(255,255,255,0.6)' }}>
        <span style={{ fontFamily:"'Lora',Georgia,serif", fontSize:30, fontWeight:400, color:p.text, opacity:0.9 }}>I</span>
      </div>
      <h1 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:36, fontWeight:300, color:p.text, letterSpacing:'-0.3px', marginBottom:12, textAlign:'center' }}>Welcome to Inlay</h1>
      <p style={{ fontFamily:"'Inter',system-ui,sans-serif", fontSize:15, color:p.textSubtle, lineHeight:'1.6', textAlign:'center', maxWidth:360, marginBottom:40, letterSpacing:'0.1px' }}>A beautiful, distraction-free space for your words. Crafted for writers who value clarity and focus.</p>
      <button style={btn1} onClick={next} onMouseEnter={() => setHovered('pri')} onMouseLeave={() => setHovered(null)} type="button" aria-label="Next slide">Get Started</button>
    </div>
  );

  // Slide 2: Features
  const slide2 = () => (
    <div style={slideS}>
      <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:28, fontWeight:300, color:p.text, letterSpacing:'-0.3px', marginBottom:8, textAlign:'center' }}>Everything you need</h2>
      <p style={{ fontFamily:"'Inter',system-ui,sans-serif", fontSize:14, color:p.textMuted, marginBottom:32, textAlign:'center', letterSpacing:'0.1px' }}>Powerful tools, thoughtfully designed</p>
      <div style={{ display:'flex', flexDirection:'column', gap:14, width:'100%', marginBottom:36 }}>
        {features.map((f, i) => {
          const Icon = icons[i];
          return (
            <div key={f.title} style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 18px', borderRadius:18, background:p.featBg, border:p.featBorder, backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}>
              <div style={{ width:44, height:44, borderRadius:14, background:p.featIconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Icon color={p.featIconColor} /></div>
              <div>
                <h3 style={{ fontFamily:"'Inter',system-ui,sans-serif", fontSize:14, fontWeight:600, color:p.text, marginBottom:3 }}>{f.title}</h3>
                <p style={{ fontFamily:"'Inter',system-ui,sans-serif", fontSize:13, color:p.textSubtle, lineHeight:'1.4' }}>{f.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:12 }}>
        <button style={btn2} onClick={back} onMouseEnter={() => setHovered('sec')} onMouseLeave={() => setHovered(null)} type="button" aria-label="Previous slide">Back</button>
        <button style={btn1} onClick={next} onMouseEnter={() => setHovered('pri')} onMouseLeave={() => setHovered(null)} type="button" aria-label="Next slide">Continue</button>
      </div>
    </div>
  );

  // Slide 3: Get Started
  const slide3 = () => (
    <div style={slideS}>
      <div style={{ width:72, height:72, borderRadius:9999, background:isDark?'rgba(52,199,89,0.08)':'rgba(52,199,89,0.1)', border:isDark?'1px solid rgba(52,199,89,0.15)':'1px solid rgba(52,199,89,0.2)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:28, animation:'ob-float 4s ease-in-out infinite', boxShadow:isDark?'0 8px 32px rgba(52,199,89,0.06)':'0 8px 32px rgba(52,199,89,0.08)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isDark?'#86D993':'#34C759'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
      </div>
      <h2 style={{ fontFamily:"'Lora',Georgia,serif", fontSize:30, fontWeight:300, color:p.text, letterSpacing:'-0.3px', marginBottom:12, textAlign:'center' }}>You&apos;re all set</h2>
      <p style={{ fontFamily:"'Inter',system-ui,sans-serif", fontSize:15, color:p.textSubtle, lineHeight:'1.6', textAlign:'center', maxWidth:340, marginBottom:16 }}>Your workspace is ready. Start writing something beautiful.</p>
      {user?.email && <p style={{ fontFamily:"'Inter',system-ui,sans-serif", fontSize:13, color:p.textMuted, marginBottom:32, textAlign:'center' }}>Signed in as {user.email}</p>}
      <div style={{ display:'flex', gap:12 }}>
        <button style={btn2} onClick={back} onMouseEnter={() => setHovered('sec')} onMouseLeave={() => setHovered(null)} type="button" aria-label="Previous slide">Back</button>
        <button style={btn1} onClick={done} onMouseEnter={() => setHovered('pri')} onMouseLeave={() => setHovered(null)} type="button" aria-label="Start writing">Start Writing</button>
      </div>
    </div>
  );

  const renders = [slide1, slide2, slide3];

  return (
    <div style={pageS} role="region" aria-label="Onboarding" aria-roledescription="carousel">
      <div style={glowS} aria-hidden="true" />
      <div style={cardS}>
        <div style={igS} aria-hidden="true" />
        <button style={skipS} onClick={done} onMouseEnter={() => setHovered('skip')} onMouseLeave={() => setHovered(null)} type="button" aria-label="Skip onboarding">Skip</button>
        {renders[slide]()}
        <div style={dotsS} role="tablist" aria-label="Onboarding progress">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button key={i} style={dotS(i)} onClick={() => go(i)} role="tab" aria-selected={slide === i} aria-label={`Go to slide ${i + 1}`} type="button" />
          ))}
        </div>
      </div>
    </div>
  );
}
