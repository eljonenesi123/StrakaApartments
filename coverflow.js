(() => {
  'use strict';

  // ============ CONFIG ============
  const slides = [
    { src: 'assets/photos/coverflow/gallery-1.jpg', alt: 'Living room with fireplace TV wall and wood accents', title: 'Fireplace Nook', subtitle: 'Curl up on the sofa and watch the flames while the TV stays tucked into the wood-panelled wall behind it.' },
    { src: 'assets/photos/coverflow/gallery-2.jpg', alt: 'Open kitchen and dining table seating four', title: 'Dining Area', subtitle: 'A table for four sits just off the kitchen, close enough to cook and talk at the same time.' },
    { src: 'assets/photos/coverflow/gallery-3.jpg', alt: 'Bedroom with king bed and balcony access', title: 'Bedroom', subtitle: 'A calm, tidy bedroom with a proper mattress, blackout curtains, and its own balcony door.' },
    { src: 'assets/photos/coverflow/gallery-4.jpg', alt: 'Living room sectional sofa with balcony view', title: 'Living Room', subtitle: 'Deep sectional seating facing the balcony, with enough room to stretch out after a long day.' },
    { src: 'assets/photos/coverflow/gallery-5.jpg', alt: 'Private balcony with seating and outdoor air conditioning unit', title: 'Balcony', subtitle: 'A quiet outdoor corner with a small table and chairs, perfect for morning coffee or evening air.' },
    { src: 'assets/photos/coverflow/gallery-6.jpg', alt: 'Bedroom dresser with mirror, folded towels, and sheer curtains by the window', title: 'Bedroom Details', subtitle: 'Fresh towels, a full-length mirror, and soft natural light through the sheer curtains each morning.' },
  ];

  const ROTATE = 44;      // degrees the first neighbour tilts
  const DEPTH = 0.6;      // how far the first neighbour recedes (fraction of card width)
  const FALLOFF = 0.56;   // exponent on distance — eases the rake off as cards travel out
  const FADE = 0.1;       // opacity lost per step from the centre
  const GAP = 0.05;       // spacing between cards, as a fraction of card width
  const LOOP = true;
  const DRAG_CLICK_THRESHOLD = 6; // px of movement before a pointer-down/up stops counting as a click

  const count = slides.length;

  const frame = document.getElementById('cfFrame');
  const track = document.getElementById('cfTrack');
  const captionTitle = document.getElementById('cfCaptionTitle');
  const captionSubtitle = document.getElementById('cfCaptionSubtitle');
  if (!frame || !track) return;

  // Build cards.
  const cards = slides.map((slide, index) => {
    const card = document.createElement('div');
    card.className = 'cf-card';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `${index + 1} of ${count}`);

    const img = document.createElement('img');
    img.src = slide.src;
    img.alt = slide.alt;
    img.draggable = false;
    if (index !== 0) img.loading = 'lazy';
    card.appendChild(img);

    track.appendChild(card);
    return card;
  });

  // ============ STATE ============
  let pos = 0;         // fractional card index at the centre — single source of truth
  let target = 0;      // where the current settle is headed
  let width = 0;       // measured card width, px
  let rafId = null;
  let selected = 0;

  let drag = null; // { id, x, pos, v, t, moved }
  let captionIndex = -1;

  function updateCaption() {
    if (!captionTitle || selected === captionIndex) return;
    captionIndex = selected;
    captionTitle.style.opacity = '0';
    if (captionSubtitle) captionSubtitle.style.opacity = '0';
    setTimeout(() => {
      captionTitle.textContent = slides[selected].title || '';
      captionTitle.style.opacity = '1';
      if (captionSubtitle) {
        captionSubtitle.textContent = slides[selected].subtitle || '';
        captionSubtitle.style.opacity = '1';
      }
    }, 160);
  }

  // Nearest whole card, folded back into 0..count-1.
  function indexAt(p) {
    return ((Math.round(p) % count) + count) % count;
  }

  function clamp(p) {
    return LOOP ? p : Math.max(0, Math.min(count - 1, p));
  }

  // Paint straight to the DOM — 60 updates a second is too much for anything else.
  function paint() {
    if (!width) return;
    const pitch = width * (1 + GAP);

    cards.forEach((card, index) => {
      // Fold the distance into the shorter way round the ring. This is the
      // whole looping mechanism — no cloned nodes, no shuffling the DOM.
      let offset = index - pos;
      if (LOOP) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      // Both the tilt and the recession ease off as cards travel out.
      const ramp = Math.pow(distance, FALLOFF);
      // Capped short of edge-on so a far card never turns its back.
      const tilt = Math.min(ROTATE * ramp, 82) * Math.sign(offset);

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-DEPTH * width * ramp}px) rotateY(${-tilt}deg)`;

      // A card is teleported across the ring at exactly half a turn out, so
      // it has to be gone by then or the jump is visible.
      const edge = LOOP ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      card.style.opacity = String(Math.max(0, 1 - FADE * distance) * edge);
      card.style.zIndex = String(100 - Math.round(distance));
      card.classList.toggle('is-active', index === selected);
    });
    updateCaption();
  }

  function settle(nextTarget) {
    if (rafId !== null) cancelAnimationFrame(rafId);
    target = nextTarget;
    selected = indexAt(target);

    const step = () => {
      const remaining = target - pos;
      if (Math.abs(remaining) < 0.0004) {
        pos = target;
        paint();
        rafId = null;
        return;
      }
      // Exponential ease-out, not a spring.
      pos += remaining * 0.16;
      paint();
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function goTo(index) {
    // Take the shorter way round rather than unwinding the whole ring.
    const nextTarget = LOOP
      ? index + Math.round((target - index) / count) * count
      : index;
    settle(clamp(nextTarget));
  }

  function nudge(by) {
    settle(clamp(Math.round(target) + by));
  }

  // ============ POINTER DRAG ============
  function onPointerDown(e) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    // Pointer capture retargets the click that would follow this gesture to
    // `frame`, so the tapped card is recorded here — before capture — and
    // resolved on pointerup instead of relying on a per-card click listener.
    const tappedCard = e.target.closest('.cf-card');
    frame.setPointerCapture(e.pointerId);
    target = pos;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      pos,
      v: 0,
      t: performance.now(),
      moved: false,
      tappedIndex: tappedCard ? cards.indexOf(tappedCard) : -1,
    };
  }

  function onPointerMove(e) {
    if (!drag || drag.id !== e.pointerId) return;

    const pitch = width * (1 + GAP);
    if (!pitch) return;

    if (Math.abs(e.clientX - drag.x) > DRAG_CLICK_THRESHOLD) drag.moved = true;

    const now = performance.now();
    const previous = pos;
    pos = clamp(drag.pos - (e.clientX - drag.x) / pitch);
    // Cards per second, for the throw.
    drag.v = ((pos - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;

    const index = indexAt(pos);
    if (index !== selected) selected = index;
    paint();
  }

  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const wasDrag = drag.moved;
    const velocity = drag.v;
    const tappedIndex = drag.tappedIndex;
    drag = null;
    if (wasDrag) {
      // Let a flick carry, but never more than two cards.
      const carried = Math.max(-2, Math.min(2, velocity * 0.18));
      settle(clamp(Math.round(pos + carried)));
    } else if (tappedIndex !== -1) {
      goTo(tappedIndex);
    }
  }

  frame.addEventListener('pointerdown', onPointerDown);
  frame.addEventListener('pointermove', onPointerMove);
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);

  // ============ KEYBOARD ============
  frame.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nudge(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nudge(1);
    }
  });

  // ============ MEASURE ============
  function measure() {
    if (!cards[0]) return;
    width = cards[0].offsetWidth;
    paint();
  }
  measure();
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(frame);

  // Start centred on the first slide.
  settle(0);
})();
