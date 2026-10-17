"use client";
import { useEffect, useRef, useState } from "react";
import {Activity, AlertTriangle, CheckCircle2, Cpu, Gauge, ShieldCheck, Trash2, Wrench} from "lucide-react";
import {machines, type Machine} from "../lib/demo";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
type Prediction = {risk_score:number; risk_level:string; predicted_failure:boolean; mode:string; message:string};
type FleetResult = {
  machine: Machine;
  prediction: Prediction;
};
type Causal = {machine_id:string; mode:string; hypotheses:{factor:string; explanation:string; suggested_action:string}[]; disclaimer:string};
type MaintenanceTask = {
  id: string;
  machineId: string;
  machineName: string;
  action: string;
  status: "Pending" | "Approved" | "Deferred" | "Rejected";
  createdAt: string;
};
const predictionUrl = process.env.NEXT_PUBLIC_PREDICTION_API_URL || "http://localhost:8000";
const causalUrl = process.env.NEXT_PUBLIC_CAUSAL_API_URL || "http://localhost:8001";
// Only reuse an ML result for the exact machine and sensor readings analyzed.
function predictionKey(machine: Machine) {
  return JSON.stringify([machine.id, machine.air, machine.process, machine.speed, machine.torque, machine.wear]);
}
export default function Home(){
 const [selected,setSelected]=useState<Machine>(machines[3]);
 const selectedKey = useRef(predictionKey(selected));
 selectedKey.current = predictionKey(selected);
 const [fleetMachines, setFleetMachines] = useState<Machine[]>(machines);
 const [registeredMachineIds, setRegisteredMachineIds] = useState<string[]>([]);
 const [removeMachineError, setRemoveMachineError] = useState("");
 const [fleetReady, setFleetReady] = useState(false);
 useEffect(() => {
  try {
    const saved = localStorage.getItem("causyn-added-machines");

    if (!saved) return;

    const addedMachines = JSON.parse(saved) as Machine[];

    if (Array.isArray(addedMachines)) {
      setRegisteredMachineIds(addedMachines.filter(
        (machine) => machine && typeof machine.id === "string" &&
          !machines.some((original) => original.id === machine.id)
      ).map((machine) => machine.id));
      setFleetMachines([
        ...machines,
        ...addedMachines.filter(
          (machine) =>
            machine &&
            typeof machine.id === "string" &&
            !machines.some((original) => original.id === machine.id)
        ),
      ]);
    }
  } catch (error) {
    console.error("Could not load saved machines:", error);
  } finally {
    window.setTimeout(() => {
  setFleetReady(true);
}, 1000);
  }
}, []);
 const [newMachine, setNewMachine] = useState<Machine>({
  id: "",
  name: "",
  area: "",
  status: "Healthy",
  air: 298,
  process: 308,
  speed: 1500,
  torque: 40,
  wear: 0,
  risk: 0,
});

const [machineFormError, setMachineFormError] = useState("");
const [showMachineForm, setShowMachineForm] = useState(false);
// What-If Simulation state
const [whatIfInputs, setWhatIfInputs] = useState({
  air: selected.air,
  process: selected.process,
  speed: selected.speed,
  torque: selected.torque,
  wear: selected.wear,
});

const [whatIfResult, setWhatIfResult] = useState<{
  baseline: Prediction;
  simulated: Prediction;
} | null>(null);

const [whatIfLoading, setWhatIfLoading] = useState(false);
const [whatIfError, setWhatIfError] = useState("");

// Reset the simulation when another machine is selected
useEffect(() => {
  setWhatIfInputs({
    air: selected.air,
    process: selected.process,
    speed: selected.speed,
    torque: selected.torque,
    wear: selected.wear,
  });

  setWhatIfResult(null);
  setWhatIfError("");
}, [selected]);

const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
const [maintenanceReady, setMaintenanceReady] = useState(false);

// Restore previously saved maintenance tasks
useEffect(() => {
  try {
    const saved = localStorage.getItem("causyn-maintenance-tasks");

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setMaintenanceTasks(parsed);
      }
    }
  } catch (error) {
    console.error("Could not restore maintenance tasks:", error);
  } finally {
    setMaintenanceReady(true);
  }
}, []);

// Save tasks whenever an engineer creates or updates one
useEffect(() => {
  if (!maintenanceReady) return;

  try {
    localStorage.setItem(
      "causyn-maintenance-tasks",
      JSON.stringify(maintenanceTasks)
    );
  } catch (error) {
    console.error("Could not save maintenance tasks:", error);
  }
}, [maintenanceTasks, maintenanceReady]);
 const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
 const prediction = predictions[predictionKey(selected)] ?? null;
 function cachePrediction(machine: Machine, result: Prediction) {
   setPredictions((current) => ({ ...current, [predictionKey(machine)]: result }));
 }
 const [causal,setCausal]=useState<Causal|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const [agentReport, setAgentReport] = useState<string | null>(null);
 const [agentLoading, setAgentLoading] = useState(false);
 const [agentError, setAgentError] = useState("");
 
