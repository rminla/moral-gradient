"use client";
import { useEffect, useState } from "react";
import { SITE_NAME, SITE_URL } from "@/lib/config";

type Props = {
  /** Site path to share, e.g. "/try?d=fb". Never include anything about the visitor (answers, ids). */
  path: string;
  /** One-line text for X and the native share sheet. */
  text: string;
  /** Email subject; defaults to the site name. */
  subject?: string;
  /** Email body before the link; defaults to `text`. */
  emailBody?: string;
  compact?: boolean;
  label?: string;
  /** Adds a "Download image" link to the page's OG image (finding pages). */
  image?: boolean;
};

const I = {
  mail: <path d="M2 5h20v14H2V5Zm2 2v.4l8 5.2 8-5.2V7H4Zm16 2.8-8 5.2-8-5.2V17h16V9.8Z" />,
  x: <path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8-9.2L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9h-2L17.7 20Z" />,
  li: <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-4.9c0-1.17-.02-2.68-1.63-2.68-1.64 0-1.89 1.28-1.89 2.6V21h-4V9.75Z" />,
  link: <path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-2 2-1.4-1.4 2-2a1 1 0 1 0-1.4-1.4l-3.5 3.5a1 1 0 0 1-1.4 0ZM13.4 10.6a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l2-2 1.4 1.4-2 2a1 1 0 1 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0Z" />,
};
const Icon = ({ d }: { d: React.ReactNode }) => <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden>{d}</svg>;

/** One share row for the whole site: Email, X, LinkedIn, Copy link, and "More…" (native sheet) where supported. */
export default function Share({ path, text, subject, emailBody, compact = false, label, image = false }: Props) {
  const url = `${SITE_URL}${path}`;
  const [canNative, setCanNative] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const mail = `mailto:?subject=${encodeURIComponent(subject || SITE_NAME)}&body=${encodeURIComponent(`${emailBody || text}\n\n${url}`)}`;
  const x = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  async function copy() {
    try { await navigator.clipboard.writeText(url); } catch {
      const t = document.createElement("textarea"); t.value = url; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const cls = compact ? "btn-ghost !gap-1.5 !px-2 !py-1 !text-[11px]" : "btn-ghost !gap-2 !px-3 !py-2";
  return (
    <div data-share>
      {label && <div className="label mb-2">{label}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <a className={cls} href={mail} aria-label="Share by email"><Icon d={I.mail} />Email</a>
        <a className={cls} href={x} target="_blank" rel="noopener noreferrer" aria-label="Share on X"><Icon d={I.x} />X</a>
        <a className={cls} href={li} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"><Icon d={I.li} />LinkedIn</a>
        <button type="button" className={cls} onClick={copy} aria-label="Copy link"><Icon d={I.link} /><span aria-live="polite">{copied ? "Copied" : "Copy link"}</span></button>
        {canNative && <button type="button" className={cls} onClick={() => navigator.share({ title: subject || SITE_NAME, text, url }).catch(() => {})}>More…</button>}
        {image && <a className={cls} href={`${path.split("?")[0]}/opengraph-image`} target="_blank" rel="noopener">Download image</a>}
      </div>
    </div>
  );
}
