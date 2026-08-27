const cfg=window.PLAYER_TV_CONFIG,db=supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const statusEl=document.getElementById("status"),listEl=document.getElementById("mediaList"),deviceList=document.getElementById("deviceList");
const fileInput=document.getElementById("fileInput"),uploadBtn=document.getElementById("uploadBtn"),saveOrderBtn=document.getElementById("saveOrderBtn"),defaultImageDuration=document.getElementById("defaultImageDuration");
const progress=document.getElementById("progress"),progressBar=document.getElementById("progressBar");
document.getElementById("playerUrl").textContent=location.href.replace(/painel\.html(?:\?.*)?$/,"player.html");
let media=[],draggedId=null;
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
function st(m,t=""){statusEl.className="status"+(t?" "+t:"");statusEl.textContent=m}

document.querySelectorAll(".tabbtn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabbtn,.tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.tab).classList.add("active");if(b.dataset.tab==="devices")loadDevices()});

async function load(){
 const {data,error}=await db.from("media").select("*").order("sort_order",{ascending:true}).order("created_at",{ascending:true});
 if(error)return st("Erro: "+error.message,"error");media=data||[];render();st(`${media.length} item(ns) carregado(s).`,"ok");
}
function render(){
 listEl.innerHTML=""; if(!media.length){listEl.innerHTML='<div class="empty">Nenhuma mídia cadastrada.</div>';return}
 media.forEach(item=>{
  const e=document.createElement("div");e.className="media-item";e.draggable=true;e.dataset.id=item.id;
  const p=item.type==="image"?`<img class="thumb" src="${esc(item.public_url)}">`:`<video class="thumb" src="${esc(item.public_url)}" muted></video>`;
  e.innerHTML=`<div class="drag-handle">☰</div>${p}<div class="media-name"><strong>${esc(item.name)}</strong><small>${item.type==="video"?"Vídeo":"Imagem"}</small></div>
  <div class="duration-wrap">${item.type==="image"?`⏱ <input class="duration-input" type="number" min="1" value="${item.duration_seconds||10}"> s`:"até o fim"}</div>
  <label class="toggle"><input class="active-input" type="checkbox" ${item.active?"checked":""}> Ativo</label><button class="danger delete-btn">Excluir</button>`;
  e.ondragstart=()=>draggedId=item.id;e.ondragover=x=>{x.preventDefault();if(!draggedId||draggedId===item.id)return;const a=media.findIndex(v=>v.id===draggedId),b=media.findIndex(v=>v.id===item.id),[m]=media.splice(a,1);media.splice(b,0,m);render()};
  const d=e.querySelector(".duration-input");if(d)d.onchange=async()=>{await db.from("media").update({duration_seconds:+d.value}).eq("id",item.id);item.duration_seconds=+d.value};
  e.querySelector(".active-input").onchange=async ev=>{await db.from("media").update({active:ev.target.checked}).eq("id",item.id);item.active=ev.target.checked};
  e.querySelector(".delete-btn").onclick=async()=>{if(!confirm(`Excluir "${item.name}"?`))return;await db.storage.from(cfg.bucketName).remove([item.storage_path]);await db.from("media").delete().eq("id",item.id);media=media.filter(x=>x.id!==item.id);render();saveOrder(false)};
  listEl.appendChild(e);
 });
}
async function saveOrder(show=true){for(let n=0;n<media.length;n++)await db.from("media").update({sort_order:n+1}).eq("id",media[n].id);if(show)st("Nova ordem salva.","ok")}
async function upload(){
 const f=fileInput.files?.[0];if(!f)return st("Escolha um arquivo.","error");
 const vid=f.type==="video/mp4",img=["image/jpeg","image/png","image/webp"].includes(f.type);if(!vid&&!img)return st("Formato não suportado.","error");
 uploadBtn.disabled=true;progress.style.display="block";progressBar.style.width="30%";
 const safe=f.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_"),path=Date.now()+"_"+safe;
 const {error:u}=await db.storage.from(cfg.bucketName).upload(path,f,{contentType:f.type});if(u){uploadBtn.disabled=false;return st("Erro: "+u.message,"error")}
 progressBar.style.width="70%";const {data:pub}=db.storage.from(cfg.bucketName).getPublicUrl(path),max=media.reduce((m,x)=>Math.max(m,+x.sort_order||0),0);
 const row={name:f.name,type:vid?"video":"image",public_url:pub.publicUrl,storage_path:path,duration_seconds:img?+defaultImageDuration.value:null,sort_order:max+1,active:true};
 const {data,error}=await db.from("media").insert(row).select().single();if(error)return st("Erro: "+error.message,"error");
 media.push(data);render();fileInput.value="";progressBar.style.width="100%";setTimeout(()=>progress.style.display="none",500);uploadBtn.disabled=false;st("Mídia adicionada.","ok");
}
function ago(d){const s=Math.floor((Date.now()-new Date(d))/1000);if(s<10)return"agora";if(s<60)return`há ${s}s`;const m=Math.floor(s/60);if(m<60)return`há ${m} min`;return`há ${Math.floor(m/60)} h`}
async function loadDevices(){
 deviceList.innerHTML='<div class="empty">Carregando...</div>';const {data,error}=await db.from("devices").select("*").order("last_seen",{ascending:false});
 if(error){deviceList.innerHTML=`<div class="empty">Erro: ${esc(error.message)}</div>`;return} if(!data?.length){deviceList.innerHTML='<div class="empty">Nenhum aparelho cadastrado.</div>';return}
 deviceList.innerHTML="";data.forEach(d=>{const online=Date.now()-new Date(d.last_seen).getTime()<=90000,e=document.createElement("div");e.className="device";
 e.innerHTML=`<div><strong>${esc(d.name)}</strong><br><small>${esc(d.device_id)}</small></div><span class="badge ${online?"on":"off"}">${online?"🟢 Online":"🔴 Offline"}</span><span>${ago(d.last_seen)}</span><button class="danger">Excluir</button>`;
 e.querySelector("button").onclick=async()=>{if(confirm(`Excluir "${d.name}"?`)){await db.from("devices").delete().eq("id",d.id);loadDevices()}};deviceList.appendChild(e)});
}
uploadBtn.onclick=upload;saveOrderBtn.onclick=()=>saveOrder(true);document.getElementById("refreshBtn").onclick=()=>{load();loadDevices()};document.getElementById("refreshDevices").onclick=loadDevices;
load();setInterval(()=>{if(document.getElementById("devices").classList.contains("active"))loadDevices()},15000);