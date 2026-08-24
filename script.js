(() => {
  'use strict';

  // ============ CONFIG ============
  const BOOKING_URL = "https://www.booking.com/Share-9qmZAVb";
  const DEFAULT_LANG = 'en';
  const SUPPORTED_LANGS = ['en', 'sq', 'de'];

  // ============ BOOKING LINKS ============
  document.querySelectorAll('#navBookBtn, #heroBookBtn, #footerBookBtn, #mobileBookBtn, #reviewsBookingBtn').forEach(el => {
    el.setAttribute('href', BOOKING_URL);
  });

  // ============ i18n ============
  const dictCache = {};
  let currentDict = null;

  function getByPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
  }

  async function loadDict(lang) {
    if (dictCache[lang]) return dictCache[lang];
    const res = await fetch(`assets/i18n/${lang}.json`);
    const data = await res.json();
    dictCache[lang] = data;
    return data;
  }

  function applyDict(dict) {
    currentDict = dict;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const path = el.getAttribute('data-i18n');
      const val = getByPath(dict, path);
      if (typeof val === 'string') el.textContent = val;
    });
    if (dict.meta) {
      if (dict.meta.title) document.title = dict.meta.title;
      const desc = document.querySelector('meta[name="description"]');
      if (desc && dict.meta.description) desc.setAttribute('content', dict.meta.description);
    }
    document.documentElement.lang = SUPPORTED_LANGS.includes(activeLang) ? activeLang : 'en';
    renderReviews(dict);
  }

  function renderReviews(dict) {
    const grid = document.getElementById('reviewsGrid');
    if (!grid || !dict.reviews || !dict.reviews.items) return;
    grid.innerHTML = '';
    dict.reviews.items.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'review-card reveal';
      card.innerHTML = `
        <p class="stars">★★★★★</p>
        <p class="quote">"${item.quote}"</p>
        <p class="author">${item.author}</p>
      `;
      grid.appendChild(card);
    });
    // re-observe newly created review cards
    document.querySelectorAll('.review-card').forEach(el => revealObserver.observe(el));
  }

  let activeLang = localStorage.getItem('straka_lang') || DEFAULT_LANG;

  function updateLangButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === activeLang);
    });
  }

  async function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
    activeLang = lang;
    localStorage.setItem('straka_lang', lang);
    updateLangButtons();
    const dict = await loadDict(lang);
    applyDict(dict);
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
  });

  setLang(activeLang);

  // ============ NAV: scroll state + burger ============
  const siteNav = document.getElementById('siteNav');
  const navBurger = document.getElementById('navBurger');
  let navLinksMobilePanel = null;

  function buildMobilePanel() {
    if (navLinksMobilePanel) return navLinksMobilePanel;
    const panel = document.createElement('div');
    panel.className = 'nav-mobile-panel';
    panel.id = 'navMobilePanel';
    const navLinks = document.getElementById('navLinks').cloneNode(true);
    navLinks.removeAttribute('id');
    panel.appendChild(navLinks);
    const langClone = document.getElementById('langSwitch').cloneNode(true);
    langClone.removeAttribute('id');
    panel.appendChild(langClone);
    const cta = document.createElement('a');
    cta.className = 'btn btn-primary';
    cta.href = BOOKING_URL;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.setAttribute('data-i18n', 'nav.book');
    cta.textContent = currentDict ? getByPath(currentDict, 'nav.book') : 'Check availability';
    panel.appendChild(cta);
    document.body.appendChild(panel);
    navLinksMobilePanel = panel;

    panel.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', () => closeMobilePanel());
    });
    panel.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
    });
    return panel;
  }

  function openMobilePanel() {
    const panel = buildMobilePanel();
    panel.classList.add('is-open');
    navBurger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMobilePanel() {
    if (navLinksMobilePanel) navLinksMobilePanel.classList.remove('is-open');
    navBurger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  navBurger.addEventListener('click', () => {
    const isOpen = navBurger.getAttribute('aria-expanded') === 'true';
    isOpen ? closeMobilePanel() : openMobilePanel();
  });

  // ============ scroll progress + nav bg + mobile sticky CTA ============
  const scrollProgress = document.getElementById('scrollProgress');
  const mobileCta = document.getElementById('mobileBookBtn');
  const heroEl = document.querySelector('.hero');
  let heroHeight = heroEl ? heroEl.offsetHeight : 600;

  function onScroll() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
    scrollProgress.style.width = progress + '%';

    siteNav.classList.toggle('is-scrolled', scrollY > 40);
    mobileCta.classList.toggle('is-shown', scrollY > heroHeight * 0.6);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { heroHeight = heroEl ? heroEl.offsetHeight : 600; });
  onScroll();

  // scroll cue click
  const scrollCue = document.getElementById('scrollCue');
  if (scrollCue) {
    scrollCue.addEventListener('click', () => {
      document.getElementById('story').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ============ Reveal on scroll (Intersection Observer) ============
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ============ Footer year ============
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
