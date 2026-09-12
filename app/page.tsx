import Link from "next/link";
import { AuthControls } from "./components/AuthControls";

const calculators = [
  {
    name: "Goddess materials",
    description: "Convert Olive Branches, Corollas, and Tribute Plates into Goddess points.",
    href: "/calculators/goddess-materials/",
    status: "Goddess",
  },
  {
    name: "Goddess XP",
    description: "Find the XP required to progress between two Goddess levels.",
    href: "/calculators/goddess-xp/",
    status: "Goddess",
  },
  {
    name: "Red Carpet materials",
    description: "Calculate event points from Cheer Sticks, Clappers, and Vintage Cameras.",
    href: "/calculators/red-carpet-materials/",
    status: "Event",
  },
  {
    name: "City upgrade",
    description: "Plan Bills of Exchange for a city and its required group milestones.",
    href: "/calculators/city-upgrade/",
    status: "Grand Voyage",
  },
  {
    name: "Route calculator",
    description: "Compare travel time, profit, and efficiency for a two-to-six-city round trip.",
    href: "/calculators/grand-voyage-route/",
    status: "Grand Voyage",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-auth"><AuthControls /></div>
        <div className="eyebrow">LoA Alexandria</div>
        <h1>Your strategy room.</h1>
        <p className="lede">
          Plan upgrades, count event points, and chart your next voyage with
          tools built from our shared Pop Epoch game data.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#calculators">Choose a calculator</a>
          <a className="button button-secondary" href="https://github.com/LoA-Alexandria/game-calculators">Contribute on GitHub</a>
        </div>
      </section>

      <section className="section" id="calculators">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Choose your task</div>
            <h2>Calculator hall</h2>
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

      <footer>
        <span>LoA Alexandria · Game Calculators</span>
        <a href="https://github.com/LoA-Alexandria/game-calculators">Source and documentation</a>
      </footer>
    </main>
  );
}
