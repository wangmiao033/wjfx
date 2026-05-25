import type { Metadata } from "next";
import policyContent from "./policy-content.json";

export const metadata: Metadata = {
  title: "隐私政策",
  description: "隐私政策",
};

function isSectionTitle(text: string) {
  return /^[一二三四五六七八九十]+、/.test(text);
}

function isSubTitle(text: string) {
  return text === "前言" || text === "隐私政策";
}

export default function PrivacyPage() {
  const paragraphs = policyContent as string[];
  const title = paragraphs[0] ?? "隐私政策";
  const meta = paragraphs.slice(1, 4);
  const body = paragraphs.slice(4);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <article className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <div>
          <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">
            {title}
          </h1>
          <div className="mt-4 space-y-1 text-sm text-slate-500">
            {meta.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>

          <div className="mt-8 space-y-4 text-[15px] leading-8 text-slate-700">
            {body.map((paragraph, index) => {
              if (isSectionTitle(paragraph)) {
                return (
                  <h2
                    key={`${paragraph}-${index}`}
                    className="pt-5 text-lg font-bold leading-8 text-slate-950"
                  >
                    {paragraph}
                  </h2>
                );
              }

              if (isSubTitle(paragraph)) {
                return (
                  <h2
                    key={`${paragraph}-${index}`}
                    className="pt-2 text-base font-semibold text-slate-950"
                  >
                    {paragraph}
                  </h2>
                );
              }

              return <p key={`${paragraph}-${index}`}>{paragraph}</p>;
            })}
          </div>
        </div>
      </article>
    </main>
  );
}
