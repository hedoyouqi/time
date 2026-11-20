const $=id=>document.getElementById(id), KEY='drive-log-v2', SET='drive-settings-v2';
let state=null,watch=null,last=null,timer=null,selectedMode='manual',autoCandidates=0,stillCandidates=0,lastGoodFixAt=0,gpsMessage='GPS 대기';
let settings={efficiency:9,price:1800,idle:.8,...JSON.parse(localStorage.getItem(SET)||'{}')};
const history=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}').history||[]}catch{return[]}};
const save=()=>localStorage.setItem(KEY,JSON.stringify({state,history:history()}));
const fmt=ms=>{let s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return [h,m,x].map(v=>String(v).padStart(2,'0')).join(':')};
const date=t=>new Date(t).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
function sums(){if(!state)return{w:0,d:0};let elapsed=Math.max(0,Date.now()-state.phaseAt);let valid=state.mode!=='auto'||(lastGoodFixAt&&Date.now()-lastGoodFixAt<12000);return{w:state.wait+(valid&&state.phase==='wait'?elapsed:0),d:state.drive+(valid&&state.phase==='drive'?elapsed:0)}}
function costs(w=0,dist=0){let idleLitres=w/3600000*settings.idle,driveLitres=dist/settings.efficiency;return{idle:idleLitres*settings.price,drive:driveLitres*settings.price,total:(idleLitres+driveLitres)*settings.price}}
function updateClock(){
 const now=new Date(), pad=n=>String(n).padStart(2,'0');
 $('liveDate').textContent=`${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}`;
 $('liveClock').textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
function updateModeIndicator(){
 const mode=state?.mode||selectedMode, el=$('currentMode');
 el.textContent=mode==='auto'?'자동 GPS':'수동 모드';
 el.className='mode-indicator '+(mode==='auto'?'auto':'manual');
}
function render(){
 updateModeIndicator();
 $('manualMode').classList.toggle('active',(state?.mode||selectedMode)==='manual');$('autoMode').classList.toggle('active',(state?.mode||selectedMode)==='auto');$('manualMode').disabled=!!state;$('autoMode').disabled=!!state;
 $('accuracy').textContent=last&&last.acc!=null?Math.round(last.acc)+'m':'-';$('gpsDecision').textContent=state?.mode==='auto'?(lastGoodFixAt&&Date.now()-lastGoodFixAt<12000?(state.phase==='drive'?'이동':'정차'):'GPS 신호 대기'):'수동 모드';
 if(!state){$('status').className='pill red';$('status').textContent='시작 전';$('main').className='main red';$('symbol').textContent='▶';$('action').textContent='주행 시작';$('sub').textContent='터치하면 대기시간 측정 시작';$('hint').textContent='주행을 시작할 준비가 되면 눌러주세요';$('finish').hidden=true;$('started').textContent='-';$('phaseStarted').textContent='-';$('wait').textContent='00:00:00';$('drive').textContent='00:00:00';$('distance').textContent='0.0 km';$('cost').textContent='0원';$('waitTotal').textContent='0분';$('driveTotal').textContent='0분';$('gps').textContent=gpsMessage;return}
 let s=sums(),driving=state.phase==='drive',color=driving?'green':'orange',c=costs(s.w,state.km);$('gps').textContent=gpsMessage;
 $('status').className='pill '+color;$('status').textContent=driving?'주행 중':'대기 중';$('main').className='main '+color;
 $('symbol').textContent=state.mode==='auto'?'◎':(driving?'Ⅱ':'▶');$('action').textContent=state.mode==='auto'?'자동 기록 중':(driving?'대기 전환':'주행 시작');$('sub').textContent=state.mode==='auto'?'GPS가 주행/정차를 자동 판별합니다':(driving?'터치하면 대기시간 측정 재개':'터치하면 주행시간 측정 시작');$('main').disabled=state.mode==='auto';
 $('hint').textContent=state.mode==='auto'?'자동 GPS 기록 중 · 종료 버튼으로 저장':(driving?'현재 주행시간 측정 중':'현재 대기시간 측정 중');$('finish').hidden=false;
 $('started').textContent=date(state.start);$('phaseStarted').textContent=date(state.phaseAt);
 $('wait').textContent=fmt(s.w);$('drive').textContent=fmt(s.d);$('distance').textContent=state.km.toFixed(2)+' km';$('cost').textContent=won(c.total);
 $('waitTotal').textContent=(s.w/60000).toFixed(1)+'분';$('driveTotal').textContent=(s.d/60000).toFixed(1)+'분';
}
function tick(){if(!timer)timer=setInterval(()=>{render();save()},1000)}
function stopGPS(){if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;last=null;lastGoodFixAt=0;gpsMessage='GPS 일시 정지'}
function kmBetween(a,b){let r=6371,rad=x=>x*Math.PI/180,dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon),v=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;return 2*r*Math.atan2(Math.sqrt(v),Math.sqrt(1-v))}
function switchPhase(phase,t=Date.now()){
 if(!state||state.phase===phase)return;
 let elapsed=Math.max(0,t-state.phaseAt);
 if(state.phase==='drive')state.drive+=elapsed;else state.wait+=elapsed;
 state.phase=phase;state.phaseAt=t;
}
function startGPS(){
 if(!navigator.geolocation||!isSecureContext){gpsMessage='GPS 사용 불가 (HTTPS 필요)';render();return}
 if(watch!==null)return;gpsMessage='GPS 연결 중';autoCandidates=0;stillCandidates=0;
 watch=navigator.geolocation.watchPosition(p=>{
  if(!state)return;
  let q={lat:p.coords.latitude,lon:p.coords.longitude,t:p.timestamp,acc:p.coords.accuracy,speed:p.coords.speed};
  if(!Number.isFinite(q.acc)||q.acc>25){gpsMessage='GPS 오차 큼 ('+Math.round(q.acc)+'m)';render();return}
  if(Date.now()-q.t>10000){gpsMessage='오래된 GPS 신호';render();return}
  let prev=last,dt=prev?(q.t-prev.t)/1000:0;
  if(dt<=0&&prev)return;
  // GPS 신호가 끊긴 동안의 시간을 주행/공회전에 임의 합산하지 않는다.
  if(state.mode==='auto'&&lastGoodFixAt&&q.t-lastGoodFixAt>12000){
    let cutoff=lastGoodFixAt+12000;let delta=Math.max(0,cutoff-state.phaseAt);
    if(state.phase==='drive')state.drive+=delta;else state.wait+=delta;
    state.phaseAt=Date.now();autoCandidates=0;stillCandidates=0;prev=null;
  }
  if(state.mode==='auto'&&!lastGoodFixAt){state.phaseAt=Date.now()}lastGoodFixAt=Date.now();gpsMessage='GPS 정확도 ±'+Math.round(q.acc)+'m';
  if(prev&&dt>0&&dt<=12){
    let d=kmBetween(prev,q),gpsKmh=d/dt*3600,reported=Number.isFinite(q.speed)&&q.speed>=0?q.speed*3.6:null;
    let plausible=gpsKmh<=160&&d<=0.3;
    let meaningful=d*1000>Math.max(4,Math.min(12,(q.acc+prev.acc)*0.35));
    let moving=plausible&&meaningful&&gpsKmh>=5&&(reported===null||reported>=2.5||gpsKmh>=10);
    let stopped=(reported!==null&&reported<2.5&&gpsKmh<6)||(!meaningful&&gpsKmh<4);
    if(state.mode==='auto'){
      autoCandidates=moving?autoCandidates+1:0;stillCandidates=stopped?stillCandidates+1:0;
      if(state.phase==='wait'&&autoCandidates>=2){switchPhase('drive',Date.now());stillCandidates=0}
      if(state.phase==='drive'&&stillCandidates>=3){switchPhase('wait',Date.now());autoCandidates=0}
    }
    // 주행거리에는 오차를 넘는 합리적인 이동만 더한다. 시작/정차 경계에서 소량 누락될 수 있다.
    if(plausible&&meaningful&&(state.phase==='drive')&&gpsKmh>=3){state.km+=d}
  }
  last=q;save();render();
 },e=>{gpsMessage=e.code===1?'위치 권한 거부':'GPS 신호 확인 필요';render()},{enableHighAccuracy:true,maximumAge:0,timeout:10000});
}
function begin(){let t=Date.now();state={start:t,mode:selectedMode,phase:'wait',phaseAt:t,wait:0,drive:0,km:0};lastGoodFixAt=0;gpsMessage='GPS 대기';if(state.mode==='auto')startGPS();save();tick();render()}
function toggle(){if(state.mode==='auto')return;let next=state.phase==='wait'?'drive':'wait';switchPhase(next);if(next==='drive')startGPS();else stopGPS();save();render()}
function finish(){if(!confirm('주행을 종료하고 기록을 저장할까요?'))return;let s=sums(),c=costs(s.w,state.km),rec={...state,end:Date.now(),wait:s.w,drive:s.d,cost:c,settings:{...settings}};stopGPS();let h=history();h.unshift(rec);localStorage.setItem(KEY,JSON.stringify({state:null,history:h}));state=null;clearInterval(timer);timer=null;render();showHistory()}
function showHistory(){let h=history();$('history').innerHTML=h.length?h.map(r=>`<article class="historycard"><b>${date(r.start)} ${r.mode==='auto'?'자동 GPS':'수동'} 주행</b><p>대기 ${fmt(r.wait)} · 주행 ${fmt(r.drive)}<br>거리 ${r.km.toFixed(1)}km · 유류비 ${won(r.cost.total)} (대기 ${won(r.cost.idle)}, 주행 ${won(r.cost.drive)})</p></article>`).join(''):'<p class="empty">저장된 주행 기록이 없습니다.</p>'}
$('homeRefresh').onclick=()=>{window.scrollTo({top:0,behavior:'instant'});location.reload()};
$('main').onclick=()=>{if(!state)begin();else toggle()};$('finish').onclick=finish;
$('manualMode').onclick=()=>{if(!state){selectedMode='manual';render()}};
$('autoMode').onclick=()=>{if(!state){selectedMode='auto';render()}};
$('saveSettings').onclick=()=>{settings={efficiency:Math.max(.1,+$('efficiency').value||9),price:Math.max(0,+$('price').value||0),idle:Math.max(0,+$('idle').value||0)};localStorage.setItem(SET,JSON.stringify(settings));render();alert('설정을 저장했습니다.')};
$('csv').onclick=()=>{let rows=[['시작','종료','대기시간(초)','주행시간(초)','주행거리(km)','대기유류비(원)','주행유류비(원)','총유류비(원)','모드'],...history().map(r=>[new Date(r.start).toISOString(),new Date(r.end).toISOString(),Math.round(r.wait/1000),Math.round(r.drive/1000),r.km.toFixed(2),Math.round(r.cost.idle),Math.round(r.cost.drive),Math.round(r.cost.total),r.mode||'manual'])];let csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');let a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='주행일지_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url)};
$('clear').onclick=()=>{if(confirm('모든 저장 기록을 삭제할까요? 복구할 수 없습니다.')){localStorage.setItem(KEY,JSON.stringify({state,history:[]}));showHistory()}};
$('efficiency').value=settings.efficiency;$('price').value=settings.price;$('idle').value=settings.idle;
try{state=JSON.parse(localStorage.getItem(KEY)||'{}').state||null}catch{state=null}
if(state){state.mode=state.mode||'manual';tick();if(state.mode==='auto'||state.phase==='drive')startGPS()}render();showHistory();
updateClock();setInterval(updateClock,1000);
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
