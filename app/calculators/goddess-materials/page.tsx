import { CalculatorHeader } from "../../components/CalculatorHeader";
import { MaterialsCalculator } from "../../components/MaterialsCalculator";
import { GODDESS_MATERIALS } from "../../../lib/calculators/event-materials";

export default function GoddessMaterialsPage() {
  return <main className="calculator-shell"><CalculatorHeader eyebrow="Goddess progression" title="Goddess materials" description="Calculate the Goddess points provided by your Olive Branches, Corollas, and Tribute Plates." /><MaterialsCalculator materials={GODDESS_MATERIALS} resultLabel="Total Goddess score" /><p className="assumption">Uses entered quantities only; it cannot read your live inventory or event progress.</p></main>;
}
