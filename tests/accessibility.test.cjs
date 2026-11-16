const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
for(const [p,prefix,keys] of [
['app/login/LoginForm.tsx','login',['name','email','password','phone','code']],
['app/business/join/DealerJoinForm.tsx','dealer',['businessName','dealerSlug','customDomain','contactName','email','phone','password']],
['app/cars/CarForm.tsx','car',['plate','color','mileage','transmission','fuelType','region','price','hand','description','wantMake','wantModel']],
['app/business/login/BusinessLoginForm.tsx','business-login',['email','password']],
['app/business/set-password/SetPermanentPassword.tsx','set-password',['password','confirmation']]])test(`${p}: explicit label pairs`,()=>{const s=fs.readFileSync(p,'utf8');for(const k of keys){assert.ok(s.includes(`htmlFor="${prefix}-${k}"`),k);assert.equal(s.split(`id="${prefix}-${k}"`).length-1,1,k);}});
test('root contains localized keyboard bypass before header with focusable target',()=>{const s=fs.readFileSync('app/layout.tsx','utf8');assert.ok(s.indexOf('href="#main-content"')<s.indexOf('<Header'));assert.match(s,/<main id="main-content" tabIndex=\{-1\}/);assert.match(fs.readFileSync('app/globals.css','utf8'),/\.skip-link:focus/);});
test('homepage labelled progress group and named chat textarea',()=>{const s=fs.readFileSync('components/HomeAssistant.tsx','utf8');assert.ok(s.includes('role="group" aria-label={c.details}'));assert.ok(s.includes('<textarea aria-label={c.input}'));});
test('page components do not nest main landmarks',()=>{for(const p of ['app/business/join/PartnerLanding.tsx','app/business/login/BusinessLoginForm.tsx','app/business/set-password/SetPermanentPassword.tsx','app/demo/DemoShowroom.tsx','app/valuation/page.tsx'])assert.doesNotMatch(fs.readFileSync(p,'utf8'),/<main[ >]/);});
