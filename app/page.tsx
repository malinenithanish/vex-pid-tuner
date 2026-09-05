import { OnshapeImportForm } from "@/components/OnshapeImportForm";

export default function Home() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>VEX PID Tuner</h1>
        <p>
          Import mass properties straight from your Onshape CAD assembly and get PID constants
          tuned for this exact robot.
        </p>
      </header>
      <OnshapeImportForm />
    </main>
  );
}