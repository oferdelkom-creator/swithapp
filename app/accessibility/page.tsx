import LegalPage from "@/components/LegalPage";
import { accessibility } from "@/lib/legalContent";
export const metadata = { title: "הצהרת נגישות | SwitchApp" };
export default function Page(){ return <LegalPage title="הצהרת נגישות" paragraphs={accessibility} />; }
