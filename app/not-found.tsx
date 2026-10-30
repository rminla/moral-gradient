import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto max-w-xl px-5 py-24 text-center"><h1 className="serif text-4xl">Not here.</h1><p className="mt-2 text-black/60">That page doesn&apos;t exist, or it&apos;s a private hold-out item.</p><Link href="/results" className="btn-primary mt-6">Back to results</Link></main>;
}
