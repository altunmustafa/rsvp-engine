import { Readability } from "@mozilla/readability";

export interface ReadableArticle {
  readonly byline: string | null;
  readonly lang: string | null;
  readonly text: string;
  readonly title: string | null;
}

const htmlMediaTypes = ["text/html", "application/xhtml+xml"];

export function extractReadableArticle(sourceHtml: string): ReadableArticle | null {
  const source = new DOMParser().parseFromString(sourceHtml, "text/html");
  const article = new Readability(source).parse();
  const text = article?.textContent?.replace(/\s+/gu, " ").trim();

  if (!article || !text) {
    return null;
  }

  return {
    byline: article.byline ?? null,
    lang: article.lang ?? null,
    text,
    title: article.title ?? null,
  };
}

export async function fetchHtmlSource(sourceUrl: URL, signal?: AbortSignal): Promise<string> {
  if (sourceUrl.protocol !== "http:" && sourceUrl.protocol !== "https:") {
    throw new Error("The URL must use HTTP or HTTPS.");
  }

  const response = await fetch(sourceUrl, {
    credentials: "omit",
    headers: { Accept: "text/html, application/xhtml+xml" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`The server returned HTTP ${response.status}.`);
  }

  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();

  if (!mediaType || !htmlMediaTypes.includes(mediaType)) {
    throw new Error("The URL did not return an HTML document.");
  }

  return response.text();
}
