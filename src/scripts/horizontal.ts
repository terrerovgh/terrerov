import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

type HorizontalApi = {
  scrollToPanel: (id: string) => void;
  refresh: () => void;
  destroy: () => void;
};

const PANEL_ORDER = ['hero', 'about', 'services', 'clients', 'process', 'faq', 'contact'] as const;

export function initHorizontal(): HorizontalApi | null {
  const track = document.getElementById('h-track');
  const scroller = document.getElementById('h-scroll');
  const progressFill = document.getElementById('progress-fill');
  const indexEl = document.getElementById('panel-index');
  const labelEl = document.getElementById('panel-label');
  const hint = document.getElementById('scroll-hint');
  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-panel-link]'));

  if (!track || !scroller) return null;

  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const narrow =
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 720px)').matches;

  // Vertical fallback for reduced motion or very small screens if preferred
  if (reduced) {
    document.body.classList.add('is-vertical');
    initVerticalReveals();
    bindNavVertical(navLinks);
    return {
      scrollToPanel: (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      },
      refresh: () => ScrollTrigger.refresh(),
      destroy: () => ScrollTrigger.getAll().forEach((t) => t.kill()),
    };
  }

  document.body.classList.remove('is-vertical');

  const panels = gsap.utils.toArray<HTMLElement>('.panel');
  const getScrollLength = () => Math.max(0, track.scrollWidth - window.innerWidth);

  // Intro: soft fade of chrome + first panel content
  gsap.set(['.chrome', '.scroll-hint', '.chrome-meta'], { autoAlpha: 0, y: -8 });
  gsap.set('.hero-fade', { autoAlpha: 0, y: 24 });
  gsap
    .timeline({ defaults: { ease: 'power3.out' } })
    .to('.chrome', { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.05 })
    .to('.hero-fade', { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.06 }, '-=0.35')
    .to(['.scroll-hint', '.chrome-meta'], { autoAlpha: 1, y: 0, duration: 0.5 }, '-=0.45');

  // Horizontal pin + scrub
  const tween = gsap.to(track, {
    x: () => -getScrollLength(),
    ease: 'none',
    scrollTrigger: {
      trigger: scroller,
      start: 'top top',
      end: () => `+=${getScrollLength() * (narrow ? 0.95 : 1.15)}`,
      pin: true,
      scrub: narrow ? 0.6 : 1.1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        if (progressFill) gsap.set(progressFill, { scaleX: p });
        if (hint) hint.classList.toggle('is-hidden', p > 0.04);

        // Active panel from actual horizontal position
        const x = Math.abs(Number(gsap.getProperty(track, 'x')) || 0);
        let idx = 0;
        let best = Infinity;
        panels.forEach((panel, i) => {
          const d = Math.abs(panel.offsetLeft - x);
          if (d < best) {
            best = d;
            idx = i;
          }
        });
        setActive(idx);
      },
    },
  });

  const st = tween.scrollTrigger!;

  function setActive(idx: number) {
    const panel = panels[idx];
    const id = panel?.dataset.panel || PANEL_ORDER[idx] || 'hero';
    const label = panel?.dataset.label || id;
    if (indexEl) indexEl.textContent = String(idx + 1).padStart(2, '0');
    if (labelEl) labelEl.textContent = label;

    navLinks.forEach((link) => {
      const target = link.getAttribute('href')?.replace('#', '');
      link.classList.toggle('is-active', target === id);
      if (target === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  setActive(0);

  // Panel entrance animations driven by horizontal container animation
  // Skip hero — it has its own intro timeline
  panels.forEach((panel) => {
    if (panel.dataset.panel === 'hero') return;

    const reveals = panel.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!reveals.length) return;

    gsap.set(reveals, { y: 36, opacity: 0 });

    gsap.to(reveals, {
      y: 0,
      opacity: 1,
      duration: 0.9,
      stagger: 0.07,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: panel,
        containerAnimation: tween,
        start: 'left 80%',
        end: 'left 35%',
        toggleActions: 'play none none reverse',
      },
    });

    // Subtle parallax for decorative layers
    const parallax = panel.querySelectorAll<HTMLElement>('[data-parallax]');
    parallax.forEach((el) => {
      const depth = Number(el.dataset.parallax || 0.15);
      gsap.to(el, {
        x: () => depth * 80,
        ease: 'none',
        scrollTrigger: {
          trigger: panel,
          containerAnimation: tween,
          start: 'left right',
          end: 'right left',
          scrub: true,
        },
      });
    });
  });

  // Service / process cards hover micro-interaction already CSS; add magnetic buttons
  initMagnetic(document.querySelectorAll<HTMLElement>('.btn, .nav-cta, .destination, .configure'));

  // Custom cursor (fine pointer only)
  initCursor();

  function scrollToPanel(id: string) {
    const panel = document.getElementById(id);
    if (!panel || !st) return;

    const maxX = getScrollLength();
    const targetX = Math.min(maxX, Math.max(0, panel.offsetLeft));
    const progress = maxX === 0 ? 0 : targetX / maxX;
    const scrollY = st.start + (st.end - st.start) * progress;

    gsap.to(window, {
      duration: reduced ? 0.01 : 1.05,
      scrollTo: { y: scrollY, autoKill: true },
      ease: 'power3.inOut',
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href?.startsWith('#')) return;
      e.preventDefault();
      scrollToPanel(href.slice(1));
    });
  });

  // Destination buttons inside hero
  document.querySelectorAll<HTMLElement>('[data-go]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const id = el.getAttribute('data-go');
      if (id) scrollToPanel(id);
    });
  });

  // Keyboard: arrows move between panels
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if ((e.target as HTMLElement)?.matches('input, textarea, select')) return;
    const p = st.progress;
    const step = 1 / Math.max(1, panels.length - 1);
    const next = e.key === 'ArrowRight' ? Math.min(1, p + step) : Math.max(0, p - step);
    gsap.to(window, {
      duration: 0.85,
      scrollTo: { y: st.start + (st.end - st.start) * next },
      ease: 'power3.inOut',
    });
  });

  // Resize handling
  const onResize = () => {
    ScrollTrigger.refresh();
  };
  window.addEventListener('resize', onResize);

  // Wheel on panels with overflow: if panel can scroll vertically, let it when at edges
  // Default horizontal scrub via vertical scroll is handled by pin.

  document.body.classList.add('is-ready');

  return {
    scrollToPanel,
    refresh: () => ScrollTrigger.refresh(),
    destroy: () => {
      window.removeEventListener('resize', onResize);
      ScrollTrigger.getAll().forEach((t) => t.kill());
      tween.kill();
    },
  };
}

