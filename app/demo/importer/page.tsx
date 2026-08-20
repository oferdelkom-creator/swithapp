import type { Metadata } from "next";
import DemoShowroom from "../DemoShowroom";

export const metadata: Metadata = { title: "יבואן רכב לדוגמה | SwitchApp", description: "הדגמה של עמוד יבואן רכב ב-SwitchApp" };

export default function ImporterDemoPage() { return <DemoShowroom type="importer" />; }
