// Synthetic local data only: never signs in to a deployed service or visits media players.
const { chromium } = require(process.env.PLAYWRIGHT_NODE_MODULES ? process.env.PLAYWRIGHT_NODE_MODULES + '/playwright' : 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.STREMCORE_UI_URL || 'http://127.0.0.1:4173';
const root = '/api/admin/v2/content/import/stremcore';
const poster = 'https://images.example.test/poster.svg';
const movie = (id,title,direct=false) => ({id:String(id),title,poster,date:'2024-01-01',rating:'7.2',genres:['drama'],type:'movies',overview:'Una ficha ficticia utilizada exclusivamente para comprobar el panel.',runtime:90,servers:[{id:'1',name:'Servidor de prueba',language:'Español',quality:'HD',url:direct?'https://8.8.8.8/demo.mp4':'https://player.example.test/embed/demo',direct}]});
const movies = [movie(11,'Viaje de prueba'),movie(12,'Fuente directa de prueba',true)];
const series = [{id:'22',title:'Serie de prueba',type:'series',poster,date:'2024-01-01',genres:['drama'],overview:'Serie ficticia.',servers:[]}];
const imported = new Map(), posts = []; let unexpectedRequests=0;

async function main() {
  await fs.mkdir('admin/ui-reports',{recursive:true});
  let ready=false;
  for(let i=0;i<50;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
  assert.ok(ready,'El servidor de previsualización no respondió');
  const browser=await chromium.launch({args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('tv_digital_admin_session',JSON.stringify({token:'synthetic-local-session',user:{nombre:'Prueba local',email:'admin@example.test',rol:'admin'}})));
    await page.route('https://**',async route=>{
      if(route.request().url()===poster)return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#24576b"/><stop offset="1" stop-color="#112238"/></linearGradient></defs><rect width="300" height="450" fill="url(#g)"/><circle cx="150" cy="170" r="50" fill="#5cd7c5" opacity=".5"/><path d="M120 140l70 30-70 30z" fill="#e8ffff"/><text x="150" y="300" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white">TV DIGITAL</text></svg>'});
      unexpectedRequests++;return route.abort();
    });
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      let data,message;
      if(path==='/api/admin/v2/content/categories')data=[{id:1,nombre:'Pruebas',activo:true}];
      else if(path===root+'/meta')data={movies:2,series:1,movieGenres:[{slug:'drama',label:'Drama',total:2}],seriesGenres:[{slug:'drama',label:'Drama',total:1}]};
      else if(path===root&&request.method()==='POST'){
        const body=request.postDataJSON();posts.push(body);
        imported.set(`${body.type}:${body.id}`,{id:Number(body.id),activo:body.mode==='publish'});
        data={created:true};message=body.mode==='publish'?'Contenido importado y publicado en la app.':'Ficha guardada como borrador.';
      } else if(path===root+'/series/22/seasons/1')data={number:1,seriesId:'22',episodes:[{number:1,title:'Ya importado',servers:[],existing:{id:1,activo:false}},{number:2,title:'Episodio nuevo',servers:[],existing:null}]};
      else if(path===root+'/movies'||path===root+'/series'){
        const type=path.endsWith('/movies')?'movies':'series',query=(url.searchParams.get('q')||'').toLowerCase();
        const items=(type==='movies'?movies:series).filter(item=>item.title.toLowerCase().includes(query)).map(item=>({...item,existing:imported.get(`${type}:${item.id}`)||null}));
        data={items,page:1,totalPages:1,total:items.length};
      } else {
        const match=path.match(/\/stremcore\/(movies|series)\/(\d+)$/);
        if(match){const item=(match[1]==='movies'?movies:series).find(item=>item.id===match[2]);data={...item,existing:imported.get(`${match[1]}:${match[2]}`)||null};}
      }
      if(data===undefined)throw new Error('Ruta de prueba no prevista: '+path);
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data,message})});
    });
    await page.goto(origin+'/stremcore');
    await page.getByRole('button',{name:'Ver ficha de Viaje de prueba',exact:true}).waitFor();
    await page.screenshot({path:'admin/ui-reports/stremcore-desktop.png',fullPage:true});
    await page.getByRole('button',{name:'Ver ficha de Viaje de prueba',exact:true}).click();
    let dialog=page.getByRole('dialog');
    await dialog.getByLabel('Guardar contenido').selectOption('publish');
    assert.equal(await dialog.getByRole('button',{name:'Importar y publicar',exact:true}).isDisabled(),true);
    await dialog.getByLabel('Guardar contenido').selectOption('draft');
    await dialog.getByRole('button',{name:'Guardar borrador',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Ficha guardada como borrador.'}).waitFor();
    assert.equal(posts[0].mode,'draft');assert.equal(posts[0].manifestUrl,'');
    await page.getByRole('button',{name:'Ver ficha de Fuente directa de prueba',exact:true}).click();
    dialog=page.getByRole('dialog');
    await dialog.getByLabel('URL directa de la película').waitFor();
    assert.equal(await dialog.getByLabel('URL directa de la película').inputValue(),'https://8.8.8.8/demo.mp4');
    await dialog.getByLabel('Guardar contenido').selectOption('publish');
    await dialog.getByRole('button',{name:'Importar y publicar',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Contenido importado y publicado'}).waitFor();
    assert.equal(posts[1].mode,'publish');assert.equal(posts[1].id,'12');
    await page.getByRole('button',{name:'Series (1)',exact:true}).click();
    await page.getByRole('button',{name:'Ver ficha de Serie de prueba',exact:true}).click();
    dialog=page.getByRole('dialog');
    await dialog.getByText('E2 · Episodio nuevo',{exact:true}).waitFor();
    await dialog.getByRole('checkbox',{name:/Seleccionar todos los disponibles/}).check();
    await dialog.getByLabel('URL directa del episodio').fill('https://8.8.8.8/episode.m3u8');
    await dialog.getByLabel('Guardar contenido').selectOption('publish');
    await dialog.getByRole('button',{name:'Importar y publicar',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.deepEqual(posts[2].episodeNumbers,[2]);assert.deepEqual(posts[2].episodeUrls,{'2':'https://8.8.8.8/episode.m3u8'});
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Películas (2)',exact:true}).click();
    await page.getByRole('button',{name:'Ver ficha de Viaje de prueba',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'La página móvil no debe tener desplazamiento horizontal');
    await page.screenshot({path:'admin/ui-reports/stremcore-mobile.png',fullPage:true});
    assert.equal(unexpectedRequests,0,'No deben abrirse reproductores externos');assert.deepEqual(errors,[]);
    console.log('UI Stremcore correcta: escritorio, móvil, borrador, publicación directa y selección de episodios nuevos.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
