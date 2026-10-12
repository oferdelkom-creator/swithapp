import Link from "next/link";
export default function ActivateSubscriptionCTA(_: {userId:string;billingPlan:string|null;requestedCarCap:number|null}) {
 return <Link href="/business/billing" className="btn-primary text-sm">להפעלת מנוי — 499 ₪ לחודש כולל מע״מ</Link>;
}
