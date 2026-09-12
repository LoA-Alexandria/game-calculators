const calculators = [
  {
    name: "Example resource calculator",
    description:
      "A small reference implementation showing validation, calculations, and responsive results.",
    href: "/calculators/example/",
    status: "Template",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">LoA Alexandria</div>
        <h1>Game calculators,<br />built in the open.</h1>
        <p className="lede">
          A shared home for focused, reliable tools that turn game data into
          useful answers. Each calculator is designed to be easy to verify,
          extend, and maintain with people or coding agents.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#calculators">Browse calculators</a>
          <a className="button button-secondary" href="https://github.com/LoA-Alexandria/game-calculators">Contribute on GitHub</a>
        </div>
      </section>

      <section className="section" id="calculators">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Toolbox</div>
            <h2>Calculators</h2>
          </div>
          <span className="count">{calculators.length} available</span>
        </div>

        <div className="card-grid">
          {calculators.map((calculator) => (
            <Link className="calculator-card" href={calculator.href} key={calculator.name}>
              <div className="card-topline">
                <span className="status">{calculator.status}</span>
                <span aria-hidden="true" className="arrow">↗</span>
              </div>
              <h3>{calculator.name}</h3>
              <p>{calculator.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="principles section">
        <div>
          <div className="eyebrow">Project principles</div>
          <h2>Small tools.<br />Clear answers.</h2>
        </div>
        <div className="principle-list">
          <article><span>01</span><div><h3>Transparent</h3><p>Formulas and assumptions live next to the code that uses them.</p></div></article>
          <article><span>02</span><div><h3>Testable</h3><p>Pure calculation logic stays separate from the interface and has automated tests.</p></div></article>
          <article><span>03</span><div><h3>Accessible</h3><p>Every tool works with a keyboard, on small screens, and without unnecessary friction.</p></div></article>
        </div>
      </section>

      <footer>
        <span>LoA Alexandria · Game Calculators</span>
        <a href="https://github.com/LoA-Alexandria/game-calculators">Source and documentation</a>
      </footer>
    </main>
  );
}
import Link from "next/link";
