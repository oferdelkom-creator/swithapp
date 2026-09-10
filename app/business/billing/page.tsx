import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BillingPanel from "./BillingPanel";

export default async function BillingPage() {
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/business/login?next=/business/billing');
 const {data:profile}=await db.from('users').select('role,business_name,name,requested_car_cap').eq('id',user.id).single();
 if(!profile || !['dealer','importer'].includes(profile.role))redirect('/business/join');
 const [{data:account},{data:orders}]=await Promise.all([
  db.from('dealer_billing_accounts').select('plan,legal_name,tax_id,email,state,activated_at,cancelled_at').eq('user_id',user.id).maybeSingle(),
  db.from('dealer_billing_orders').select('id,kind,period,peak,amount_agorot,status,document_number,document_status').eq('user_id',user.id).order('created_at',{ascending:false}).limit(24)
 ]);
 return <BillingPanel initialPlan={profile.requested_car_cap===10?'small':'lot'} initialName={profile.business_name||profile.name} initialEmail={user.email||''} account={account} orders={orders||[]} />;
}
