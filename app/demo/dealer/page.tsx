import type { Metadata } from "next";
import DemoShowroom from "../DemoShowroom";

export const metadata: Metadata = { title: "מגרש רכב לדוגמה | SwitchApp", description: "הדגמה של מגרש רכב דיגיטלי ב-SwitchApp" };

export default function DealerDemoPage() { return <DemoShowroom type="dealer" />; }
