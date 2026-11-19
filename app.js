const $=id=>document.getElementById(id), KEY='drive-log-v2', SET='drive-settings-v2';
let state=null,watch=null,last=null,timer=null;
let settings={efficiency:9,price:1800,idle:.8,...JSON.parse(localStorage.getItem(SET)||'{}')};
const history=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}').history||[]}catch{return[]}};
const save=()=>localStorage.setItem(KEY,JSON.stringify({state,history:history()}));
const fmt=ms=>{let s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return [h,m,x].map(v=>String(v).padStart(2,'0')).join(':')};
const date=t=>new Date(t).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
function sums(){if(!state)return{w:0,d:0};let elapsed=Date.now()-state.phaseAt;return{w:state.wait+(state.phase==='wait'?elapsed:0),d:state.drive+(state.phase==='drive'?elapsed:0)}}
function costs(w=0,dist=0){let idleLitres=w/3600000*settings.idle,driveLitres=dist/settings.efficiency;return{idle:idleLitres*settings.price,drive:driveLitres*settings.price,total:(idleLitres+driveLitres)*settings.price}}
function render(){
 if(!state){$('status').className='pill red';$('status').textContent='시작 전';$('main').className='main red';$('symbol').textContent='▶';$('action').textContent='운행 시작';$('sub').textContent='터치하면 대기시간 측정 시작';$('hint').textContent='운행을 시작할 준비가 되면 눌러주세요';$('finish').hidden=true;$('started').textContent='-';$('phaseStarted').textContent='-';$('wait').textContent='00:00:00';$('drive').textContent='00:00:00';$('distance').textContent='0.0 km';$('cost').textContent='0원';$('waitTotal').textContent='0분';$('driveTotal').textContent='0분';$('gps').textContent='GPS 대기';return}
 let s=sums(),driving=state.phase==='drive',color=driving?'green':'orange',c=costs(s.w,state.km);
 $('status').className='pill '+color;$('status').textContent=driving?'운행 중':'대기 중';$('main').className='main '+color;
 $('symbol').textContent=driving?'Ⅱ':'▶';$('action').textContent=driving?'대기 전환':'주행 시작';$('sub').textContent=driving?'터치하면 대기시간 측정 재개':'터치하면 주행시간 측정 시작';
 $('hint').textContent=driving?'현재 주행시간 측정 중':'현재 대기시간 측정 중';$('finish').hidden=false;
 $('started').textContent=date(state.start);$('phaseStarted').textContent=date(state.phaseAt);
 $('wait').textContent=fmt(s.w);$('drive').textContent=fmt(s.d);$('distance').textContent=state.km.toFixed(1)+' km';$('cost').textContent=won(c.total);
 $('waitTotal').textContent=(s.w/60000).toFixed(1)+'분';$('driveTotal').textContent=(s.d/60000).toFixed(1)+'분';
}
function tick(){if(!timer)timer=setInterval(()=>{render();save()},1000)}
function stopGPS(){if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;last=null;$('gps').textContent='GPS 일시 정지'}
function kmBetween(a,b){let r=6371,rad=x=>x*Math.PI/180,dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon),v=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;return 2*r*Math.atan2(Math.sqrt(v),Math.sqrt(1-v))}
function startGPS(){
 if(!navigator.geolocation||!isSecureContext){$('gps').textContent='GPS 사용 불가 (HTTPS 필요)';return}
 if(watch!==null)return;$('gps').textContent='GPS 측정 중';
 watch=navigator.geolocation.watchPosition(p=>{let q={lat:p.coords.latitude,lon:p.coords.longitude,t:p.timestamp,acc:p.coords.accuracy};if(q.acc>45)return;
 if(last){let d=kmBetween(last,q),sec=Math.max(1,(q.t-last.t)/1000);if(d>.008&&d/sec*3600<=160){state.km+=d;save();render()}}last=q;
 },e=>$('gps').textContent=e.code===1?'위치 권한 거부':'GPS 신호 확인 필요',{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
}
function begin(){let t=Date.now();state={start:t,phase:'wait',phaseAt:t,wait:0,drive:0,km:0};save();tick();render()}
function toggle(){let t=Date.now(),elapsed=t-state.phaseAt;if(state.phase==='wait'){state.wait+=elapsed;state.phase='drive';state.phaseAt=t;startGPS()}else{state.drive+=elapsed;state.phase='wait';state.phaseAt=t;stopGPS()}save();render()}
function finish(){if(!confirm('운행을 종료하고 기록을 저장할까요?'))return;let s=sums(),c=costs(s.w,state.km),rec={...state,end:Date.now(),wait:s.w,drive:s.d,cost:c,settings:{...settings}};stopGPS();let h=history();h.unshift(rec);localStorage.setItem(KEY,JSON.stringify({state:null,history:h}));state=null;clearInterval(timer);timer=null;render();showHistory()}
function showHistory(){let h=history();$('history').innerHTML=h.length?h.map(r=>`<article class="historycard"><b>${date(r.start)} 운행</b><p>대기 ${fmt(r.wait)} · 주행 ${fmt(r.drive)}<br>거리 ${r.km.toFixed(1)}km · 유류비 ${won(r.cost.total)} (대기 ${won(r.cost.idle)}, 주행 ${won(r.cost.drive)})</p></article>`).join(''):'<p class="empty">저장된 운행 기록이 없습니다.</p>'}
$('main').onclick=()=>{if(!state)begin();else toggle()};$('finish').onclick=finish;
$('saveSettings').onclick=()=>{settings={efficiency:Math.max(.1,+$('efficiency').value||9),price:Math.max(0,+$('price').value||0),idle:Math.max(0,+$('idle').value||0)};localStorage.setItem(SET,JSON.stringify(settings));render();alert('설정을 저장했습니다.')};
$('csv').onclick=()=>{let rows=[['시작','종료','대기시간(초)','주행시간(초)','주행거리(km)','대기유류비(원)','주행유류비(원)','총유류비(원)'],...history().map(r=>[new Date(r.start).toISOString(),new Date(r.end).toISOString(),Math.round(r.wait/1000),Math.round(r.drive/1000),r.km.toFixed(2),Math.round(r.cost.idle),Math.round(r.cost.drive),Math.round(r.cost.total)])];let csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');let a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='운행일지_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url)};
$('clear').onclick=()=>{if(confirm('모든 저장 기록을 삭제할까요? 복구할 수 없습니다.')){localStorage.setItem(KEY,JSON.stringify({state,history:[]}));showHistory()}};
$('efficiency').value=settings.efficiency;$('price').value=settings.price;$('idle').value=settings.idle;
try{state=JSON.parse(localStorage.getItem(KEY)||'{}').state||null}catch{state=null}
if(state){tick();if(state.phase==='drive')startGPS()}render();showHistory();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
