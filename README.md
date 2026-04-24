# Oral Sin Londrina

Landing page de conversão da Oral Sin Londrina, otimizada para mobile, captura de leads e integração com mídia paga.

## Escopo

- Landing page principal em [index.html](/Users/giovanelazari/oral-sin/index.html)
- Variante B para teste A/B em [index-b.html](/Users/giovanelazari/oral-sin/index-b.html) (formulário na primeira dobra)
- Assets locais otimizados em `.webp`
- Fontes locais em `fonts/`
- Regras de cache e compressão em [.htaccess](/Users/giovanelazari/oral-sin/.htaccess)

## Stack

- HTML estático
- CSS inline com utilitários gerados
- JavaScript vanilla
- Google Tag Manager
- Google Analytics / Google Ads via `gtag`
- Meta Pixel no browser
- Webhook server-side para n8n

## Captação e tracking

- O formulário envia leads para o webhook operacional da Oral Sin
- O fluxo de automação consolida leads de landing page e WhatsApp por telefone
- O browser dispara eventos de conversão para Google Ads e Meta Pixel
- A estrutura está preparada para Meta Conversions API no n8n, com deduplicação por `event_id`

## Otimizações aplicadas

- Hero e assets principais priorizados para mobile
- Fontes locais com preload
- Imagem LCP com preload responsivo
- Carregamento adiado de scripts de terceiros para reduzir custo no first paint
- Seções abaixo da dobra com `content-visibility`
- Compressão e cache longo para assets estáticos via Apache

## Publicação

Arquivos críticos para subir:

- [index.html](/Users/giovanelazari/oral-sin/index.html)
- [index-b.html](/Users/giovanelazari/oral-sin/index-b.html)
- [.htaccess](/Users/giovanelazari/oral-sin/.htaccess)
- `fonts/`
- `*.webp`
- `favicon.svg`
- `robots.txt`
- `sitemap.xml`

## Teste A/B

- URL da variante A (controle): `/` (index.html) — formulário no final da página.
- URL da variante B: `/index-b.html` — formulário na primeira dobra, ao lado da copy.
- As duas páginas ficam no ar simultaneamente; `index-b.html` tem `noindex` + `canonical` apontando para `/` para não dividir SEO.
- Diferenciação nos dados:
  - dataLayer: `{ variant: 'B' }` em todos os eventos da variante B.
  - Meta Pixel: parâmetro `variant: 'B'` nos eventos `PageView`, `ViewContent`, `Contact`, `FormStart`, `Lead`.
  - Webhook n8n: payload inclui `variant: 'B'` e `pagina: 'index-b'`.
- UTM sugerido para campanhas que mandam tráfego para a variante B: `?utm_content=var_b`.
- No GA4, criar segmento/dimensão custom `variant` para separar as conversões.

## Observações

- A pasta `agente/` contém arquivos locais de automação, memória e staging; ela não deve ser publicada no repositório.
- Segredos e tokens operacionais devem permanecer fora do GitHub e configurados apenas nos serviços responsáveis.