const [chatMessages, setChatMessages] = useState<
  { role: "user" | "assistant"; content: string }[]
>([]);

const [chatInput, setChatInput] = useState("");
const [chatLoading, setChatLoading] = useState(false);
const [chatError, setChatError] = useState("");
const [fleetResults, setFleetResults] = useState<FleetResult[]>([]);
const [fleetLoading, setFleetLoading] = useState(false);
const [fleetError, setFleetError] = useState("");
const rankedFleetResults = fleetResults.map((result) => ({
  ...result,
  prediction: predictions[predictionKey(result.machine)] ?? result.prediction,
})).sort((a, b) => b.prediction.risk_score - a.prediction.risk_score);

function registerMachine() {
  const id = newMachine.id.trim().toUpperCase();
  const name = newMachine.name.trim();
  const area = newMachine.area.trim();

  if (!id || !name || !area) {
    setMachineFormError("Please enter the machine ID, name, and area.");
    return;
  }

  if (fleetMachines.some((machine) => machine.id.toUpperCase() === id)) {
    setMachineFormError(`Machine ${id} already exists.`);
    return;
  }

  if (
    !Number.isFinite(newMachine.air) ||
    !Number.isFinite(newMachine.process) ||
    !Number.isFinite(newMachine.speed) ||
    !Number.isFinite(newMachine.torque) ||
    !Number.isFinite(newMachine.wear) ||
    newMachine.air <= 0 ||
    newMachine.process <= 0 ||
    newMachine.speed <= 0 ||
    newMachine.torque < 0 ||
    newMachine.wear < 0
  ) {
    setMachineFormError("Please enter valid sensor readings.");
    return;
  }

  const machineToAdd: Machine = {
    ...newMachine,
    id,
    name,
    area,
    risk: 0,
  };

  const updatedFleet = [...fleetMachines, machineToAdd];

try {
  const addedMachines = updatedFleet.filter(
    (machine) =>
      !machines.some((original) => original.id === machine.id)
  );

  localStorage.setItem(
    "causyn-added-machines",
    JSON.stringify(addedMachines)
  );
} catch (error) {
  console.error("Could not save machine:", error);
  setMachineFormError("Could not save machine to browser storage.");
  return;
}

setFleetMachines(updatedFleet);
setRegisteredMachineIds((current) => [...current, machineToAdd.id]);
  setFleetResults([]);
  setMachineFormError("");
  setShowMachineForm(false);

  setNewMachine({
    id: "",
    name: "",
    area: "",
    status: "Healthy",
    air: 298,
    process: 308,
    speed: 1500,
    torque: 40,
    wear: 0,
    risk: 0,
  });
}

const removalBusy = loading || agentLoading || chatLoading || whatIfLoading || fleetLoading;
const canRemoveSelected = registeredMachineIds.includes(selected.id) &&
  !machines.some((original) => original.id === selected.id);

function removeSelectedMachine() {
  // Require registration provenance as well as protecting every seeded demo ID.
  if (!fleetReady || removalBusy || !canRemoveSelected ||
      !fleetMachines.some((machine) => machine.id === selected.id)) return;

  if (!window.confirm(
    `Are you sure you want to remove ${selected.id} from the fleet? This will remove the machine from this browser.`
  )) return;

  const updatedFleet = fleetMachines.filter((machine) => machine.id !== selected.id);
  const remainingRegisteredIds = registeredMachineIds.filter((id) => id !== selected.id);
  const addedMachines = updatedFleet.filter((machine) =>
    remainingRegisteredIds.includes(machine.id) &&
    !machines.some((original) => original.id === machine.id)
  );

  try {
    localStorage.setItem("causyn-added-machines", JSON.stringify(addedMachines));
  } catch (error) {
    console.error("Could not remove machine:", error);
    setRemoveMachineError("Could not save removal to browser storage. The machine has not been removed.");
    return;
  }

  setFleetMachines(updatedFleet);
  setRegisteredMachineIds(remainingRegisteredIds);
  setSelected(updatedFleet[0] ?? machines[0]);
  setFleetResults([]);
  setFleetError("");
  setPredictions((current) => {
    const remaining = { ...current };
    delete remaining[predictionKey(selected)];
    return remaining;
  });
  setCausal(null);
  setError("");
  setAgentReport(null);
  setAgentError("");
  setChatMessages([]);
  setChatInput("");
  setChatError("");
  setWhatIfResult(null);
  setWhatIfError("");
  setRemoveMachineError("");
}

