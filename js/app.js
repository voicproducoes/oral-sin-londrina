/* ── Header shadow ── */
const header = document.getElementById('site-header');
let headerScrollTicking = false;
let headerScrolled = false;

function syncHeaderShadow() {
  headerScrollTicking = false;
  const shouldBeScrolled = window.scrollY > 20;
  if (shouldBeScrolled === headerScrolled) return;
  headerScrolled = shouldBeScrolled;
  header.classList.toggle('scrolled', shouldBeScrolled);
}

syncHeaderShadow();
window.addEventListener('scroll', () => {
  if (headerScrollTicking) return;
  headerScrollTicking = true;
  window.requestAnimationFrame(syncHeaderShadow);
}, { passive: true });

/* ── Fade-in ── */
const animatedSections = document.querySelectorAll('.fade-up:not(.above-fold)');
if ('IntersectionObserver' in window && animatedSections.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '120px 0px -40px 0px' });

  animatedSections.forEach(el => observer.observe(el));
} else {
  animatedSections.forEach(el => el.classList.add('visible'));
}

/* ── Accordion ── */
const accordion = document.getElementById('accordion');
const accordionItems = Array.from(accordion.querySelectorAll('.acc-item'));
let openAccordionItem = accordionItems.find(item => item.classList.contains('active')) || null;
let openAccordionTrigger = openAccordionItem ? openAccordionItem.querySelector('.acc-trigger') : null;
let openAccordionContent = openAccordionItem ? openAccordionItem.querySelector('.acc-content') : null;

accordion.querySelectorAll('.acc-trigger').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const item    = trigger.closest('.acc-item');
    const content = item.querySelector('.acc-content');
    const isOpen  = item === openAccordionItem;

    if (openAccordionItem) {
      openAccordionItem.classList.remove('active');
      openAccordionContent.classList.remove('open');
      openAccordionTrigger.setAttribute('aria-expanded', 'false');
    }

    if (isOpen) {
      openAccordionItem = openAccordionTrigger = openAccordionContent = null;
      return;
    }

    item.classList.add('active');
    content.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    openAccordionItem    = item;
    openAccordionTrigger = trigger;
    openAccordionContent = content;
  });
});

/* ══════════════════════════════════════════
   TRACKING — Pixel + CAPI
══════════════════════════════════════════ */

const WEBHOOK_URL   = 'https://nnwb.voictech.com.br/webhook/oralsin';
const LP_PAGINA     = window.__LP_PAGINA  || 'index';
const LP_VARIANT    = window.__LP_VARIANT || null;

/* URL do backend CAPI (definida no <head> de cada HTML via window.__CAPI_ENDPOINT).
   Se não configurada, sendCAPI é no-op — não quebra nada. */
const CAPI_ENDPOINT = window.__CAPI_ENDPOINT || null;

let metaFormStarted = false;

/* ── Helpers de cookie / Meta ── */

function readCookie(name) {
  const row = document.cookie.split('; ').find(r => r.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.split('=').slice(1).join('=')) : null;
}

