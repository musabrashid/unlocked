import { NextResponse } from "next/server";
import { unlockArticle } from "@/lib/unlock";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(body.url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "URL must be http or https" }, { status: 400 });
    }

    const article = await unlockArticle(body.url);

    if (!article) {
      return NextResponse.json(
        {
          error:
            "Could not unlock this article. It may be paywalled with no full public archive yet — try an older article or a different source.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ article });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while unlocking the article." },
      { status: 500 },
    );
  }
}
