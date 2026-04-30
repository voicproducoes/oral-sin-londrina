/* ─────────────────────────────────────────
   HEADER SHADOW
───────────────────────────────────────── */

const header = document.getElementById('site-header');
let headerScrollTicking = false;
let headerScrolled = false;

function syncHeaderShadow() {
  if (!header) return;

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


/* ─────────────────────────────────────────
   FADE / REVEAL
───────────────────────────────────────── */

/*
  Suporte para os dois padrões:
  - .fade-up
  - .reveal

  Assim o app.js funciona mesmo se uma LP usar uma classe
  e outra LP usar outra.
*/

const animatedSections = document.querySelectorAll(
  '.fade-up:not(.above-fold), .reveal:not(.above-fold)'
);

if ('IntersectionObserver' in window && animatedSections.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.08,
    rootMargin: '120px 0px -40px 0px',
  });

  animatedSections.forEach(el => observer.observe(el));
} else {
  animatedSections.forEach(el => el.classList.add('visible'));
}


/* ─────────────────────────────────────────
   ACCORDION
───────────────────────────────────────── */

const accordion = document.getElementById('accordion');

if (accordion) {
  const accordionItems = Array.from(accordion.querySelectorAll('.acc-item'));

  let openAccordionItem = accordionItems.find(item => item.classList.contains('active')) || null;
  let openAccordionTrigger = openAccordionItem ? openAccordionItem.querySelector('.acc-trigger') : null;
  let openAccordionContent = openAccordionItem ? openAccordionItem.querySelector('.acc-content') : null;

  accordion.querySelectorAll('.acc-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.acc-item');
      const content = item.querySelector('.acc-content');
      const isOpen = item === openAccordionItem;

      if (openAccordionItem) {
        openAccordionItem.classList.remove('active');

        if (openAccordionContent) {
          openAccordionContent.classList.remove('open');
        }

        if (openAccordionTrigger) {
          openAccordionTrigger.setAttribute('aria-expanded', 'false');
        }
      }

      if (isOpen) {
        openAccordionItem = null;
        openAccordionTrigger = null;
        openAccordionContent = null;
        return;
      }

      item.classList.add('active');
      content.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');

      openAccordionItem = item;
      openAccordionTrigger = trigger;
      openAccordionContent = content;
    });
  });
}


/* ══════════════════════════════════════════
   TRACKING — PIXEL + CAPI + N8N
══════════════════════════════════════════ */

const WEBHOOK_URL = 'https://nnwb.voictech.com.br/webhook/oral-sin-londrina';

const LP_PAGINA = window.__LP_PAGINA || 'index';
const LP_VARIANT = window.__LP_VARIANT || null;

/*
  URL do backend CAPI.
  Ela é definida no <head> de cada HTML:

  window.__CAPI_ENDPOINT = 'https://capi.voictech.com.br/api/oral-sin/event';

  Se não existir, o envio CAPI simplesmente não roda.
*/
const CAPI_ENDPOINT = window.__CAPI_ENDPOINT || null;

let metaFormStarted = false;


/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */

function readCookie(name) {
  const row = document.cookie
    .split('; ')
    .find(r => r.startsWith(`${name}=`));

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
    utm_source: p.get('utm_source') || null,
    utm_medium: p.get('utm_medium') || null,
    utm_campaign: p.get('utm_campaign') || null,
    utm_content: p.get('utm_content') || null,
    utm_term: p.get('utm_term') || null,
  };
}

function getCleanPayloadValue(value) {
  return value === null || value === undefined ? '' : value;
}


/* ─────────────────────────────────────────
   GOOGLE ADS CONVERSION
───────────────────────────────────────── */

function gtag_report_conversion(url) {
  if (typeof gtag !== 'function') return false;

  gtag('event', 'conversion', {
    send_to: 'AW-10975665738/WYCZCJafzuAYEMq8zfEo',
    event_callback: url ? () => { window.location = url; } : undefined,
  });

  return false;
}


/* ─────────────────────────────────────────
   META CAPI
───────────────────────────────────────── */

function sendCAPI(eventName, eventId, extra = {}) {
  if (!CAPI_ENDPOINT) return;

  const body = {
    event_name: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: window.location.href,
    client_user_agent: navigator.userAgent,
    pagina: LP_PAGINA,
    fbp: readCookie('_fbp') || null,
    fbc: readCookie('_fbc') || null,
    ...getUtmParams(),
    ...(LP_VARIANT && { variant: LP_VARIANT }),
    ...extra,
  };

  fetch(CAPI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).catch(error => {
    console.warn('Erro ao enviar CAPI:', error);
  });
}


/* ══════════════════════════════════════════
   FORMULÁRIO
══════════════════════════════════════════ */

const form = document.getElementById('contato-form');
const success = document.getElementById('form-success');
const ctaLinks = document.querySelectorAll('a[href="#formulario"]');