function createMaintenanceTask() {
  if (!causal || causal.machine_id !== selected.id) {
    alert("Please run a causal analysis for this machine first.");
    return;
  }

  const suggestedAction =
    causal.hypotheses[0]?.suggested_action ??
    "Routine inspection: verify sensor readings, equipment condition, and maintenance history. No specific causal anomaly was detected.";

  const alreadyExists = maintenanceTasks.some(
    (task) =>
      task.machineId === selected.id &&
      task.action === suggestedAction &&
      task.status === "Pending"
  );

  if (alreadyExists) {
    alert("A pending task already exists for this recommendation.");
    return;
  }

  const task: MaintenanceTask = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    machineId: selected.id,
    machineName: selected.name,
    action: suggestedAction,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };

  setMaintenanceTasks((current) => [task, ...current]);
}

function updateMaintenanceStatus(
  taskId: string,
  newStatus: "Approved" | "Deferred" | "Rejected"
) {
  setMaintenanceTasks((current) =>
    current.map((task) =>
      task.id === taskId
        ? { ...task, status: newStatus }
        : task
    )
  );
}

async function runWhatIfSimulation() {
  const requestKey = predictionKey(selected);
  setWhatIfLoading(true);
  setWhatIfError("");
  setWhatIfResult(null);

  try {
    const values = Object.values(whatIfInputs);

    if (
      values.some((value) => !Number.isFinite(value)) ||
      whatIfInputs.air <= 0 ||
      whatIfInputs.process <= 0 ||
      whatIfInputs.speed <= 0 ||
      whatIfInputs.torque < 0 ||
      whatIfInputs.wear < 0
    ) {
      throw new Error("Please enter valid sensor readings.");
    }

    const baselineInput = {
      machine_id: selected.id,
      air_temperature: selected.air,
      process_temperature: selected.process,
      rotational_speed: selected.speed,
      torque: selected.torque,
      tool_wear: selected.wear,
    };

    const simulatedInput = {
      machine_id: selected.id,
      air_temperature: whatIfInputs.air,
      process_temperature: whatIfInputs.process,
      rotational_speed: whatIfInputs.speed,
      torque: whatIfInputs.torque,
      tool_wear: whatIfInputs.wear,
    };

    const [baselineResponse, simulatedResponse] = await Promise.all([
      fetch(`${predictionUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baselineInput),
      }),
      fetch(`${predictionUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simulatedInput),
      }),
    ]);

    if (!baselineResponse.ok || !simulatedResponse.ok) {
      throw new Error(
        `Prediction API error: baseline ${baselineResponse.status}, simulation ${simulatedResponse.status}`
      );
    }

    const baseline: Prediction = await baselineResponse.json();
    const simulated: Prediction = await simulatedResponse.json();

    cachePrediction(selected, baseline);
    if (selectedKey.current === requestKey) setWhatIfResult({ baseline, simulated });
  } catch (error) {
    if (selectedKey.current === requestKey) setWhatIfError(
      error instanceof Error ? error.message : "Simulation failed."
    );
  } finally {
    setWhatIfLoading(false);
  }
}

async function scanFleet() {
  setFleetLoading(true);
  setFleetError("");
  setFleetResults([]);

  try {
    const results: FleetResult[] = [];

    for (const machine of fleetMachines) {
      const input = {
        machine_id: machine.id,
        air_temperature: machine.air,
        process_temperature: machine.process,
        rotational_speed: machine.speed,
        torque: machine.torque,
        tool_wear: machine.wear,
      };

      const response = await fetch(`${predictionUrl}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(
          `Prediction failed for ${machine.id}: HTTP ${response.status}`
        );
      }

      const prediction: Prediction = await response.json();
      cachePrediction(machine, prediction);

      results.push({
        machine,
        prediction,
      });
    }

    results.sort(
      (a, b) => b.prediction.risk_score - a.prediction.risk_score
    );

    setFleetResults(results);
  } catch (err) {
    setFleetError(
      err instanceof Error ? err.message : "Fleet scan failed."
    );
  } finally {
    setFleetLoading(false);
  }
}

 async function analyze(){setLoading(true);setError("");setCausal(null);
 setAgentReport(null);
 setAgentError("");
  const input={machine_id:selected.id,air_temperature:selected.air,process_temperature:selected.process,rotational_speed:selected.speed,torque:selected.torque,tool_wear:selected.wear};
  try{
   const [p,c]=await Promise.all([fetch(`${predictionUrl}/predict`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}),fetch(`${causalUrl}/causal/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})]);
   if(!p.ok||!c.ok)throw new Error(`API error: prediction ${p.status}, causal ${c.status}. Check both Python services.`);
   cachePrediction(selected, await p.json());setCausal(await c.json());
  }catch(e){setError(e instanceof Error?e.message:"Unexpected error");}finally{setLoading(false)}
 }

