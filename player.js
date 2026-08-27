const cfg=window.PLAYER_TV_CONFIG, db=supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const stage=document.getElementById("stage"),msg=document.getElementById("msg"),tap=document.getElementById("tap");
const reg=document.getElementById("register"),nameEl=document.getElementById("deviceName"),err=document.getElementById("err");
let list=[],i=0,current=null,timer=null,waitGesture=false;
let deviceId=localStorage.getItem("ptv_device_id")||("tv-"+Date.now()+"-"+Math.random().toString(36).slice(2));
localStorage.setItem("ptv_device_id",deviceId);
let deviceName=localStorage.getItem("ptv_device_name");

async function heartbeat(){
  if(deviceName) await db.from("devices").update({last_seen:new Date().toISOString()}).eq("device_id",deviceId);
}

async function ensureDevice(){
  if(!deviceName){reg.style.display="flex";return false;}
  const {data}=await db.from("devices").select("id,name").eq("device_id",deviceId).maybeSingle();
  if(!data){localStorage.removeItem("ptv_device_name");deviceName=null;reg.style.display="flex";return false;}
  await heartbeat(); return true;
}

document.getElementById("registerBtn").onclick=async()=>{
  const n=nameEl.value.trim(); if(!n){err.textContent="Digite um nome.";return;}
  const {error}=await db.from("devices").upsert({device_id:deviceId,name:n,last_seen:new Date().toISOString()},{onConflict:"device_id"});
  if(error){err.textContent=error.message;return;}
  deviceName=n; localStorage.setItem("ptv_device_name",n); reg.style.display="none"; start();
};

async function fetchList(){
  const {data,error}=await db.from("media").select("*").eq("active",true).order("sort_order",{ascending:true}).order("created_at",{ascending:true});
  if(error){console.error(error);return []} return data||[];
}
function stop(){if(timer)clearTimeout(timer);if(current?.tagName==="VIDEO")current.pause();stage.innerHTML="";current=null}
function next(){if(!list.length)return;i=(i+1)%list.length;play()}
async function play(){
  stop(); if(!list.length){msg.style.display="flex";msg.textContent="Nenhuma mídia ativa.";return}
  msg.style.display="none"; tap.style.display="none"; const item=list[i];
  if(item.type==="video"){
    const v=document.createElement("video");v.src=item.public_url;v.autoplay=true;v.playsInline=true;v.preload="auto";v.controls=false;v.muted=false;
    v.onended=next;v.onerror=()=>setTimeout(next,1500);stage.appendChild(v);current=v;
    try{await v.play()}catch(e){waitGesture=true;tap.style.display="flex"}
  }else{
    const img=document.createElement("img");img.src=item.public_url;stage.appendChild(img);current=img;
    timer=setTimeout(next,Math.max(1,Number(item.duration_seconds||10))*1000);
  }
}
async function refresh(){
  const fresh=await fetchList();
  const sig=x=>x.map(a=>[a.id,a.public_url,a.duration_seconds,a.active,a.sort_order].join("|")).join(";");
  if(sig(fresh)!==sig(list)){list=fresh;if(!current){i=0;play()}}
}
async function toggle(){
  if(waitGesture&&current?.tagName==="VIDEO"){try{await current.play();waitGesture=false;tap.style.display="none"}catch(e){};return}
  if(current?.tagName==="VIDEO"){current.paused?current.play():current.pause()}
}
document.addEventListener("keydown",e=>{if(["Enter"," ","MediaPlayPause"].includes(e.key)){e.preventDefault();toggle()}});
tap.onclick=toggle;
async function start(){list=await fetchList();i=0;play()}
(async()=>{if(await ensureDevice())await start();setInterval(async()=>{await heartbeat();await refresh()},15000)})();
