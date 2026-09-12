import { CalculatorHeader } from "../../components/CalculatorHeader";
import { MaterialsCalculator } from "../../components/MaterialsCalculator";
import { RED_CARPET_MATERIALS } from "../../../lib/calculators/event-materials";

export default function RedCarpetMaterialsPage() {
  return <main className="calculator-shell"><CalculatorHeader eyebrow="Red Carpet Night" title="Event materials" description="Calculate the event points provided by Cheer Sticks, Clappers, and Vintage Cameras." /><MaterialsCalculator materials={RED_CARPET_MATERIALS} /><p className="assumption">Uses entered quantities only; it cannot read your live inventory or event progress.</p></main>;
}
