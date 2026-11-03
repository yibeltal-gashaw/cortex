/**
 * Zero-dependency HTML Sanitizer for Cortex
 * Sanitizes markdown-rendered HTML to prevent XSS in Electron & browser environments.
 */

const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'embed',
  'object',
  'param',
  'base',
  'link',
  'meta',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'applet',
  'frame',
  'frameset'
]);

const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'tel:',
  'ftp:'
]);

function isSafeUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  // Allow relative URLs, fragment IDs, query strings, and root-relative URLs
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?')
  ) {
    return true;
  }
  // Allow safe data URIs for images only
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, 'http://localhost');
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitizes a string of HTML generated from Markdown or untrusted inputs.
 * Strips active scripting elements, inline event listeners, and dangerous URL protocols.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // Non-DOM fallback: strip script tags
    return dirtyHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirtyHtml, 'text/html');

    function cleanNode(node: Node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tagName = el.tagName.toLowerCase();

          // 1. Remove forbidden tags completely
          if (FORBIDDEN_TAGS.has(tagName)) {
            el.remove();
            continue;
          }

          // 2. Strip event handlers (on*) and dangerous attributes
          const attrs = Array.from(el.attributes);
          for (const attr of attrs) {
            const attrName = attr.name.toLowerCase();
            const attrVal = attr.value;

            if (attrName.startsWith('on') || attrName === 'srcdoc' || attrName === 'formaction') {
              el.removeAttribute(attr.name);
              continue;
            }

            // 3. Verify protocol on URL attributes
            if (attrName === 'href' || attrName === 'src' || attrName === 'xlink:href') {
              if (!isSafeUrl(attrVal)) {
                el.removeAttribute(attr.name);
              }
            }
          }

          // 4. Harden external links to prevent window.opener hijacking in Electron/browser
          if (tagName === 'a') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }

          cleanNode(el);
        }
      }
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
  } catch (err) {
    console.warn('HTML Sanitization error, falling back to stripped text:', err);
    return dirtyHtml.replace(/<[^>]*>/g, '');
  }
}

