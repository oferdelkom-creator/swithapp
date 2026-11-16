import LegalPage from "@/components/LegalPage";
import { business } from "@/lib/legalContent";
export const metadata = { title: "הסכם מנוי לעסקים | SwitchApp" };
export default function Page(){ return <LegalPage title="הסכם מנוי לעסקים" paragraphs={business} />; }
