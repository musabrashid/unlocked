"use client";

import { useEffect, useRef } from "react";

function removeImageElement(img: HTMLImageElement) {
  const figure = img.closest("figure");
  if (figure) {
    figure.remove();
    return;
  }

  const parent = img.parentElement;
  img.remove();

  if (
    parent &&
    !parent.classList.contains("article-content") &&
    !parent.textContent?.trim() &&
    parent.querySelectorAll("img").length === 0
  ) {
    parent.remove();
  }
}

export function ArticleContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const images = container.querySelectorAll("img");
    for (const img of images) {
      const src = img.getAttribute("src")?.trim();
      if (!src) {
        removeImageElement(img);
        continue;
      }

      const onError = () => removeImageElement(img);
      img.addEventListener("error", onError);

      if (img.complete && img.naturalWidth === 0) {
        removeImageElement(img);
      }
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className="article-content text-[17px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
