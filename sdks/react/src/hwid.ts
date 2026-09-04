/**
 * Deterministic Browser Hardware / Device Fingerprint (HWID) Generator.
 * Compiles Canvas 2D, WebGL, Screen, and Hardware entropy vectors
 * into a cryptographic SHA-256 identifier.
 */

const HWID_STORAGE_KEY = 'volq_device_hwid_v1';

export async function getBrowserHWID(): Promise<string> {
  if (typeof window === 'undefined') {
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }

  // Check persistent local storage cache first
  try {
    const cached = localStorage.getItem(HWID_STORAGE_KEY);
    if (cached && cached.length === 64) {
      return cached;
    }
  } catch {
    // Storage access might be restricted in private browsing mode
  }

  const components: string[] = [];

  // 1. Hardware Concurrency & System Memory
  components.push(`cores:${navigator.hardwareConcurrency || 4}`);
  components.push(`mem:${(navigator as any).deviceMemory || 'unknown'}`);
  components.push(`platform:${navigator.platform || ''}`);
  components.push(`lang:${navigator.language || ''}`);

  // 2. Screen & Display Metrics
  try {
    components.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
    components.push(`dpr:${window.devicePixelRatio || 1}`);
  } catch {
    components.push('screen:default');
  }

  // 3. TimeZone
  try {
    components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}`);
  } catch {
    components.push('tz:UTC');
  }

  // 4. HTML5 Canvas 2D Rendering Entropy
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial', sans-serif";
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);

      ctx.fillStyle = '#069';
      ctx.fillText('VOLQ-Auth HWID Hash 🔐', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('VOLQ-Auth HWID Hash 🔐', 4, 17);

      components.push(`canvas:${canvas.toDataURL()}`);
    }
  } catch {
    components.push('canvas:unavailable');
  }

  // 5. WebGL Vendor & Renderer Strings
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        components.push(`gl:${vendor}~${renderer}`);
      } else {
        components.push(`gl:${gl.getParameter(gl.VENDOR)}~${gl.getParameter(gl.RENDERER)}`);
      }
    }
  } catch {
    components.push('gl:unavailable');
  }

  const rawFingerprint = components.join('|||');

  // Hash with Web Crypto SHA-256
  let hwidHex = '';
  if (window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(rawFingerprint);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    hwidHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback simple 64-char hash
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < rawFingerprint.length; i++) {
      const ch = rawFingerprint.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
    hwidHex = (part1 + part2).repeat(4);
  }

  try {
    localStorage.setItem(HWID_STORAGE_KEY, hwidHex);
  } catch {
    // ignore storage quota / access issues
  }

  return hwidHex;
}
