import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = request.nextUrl.origin;
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent(error || "Google authorization failed")}`);
  }

  try {
    const res = await fetch(`${backendUrl}/auth/google/callback?code=${encodeURIComponent(code)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.detail || "Google authentication failed on backend";
      return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent(msg)}`);
    }

    const data = await res.json();
    const token = data.access_token;
    const role = data.role || "farmer";

    return NextResponse.redirect(
      `${baseUrl}/api/auth/callback/google/success?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`
    );
  } catch (err: any) {
    return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent("Server network error during OAuth code exchange")}`);
  }
}
