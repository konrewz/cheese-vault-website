import { useEffect, useRef } from 'react';
export const OFFICIAL_X = 'https://x.com/cheesevaultfun';
// Unmodified path geometry from X's official brand-toolkit logo.svg (2026-11-08).
export function XLogo() {
  return <svg viewBox="0 0 1200 1227" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" /></svg>;
}
export function FloatingX({ hidden = false }: { hidden?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    let frame = 0;
    const avoidControls = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current; if (!el) return;
        el.style.removeProperty('--social-lift');
        if (innerWidth > 700) return;
        const rect = el.getBoundingClientRect();
        const controls = [...document.querySelectorAll('button,input,select,summary,a:not(.floating-x)')].filter(x => !el.contains(x)).map(x => x.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight);
        for (let lift = 0; lift <= 240; lift += 60) {
          if (!controls.some(r => r.left < rect.right + 6 && r.right > rect.left - 6 && r.top < rect.bottom - lift + 6 && r.bottom > rect.top - lift - 6)) { el.style.setProperty('--social-lift', `${lift}px`); break; }
        }
      });
    };
    avoidControls(); addEventListener('scroll', avoidControls, { passive: true }); addEventListener('resize', avoidControls);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(avoidControls) : undefined; observer?.observe(document.body);
    return () => { cancelAnimationFrame(frame); removeEventListener('scroll', avoidControls); removeEventListener('resize', avoidControls); observer?.disconnect(); };
  }, []);
  return <a ref={ref} className="floating-x" href={OFFICIAL_X} target="_blank" rel="noopener noreferrer" aria-label="Follow us on X (opens in a new tab)" hidden={hidden}>
    <XLogo /><span className="social-tooltip" role="tooltip">Follow us on X</span>
  </a>;
}
export function FooterX() { return <a className="footer-x" href={OFFICIAL_X} target="_blank" rel="noopener noreferrer" aria-label="The Cheese Vault on X (opens in a new tab)"><XLogo />Follow us on X</a>; }
