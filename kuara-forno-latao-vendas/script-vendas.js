const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-button');

document.querySelectorAll('.brand.has-logo img').forEach(logo => {
  if (logo.complete && logo.naturalWidth === 0) logo.closest('.brand')?.classList.add('logo-missing');
  logo.addEventListener('error', () => logo.closest('.brand')?.classList.add('logo-missing'));
});

document.querySelectorAll('[data-logo-fallbacks]').forEach(logo => {
  const fallbacks = logo.dataset.logoFallbacks.split(',').map(item => item.trim()).filter(Boolean);
  logo.addEventListener('error', () => {
    const next = fallbacks.shift();
    if (next) logo.src = next;
  });
});

const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 24);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const updateScrollProgress = () => {
  const viewportHeight = window.innerHeight;
  const pageRange = document.documentElement.scrollHeight - viewportHeight;
  header?.style.setProperty('--scroll-progress', pageRange > 0 ? window.scrollY / pageRange : 0);
};
updateScrollProgress();
window.addEventListener('scroll', updateScrollProgress, { passive: true });
window.addEventListener('resize', updateScrollProgress, { passive: true });

if (menuButton) {
  menuButton.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
}

document.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', () => {
  document.body.classList.remove('menu-open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));

const mobileStickyCta = document.querySelector('.mobile-sticky-cta');
const signupCard = document.querySelector('.signup-card, .sales-card, .price-panel');
if (mobileStickyCta && signupCard) {
  const stickyObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      mobileStickyCta.classList.toggle('hide-over-form', entry.isIntersecting);
    });
  }, { threshold: 0.12 });
  stickyObserver.observe(signupCard);
}

document.querySelectorAll('a[href="#topo"]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    document.body.classList.remove('menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  });
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

/* ---------- Envio seguro do formulário ----------
   O HTML não expõe mais o endpoint do Brevo. O navegador envia para a Netlify Function,
   e o backend valida, aplica proteção anti-abuso e só então encaminha ao Brevo. */
const leadForm = document.querySelector('[data-lead-form]');
const leadSuccess = document.querySelector('.form-success');
const leadError = document.querySelector('.form-error');
const leadButton = leadForm ? leadForm.querySelector('button[type="submit"]') : null;
const formStartedAt = leadForm ? leadForm.querySelector('[data-form-started-at]') : null;
const turnstileContainer = leadForm ? leadForm.querySelector('[data-turnstile-container]') : null;
const turnstileToken = leadForm ? leadForm.querySelector('[data-turnstile-token]') : null;
let turnstileWidgetId = null;
if (formStartedAt) formStartedAt.value = String(Date.now());

const hasTurnstileSiteKey = () => {
  const sitekey = turnstileContainer?.dataset.sitekey || '';
  return sitekey && !sitekey.includes('COLE_SUA_TURNSTILE_SITE_KEY_AQUI');
};

const renderTurnstile = () => {
  if (!turnstileContainer || !turnstileToken || !hasTurnstileSiteKey()) return;
  if (!window.turnstile || turnstileWidgetId !== null) return;
  turnstileWidgetId = window.turnstile.render(turnstileContainer, {
    sitekey: turnstileContainer.dataset.sitekey,
    theme: 'light',
    callback: token => {
      turnstileToken.value = token;
    },
    'expired-callback': () => {
      turnstileToken.value = '';
    },
    'error-callback': () => {
      turnstileToken.value = '';
    }
  });
};

const waitForTurnstile = () => {
  if (!hasTurnstileSiteKey()) return;
  if (window.turnstile) {
    renderTurnstile();
    return;
  }
  window.addEventListener('load', renderTurnstile);
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    renderTurnstile();
    if (turnstileWidgetId !== null || attempts > 30) window.clearInterval(timer);
  }, 300);
};
waitForTurnstile();

if (leadForm) {
  leadForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (leadError) {
      leadError.hidden = true;
      const errorText = leadError.querySelector('p');
      if (errorText) errorText.textContent = 'Revise os campos e tente novamente em instantes.';
    }
    if (!leadForm.reportValidity()) return;
    if (hasTurnstileSiteKey() && !turnstileToken?.value) {
      if (leadError) {
        leadError.hidden = false;
        leadError.querySelector('p').textContent = 'Confirme a verificação anti-bot antes de enviar.';
      }
      return;
    }

    if (leadButton) {
      leadButton.disabled = true;
      leadButton.textContent = 'Enviando…';
    }

    try {
      const response = await fetch(leadForm.action, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(new FormData(leadForm))
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || 'Falha no envio');

      leadForm.reset();
      if (leadForm) leadForm.style.display = 'none';
      if (leadSuccess) leadSuccess.hidden = false;
    } catch (error) {
      if (leadError) leadError.hidden = false;
      if (window.turnstile && turnstileWidgetId !== null) {
        window.turnstile.reset(turnstileWidgetId);
        if (turnstileToken) turnstileToken.value = '';
      }
      if (leadButton) {
        leadButton.disabled = false;
        leadButton.innerHTML = 'Quero participar <span>→</span>';
      }
    }
  });
}

document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', () => {
  if (!detail.open) return;
  document.querySelectorAll('details').forEach(other => {
    if (other !== detail) other.open = false;
  });
}));

