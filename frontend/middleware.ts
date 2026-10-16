import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (process.env.DEMO_ACCESS_ENABLED !== "true") {
    return NextResponse.next();
  }

  const username = process.env.DEMO_USERNAME;
  const password = process.env.DEMO_PASSWORD;

  if (!username || !password) {
    return new NextResponse("Demo access is not configured.", {
      status: 503,
    });
  }

  const expectedAuthorization =
    "Basic " + btoa(`${username}:${password}`);

  const suppliedAuthorization =
    request.headers.get("authorization");

  if (suppliedAuthorization === expectedAuthorization) {
    return NextResponse.next();
  }

  return new NextResponse("CAUSYN AI private demo", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="CAUSYN AI Demo"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};