if (form) {
  const formInputs = Array.from(form.querySelectorAll('.form-input'));

  const formFields = {
    nome: form.elements.namedItem('nome'),
    telefone: form.elements.namedItem('telefone'),
  };

  const formErrors = {
    nome: form.querySelector('[data-error="nome"]'),
    telefone: form.querySelector('[data-error="telefone"]'),
  };


  /* ─────────────────────────────────────────
     CTA CLICK → CONTACT
  ───────────────────────────────────────── */

  ctaLinks.forEach(link => {
    link.addEventListener('click', () => {
      const eventId = buildMetaEventId();

      if (typeof fbq === 'function') {
        const props = {
          content_name: 'Agendar avaliação',
          content_category: 'CTA',
        };

        if (LP_VARIANT) props.variant = LP_VARIANT;

        fbq('track', 'Contact', props, {
          eventID: eventId,
        });
      }

      sendCAPI('Contact', eventId);
    });
  });


  /* ─────────────────────────────────────────
     PRIMEIRO FOCO NO FORM → FORMSTART
  ───────────────────────────────────────── */

  formInputs.forEach(input => {
    input.addEventListener('focus', () => {
      if (metaFormStarted) return;

      metaFormStarted = true;

      const eventId = buildMetaEventId();

      if (typeof fbq === 'function') {
        const props = {
          form_name: 'Agende sua avaliação',
        };

        if (LP_VARIANT) props.variant = LP_VARIANT;

        fbq('trackCustom', 'FormStart', props, {
          eventID: eventId,
        });
      }

      sendCAPI('FormStart', eventId);
    }, { once: true });
  });


  /* ─────────────────────────────────────────
     VALIDAÇÃO
  ───────────────────────────────────────── */

  function setFieldError(name, show) {
    const err = formErrors[name];

    if (!err) return;

    /*
      No seu HTML original, o CSS usa:
      .form-error { display: none; }
      .form-error.visible { display: block; }

      Por isso usamos "visible".
    */
    err.classList.toggle('visible', show);
    err.classList.toggle('hidden', !show);
  }

  function validateForm() {
    let valid = true;

    const nome = formFields.nome;
    const telefone = formFields.telefone;

    const nomeOk = nome && nome.value.trim().length >= 2;
    const telefoneOk = telefone && telefone.value.replace(/\D/g, '').length >= 10;

    setFieldError('nome', !nomeOk);
    setFieldError('telefone', !telefoneOk);

    if (!nomeOk) {
      nome.focus();
      valid = false;
    } else if (!telefoneOk) {
      telefone.focus();
      valid = false;
    }

    return valid;
  }


  /* ─────────────────────────────────────────
     SUBMIT → N8N + LEAD
  ───────────────────────────────────────── */

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!validateForm()) return;

    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.innerHTML;
      submitButton.innerHTML = 'Enviando...';
    }

    const eventId = buildMetaEventId();
    const eventTime = Math.floor(Date.now() / 1000);

    const nome = formFields.nome.value.trim();
    const telefone = formFields.telefone.value.trim();

    const fbp = readCookie('_fbp') || null;
    const fbc = buildMetaFbc() || null;
    const utms = getUtmParams();

    const webhookPayload = {
      event_name: 'Lead',
      event_id: eventId,
      event_time: eventTime,
      action_source: 'website',
      event_source_url: window.location.href,
      client_user_agent: navigator.userAgent,

      fbp,
      fbc,

      nome,
      telefone,
      pagina: LP_PAGINA,

      utm_source: getCleanPayloadValue(utms.utm_source),
      utm_medium: getCleanPayloadValue(utms.utm_medium),
      utm_campaign: getCleanPayloadValue(utms.utm_campaign),
      utm_content: getCleanPayloadValue(utms.utm_content),
      utm_term: getCleanPayloadValue(utms.utm_term),

      ...(LP_VARIANT && { variant: LP_VARIANT }),
    };

    try {
      /*
        1. Primeiro envia para o n8n.
        Se isso falhar, NÃO dispara Lead para Meta/Google.
      */
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        throw new Error(`Erro no webhook: ${response.status}`);
      }

      /*
        2. GTM dataLayer
      */
      window.dataLayer = window.dataLayer || [];

      window.dataLayer.push({
        event: 'lead_submitted',
        ...webhookPayload,
      });

      /*
        3. Google Ads conversion
      */
      gtag_report_conversion();

      /*
        4. Meta Pixel browser — Lead
      */
      if (typeof fbq === 'function') {
        const props = {
          content_name: 'Agende sua avaliação',
          content_category: 'Formulário',
          status: 'submitted',
        };

        if (LP_VARIANT) props.variant = LP_VARIANT;

        fbq('track', 'Lead', props, {
          eventID: eventId,
        });
      }

      /*
        5. Meta CAPI server-side
      */
      sendCAPI('Lead', eventId, {
        nome,
        telefone,
        fbp,
        fbc,
      });

      /*
        6. Sucesso visual
      */
      form.style.display = 'none';

      if (success) {
        success.style.display = 'block';
        success.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }

    } catch (error) {
      console.error('Erro ao enviar lead:', error);

      alert('Não conseguimos enviar seus dados agora. Por favor, tente novamente em alguns instantes.');

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = submitButton.dataset.originalText || 'Quero agendar minha avaliação';
      }
    }
  });


  /* ─────────────────────────────────────────
     LIMPAR ERROS AO DIGITAR
  ───────────────────────────────────────── */

  formInputs.forEach(input => {
    input.addEventListener('input', () => {
      const err = formErrors[input.name];

      if (err) {
        err.classList.remove('visible');
        err.classList.add('hidden');
      }
    });
  });
}


/* ─────────────────────────────────────────
   MÁSCARA TELEFONE
───────────────────────────────────────── */

const tel = document.getElementById('telefone');

if (tel) {
  tel.addEventListener('input', event => {
    let v = event.target.value.replace(/\D/g, '').slice(0, 11);

    if (v.length >= 7) {
      v = v.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4');
    } else if (v.length >= 3) {
      v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else if (v.length >= 1) {
      v = v.replace(/^(\d{0,2})/, '($1');
    }

    event.target.value = v;
  });
}
