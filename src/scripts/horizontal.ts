import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

type AppApi = {
  scrollToPanel: (id: string) => void;
  refresh: () => void;
  destroy: () => void;
};

const DESKTOP_MQ = '(min-width: 901px)';
const PANEL_ORDER = ['hero', 'about', 'services', 'clients', 'process', 'faq', 'contact'] as const;

let activeApi: AppApi | null = null;
let mode: 'desktop' | 'mobile' | null = null;

export function initHorizontal(): AppApi | null {
  const isDesktop = window.matchMedia(DESKTOP_MQ).matches;
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tear down previous mode on resize switch
  if (activeApi) {
    activeApi.destroy();
    activeApi = null;
  }

  if (!isDesktop || reduced) {
    mode = 'mobile';
    activeApi = initMobileApp(reduced);
  } else {
    mode = 'desktop';
    activeApi = initDesktopHorizontal();
  }

  // Re-init when crossing breakpoint
  const mql = window.matchMedia(DESKTOP_MQ);
  const onChange = () => {
    // Avoid thrashing: only re-boot when mode actually flips
    const next = mql.matches ? 'desktop' : 'mobile';
    if (next !== mode) {
      initHorizontal();
    }
  };
  // modern + legacy listeners
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
  else mql.addListener(onChange);

  return activeApi;
}

/* ═══════════════════════════════════════════
   MOBILE APP MODE — vertical, tabbed, tappable
   ═══════════════════════════════════════════ */
function initMobileApp(reduced: boolean): AppApi {
  document.body.classList.add('is-mobile-app', 'is-vertical');
  document.body.classList.remove('is-desktop-h');

  const tabs = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-mobile-nav]'));
  const sections = PANEL_ORDER.map((id) => document.getElementById(id)).filter(
    (el): el is HTMLElement => !!el,
  );

  // Ensure all content is visible (no GSAP hide leftovers)
  gsap.set('[data-reveal], .hero-fade, .chrome--desktop, .m-hero, .m-top, .m-tabbar, .m-fab', {
    clearProps: 'all',
  });
  gsap.set(['.m-top', '.m-tabbar', '.m-fab'], { autoAlpha: 1, y: 0 });

  // Soft entrance for mobile hero
  if (!reduced) {
    gsap.from('.m-hero > *', {
      y: 18,
      opacity: 0,
      duration: 0.55,
      stagger: 0.05,
      ease: 'power2.out',
      delay: 0.05,
    });
  }

  // Light scroll reveals
  if (!reduced) {
    gsap.utils.toArray<HTMLElement>('.panel:not(#hero) [data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 22,
        opacity: 0,
        duration: 0.55,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 92%',
          toggleActions: 'play none none reverse',
        },
      });
    });
  }

  function setActiveTab(id: string) {
    document.querySelectorAll<HTMLElement>('.m-tab').forEach((tab) => {
      let match = tab.dataset.tab === id;
      // Map intermediate sections onto nearest primary tab
      if (id === 'about') match = tab.dataset.tab === 'hero';
      if (id === 'clients') match = tab.dataset.tab === 'services';
      tab.classList.toggle('is-active', match);
      if (match) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });

    // Hide floating CTA on home (hero has its own CTAs) and contact (form)
    const fab = document.querySelector('.m-fab');
    const hideFab = id === 'contact' || id === 'hero' || id === 'about';
    fab?.classList.toggle('is-hidden', hideFab);
    document.body.classList.toggle('is-on-contact', id === 'contact');
    document.body.classList.toggle('is-fab-hidden', hideFab);
  }

  function scrollToPanel(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const topBar = document.getElementById('m-top');
    const offset = (topBar?.offsetHeight || 56) + 8;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    if (reduced) {
      window.scrollTo(0, y);
    } else {
      gsap.to(window, {
        duration: 0.7,
        scrollTo: { y, autoKill: true },
        ease: 'power3.out',
      });
    }
    setActiveTab(id);
  }

  tabs.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href?.startsWith('#')) return;
      e.preventDefault();
      scrollToPanel(href.slice(1));
    });
  });

  // Also wire data-go buttons
  document.querySelectorAll<HTMLElement>('[data-go]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const id = el.getAttribute('data-go');
      if (id) scrollToPanel(id);
    });
  });

  // IntersectionObserver for active tab while scrolling
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActiveTab(visible.target.id);
    },
    {
      rootMargin: '-40% 0px -45% 0px',
      threshold: [0.1, 0.25, 0.5],
    },
  );
  sections.forEach((s) => io.observe(s));
  setActiveTab('hero');

  document.body.classList.add('is-ready');

  return {
    scrollToPanel,
    refresh: () => ScrollTrigger.refresh(),
    destroy: () => {
      io.disconnect();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      document.body.classList.remove('is-mobile-app', 'is-vertical');
    },
  };
}

/* ═══════════════════════════════════════════
   DESKTOP — horizontal GSAP experience
   ═══════════════════════════════════════════ */
function initDesktopHorizontal(): AppApi | null {
  document.body.classList.add('is-desktop-h');
  document.body.classList.remove('is-mobile-app', 'is-vertical');

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

  const panels = gsap.utils.toArray<HTMLElement>('.panel');
  const getScrollLength = () => Math.max(0, track.scrollWidth - window.innerWidth);

  gsap.set(['.chrome--desktop', '.scroll-hint', '.chrome-meta'], { autoAlpha: 0, y: -8 });
  gsap.set('.hero-fade', { autoAlpha: 0, y: 24 });
  gsap
    .timeline({ defaults: { ease: 'power3.out' } })
    .to('.chrome--desktop', { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.05 })
    .to('.hero-fade', { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.06 }, '-=0.35')
    .to(['.scroll-hint', '.chrome-meta'], { autoAlpha: 1, y: 0, duration: 0.5 }, '-=0.45');

  const tween = gsap.to(track, {
    x: () => -getScrollLength(),
    ease: 'none',
    scrollTrigger: {
      trigger: scroller,
      start: 'top top',
      end: () => `+=${getScrollLength() * 1.15}`,
      pin: true,
      scrub: 1.1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        if (progressFill) gsap.set(progressFill, { scaleX: p });
        if (hint) hint.classList.toggle('is-hidden', p > 0.04);

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
  });

  initMagnetic(document.querySelectorAll<HTMLElement>('.btn, .nav-cta, .destination, .configure'));
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

  document.querySelectorAll<HTMLElement>('[data-go]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const id = el.getAttribute('data-go');
      if (id) scrollToPanel(id);
    });
  });

  const onKey = (e: KeyboardEvent) => {
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
  };
  window.addEventListener('keydown', onKey);

  const onResize = () => ScrollTrigger.refresh();
  window.addEventListener('resize', onResize);

  document.body.classList.add('is-ready');

  return {
    scrollToPanel,
    refresh: () => ScrollTrigger.refresh(),
    destroy: () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      ScrollTrigger.getAll().forEach((t) => t.kill());
      tween.kill();
      document.body.classList.remove('is-desktop-h');
    },
  };
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
