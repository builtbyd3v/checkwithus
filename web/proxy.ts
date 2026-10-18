import { NextResponse } from 'next/server';
import { auth0 } from './lib/auth0/web';

export async function proxy(request: Request) {
  // ponytail: a deploy with no Auth0 config (Vercel previews) serves public pages instead of a 500 everywhere.
  // Production always has AUTH0_DOMAIN, so it always runs the SDK middleware below.
  if (!process.env.AUTH0_DOMAIN) return NextResponse.next();
  return auth0.middleware(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