async function investigateWithAI() {
  setAgentLoading(true);
  setAgentError("");
  setAgentReport(null);

  const input = {
    machine_id: selected.id,
    air_temperature: selected.air,
    process_temperature: selected.process,
    rotational_speed: selected.speed,
    torque: selected.torque,
    tool_wear: selected.wear,
  };

  



  try {
    const response = await fetch(`${causalUrl}/agent/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`AI investigation failed: ${response.status}`);
    }

    const result = await response.json();

    // Also show the ML prediction returned by the agent.
    cachePrediction(selected, result.prediction);

    if (result.llm_status === "success" && result.llm_report) {
      setAgentReport(result.llm_report);
    } else {
      setAgentError(
        "AMD LLM unavailable. The ML prediction and sensor evidence are still available."
      );
    }
  } catch (e) {
    setAgentError(
      e instanceof Error ? e.message : "Unexpected AI investigation error"
    );
  } finally {
    setAgentLoading(false);
  }
}


async function sendChatMessage() {
  const question = chatInput.trim();

  if (!question || chatLoading || agentLoading || loading) return;

  const history = chatMessages.slice(-6);

  const input = {
    machine_id: selected.id,
    air_temperature: selected.air,
    process_temperature: selected.process,
    rotational_speed: selected.speed,
    torque: selected.torque,
    tool_wear: selected.wear,
    question,
    history,
  };

  setChatInput("");
  setChatError("");
  setChatLoading(true);

  setChatMessages((previous) => [
    ...previous,
    { role: "user", content: question },
  ]);

  try {
    const response = await fetch(`${causalUrl}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`AI Copilot request failed: ${response.status}`);
    }

    const result = await response.json();

    if (typeof result.answer !== "string" || !result.answer.trim()) {
      throw new Error("AI Copilot returned an empty answer.");
    }

    cachePrediction(selected, result.prediction);

    setChatMessages((previous) => [
      ...previous,
      { role: "assistant", content: result.answer },
    ]);
  } catch (error) {
    setChatError(
      error instanceof Error ? error.message : "AI Copilot is unavailable."
    );
  } finally {
    setChatLoading(false);
  }
}

 if (!fleetReady) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b111d",
        color: "#e8edf7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          textAlign: "center",
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "#14283b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <Activity size={30} color="#4ac5d9" />
        </div>

        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            margin: "0 0 8px",
          }}
        >
          CAUSYN <span style={{ color: "#4ac5d9" }}>AI</span>
        </h1>

        <p style={{ color: "#a7b5c9", marginBottom: 32 }}>
          Predict. Understand. Prevent.
        </p>

        <div
  style={{
    borderTop: "1px solid #263044",
    paddingTop: 20,
    color: "#a7b5c9",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  }}
>
  <span className="causyn-loading-spinner" aria-hidden="true" />
  <span>Preparing your machine fleet...</span>
</div>
      </div>
    </div>
  );
}


return <div className="shell"><aside className="sidebar">
  <Link href="/" className="brand" aria-label="CAUSYN AI Home">
    <div className="brandIcon">
      <Activity size={22} />
    </div>

    <div>
      <strong>CAUSYN <span>AI</span></strong>
      <small>Predict. Understand. Prevent.</small>
    </div>
  </Link>

  <div className="navTitle">WORKSPACE</div>
 <div className="nav active"><Gauge size={17}/> Overview</div><a className="nav" href="#machine-fleet" style={{ textDecoration: "none", color: "inherit" }}>
  <Cpu size={17}/> Machines
</a><a
  className="nav"
  href="#causal-insights"
  style={{ textDecoration: "none", color: "inherit" }}
>
  <Activity size={17}/> Causal Insights
</a><a
  className="nav"
  href="#maintenance-workspace"
  style={{ textDecoration: "none", color: "inherit" }}
>
  <Wrench size={17} /> Maintenance
</a><div className="sidebarFoot"><span className="dot"/> Local demo environment<br/><small>AMD deployment pending</small></div></aside>
 <main className="main"><header><div><div className="eyebrow">INDUSTRIAL INTELLIGENCE / OVERVIEW</div><h1>Machine health overview</h1><p>Monitor assets, explore risk, and investigate possible contributing factors.</p></div><div className="pill"><span className="dot"/> DEMO DATA</div></header>
