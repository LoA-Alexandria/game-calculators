import Link from "next/link";

export function CalculatorHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header>
      <Link className="back-link" href="/">← All calculators</Link>
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
