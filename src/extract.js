const cheerio = require('cheerio');
const config = require('./config');
const { decodeEntities, normalizeUrl, sameSite } = require('./util');

const BOILERPLATE = [
  'script', 'style', 'noscript', 'nav', 'footer', 'aside', 'form', 'iframe',
  'svg', 'template', 'button', 'select', 'video', 'audio', 'object', 'embed',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]', '[role="dialog"]',
  '[role="search"]', '[aria-hidden="true"]', '[hidden]',
  // Navigasi bahasa dan UI yang tidakHernandez
  '#p-lang-btn', '#siteNotice', '.mw-editsection', '.reflist', '.navbox',
  '.sidebar', '.sistersitebox', '.mw-jump-link', '.shortdescription',
  '.hatnote', '.thumbcaption', '.toc', '#toc', '.catlinks', '.printfooter',
  '.mw-indicators', '.language-list', '.interlanguage-link'
].join(', ');

//bekas yang biasanyaAN ada kandungan utama — lebih diutamakan daripada <body>
const CONTENT_SELECTORS = [
  'main', 'article', '[role="main"]', '#mw-content-text', '.mw-parser-output',
  '#content', '.post-content', '.entry-content', '.article-content', '#main-content'
].join(', ');

function pickContentRoot($) {
  for (const selector of CONTENT_SELECTORS.split(', ')) {
    const node = $(selector).first();
    if (node.length) return node;
  }
  return $('body');
}

function meta($, names) {
  for (const name of names) {
    const value =
      $(`meta[property="${name}"]`).attr('content') ||
      $(`meta[name="${name}"]`).attr('content') ||
      $(`meta[itemprop="${name}"]`).attr('content');
    if (value && value.trim()) return decodeEntities(value.trim());
  }
  return '';
}

function absolute($, value, base) {
  if (!value) return null;
  try {
    return normalizeUrl(value, base);
  } catch {
    return null;
  }
}

function extract(html, finalUrl) {
  const $ = cheerio.load(html);
  $('base').remove();

  const title = decodeEntities($('title').first().text().trim()) || finalUrl;
  const siteName = meta($, ['og:site_name']) || new URL(finalUrl).hostname.replace(/^www\./, '');

  const description =
    meta($, ['description', 'og:description', 'twitter:description']) ||
    $('h1').first().text().trim().slice(0, config.docs.summaryChars);

  const lang = $('html').attr('lang') || new URL(finalUrl).locale || '';

  const image = absolute($, meta($, ['og:image', 'twitter:image', 'twitter:image:src']), finalUrl) || '';

  const canonical = absolute($, $('link[rel="canonical"]').attr('href'), finalUrl) || finalUrl;

  const published = meta($, [
    'article:published_time',
    'article:modified_time',
    'og:updated_time',
    'date',
    'datePublished'
  ]);

  const type = meta($, ['og:type']) || 'article';
  const section = meta($, ['article:section', 'og:article:section']) || '';

  const keywords = meta($, ['keywords', 'news_keywords'])
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 25);

  const headings = [];
  $('h1, h2, h3').each((_, element) => {
    const level = Number(element.tagName.slice(1));
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (text.length > 1 && text.length < 160) headings.push({ level, text });
    if (headings.length >= 30) return false;
    return undefined;
  });

  const links = [];
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const resolved = absolute($, href, finalUrl);
    if (!resolved || !sameSite(resolved, finalUrl)) return undefined;
    if (!links.includes(resolved) && links.length < 400) links.push(resolved);
    return undefined;
  });

  const root = pickContentRoot($);
  const body = root.length ? root.clone() : $('body').clone();
  body.find(BOILERPLATE).remove();
  // buang skrip dalam kandungan yang disalin
  body.find('script, style').remove();

  const paragraphText = [];
  body.find('p, li, blockquote, td, pre').each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (text.length > 30 && !paragraphText.includes(text)) paragraphText.push(text);
  });

  const content = paragraphText.join('\n').slice(0, config.docs.contentChars) || body.text().replace(/\s+/g, ' ').trim().slice(0, config.docs.contentChars);

  const summary =
    description ||
    paragraphText.join(' ').slice(0, config.docs.summaryChars) ||
    content.slice(0, config.docs.summaryChars);

  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
  const depth = (() => {
    const segments = new URL(finalUrl).pathname.split('/').filter(Boolean);
    return Math.min(segments.length, 10);
  })();

  const hostname = new URL(finalUrl).hostname.replace(/^www\./, '');
  const path = new URL(finalUrl).pathname;

  // Quality scoring (0-100)
  let quality = 50;
  if (wordCount > 300) quality += 10;
  if (wordCount > 1000) quality += 10;
  if (wordCount > 2000) quality += 5;
  if (headings.length >= 3) quality += 5;
  if (headings.length >= 6) quality += 5;
  if (description && description.length > 50) quality += 5;
  if (canonical === finalUrl) quality += 3;
  if (keywords && keywords.length > 0) quality += 3;
  if (image) quality += 2;
  if (lang && /^en|ms|id|zh|es|fr|de|pt|ru|ja|ko$/i.test(lang)) quality += 2;
  if (/^https:\/\//i.test(finalUrl)) quality += 2;
  if (depth <= 2) quality += 3;
  if (links.length > 5) quality += 2;
  quality = Math.min(100, Math.max(0, quality));

  return {
    title,
    description: summary.slice(0, config.docs.summaryChars),
    content,
    url: finalUrl,
    canonical,
    siteName,
    lang: lang.slice(0, 10),
    type,
    section,
    keywords,
    headings: headings.map((heading) => heading.text),
    links,
    image,
    publishedAt: published || '',
    wordCount,
    depth,
    host: hostname,
    path,
    pathSegments: path.split('/').filter(Boolean).slice(0, 5),
    quality
  };
}

module.exports = { extract };