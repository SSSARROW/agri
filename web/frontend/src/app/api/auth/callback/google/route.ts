import { NextRequest, NextResponse } from "next/server";

/** The account service redirects Google back to /api/auth/callback/google;
 *  hand the code on to the client page that completes the exchange. */
export function GET(req: NextRequest) {
  const target = new URL("/auth/google/callback", req.url);
  req.nextUrl.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return NextResponse.redirect(target);
}
