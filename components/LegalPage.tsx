import Link from "next/link";
import { LEGAL_UPDATED } from "@/lib/legalContent";
export default function LegalPage({title, paragraphs}: {title: string; paragraphs: string[]}) {
 return <article lang="he" dir="rtl" className="mx-auto w-full max-w-4xl px-5 py-12 text-neutral-900">
 <Link href="/" className="underline">חזרה לאתר</Link>
 <h1 className="mt-8 text-3xl font-bold">{title}</h1><p className="mt-3 text-sm">עודכן לאחרונה: {LEGAL_UPDATED}</p>
 <div className="mt-8 space-y-6 leading-8 break-words">{paragraphs.map((p,i)=><p key={i} className="whitespace-pre-line">{p}</p>)}</div>
 </article>;
}
