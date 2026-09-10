import Link from "next/link";
export default function ActivateSubscriptionCTA(_: {userId:string;billingPlan:string|null;requestedCarCap:number|null}) {
 return <Link href="/business/billing" className="btn-primary text-sm">להפעלת מנוי ותשלום הקמה — 3,000 ₪ כולל מע״מ</Link>;
}