function bindNavVertical(navLinks: HTMLAnchorElement[]) {
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href?.startsWith('#')) return;
      e.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function initVerticalReveals() {
  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 28,
      opacity: 0,
      duration: 0.7,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none reverse',
      },
    });
  });
  document.body.classList.add('is-ready');
}

function initMagnetic(nodes: NodeListOf<HTMLElement>) {
  if (window.matchMedia('(hover: none)').matches) return;

  nodes.forEach((el) => {
    const strength = 12;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, {
        x: (x / r.width) * strength,
        y: (y / r.height) * strength,
        duration: 0.35,
        ease: 'power3.out',
      });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)' });
    });
  });
}

function initCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cursor = document.createElement('div');
  cursor.className = 'g-cursor';
  document.body.appendChild(cursor);

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const mouse = { x: pos.x, y: pos.y };

  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    cursor.classList.add('is-on');
  });

  gsap.ticker.add(() => {
    pos.x += (mouse.x - pos.x) * 0.18;
    pos.y += (mouse.y - pos.y) * 0.18;
    cursor.style.left = `${pos.x}px`;
    cursor.style.top = `${pos.y}px`;
  });

  document.querySelectorAll('a, button, .service-card, .card, summary, input, textarea').forEach((el) => {
    el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
    el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
  });
}
