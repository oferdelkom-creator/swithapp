import LegalPage from "@/components/LegalPage";
import { terms } from "@/lib/legalContent";
export const metadata = { title: "תנאי שימוש | SwitchApp" };
export default function Page(){ return <LegalPage title="תנאי שימוש" paragraphs={terms} />; }
