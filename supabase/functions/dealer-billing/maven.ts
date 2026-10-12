export function paymentDate(value: string): string {
 const date = new Date(value);
 if (!Number.isFinite(date.getTime())) throw new Error('invalid_verified_payment_date');
 const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(date);
 const get=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${get('day')}/${get('month')}/${get('year')}`;
}
export function mavenDocument(account:any, order:any, config:any, test=false) {
 if (!order.payment_verified || !order.transaction_id || !order.paid_at || !Number.isSafeInteger(Number(order.amount_agorot)) || Number(order.amount_agorot)<=0) throw new Error('unverified_invoice_payment');
 if (!account.legal_name || !/^\d{9}$/.test(account.tax_id) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) throw new Error('invalid_invoice_customer');
 const amount=Number(order.amount_agorot)/100;
 const description=order.kind==='setup'?(Number(order.amount_agorot)===49900?'SwitchApp — מנוי חודש ראשון':'SwitchApp — הקמת פלטפורמה ואולם תצוגה'):`SwitchApp — מנוי לחודש ${order.period}`;
 return {api_key:config.api_key,test:test?1:0,contact_email:config.contact_email,contact_phone:config.contact_phone,
  doc_type:320,doc_id:`switchapp-${order.id}`,customer:{name:account.legal_name,identification:account.tax_id,email:account.email},
  description:`SwitchApp order ${order.id}; Cardcom ${order.transaction_id}`,
  items:[{description,quantity:1,price:amount}],payments:[{payment_type:4,amount,payment_date:paymentDate(order.paid_at),number_of_payments:1}],
  vat_included:true,no_vat:false,round_total:false,send_to_customer:!test};
}
export function documentResult(result:any) {
 if(String(result.status_code)!=='0' || !result.id || !result.doc_no) throw new Error('maven_document_not_confirmed');
 const allocationReview=Boolean(result.allocation_warning) || (result.allocation_required===true && !result.allocation_number);
 const safeUrl=(s:unknown)=>{if(typeof s!=='string')return null;try{const u=new URL(s);return u.protocol==='https:'&&u.hostname==='app.invoice-maven.co.il'?s:null;}catch{return null;}};
 return {document_number:String(result.doc_no),document_status:allocationReview?'allocation_review':'issued',maven_document_id:String(result.id),document_pdf:safeUrl(result.pdf_copy??result.pdf_original),document_error:allocationReview?'allocation_required':null};
}