<div
  className="stats"
  style={{ visibility: fleetReady ? "visible" : "hidden" }}
><div className="stat"><div className="statLabel"><Cpu size={17}/>Total machines</div><strong>{String(fleetMachines.length).padStart(2, "0")}</strong><small>Simulated assets</small></div><div className="stat"><div className="statLabel"><CheckCircle2 size={17}/>Healthy</div><strong>{String(fleetMachines.filter(m => m.status === "Healthy").length).padStart(2, "0")}</strong><small>Normal operating range</small></div><div className="stat"><div className="statLabel"><AlertTriangle size={17}/>Needs attention</div><strong>{String(fleetMachines.filter(m => m.status === "Watch").length).padStart(2, "0")}</strong><small>Watch status</small></div><div className="stat"><div className="statLabel"><ShieldCheck size={17}/>Critical</div><strong>{String(fleetMachines.filter(m => m.status === "Critical").length).padStart(2, "0")}</strong><small>Review recommended</small></div></div>
 <section className="panel" id="fleet-scan">
  <div className="panelHead">
    <div>
      <h2>Fleet-wide AI scanning</h2>
      <p>Analyze all {fleetMachines.length} machines using the trained Random Forest model.</p>
    </div>
    <Cpu size={19} />
  </div>

  <button
    type="button"
    className="primary"
    onClick={scanFleet}
    disabled={fleetLoading}
  >
    {fleetLoading ? "Scanning machines..." : "Scan Entire Fleet"}
  </button>

  {fleetError && (
    <p className="fleetScanError" role="alert">
      {fleetError}
    </p>
  )}

  {fleetResults.length > 0 && (
    <div className="fleetRanking">
      <h3>Fleet risk ranking</h3>
      <p>
        Machines ranked from highest to lowest model risk score.
      </p>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>PRIORITY</th>
              <th>MACHINE</th>
              <th>RISK SCORE</th>
              <th>RISK LEVEL</th>
            </tr>
          </thead>

          <tbody>
            {rankedFleetResults.map((result, index) => (
              <tr key={result.machine.id}>
                <td>#{index + 1}</td>
                <td>{result.machine.id}</td>
                <td>
                  {result.prediction.risk_score.toFixed(2)}
                </td>
                <td>{result.prediction.risk_level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="fleetRankingDisclaimer">
        Risk scores are uncalibrated model estimates based on
        simulated machine readings, not confirmed failure probabilities.
      </p>
    </div>
  )}
</section> <section className="panel" id="register-machine">
  <div className="panelHead machineRegistrationHeader">
    <div>
      <h2>Machine registration</h2>
      <p>Register a new industrial asset for AI monitoring.</p>
    </div>
    <Cpu size={19} />
  </div>

  <div className="machineRegistrationBody">
  <button
    type="button"
    className="primary machineRegistrationToggle"
    onClick={() => setShowMachineForm(!showMachineForm)}
  >
    {showMachineForm ? "Cancel Registration" : "+ Add New Machine"}
  </button>

  {showMachineForm && (
    <form
      className="machineRegistrationForm"
      onSubmit={(e) => {
        e.preventDefault();
        registerMachine();
      }}
    >
      <div className="machineRegistrationGrid">
        {([
          ["id", "Machine ID", "text"],
          ["name", "Machine Name", "text"],
          ["area", "Production Area", "text"],
          ["air", "Air Temperature (K)", "number"],
          ["process", "Process Temperature (K)", "number"],
          ["speed", "Rotational Speed (RPM)", "number"],
          ["torque", "Torque (Nm)", "number"],
          ["wear", "Tool Wear (minutes)", "number"],
        ] as const).map(([field, label, inputType]) => (
          <label
            key={field}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span>{label}</span>
            <input
              type={inputType}
              required
              step={inputType === "number" ? "any" : undefined}
              value={newMachine[field]}
              onChange={(e) =>
                setNewMachine((current) => ({
                  ...current,
                  [field]:
                    inputType === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                }))
              }
              style={{
                background: "#0b111d",
                color: "#e8edf7",
                border: "1px solid #344258",
                borderRadius: 8,
                padding: 12,
                width: "100%",
              }}
            />
          </label>
        ))}

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span>Initial Status</span>
          <select
            value={newMachine.status}
            onChange={(e) =>
              setNewMachine((current) => ({
                ...current,
                status: e.target.value as Machine["status"],
              }))
            }
            style={{
              background: "#0b111d",
              color: "#e8edf7",
              border: "1px solid #344258",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <option value="Healthy">Healthy</option>
            <option value="Watch">Watch</option>
            <option value="Critical">Critical</option>
          </select>
        </label>
      </div>

      {machineFormError && (
        <p style={{ color: "#ff8585", marginTop: 16 }}>
          {machineFormError}
        </p>
      )}

      <button
        type="submit"
        className="primary machineRegistrationSubmit"
      >
        Register Machine
      </button>
    </form>
  )}
  </div>
  <section className="panel" id="maintenance-workspace">
  <div className="panelHead">
    <div>
      <h2>Maintenance Decision Center</h2>
      <p>Review inspection recommendations and record engineer decisions.</p>
    </div>
    <Wrench size={19} />
  </div>

  <button
    type="button"
    className="primary"
    onClick={createMaintenanceTask}
  >
    + Create Inspection Task
  </button>

  <p style={{ margin: "14px 0 18px",
    padding: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#a7b5c9", }}>
    Select a machine and run causal analysis before creating a task.
  </p>

  {maintenanceTasks.length === 0 ? (
    <div className="empty">
      No maintenance tasks yet. Run a machine analysis to get started.
    </div>
  ) : (
    <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
      {maintenanceTasks.map((task) => (
        <div
          key={task.id}
          style={{
            background: "#0b111d",
            border: "1px solid #344258",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <strong>
              {task.machineId} — {task.machineName}
            </strong>
            <span className="tag">{task.status}</span>
          </div>

          <p style={{ marginTop: 12 }}>{task.action}</p>

          {task.status === "Pending" && (
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="primary"
                onClick={() =>
                  updateMaintenanceStatus(task.id, "Approved")
                }
              >
                Approve
              </button>

              <button
                type="button"
                onClick={() =>
                  updateMaintenanceStatus(task.id, "Deferred")
                }
              >
                Defer
              </button>

              <button
                type="button"
                onClick={() =>
                  updateMaintenanceStatus(task.id, "Rejected")
                }
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )}

  <p style={{margin: "18px 0 0",
    padding: 0,
    fontSize: 12,
    lineHeight: 1.6,
    color: "#8393aa",}}>
    Demo only. Maintenance actions require human approval.
    No physical equipment is controlled.
  </p>
</section>

<section className="panel" id="what-if-simulation">
  <div className="panelHead">
    <div>
      <h2>What-If Simulation</h2>
      <p>
        Explore how hypothetical sensor changes affect the ML risk score.
      </p>
    </div>
    <Gauge size={19} />
  </div>

  <div style={{ padding: "0 26px 26px" }}>
    <div
      style={{
        padding: 16,
        background: "#0b1727",
        border: "1px solid #2b3a50",
        borderRadius: 12,
        marginBottom: 22,
      }}
    >
      <strong style={{ color: "#e8edf7" }}>
        {selected.id} — {selected.name}
      </strong>
      <p style={{ color: "#9fb0c7", margin: "8px 0 0" }}>
        Change the readings below to create a hypothetical scenario.
        Your saved machine data will not be modified.
      </p>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginBottom: 22,
      }}
    >
      {([
        ["air", "Air Temperature (K)"],
        ["process", "Process Temperature (K)"],
        ["speed", "Rotational Speed (RPM)"],
        ["torque", "Torque (Nm)"],
        ["wear", "Tool Wear (minutes)"],
      ] as const).map(([field, label]) => (
        <label
          key={field}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            color: "#a7b5c9",
            fontSize: 13,
          }}
        >
          {label}

          <input
            type="number"
            step="any"
            value={whatIfInputs[field]}
            onChange={(e) => {
              setWhatIfInputs((current) => ({
                ...current,
                [field]: Number(e.target.value),
              }));
              setWhatIfResult(null);
            }}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "#0b111d",
              border: "1px solid #344258",
              borderRadius: 9,
              color: "#e8edf7",
              fontSize: 15,
            }}
          />
        </label>
      ))}
    </div>

    <div
      className="whatIfActions"
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <button
        type="button"
        className="primary"
        onClick={runWhatIfSimulation}
        disabled={whatIfLoading}
      >
        {whatIfLoading ? "Calculating..." : "Run Simulation"}
      </button>

      <button
        type="button"
        onClick={() => {
          setWhatIfInputs({
            air: selected.air,
            process: selected.process,
            speed: selected.speed,
            torque: selected.torque,
            wear: selected.wear,
          });
          setWhatIfResult(null);
          setWhatIfError("");
        }}
        style={{
          padding: "12px 18px",
          background: "#243347",
          border: "1px solid #435571",
          borderRadius: 9,
          color: "#e8edf7",
          cursor: "pointer",
        }}
      >
        Reset Values
      </button>
    </div>

    {whatIfError && (
      <p style={{ color: "#ff8585", marginTop: 16 }}>
        {whatIfError}
      </p>
    )}

    {whatIfResult && (
      <div
        style={{
          marginTop: 24,
          padding: 20,
          background: "#0b1727",
          border: "1px solid #344258",
          borderRadius: 12,
        }}
      >
        <h3 style={{ margin: "0 0 18px" }}>
          Simulation Results
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          <div>
            <small style={{ color: "#9fb0c7" }}>
              Original Risk Score
            </small>
            <div style={{ fontSize: 32, fontWeight: 700 }}>
              {(prediction ?? whatIfResult.baseline).risk_score.toFixed(2)}
            </div>
            <small>{(prediction ?? whatIfResult.baseline).risk_level}</small>
          </div>

          <div>
            <small style={{ color: "#9fb0c7" }}>
              Simulated Risk Score
            </small>
            <div style={{ fontSize: 32, fontWeight: 700 }}>
              {whatIfResult.simulated.risk_score.toFixed(2)}
            </div>
            <small>{whatIfResult.simulated.risk_level}</small>
          </div>

          <div>
            <small style={{ color: "#9fb0c7" }}>
              Score Change
            </small>
            <div style={{ fontSize: 32, fontWeight: 700 }}>
              {(
                whatIfResult.simulated.risk_score -
                (prediction ?? whatIfResult.baseline).risk_score
              ).toFixed(2)}
            </div>
            <small>Simulated minus original</small>
          </div>
        </div>
      </div>
    )}

    <p
      style={{
        margin: "20px 0 0",
        color: "#8393aa",
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      Simulations use the trained Random Forest and hypothetical sensor
      readings. Scores are uncalibrated model estimates, not confirmed
      failure probabilities or evidence of causation.
    </p>
  </div>
</section>

</section><section className="panel" id="machine-fleet"><div className="panelHead"><div><h2>Machine fleet</h2><p>Select a machine to inspect its readings. ML scores are uncalibrated; status labels are demo indicators.</p></div><span className="tag">{fleetMachines.length} assets</span></div><div className="tableWrap"><table><thead><tr><th>ASSET</th><th>AREA</th><th>STATUS</th><th>TOOL WEAR</th><th>ML SCORE</th></tr></thead><tbody>{fleetMachines.map(m=><tr key={m.id}
onClick={() => {
  if (agentLoading || loading || chatLoading) return;

  setSelected(m);
  setCausal(null);
  setError("");
  setAgentReport(null);
  setAgentError("");
  setChatMessages([]);
  setChatInput("");
  setChatError("");
}}
 className={selected.id===m.id?"selected":""}><td><b>{m.name}</b><small>{m.id}</small></td><td>{m.area}</td><td><span className={`status ${m.status.toLowerCase()}`}>{m.status}</span></td><td>{m.wear} min</td><td>{predictions[predictionKey(m)] ? <div className="risk"><div className="track"><div className={`fill ${predictions[predictionKey(m)].risk_score>=0.7?"danger":predictions[predictionKey(m)].risk_score>=0.4?"warn":""}`} style={{width:`${predictions[predictionKey(m)].risk_score*100}%`}}/></div><b>{Math.round(predictions[predictionKey(m)].risk_score*100)}%</b></div> : <span>Not analyzed</span>}</td></tr>)}</tbody></table></div></section>
 <div className="columns"><section className="panel"><div className="panelHead"><div><h2>{selected.name}</h2><p>{selected.id} · Latest simulated sensor readings</p></div><span className={`status ${selected.status.toLowerCase()}`}>{selected.status}</span></div><div className="sensors"><div><small>Air temperature</small><strong>{selected.air} K</strong></div><div><small>Process temperature</small><strong>{selected.process} K</strong></div><div><small>Rotational speed</small><strong>{selected.speed} rpm</strong></div><div><small>Torque</small><strong>{selected.torque} Nm</strong></div><div><small>Tool wear</small><strong>{selected.wear} min</strong></div></div>
{canRemoveSelected && (
  <div className="machineRemovalActions">
    <button
      type="button"
      className="machineRemovalButton"
      onClick={removeSelectedMachine}
      disabled={removalBusy}
    >
      <Trash2 size={16} aria-hidden="true" />
      Remove Machine
    </button>
    {removalBusy && <p>Wait for the current operation to finish before removing this machine.</p>}
    {removeMachineError && <p role="alert">{removeMachineError}</p>}
  </div>
)}
{prediction && <div className="insights"><div className="prediction">ML score: <b>{prediction.risk_score.toFixed(2)} ({Math.round(prediction.risk_score * 100)}%) · {prediction.risk_level}</b><small>{prediction.message}</small></div></div>}
<button
  className="primary"
  disabled={loading || agentLoading || chatLoading}
  onClick={analyze}
>
  {loading ? "Analyzing…" : "Run ML analysis →"}
</button>

<button
  className="primary"
  disabled={loading || agentLoading || chatLoading}
  onClick={investigateWithAI}
>
  {agentLoading ? "AI investigating…" : "Investigate with AI ✨"}
</button>

{error && (
  <div className="error" role="alert">{error}</div>
)}

{agentError && (
  <div className="error" role="alert">{agentError}</div>
)}

</section>

 <section className="panel" id="causal-insights"><div className="panelHead"><div><h2>Causal investigation</h2><p>Hypotheses, not proven causes</p></div><Activity size={19}/></div>{!causal?<div className="empty">Select a machine and run analysis to view possible contributing factors.</div>:<div className="insights">{prediction&&<div className="prediction">ML prediction: <b>{Math.round(prediction.risk_score*100)}% · {prediction.risk_level}</b><small>{prediction.message}</small></div>}{causal.hypotheses.length?causal.hypotheses.map((h,i)=><div className="hypothesis" key={i}><strong>{h.factor}</strong><p>{h.explanation}</p><small>Suggested check: {h.suggested_action}</small></div>):<p>No configured rules triggered for these readings.</p>}<div className="disclaimer">{causal.disclaimer}</div></div>}</section></div>
 
{agentReport && (
  <section className="panel">
    <div className="panelHead">
      <div>
        <h2>AI Investigation Report ✨</h2>
        <p>
          AMD-hosted LLM analysis for {selected.name} ({selected.id})
        </p>
      </div>
      <span className="tag">AI GENERATED</span>
    </div>

    
<div
  className="insights"
  style={{
    overflowWrap: "anywhere",
    lineHeight: 1.7,
  }}
>
  <ReactMarkdown>{agentReport}</ReactMarkdown>
</div>

    <div className="disclaimer">
      AI-generated hypotheses are not proven root causes.
      Maintenance actions require engineer review.
    </div>
  </section>
)}


<section className="panel" id="ai-copilot">
  <div className="panelHead">
    <div>
      <h2>CAUSYN AI Copilot ✨</h2>
      <p>
        Ask questions about {selected.name} ({selected.id})
      </p>
    </div>
    <span className="tag">AMD LLM</span>
  </div>

  <div className="insights">
    {chatMessages.length === 0 && (
      <div className="empty">
        Ask your maintenance copilot a question.
        For example: "What should I inspect first?"
      </div>
    )}

    {chatMessages.map((message, index) => (
      <div
        key={index}
        style={{
          display: "flex",
          justifyContent:
            message.role === "user" ? "flex-end" : "flex-start",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background:
              message.role === "user" ? "#1e4053" : "#19283d",
            padding: 16,
            borderRadius: 12,
            maxWidth: "85%",
            overflowWrap: "anywhere",
          }}
        >
          <strong>
            {message.role === "user" ? "You" : "CAUSYN AI"}
          </strong>

          <div style={{ marginTop: 8, lineHeight: 1.7 }}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    ))}

    {chatLoading && (
      <p aria-live="polite">CAUSYN AI is thinking...</p>
    )}

    {chatError && (
      <div className="error" role="alert">
        {chatError}
      </div>
    )}

    <form
      onSubmit={(event) => {
        event.preventDefault();
        void sendChatMessage();
      }}
      style={{ marginTop: 20 }}
    >
      <label
        htmlFor="copilot-question"
        style={{ display: "block", marginBottom: 8 }}
      >
        Ask CAUSYN AI
      </label>

      <textarea
        id="copilot-question"
        value={chatInput}
        onChange={(event) => setChatInput(event.target.value)}
        placeholder="Ask CAUSYN AI"
        maxLength={1000}
        rows={3}
        disabled={chatLoading || agentLoading || loading}
        style={{
          width: "100%",
          padding: 14,
          background: "#19283d",
          color: "white",
          border: "1px solid #30465f",
          borderRadius: 10,
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />

      <button
        type="submit"
        className="primary"
        disabled={
          chatLoading ||
          agentLoading ||
          loading ||
          !chatInput.trim()
        }
        style={{ marginTop: 12 }}
      >
        {chatLoading ? "Thinking..." : "Send message →"}
      </button>
    </form>

    <div className="disclaimer">
      AI suggestions require engineer verification.
      Risk estimates are uncalibrated, and proposed
      causes are not confirmed diagnoses.
    </div>
  </div>
</section>


 <footer>CAUSYN AI · Prototype · Simulated sensor data · Uncalibrated ML risk estimates · AMD-hosted LLM for investigation</footer></main></div>
}
