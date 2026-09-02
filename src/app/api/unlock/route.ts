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
            "Could not unlock this article. Try a different link or check if an archive exists.",
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
