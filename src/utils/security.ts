/**
 * 系統資安防護工具模組
 * 包含：
 * 1. 密碼不可逆雜湊 (SHA-256 + Salt) 與向下相容驗證
 * 2. 富文本 HTML 白名單過濾器 (防範 Stored / DOM XSS)
 * 3. Excel / CSV 匯出公式注入防護 (防範 Formula Injection)
 */

const PASSWORD_HASH_PREFIX = 'sha256$';
const PASSWORD_STATIC_SALT = 'crayon-inventory-tracker-v1-salt';

const toHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const sha256Hex = async (input: string): Promise<string> => {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return toHex(digest);
  }
  // Fallback deterministic hash if Web Crypto is unavailable
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};

/**
 * 將明文密碼雜湊為 `sha256$<hex>` 格式
 */
export const hashPassword = async (password: string, username = ''): Promise<string> => {
  if (password.startsWith(PASSWORD_HASH_PREFIX)) {
    return password;
  }
  const normalizedUser = username.trim().toLowerCase();
  const payload = `${PASSWORD_STATIC_SALT}:${normalizedUser}:${password}`;
  const digestHex = await sha256Hex(payload);
  return `${PASSWORD_HASH_PREFIX}${digestHex}`;
};

/**
 * 常數時間字串比較，降低時序攻擊風險
 */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

/**
 * 驗證使用者輸入之密碼是否正確（同時支援新版雜湊密碼與舊版明文密碼向下相容升級）
 */
export const verifyPassword = async (
  inputPassword: string,
  storedPassword?: string,
  username = ''
): Promise<{ valid: boolean; needsUpgrade: boolean }> => {
  if (!storedPassword) {
    return { valid: false, needsUpgrade: false };
  }

  if (storedPassword.startsWith(PASSWORD_HASH_PREFIX)) {
    const candidateHash = await hashPassword(inputPassword, username);
    return {
      valid: safeEqual(candidateHash, storedPassword),
      needsUpgrade: false
    };
  }

  // 向下相容舊版資料庫中的明文密碼，登入成功後自動升級為雜湊格式
  const isLegacyMatch = safeEqual(inputPassword, storedPassword);
  return {
    valid: isLegacyMatch,
    needsUpgrade: isLegacyMatch
  };
};

// 允許的富文本 HTML 標籤白名單
const ALLOWED_TAGS = new Set([
  'DIV',
  'SPAN',
  'P',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'FONT'
]);

// 允許的 CSS style 屬性白名單
const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'font-size',
  'text-align',
  'text-indent',
  'font-weight',
  'font-style',
  'text-decoration',
  'line-height',
  'background-color'
]);

const DANGEROUS_STYLE_PATTERN = /url\s*\(|expression\s*\(|javascript:|vbscript:|data:|-moz-binding|behavior\s*:/i;

const sanitizeStyleAttribute = (rawStyle: string): string => {
  const safeRules: string[] = [];
  const declarations = rawStyle.split(';');
  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (!val || DANGEROUS_STYLE_PATTERN.test(val)) continue;
    if (/^[#a-zA-Z0-9.,%\s()-]+$/.test(val)) {
      safeRules.push(`${prop}: ${val}`);
    }
  }
  return safeRules.join('; ');
};

/**
 * 清理富文本 HTML，移除所有 script / iframe / on* 事件與危險屬性，防範 Stored XSS
 */
export const sanitizeRichHtml = (dirtyHtml?: string): string => {
  if (!dirtyHtml) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return dirtyHtml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${dirtyHtml}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return doc.createTextNode(node.textContent || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    // 直接丟棄高風險標籤及其內容
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'META', 'LINK', 'BASE'].includes(tag)) {
      return null;
    }

    // 若非白名單標籤，僅保留其安全的子節點文字/元素（展開為 SPAN）
    const targetTag = ALLOWED_TAGS.has(tag) ? tag : 'SPAN';
    const cleanEl = doc.createElement(targetTag);

    if (el.hasAttribute('style')) {
      const safeStyle = sanitizeStyleAttribute(el.getAttribute('style') || '');
      if (safeStyle) {
        cleanEl.setAttribute('style', safeStyle);
      }
    }

    if (targetTag === 'FONT') {
      const color = el.getAttribute('color');
      if (color && /^[#a-zA-Z0-9(),.\s]+$/.test(color) && !DANGEROUS_STYLE_PATTERN.test(color)) {
        cleanEl.setAttribute('color', color);
      }
      const size = el.getAttribute('size');
      if (size && /^[0-9+-]+$/.test(size)) {
        cleanEl.setAttribute('size', size);
      }
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      const cleanedChild = cleanNode(el.childNodes[i]);
      if (cleanedChild) {
        cleanEl.appendChild(cleanedChild);
      }
    }

    return cleanEl;
  };

  const container = doc.createElement('div');
  for (let i = 0; i < root.childNodes.length; i++) {
    const cleaned = cleanNode(root.childNodes[i]);
    if (cleaned) {
      container.appendChild(cleaned);
    }
  }

  return container.innerHTML;
};

/**
 * 防範 Excel / CSV 公式注入 (Formula Injection)
 * 若字串以 =, +, -, @, Tab, CR 開頭（且非純負數），自動於前方加上單引號 '
 */
export const sanitizeSpreadsheetCell = (val: unknown): unknown => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trimStart();
  if (!trimmed) return val;
  const firstChar = trimmed[0];
  if (['=', '+', '-', '@', '\t', '\r'].includes(firstChar)) {
    // 允許純負數字串，但攔截任何公式表達式
    if (firstChar === '-' && /^-\d+(\.\d+)?$/.test(trimmed)) {
      return val;
    }
    return `'${val}`;
  }
  return val;
};

export const sanitizeSpreadsheetRow = <T extends Record<string, unknown>>(row: T): T => {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    result[k] = sanitizeSpreadsheetCell(v);
  }
  return result as T;
};
