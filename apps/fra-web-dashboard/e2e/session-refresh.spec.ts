import { test, expect } from '@playwright/test';

for (const exclusive of [true,false]) {
  test(`two tabs preserve the winning session ${exclusive?'with Web Locks':'without Web Locks'}`,async({context})=>{
    const pages=[await context.newPage(),await context.newPage()];
    const pending: import('@playwright/test').Route[]=[];
    for(const page of pages){
      if(!exclusive)await page.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
      await page.route('**/session-test',r=>r.fulfill({contentType:'text/html',body:'<html><body>Session contract</body></html>'}));
      await page.route('**/api/v1/**',async route=>{
        const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'};
        if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
        if(route.request().url().endsWith('/auth/refresh')){pending.push(route);return;}
        const valid=route.request().headers().authorization==='Bearer fresh-access';
        return route.fulfill({status:valid?200:401,headers,contentType:'application/json',body:JSON.stringify(valid?{success:true,data:{ok:true}}:{success:false,error:{code:'UNAUTHORIZED',message:'Expired fixture'}})});
      });
      await page.goto('/session-test');
    }
    await pages[0].evaluate(async()=>{const path='/src/lib/api.ts';const api=await import(path);api.setTokens('old-access','old-refresh');});
    const requests=pages.map(page=>page.evaluate(async()=>{const path='/src/lib/api.ts';const {api}=await import(path);return api.get('/api/v1/session-probe').then(()=>true,()=>false);}));
    await expect.poll(()=>pending.length).toBe(exclusive?1:2);
    await pending[0].fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify({success:true,data:{accessToken:'fresh-access',refreshToken:'fresh-refresh'}})});
    expect(await Promise.race(requests)).toBe(true);
    if(!exclusive)await pending[1].fulfill({status:401,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify({success:false,error:{code:'REFRESH_REVOKED',message:'Already consumed'}})});
    expect(await Promise.all(requests)).toEqual([true,true]);
    expect(pending).toHaveLength(exclusive?1:2);
    expect(await pages[0].evaluate(()=>localStorage.getItem('fra_refresh_token'))).toBe('fresh-refresh');
  });
}
