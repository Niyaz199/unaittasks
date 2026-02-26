import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"));

  if (!hasAuthCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/my", "/new", "/archive", "/tasks/:path*", "/objects/:path*", "/users/:path*", "/audit", "/profile"]
};
