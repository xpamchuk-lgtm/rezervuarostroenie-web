import { useEffect } from "react";

type SeoProps = {
  title: string;
  description: string;
  canonical?: string;
  robots?: string;
  ogType?: "website" | "article";
  image?: string;
};

const BASE_URL = "https://rezervuarostroenie.ru";
const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;

function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let node = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    document.head.appendChild(node);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    node?.setAttribute(key, value);
  });
}

function upsertLink(rel: string, href: string): void {
  let node = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", rel);
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

export default function Seo({
  title,
  description,
  canonical,
  robots = "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1",
  ogType = "website",
  image = DEFAULT_IMAGE,
}: SeoProps) {
  useEffect(() => {
    document.title = title;

    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: robots });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: ogType });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "ru_RU" });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });

    if (canonical) {
      upsertLink("canonical", canonical);
      upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    } else {
      document.head.querySelector('link[rel="canonical"]')?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
    }
  }, [title, description, canonical, robots, ogType, image]);

  return null;
}