const galleryItems = [...document.querySelectorAll('.piece-trigger')].map(trigger => {
  const image = trigger.querySelector('img');
  const caption = trigger.closest('.piece')?.querySelector('figcaption span')?.textContent || '';
  return {
    src: image?.getAttribute('src') || '',
    alt: image?.getAttribute('alt') || caption,
    caption,
    trigger
  };
});
const lightbox = document.querySelector('[data-gallery-lightbox]');
const lightboxImage = document.querySelector('[data-lightbox-image]');
const lightboxCaption = document.querySelector('[data-lightbox-caption]');
const lightboxClose = document.querySelector('[data-lightbox-close]');
const lightboxPrev = document.querySelector('[data-lightbox-prev]');
const lightboxNext = document.querySelector('[data-lightbox-next]');
let activeGalleryIndex = 0;

const renderLightbox = index => {
  if (!galleryItems.length || !lightboxImage || !lightboxCaption) return;
  activeGalleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[activeGalleryIndex];
  lightboxImage.src = item.src;
  lightboxImage.alt = item.alt;
  lightboxCaption.textContent = item.caption;
};

const openLightbox = index => {
  if (!lightbox) return;
  renderLightbox(index);
  lightbox.hidden = false;
  document.body.classList.add('lightbox-open');
  lightboxClose?.focus();
};

const closeLightbox = () => {
  if (!lightbox) return;
  lightbox.hidden = true;
  document.body.classList.remove('lightbox-open');
  galleryItems[activeGalleryIndex]?.trigger?.focus();
};

galleryItems.forEach((item, index) => {
  item.trigger.addEventListener('click', () => openLightbox(index));
});
lightboxClose?.addEventListener('click', closeLightbox);
lightboxPrev?.addEventListener('click', () => renderLightbox(activeGalleryIndex - 1));
lightboxNext?.addEventListener('click', () => renderLightbox(activeGalleryIndex + 1));
lightbox?.addEventListener('click', event => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', event => {
  if (!lightbox || lightbox.hidden) return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowLeft') renderLightbox(activeGalleryIndex - 1);
  if (event.key === 'ArrowRight') renderLightbox(activeGalleryIndex + 1);
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector('.hero');
const heroImage = document.querySelector('[data-parallax="hero-image"]');
const heroCopy = document.querySelector('[data-parallax="hero-copy"]');
const signup = document.querySelector('[data-parallax="signup"]');
const eventDate = document.querySelector('.event-date');
const video = document.querySelector('[data-parallax="video"]');
const pieces = [...document.querySelectorAll('[data-piece-depth]')];
let motionFrame = null;

const clamp = (min, value, max) => Math.min(max, Math.max(min, value));

const updateMotion = () => {
  motionFrame = null;
  if (reduceMotion.matches || !hero || !heroImage || !heroCopy || !signup || !eventDate) return;

  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const heroProgress = clamp(0, scrollY / Math.max(hero.offsetHeight, 1), 1);
  heroImage.style.setProperty('--hero-image-y', `${heroProgress * 72}px`);
  heroCopy.style.setProperty('--hero-copy-y', `${heroProgress * -42}px`);
  signup.style.setProperty('--signup-y', `${heroProgress * 28}px`);
  eventDate.style.setProperty('--date-y', `${heroProgress * 36}px`);

  if (video) {
    const videoRect = video.getBoundingClientRect();
    const videoDistance = (videoRect.top + videoRect.height / 2) - viewportHeight / 2;
    const videoProgress = clamp(-1, videoDistance / viewportHeight, 1);
    video.style.setProperty('--video-y', `${videoProgress * 24}px`);
    video.style.setProperty('--video-rotate', `${videoProgress * 0.65}deg`);
  }

  pieces.forEach(piece => {
    const rect = piece.getBoundingClientRect();
    if (rect.bottom < -120 || rect.top > viewportHeight + 120) return;
    const distance = (rect.top + rect.height / 2) - viewportHeight / 2;
    const depth = Number(piece.dataset.pieceDepth);
    piece.style.setProperty('--piece-y', `${distance * depth}px`);
  });
};

const requestMotion = () => {
  if (motionFrame === null) motionFrame = requestAnimationFrame(updateMotion);
};

updateMotion();
window.addEventListener('scroll', requestMotion, { passive: true });
window.addEventListener('resize', requestMotion, { passive: true });
reduceMotion.addEventListener('change', requestMotion);

const salesSlider = document.querySelector('[data-sales-slider]');
if (salesSlider) {
  const slides = [...salesSlider.querySelectorAll('figure')];
  let activeSlide = Math.max(0, slides.findIndex(slide => slide.classList.contains('active')));
  const showSlide = index => {
    if (!slides.length) return;
    slides[activeSlide]?.classList.remove('active');
    activeSlide = (index + slides.length) % slides.length;
    slides[activeSlide].classList.add('active');
  };

  if (slides.length > 1 && !reduceMotion.matches) {
    window.setInterval(() => showSlide(activeSlide + 1), 3600);
  }
}

const salesParallaxHero = document.querySelector('[data-sales-parallax="hero-bg"]');
let salesParallaxFrame = null;
const updateSalesParallax = () => {
  salesParallaxFrame = null;
  if (reduceMotion.matches || !salesParallaxHero) return;
  const progress = clamp(0, window.scrollY / Math.max(window.innerHeight, 1), 1);
  salesParallaxHero.style.setProperty('--sales-hero-y', `${progress * 34}px`);
};
const requestSalesParallax = () => {
  if (salesParallaxFrame === null) salesParallaxFrame = requestAnimationFrame(updateSalesParallax);
};
updateSalesParallax();
window.addEventListener('scroll', requestSalesParallax, { passive: true });
window.addEventListener('resize', requestSalesParallax, { passive: true });