function buildMetaEventId() {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildMetaFbc() {
  const existing = readCookie('_fbc');
  if (existing) return existing;
  const fbclid = new URLSearchParams(window.location.search).get('fbclid');
  if (!fbclid) return null;
  const fbc = `fb.1.${Date.now()}.${fbclid}`;
  document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=7776000; SameSite=Lax`;
  return fbc;
}

function getUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source:   p.get('utm_source')   || null,
    utm_medium:   p.get('utm_medium')   || null,
    utm_campaign: p.get('utm_campaign') || null,
    utm_content:  p.get('utm_content')  || null,
  };
}

/* Google Ads conversion — definida aqui para ser acessível mesmo sem gtag.js carregado */
function gtag_report_conversion(url) {
  gtag('event', 'conversion', {
    send_to:        'AW-10975665738/WYCZCJafzuAYEMq8zfEo',
    event_callback: url ? () => { window.location = url; } : undefined,
  });
  return false;
}

/* ── CAPI server-side ──
   Envia evento para o backend (que o encaminha para a Meta Graph API com o token).
   O mesmo event_id do Pixel garante deduplicação automática pela Meta.
   Fire-and-forget: nunca bloqueia UX. */
function sendCAPI(eventName, eventId, extra = {}) {
  if (!CAPI_ENDPOINT) return;

  const body = {
    event_name:        eventName,
    event_id:          eventId,
    event_time:        Math.floor(Date.now() / 1000),
    event_source_url:  window.location.href,
    client_user_agent: navigator.userAgent,
    pagina:            LP_PAGINA,
    fbp:               readCookie('_fbp') || null,
    fbc:               readCookie('_fbc') || null,
    ...getUtmParams(),
    ...(LP_VARIANT && { variant: LP_VARIANT }),
    ...extra,
  };

  fetch(CAPI_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => {});
}

/* ══════════════════════════════════════════
   FORMULÁRIO
══════════════════════════════════════════ */

const form       = document.getElementById('contato-form');
const success    = document.getElementById('form-success');
const ctaLinks   = document.querySelectorAll('a[href="#formulario"]');
const formInputs = Array.from(form.querySelectorAll('.form-input'));
const formFields = {
  nome:     form.elements.namedItem('nome'),
  telefone: form.elements.namedItem('telefone'),
};
const formErrors = {
  nome:     form.querySelector('[data-error="nome"]'),
  telefone: form.querySelector('[data-error="telefone"]'),
};

/* CTA click → Contact
   Browser Pixel + CAPI (sem dados PII ainda — só IP/UA no servidor) */
ctaLinks.forEach(link => {
  link.addEventListener('click', () => {
    const eventId = buildMetaEventId();

    if (typeof fbq === 'function') {
      const props = { content_name: 'Agendar avaliação', content_category: 'CTA' };
      if (LP_VARIANT) props.variant = LP_VARIANT;
      fbq('track', 'Contact', props, { eventID: eventId });
    }

    sendCAPI('Contact', eventId);
  });
});

/* Primeiro foco no formulário → FormStart
   Browser Pixel + CAPI */
formInputs.forEach(input => {
  input.addEventListener('focus', () => {
    if (metaFormStarted) return;
    metaFormStarted = true;
    const eventId = buildMetaEventId();

    if (typeof fbq === 'function') {
      const props = { form_name: 'Agende sua avaliação' };
      if (LP_VARIANT) props.variant = LP_VARIANT;
      fbq('trackCustom', 'FormStart', props, { eventID: eventId });
    }

    sendCAPI('FormStart', eventId);
  }, { once: true });
});

/* Envio do formulário → Lead
   n8n webhook (WhatsApp) + GTM + Google Ads + Browser Pixel + CAPI (com PII hashed no servidor) */
form.addEventListener('submit', async e => {
  e.preventDefault();
  let valid = true;

  ['nome', 'telefone'].forEach(name => {
    const el  = formFields[name];
    const err = formErrors[name];
    const ok  = el.value.trim().length >= 2 &&
                (name !== 'telefone' || el.value.replace(/\D/g, '').length >= 10);
    err.classList.toggle('hidden', ok);
    if (!ok && valid) { el.focus(); valid = false; }
  });

  if (!valid) return;

  /* event_id compartilhado entre Pixel e CAPI → Meta deduplica automaticamente */
  const eventId   = buildMetaEventId();
  const eventTime = Math.floor(Date.now() / 1000);
  const nome      = formFields.nome.value.trim();
  const telefone  = formFields.telefone.value.trim();
  const fbp       = readCookie('_fbp') || null;
  const fbc       = buildMetaFbc()     || null;
  const utms      = getUtmParams();

  /* 1. n8n → WhatsApp / CRM / planilha */
  const webhookPayload = {
    event_name:        'Lead',
    event_id:          eventId,
    event_time:        eventTime,
    action_source:     'website',
    event_source_url:  window.location.href,
    client_user_agent: navigator.userAgent,
    fbp,
    fbc,
    nome,
    telefone,
    pagina:            LP_PAGINA,
    ...utms,
    ...(LP_VARIANT && { variant: LP_VARIANT }),
  };

  fetch(WEBHOOK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(webhookPayload),
  }).catch(err => console.error('Webhook error:', err));

  /* 2. GTM dataLayer */
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'lead_submitted', ...webhookPayload });

  /* 3. Google Ads conversion */
  gtag_report_conversion();

  /* 4. Meta Pixel (browser) — rápido, dispara imediatamente */
  if (typeof fbq === 'function') {
    const props = { content_name: 'Agende sua avaliação', content_category: 'Formulário', status: 'submitted' };
    if (LP_VARIANT) props.variant = LP_VARIANT;
    fbq('track', 'Lead', props, { eventID: eventId });
  }

  /* 5. Meta CAPI (server-side) — mesmo event_id, hashing acontece no servidor */
  sendCAPI('Lead', eventId, { nome, telefone, fbp, fbc });

  /* Mostrar tela de sucesso */
  form.style.display    = 'none';
  success.style.display = 'block';
  success.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

/* Limpar erros ao digitar */
formInputs.forEach(input => {
  input.addEventListener('input', () => {
    const err = formErrors[input.name];
    if (err) err.classList.add('hidden');
  });
});

/* ── Máscara telefone ── */
const tel = document.getElementById('telefone');
tel.addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
  if      (v.length >= 7) v = v.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4');
  else if (v.length >= 3) v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  else if (v.length >= 1) v = v.replace(/^(\d{0,2})/, '($1');
  e.target.value = v;
});
