import { SITE_NAME, SITE_URL } from "@/lib/config";

export default function Share({ path, text, compact = false }: { path: string; text: string; compact?: boolean }) {
  const url = `${SITE_URL}${path}`;
  const x = `https://x.com/intent/post?text=${encodeURIComponent(`${text} — via ${SITE_NAME}`)}&url=${encodeURIComponent(url)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const cls = compact ? "btn-ghost !px-2.5 !py-1 !text-xs" : "btn-ghost !py-1.5";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a className={cls} href={x} target="_blank" rel="noopener noreferrer" aria-label="Share on X">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8-9.2L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9h-2L17.7 20Z" /></svg>
        Post
      </a>
      <a className={cls} href={li} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-4.9c0-1.17-.02-2.68-1.63-2.68-1.64 0-1.89 1.28-1.89 2.6V21h-4V9.75Z" /></svg>
        Share
      </a>
      {!compact && <a className={cls} href={`${path}/opengraph-image`} target="_blank" rel="noopener">Download image</a>}
    </div>
  );
}
