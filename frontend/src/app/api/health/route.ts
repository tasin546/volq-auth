import { NextResponse } from 'next/server';

export async function GET() {
  let backendUrl = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080').trim();
  backendUrl = backendUrl.replace(/\/+$/, '');

  if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://') && !backendUrl.startsWith('/')) {
    if (backendUrl.includes('.railway.app') || backendUrl.includes('.vercel.app') || backendUrl.includes('.render.com')) {
      backendUrl = `https://${backendUrl}`;
    } else {
      backendUrl = `http://${backendUrl}`;
    }
  }

  if (backendUrl.includes('.railway.internal') && !backendUrl.match(/:\d+$/)) {
    backendUrl = `${backendUrl}:8080`;
  }

  const target = `${backendUrl}/api/v1/client/ping`;

  try {
    const startTime = Date.now();
    const res = await fetch(target, { cache: 'no-store' });
    const duration = Date.now() - startTime;
    const body = await res.json().catch(() => null);

    return NextResponse.json({
      status: 'online',
      latencyMs: duration,
      target,
      backendStatus: res.status,
      response: body,
      env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '(not set)',
        INTERNAL_API_URL: process.env.INTERNAL_API_URL || '(not set)',
      }
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'unreachable',
      target,
      error: err.message,
      code: err.cause?.code || err.code || 'UNKNOWN',
      tip: 'For Railway, set NEXT_PUBLIC_API_URL to your backend public URL (e.g. https://volq-auth-backend-production.up.railway.app).',
      env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '(not set)',
        INTERNAL_API_URL: process.env.INTERNAL_API_URL || '(not set)',
      }
    }, { status: 502 });
  }
}
