// Read-only government metadata. No database credentials, VIN/owner projection or logs.
const ENDPOINT = 'https://data.gov.il/api/3/action/datastore_search';
export const PLATE_RESOURCE = '053cea08-09bc-40ec-8f7a-156f0677aff3';
export type RegistryResult = { status: 'found'; vehicle: { make: string | null; model: string | null; year: number | null; color: string | null; fuel: string | null } } | { status: 'not_found' } | { status: 'unavailable' };
export async function lookupOfficialPlate(plate: string, fetcher: typeof fetch = fetch): Promise<RegistryResult> {
 if (!/^\d{7,8}$/.test(plate)) return { status:'unavailable' };
 const url=new URL(ENDPOINT);url.searchParams.set('resource_id',PLATE_RESOURCE);url.searchParams.set('filters',JSON.stringify({mispar_rechev:plate}));url.searchParams.set('limit','1');
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('registry_unavailable'));},5000);});
 try {
  const r=await Promise.race([fetcher(url,{method:'GET',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal}),deadline]);
  if(!r.ok||r.redirected||r.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw Error();
  reader=r.body?.getReader();if(!reader)throw Error();const parts:Uint8Array[]=[];let size=0;
  while(true){const x=await Promise.race([reader.read(),deadline]);if(x.done)break;if((size+=x.value.byteLength)>32768)throw Error();parts.push(x.value);}
  const d=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
  if(d?.success!==true||!Array.isArray(d.result?.records)||d.result.records.length>1)throw Error();
  if(d.result.records.length===0)return {status:'not_found'};
  const row=d.result.records[0];if(!row||String(row.mispar_rechev)!==plate)throw Error();
  const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=120&&!/[\u0000-\u001f<>]/.test(v)?v.trim():null;
  const year=Number(row.shnat_yitzur);
  return {status:'found',vehicle:{make:text(row.tozeret_nm),model:text(row.kinuy_mishari)||text(row.degem_nm),year:Number.isInteger(year)&&year>=1900&&year<=new Date().getFullYear()+1?year:null,color:text(row.tzeva_rechev),fuel:text(row.sug_delek_nm)}};
 }catch{return {status:'unavailable'};}
 finally{clearTimeout(timer!);if(reader)void reader.cancel().catch(()=>{});}
}

// Fixed source-separated response; never asks a model to interpret government metadata.
export function formatPlateLookup(rows: Record<string,unknown>[] | null, registry: RegistryResult, locale: string): string {
 const words = {
  he: ['SwitchApp: ', 'לא נמצאה מודעה פעילה תואמת.', 'חיפוש המודעות אינו זמין כרגע.', 'מודעה פעילה: ', 'משרד התחבורה: ', 'לא נמצא רישום במאגר שנבדק.', 'המאגר אינו זמין כרגע.', 'מפרט טכני: ', 'מידע טכני בלבד, לא הוכחת בעלות, מצב הרכב או מחיר.'],
  en: ['SwitchApp: ', 'No matching active listing found.', 'Listing lookup is currently unavailable.', 'Active listing: ', 'Ministry of Transport: ', 'No record found in the checked registry.', 'Registry currently unavailable.', 'Technical details: ', 'Technical data only, not proof of ownership, condition or value.'],
  ru: ['SwitchApp: ', 'Активное объявление не найдено.', 'Поиск объявлений временно недоступен.', 'Активное объявление: ', 'Министерство транспорта: ', 'Запись в проверенном реестре не найдена.', 'Реестр временно недоступен.', 'Технические данные: ', 'Это не подтверждение владельца, состояния или стоимости автомобиля.'],
  ar: ['SwitchApp: ', 'لم يُعثر على إعلان نشط مطابق.', 'البحث في الإعلانات غير متاح حالياً.', 'إعلان نشط: ', 'وزارة المواصلات: ', 'لم يُعثر على سجل في القاعدة التي فُحصت.', 'القاعدة غير متاحة حالياً.', 'مواصفات تقنية: ', 'معلومات تقنية فقط، وليست إثباتاً للملكية أو حالة المركبة أو قيمتها.'],
 };
 const w=words[locale as keyof typeof words]??words.he;
 const safe=(x:unknown)=>typeof x==='string'&&x.length<=120&&!/[\u0000-\u001f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f<>:@/]|\.[a-z]{2}/i.test(x)?x:null;
 const car=rows?.[0];const valid=car&&typeof car.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(car.id);
 const internal=rows===null?w[2]:rows.length===0?w[1]:rows.length===1&&valid?w[3]+[safe(car.make),safe(car.model),typeof car.year==='number'?car.year:null].filter(x=>x!==null).join(' ')+'\nhttps://www.switchapp.co.il/cars/'+car.id:w[2];
 const official=registry.status==='unavailable'?w[6]:registry.status==='not_found'?w[5]:w[7]+[safe(registry.vehicle.make),safe(registry.vehicle.model),registry.vehicle.year,safe(registry.vehicle.color),safe(registry.vehicle.fuel)].filter(x=>x!==null).join(' · ');
 return w[0]+internal+'\n'+w[4]+official+'\n'+w[8];
}
