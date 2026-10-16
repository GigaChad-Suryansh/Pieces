import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EnginePhysics} from './physics.js';
import {setupQuiz} from './quiz.js';
import {buildEngine} from './engine3d/build.js';
import {ENGINES} from './data/engines.js';
import {createEnvironment,createStudio} from './engine3d/studio.js';

const engines={
 i4:{name:'2.0L Inline-4',sub:'Petrol · DOHC · 16 valves',cyl:4,bore:1.75,stroke:2.05},
 v6:{name:'3.0L V6',sub:'Petrol · DOHC · 24 valves',cyl:6,bore:1.55,stroke:1.95},
 diesel:{name:'2.2L Turbo Diesel',sub:'Diesel · common rail · turbo',cyl:4,bore:1.82,stroke:2.15},
 bike:{name:'1.0L Motorcycle',sub:'Petrol · DOHC · high-revving',cyl:4,bore:1.42,stroke:1.75}
};
const catalog=[
['Structure','Engine block','Main structural casting containing cylinder bores and oil/coolant passages.'],
['Structure','Cylinder liner','Precision bore surface in which the piston travels.'],
['Structure','Cylinder head','Closes the cylinders and carries combustion chambers, ports and valvetrain.'],
['Structure','Head gasket','Seals combustion pressure and oil/coolant passages between head and block.'],
['Structure','Valve cover','Covers the upper valvetrain and retains lubricant.'],
['Structure','Oil pan / sump','Reservoir at the bottom of the engine that collects oil.'],
['Motion','Piston','Receives combustion pressure and transfers force to the connecting rod.'],
['Motion','Piston rings','Seal combustion gases, control oil and transfer heat to the cylinder wall.'],
['Motion','Wrist pin','Connects the piston to the small end of the connecting rod.'],
['Motion','Connecting rod','Transfers force between piston and crankshaft.'],
['Motion','Rod bearing','Precision bearing between the rod big end and crank journal.'],
['Motion','Crankshaft','Converts piston reciprocation into rotary motion.'],
['Motion','Main bearing','Supports crankshaft journals inside the block.'],
['Motion','Crank pulley','Front pulley for accessory drive and timing reference.'],
['Motion','Flywheel / flexplate','Adds rotational inertia and couples the crankshaft to the transmission.'],
['Valvetrain','Camshaft','Runs at half crank speed in a four-stroke engine and controls valve events.'],
['Valvetrain','Cam lobe','Eccentric profile that produces valve lift.'],
['Valvetrain','Intake valve','Admits fresh charge into the combustion chamber.'],
['Valvetrain','Exhaust valve','Releases combustion products.'],
['Valvetrain','Valve spring','Returns a valve toward its seat and maintains contact.'],
['Valvetrain','Rocker arm','Lever transmitting cam motion to a valve in rocker-based layouts.'],
['Valvetrain','Valve guide','Guides the valve stem.'],
['Valvetrain','Valve seat','Machined sealing surface for a closed valve.'],
['Timing','Timing chain / belt','Synchronizes crankshaft and camshaft rotation.'],
['Timing','Timing tensioner','Maintains timing-drive tension.'],
['Timing','Timing guide','Controls timing-chain path and vibration.'],
['Air & fuel','Intake manifold','Distributes incoming air or charge to the cylinders.'],
['Air & fuel','Throttle body','Controls intake airflow in throttle-controlled gasoline engines.'],
['Air & fuel','Fuel rail','Supplies pressurized fuel to injectors.'],
['Air & fuel','Fuel injector','Meters and atomizes fuel.'],
['Air & fuel','Air filter','Removes particles from intake air.'],
['Air & fuel','Exhaust manifold','Collects exhaust gas from cylinder outlets.'],
['Air & fuel','Turbocharger','Uses exhaust energy to compress intake air.'],
['Air & fuel','Intercooler','Cools compressed intake air in boosted systems.'],
['Ignition','Spark plug','Creates the spark that initiates combustion in gasoline engines.'],
['Ignition','Ignition coil','Raises battery voltage for the spark plug.'],
['Ignition','Glow plug','Assists cold starting and combustion in diesel engines.'],
['Cooling','Water pump','Circulates coolant through the engine and cooling circuit.'],
['Cooling','Thermostat','Regulates coolant flow and operating temperature.'],
['Cooling','Coolant jacket','Passages around hot areas carrying heat into coolant.'],
['Cooling','Radiator','Rejects coolant heat to ambient air.'],
['Cooling','Cooling fan','Moves air through the radiator when required.'],
['Lubrication','Oil pump','Draws oil from the sump and supplies pressurized lubricant.'],
['Lubrication','Oil filter','Removes particles and contaminants from engine oil.'],
['Lubrication','Oil gallery','Internal passage carrying lubricant to bearings and components.'],
['Lubrication','Oil jet','Directs lubricant toward piston undersides on some engines.'],
['Exhaust','Catalytic converter','Uses catalyst surfaces to reduce regulated exhaust pollutants.'],
['Exhaust','Oxygen sensor','Measures exhaust oxygen for engine-control feedback.'],
['Exhaust','EGR valve','Routes controlled exhaust gas back to the intake on equipped engines.'],
['Starting','Starter motor','Electric motor that rotates the crankshaft during startup.'],
['Starting','Alternator','Generates electrical power and maintains the vehicle battery.']
];
const info=Object.fromEntries(catalog.map(x=>[x[1],{system:x[0],desc:x[2]}]));
const state={engine:'i4',selected:'Piston',system:'All',search:'',explode:false,cutaway:false,isolate:false,running:false,xray:false,rpm:900,cycle:0,throttle:18,load:25};
let plotClock=0;const history={rpm:[],torque:[],temp:[]};let animationLoopStarted=false,resizeHandlerBound=false;
let physics=new EnginePhysics(state.engine);
const combustion=[];
const dyno={running:false,elapsed:0,lastSample:0,points:[],peakTorque:0,peakPower:0};
let scene,camera,renderer,controls,raycaster,mouse,eng,parts=[],last=performance.now(),focusTarget=new THREE.Vector3(0,6,0),focusCamera=new THREE.Vector3(30,18,46),focusAnimating=false;const home={target:new THREE.Vector3(),cam:new THREE.Vector3()};

document.querySelector('#app').innerHTML=`
<header class="topbar"><div class="brand">PIECES <span>ENGINEVERSE</span></div><div class="search"><span>⌕</span><input id="search" placeholder="Search parts, systems, engines…"></div><nav><button class="nav active" data-tab="library">Library</button><button class="nav" data-tab="learn">Learn</button><button class="nav" data-tab="compare">Compare</button></nav><kbd>K</kbd><div class="avatar">S</div></header>
<main class="appShell"><section class="intro"><div><span class="eyebrow">INTERACTIVE 3D ENGINEERING LAB</span><h1>See how an engine<br><em>actually moves.</em></h1><p>Rotate real-world-inspired engine assemblies, inspect individual parts and watch the four-stroke mechanism move in real time.</p></div><div class="stats"><b>50+</b><span>catalogued parts</span><b>4</b><span>road-engine families</span><b>720°</b><span>four-stroke cycle</span></div></section><section id="workspace"></section></main>`;

const M={steel:new THREE.MeshPhysicalMaterial({color:0x777b78,roughness:.25,metalness:.9,clearcoat:.18}),alloy:new THREE.MeshPhysicalMaterial({color:0xc4c7c3,roughness:.34,metalness:.78,clearcoat:.22}),dark:new THREE.MeshPhysicalMaterial({color:0x252827,roughness:.23,metalness:.88,clearcoat:.12}),black:new THREE.MeshPhysicalMaterial({color:0x121413,roughness:.58,metalness:.2}),red:new THREE.MeshPhysicalMaterial({color:0xb94139,roughness:.28,metalness:.48,clearcoat:.25}),blue:new THREE.MeshPhysicalMaterial({color:0x3d6ea4,roughness:.3,metalness:.45,clearcoat:.2}),gold:new THREE.MeshPhysicalMaterial({color:0xd0a044,roughness:.22,metalness:.86,clearcoat:.2}),rubber:new THREE.MeshStandardMaterial({color:0x202220,roughness:.8}),white:new THREE.MeshPhysicalMaterial({color:0xe7e8e4,roughness:.4,metalness:.25,clearcoat:.18}),copper:new THREE.MeshPhysicalMaterial({color:0xa85f35,roughness:.24,metalness:.82})};
const geo={box:(x,y,z,r=.12)=>new THREE.BoxGeometry(x,y,z),cyl:(r,h,s=32)=>new THREE.CylinderGeometry(r,r,h,s),tor:(R,r)=>new THREE.TorusGeometry(R,r,16,48)};
function add(g,m,name,system,parent=root){const o=new THREE.Mesh(g,m);o.userData={part:name,system};o.castShadow=o.receiveShadow=true;parent.add(o);parts.push(o);return o}
function init3D(){
 try{
 physics=new EnginePhysics(state.engine);physics.throttle=state.throttle/100;physics.load=state.load/100;physics.rpm=state.rpm;physics.theta=state.cycle;
 const el=document.querySelector('#viewport');if(renderer){controls?.dispose();renderer.dispose();renderer.domElement.remove();renderer=null;}scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(36,1,.5,400);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.localClippingEnabled=true;el.appendChild(renderer.domElement);
 scene.environment=createEnvironment(renderer);scene.environmentIntensity=.9;createStudio(scene);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=7;controls.maxDistance=110;controls.maxPolarAngle=Math.PI*.495;
 raycaster=new THREE.Raycaster();mouse=new THREE.Vector2();
 build();resize();if(!resizeHandlerBound){window.addEventListener('resize',resize);resizeHandlerBound=true;}renderer.domElement.addEventListener('pointermove',pointer);renderer.domElement.addEventListener('click',e=>{pointer(e);pick();});requestRenderMeta();drawInstrumentation();if(!animationLoopStarted){animationLoopStarted=true;requestAnimationFrame(loop);}
 }catch(err){
   console.error('Engine Atlas 3D initialization failed:',err);
   const el=document.querySelector('#viewport');
   if(el) el.insertAdjacentHTML('beforeend',`<div class="engineError"><b>3D simulation could not start</b><span>${String(err?.message||err)}</span><small>Try Chrome/Edge with hardware acceleration enabled.</small></div>`);
 }
}
function build(){
 eng=buildEngine(ENGINES[state.engine]);scene.add(eng.root);parts=eng.parts;
 const c=eng.bounds.center,sz=eng.bounds.size,d=Math.max(sz.x,sz.y*1.25)*1.85;
 home.target.set(c.x,c.y-.5,c.z);home.cam.set(c.x+d*.62,c.y+d*.42,c.z+d*.92);
 focusTarget.copy(home.target);focusCamera.copy(home.cam);focusAnimating=false;
 camera.position.copy(home.cam);controls.target.copy(home.target);controls.update();controls.saveState();
 updateVisibility();select(state.selected,false)
}
function updateVisibility(){eng&&eng.applyFilter({system:state.system,isolate:state.isolate?state.selected:null})}
function highlight(name){eng&&eng.highlight(name)}
function select(name,focus=true){
 state.selected=name;highlight(name);document.querySelectorAll('.partRow').forEach(x=>x.classList.toggle('selected',x.dataset.part===name));
 const d=document.querySelector('#detail');if(d)d.innerHTML=`<span class="detailLabel">${info[name]?.system||'ENGINE'} · COMPONENT</span><h3>${name}</h3><p>${info[name]?.desc||'Mechanical component in the engine assembly.'}</p><div class="chips"><span>3D SELECTABLE</span><span>INTERACTIVE</span></div>`;
 if(focus){const o=parts.find(x=>x.userData.part===name);if(o){focusTarget.copy(o.getWorldPosition(new THREE.Vector3()));const offset=new THREE.Vector3(8,5,12);focusCamera.copy(focusTarget).add(offset);focusAnimating=true;}}
}
function pointer(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1}
function pick(){raycaster.setFromCamera(mouse,camera);const h=raycaster.intersectObjects(parts,true)[0];if(h){let o=h.object;while(o&&!o.userData.part)o=o.parent;if(o?.userData.part){select(o.userData.part);document.querySelectorAll('.partRow').forEach(x=>x.classList.toggle('selected',x.dataset.part===state.selected))}}}
function resize(){if(!renderer)return;const el=document.querySelector('#viewport');if(!el||!el.clientWidth||!el.clientHeight)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight,false)}
function loop(now){
 requestAnimationFrame(loop);
 const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;
 if(state.running){physics.throttle=state.throttle/100;physics.load=state.load/100;const snap=physics.step(dt);state.rpm=snap.rpm;state.cycle=snap.theta;}else{physics.theta=state.cycle;physics.rpm=state.rpm;}
 eng&&eng.update({theta:state.cycle,physics,dt,explode:state.explode,cutaway:state.cutaway,xray:state.xray});
if(dyno.running){
  dyno.elapsed+=dt;dyno.lastSample+=dt;
  if(dyno.lastSample>=.12){
    dyno.lastSample=0;
    const rpm=Math.round(physics.rpm/100)*100,prev=dyno.points[dyno.points.length-1];
    if(!prev||rpm>prev.rpm+70){
      const torque=Math.max(0,physics.torque),power=torque*rpm*2*Math.PI/60/1000;
      dyno.points.push({rpm,torque,power});
      dyno.peakTorque=Math.max(dyno.peakTorque,torque);dyno.peakPower=Math.max(dyno.peakPower,power);
      drawDyno();
    }
  }
  if(physics.rpm>=physics.spec.redline-30||dyno.elapsed>22){dyno.running=false;const btn=document.querySelector('#dynoStart');if(btn)btn.textContent='▶ RUN DYNO PULL';requestRenderMeta();drawDyno();}
}
 if(controls){if(focusAnimating){controls.target.lerp(focusTarget,.12);camera.position.lerp(focusCamera,.08);if(camera.position.distanceTo(focusCamera)<.08&&controls.target.distanceTo(focusTarget)<.08)focusAnimating=false;}controls.update();}
 renderer?.render(scene,camera);plotClock+=dt;if(plotClock>.3){plotClock=0;requestRenderMeta();drawInstrumentation();}
}
function requestRenderMeta(){const phase=document.querySelector('#cyclePhase');if(phase){const a=((state.cycle%720)+720)%720;phase.textContent=a<180?'INTAKE':a<360?'COMPRESSION':a<540?'POWER':'EXHAUST';}const status=document.querySelector('#engineStatus');if(status)status.textContent=state.running?'ENGINE RUNNING · LIVE PHYSICS':'SIMULATION READY · 4-STROKE';const play=document.querySelector('#play');if(play){play.textContent=state.running?'Ⅱ':'▶';play.setAttribute('aria-label',state.running?'Pause engine':'Start engine');}const deg=document.querySelector('#cycleDeg');if(deg)deg.textContent=Math.round(state.cycle)+'°';const bar=document.querySelector('#cycleBar');if(bar)bar.style.width=state.cycle/7.2+'%';const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};set('#teleRPM',Math.round(physics.rpm));set('#teleTorque',Math.round(physics.torque)+' Nm');set('#telePower',physics.power.toFixed(1)+' kW');set('#telePressure',physics.pressure.toFixed(1)+' bar');set('#teleBoost',(physics.boost||0).toFixed(2)+' bar');set('#teleTemp',Math.round(physics.temperature)+'°C');set('#teleOil',Math.round(physics.oil||95)+'°C');set('#teleExhaust',Math.round(physics.exhaustTemp||280)+'°C');set('#teleEff',(physics.efficiency||0).toFixed(1)+'%');set('#teleKnock',(physics.knock||0).toFixed(1)+'%');set('#readIMEP',(physics.imep||0).toFixed(1)+' bar');set('#readBMEP',(physics.bmep||0).toFixed(1)+' bar');set('#readAFR',physics.spec.afr.toFixed(1));set('#readFlow',(physics.intakeFlow||0).toFixed(1)+' g/s')}

function drawChart(id,values,maxValue,label,color='#48e6ff'){const cv=document.querySelector('#'+id);if(!cv||!values?.length)return;const d=Math.min(window.devicePixelRatio||1,2),w=Math.max(cv.clientWidth,300),h=Math.max(cv.clientHeight,145);cv.width=Math.round(w*d);cv.height=Math.round(h*d);const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);x.font='10px DM Sans,Arial';x.fillStyle='rgba(157,169,198,.75)';for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,i*h/4);x.lineTo(w,i*h/4);x.strokeStyle='rgba(157,169,198,.12)';x.lineWidth=1;x.stroke()}const pts=values.map((v,i)=>[i/(values.length-1||1)*w,h-10-(Math.max(0,Math.min(v,maxValue))/Math.max(maxValue,1))*(h-22)]);x.beginPath();pts.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.lineTo(w,h-10);x.lineTo(0,h-10);x.closePath();const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,color+'55');g.addColorStop(1,color+'00');x.fillStyle=g;x.fill();x.beginPath();pts.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.strokeStyle=color;x.lineWidth=2.5;x.lineJoin='round';x.lineCap='round';x.stroke();x.fillStyle=color;x.fillText(label,8,14)}
function drawDyno(){
 const cv=document.querySelector('#dynoPlot');if(!cv)return;
 const d=Math.min(window.devicePixelRatio||1,2),w=Math.max(cv.clientWidth,320),h=Math.max(cv.clientHeight,180);
 cv.width=Math.round(w*d);cv.height=Math.round(h*d);const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
 c.fillStyle='rgba(9,15,29,.35)';c.fillRect(0,0,w,h);c.font='10px DM Sans,Arial';c.fillStyle='rgba(157,169,198,.8)';
 for(let i=1;i<5;i++){const y=i*h/5;c.beginPath();c.moveTo(32,y);c.lineTo(w-12,y);c.strokeStyle='rgba(157,169,198,.14)';c.stroke();}
 for(let i=1;i<5;i++){const x=32+i*(w-44)/5;c.beginPath();c.moveTo(x,8);c.lineTo(x,h-22);c.strokeStyle='rgba(157,169,198,.09)';c.stroke();}
 const maxRpm=physics.spec.redline,maxT=Math.max(30,...dyno.points.map(p=>p.torque))*1.15,maxP=Math.max(10,...dyno.points.map(p=>p.power))*1.15;
 const draw=(key,max,color)=>{if(dyno.points.length<2)return;c.beginPath();dyno.points.forEach((p,i)=>{const x=32+(p.rpm/maxRpm)*(w-44),y=h-22-(p[key]/max)*(h-34);i?c.lineTo(x,y):c.moveTo(x,y)});c.strokeStyle=color;c.lineWidth=2.5;c.lineJoin='round';c.stroke();};
 draw('torque',maxT,'#48e6ff');draw('power',maxP,'#ffad5a');
 c.fillStyle='#48e6ff';c.fillText('TORQUE',36,14);c.fillStyle='#ffad5a';c.fillText('POWER',104,14);
 c.fillStyle='rgba(157,169,198,.8)';c.fillText('0',18,h-9);c.fillText(Math.round(maxRpm),w-50,h-9);
 const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};
 set('#dynoPeakTorque',dyno.points.length?dyno.peakTorque.toFixed(1)+' Nm':'— Nm');
 set('#dynoPeakPower',dyno.points.length?dyno.peakPower.toFixed(1)+' kW':'— kW');
 set('#dynoLiveRpm',Math.round(physics.rpm).toLocaleString());
 set('#dynoStatus',dyno.running?'PULL IN PROGRESS':dyno.points.length?'Pull complete · modelled data':'Ready for a pull');
}
function drawInstrumentation(){if(!physics)return;const pressure=[],torque=[],piston=[];for(let a=0;a<=720;a+=30){pressure.push(physics.cylinderPressure(a,physics.throttle)/1e5);const q=physics.cylinderWorkTorque(a);torque.push(Math.max(0,q.torque));piston.push(physics.pistonPosition(a*Math.PI/180)*1000)}drawChart('pressurePlot',pressure,Math.max(20,...pressure),'bar','#48e6ff');drawChart('torquePlot',torque,Math.max(20,...torque),'Nm','#ffad5a');drawChart('pistonPlot',piston,Math.max(90,...piston),'mm','#9b7cff');history.rpm.push(physics.rpm);history.torque.push(physics.torque);history.temp.push(physics.temperature);[history.rpm,history.torque,history.temp].forEach(a=>{if(a.length>80)a.shift()});const cv=document.querySelector('#trendPlot');if(cv){const w=cv.clientWidth||500,h=cv.clientHeight||150,d=Math.min(devicePixelRatio||1,2);cv.width=Math.round(w*d);cv.height=Math.round(h*d);const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);const draw=(arr,max)=>{x.beginPath();arr.forEach((v,i)=>{const px=i/(79)*w,py=h-6-Math.max(0,Math.min(v/max,1))*(h-12);i?x.lineTo(px,py):x.moveTo(px,py)});x.strokeStyle='#30332f';x.lineWidth=2;x.stroke()};draw(history.rpm,physics.spec.redline);draw(history.temp,180)}const set=(id,v)=>{const e=document.querySelector(id.startsWith('#')?id:'#'+id);if(e)e.textContent=v};set('#readIMEP',(physics.imep||0).toFixed(1)+' bar');set('#readBMEP',(physics.bmep||0).toFixed(1)+' bar');set('#readAFR',physics.spec.afr.toFixed(1));set('#readFlow',(physics.intakeFlow||0).toFixed(1)+' g/s')}
function renderLibrary(){
 const systems=['All',...new Set(catalog.map(x=>x[0]))],q=state.search.toLowerCase();
 const list=catalog.filter(x=>(state.system==='All'||x[0]===state.system)&&(`${x[0]} ${x[1]} ${x[2]}`.toLowerCase().includes(q)));
 document.querySelector('#workspace').innerHTML=`
 <div class="atlasGrid"><aside class="library panel"><div class="panelTitle"><div><span class="eyebrow">ENGINE LIBRARY</span><h2>Choose a machine</h2></div><span class="count">04</span></div>
 <div class="engineList">${Object.entries(engines).map(([id,e])=>`<button class="engineCard ${id===state.engine?'selected':''}" data-engine="${id}"><span class="engineIcon">◎</span><div><b>${e.name}</b><small>${e.sub}</small></div><i>↗</i></button>`).join('')}</div>
 <div class="catalogHead"><span class="eyebrow">SYSTEMS</span><button id="clear">CLEAR</button></div><div class="systemList">${systems.map(s=>`<button class="systemBtn ${s===state.system?'active':''}" data-system="${s}"><span class="dot"></span>${s}<small>${s==='All'?catalog.length:catalog.filter(x=>x[0]===s).length}</small></button>`).join('')}</div></aside>
 <section class="viewer panel"><div class="viewerHead"><div><span class="eyebrow">LIVE 3D ASSEMBLY</span><h2>${engines[state.engine].name}</h2><small>Orbit · zoom · click any component</small></div><div class="actions"><button data-view="front">FRONT</button><button data-view="side">SIDE</button><button data-view="top">TOP</button><button id="explodeBtn">${state.explode?'ASSEMBLE':'EXPLODE'}</button><button id="cutBtn">${state.cutaway?'SOLID':'CUTAWAY'}</button><button id="isoBtn">${state.isolate?'SHOW ALL':'ISOLATE'}</button><button id="reset">RESET</button></div></div>
 <div id="viewport" class="viewport"><div class="hud"><b>PIECES // ENGINE LAB</b><span id="engineStatus">SIMULATION READY · 4-STROKE</span></div><div class="simPresets"><span>DRIVE MODE</span><button data-preset="idle">IDLE</button><button data-preset="road">ROAD</button><button data-preset="power">POWER</button></div><div class="telemetry"><div><span>RPM</span><b id="teleRPM">${Math.round(state.rpm)}</b></div><div><span>TORQUE</span><b id="teleTorque">0 Nm</b></div><div><span>POWER</span><b id="telePower">0 kW</b></div><div><span>CYL. PRESSURE</span><b id="telePressure">1 bar</b></div><div><span>BOOST</span><b id="teleBoost">0.00 bar</b></div><div><span>COOLANT</span><b id="teleTemp">90°C</b></div><div><span>OIL</span><b id="teleOil">95°C</b></div><div><span>EXHAUST</span><b id="teleExhaust">280°C</b></div><div><span>EFFICIENCY</span><b id="teleEff">0%</b></div><div><span>KNOCK</span><b id="teleKnock">0%</b></div></div><div class="cycle"><span>4-STROKE CYCLE</span><small id="cyclePhase">INTAKE</small><b id="cycleDeg">${Math.round(state.cycle)}°</b><div class="cycleBar"><i id="cycleBar" style="width:${state.cycle/7.2}%"></i></div><button id="play" aria-label="${state.running?'Pause engine':'Start engine'}">${state.running?'Ⅱ':'▶'}</button></div><div class="physicsControls"><label>THROTTLE <input id="throttle" type="range" min="0" max="100" value="${state.throttle}"><b id="throttleVal">${state.throttle}%</b></label><label>LOAD <input id="load" type="range" min="0" max="100" value="${state.load}"><b id="loadVal">${state.load}%</b></label><label>IGNITION <input id="advance" type="range" min="0" max="35" value="${physics.sparkAdvance||12}"><b id="advanceVal">${physics.sparkAdvance||12}°</b></label></div></div>
 <div id="detail" class="detail"></div></section></div><div class="instrumentation panel"><div class="panelTitle"><div><span class="eyebrow">LIVE INSTRUMENTATION</span><h2>Engine traces</h2></div><span class="subtle">Reduced-order physics · 0–720° cycle</span></div><div class="plotGrid"><article class="plotCard"><div><b>CYLINDER PRESSURE</b><small>bar vs crank angle</small></div><canvas id="pressurePlot"></canvas></article><article class="plotCard"><div><b>TORQUE PULSE</b><small>Nm vs crank angle</small></div><canvas id="torquePlot"></canvas></article><article class="plotCard"><div><b>PISTON MOTION</b><small>position vs crank angle</small></div><canvas id="pistonPlot"></canvas></article><article class="plotCard"><div><b>LIVE TREND</b><small>RPM / temperature</small></div><canvas id="trendPlot"></canvas></article></div><div class="physicsReadout"><span>IMEP <b id="readIMEP">0 bar</b></span><span>BMEP <b id="readBMEP">0 bar</b></span><span>AFR <b id="readAFR">14.7</b></span><span>INTAKE FLOW <b id="readFlow">0 g/s</b></span></div></div>
 <section class="dyno panel"><div class="panelTitle"><div><span class="eyebrow">CHASSIS DYNO · MODELLED SWEEP</span><h2>Power & torque curve</h2></div><span id="dynoStatus" class="subtle">Ready for a pull</span></div>
 <div class="dynoLayout"><div class="dynoPlotWrap"><canvas id="dynoPlot"></canvas><div class="dynoAxis"><span>LOW RPM</span><span>ENGINE SPEED →</span><span>REDLINE</span></div></div>
 <div class="dynoSide"><div class="dynoMetrics"><div><span>PEAK TORQUE</span><b id="dynoPeakTorque">— <small>Nm</small></b></div><div><span>PEAK POWER</span><b id="dynoPeakPower">— <small>kW</small></b></div><div><span>LIVE RPM</span><b id="dynoLiveRpm">900</b></div></div>
 <label class="dynoLoadLabel">DYNO BRAKE LOAD <input id="dynoLoad" type="range" min="5" max="85" value="20"><b id="dynoLoadValue">20%</b></label>
 <div class="dynoButtons"><button id="dynoStart">▶ RUN DYNO PULL</button><button id="dynoClear">CLEAR TRACE</button></div>
 <p class="dynoNote">Educational reduced-order model, not a calibrated real-world dynamometer. Hold load steady and compare engine configurations.</p></div></div></section>
 <section class="catalog panel"><div class="panelTitle"><div><span class="eyebrow">COMPONENT CATALOGUE</span><h2>${list.length} parts in view</h2></div><span class="subtle">Click a part to inspect it</span></div><div class="partsGrid">${list.map((x,i)=>`<button class="partRow ${x[1]===state.selected?'selected':''}" data-part="${x[1]}"><span class="num">${String(i+1).padStart(2,'0')}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><em>${x[0]}</em></button>`).join('')}</div></section>`;
 bindLibrary();init3D()
}
function refreshCatalog(){
 const q=state.search.toLowerCase();
 const list=catalog.filter(x=>(state.system==='All'||x[0]===state.system)&&(`${x[0]} ${x[1]} ${x[2]}`.toLowerCase().includes(q)));
 const title=document.querySelector('.catalog .panelTitle h2');if(title)title.textContent=`${list.length} parts in view`;
 const grid=document.querySelector('.catalog .partsGrid');if(grid)grid.innerHTML=list.map((x,i)=>`<button class="partRow ${x[1]===state.selected?'selected':''}" data-part="${x[1]}"><span class="num">${String(i+1).padStart(2,'0')}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><em>${x[0]}</em></button>`).join('');
 document.querySelectorAll('.partRow').forEach(b=>b.onclick=()=>select(b.dataset.part));
}
function bindLibrary(){
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(!camera||!controls)return;const target=controls.target.clone();const offsets={front:new THREE.Vector3(0,4,44),side:new THREE.Vector3(44,4,0),top:new THREE.Vector3(0,48,.01)};focusTarget.copy(target);focusCamera.copy(target).add(offsets[b.dataset.view]);focusAnimating=true;});
 document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const presets={idle:{throttle:18,load:8},road:{throttle:42,load:32},power:{throttle:92,load:12}};const p=presets[b.dataset.preset];state.throttle=p.throttle;state.load=p.load;physics.throttle=p.throttle/100;physics.load=p.load/100;document.querySelector('#throttle').value=p.throttle;document.querySelector('#load').value=p.load;document.querySelector('#throttleVal').textContent=p.throttle+'%';document.querySelector('#loadVal').textContent=p.load+'%';document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x===b));if(!state.running){state.running=true;}requestRenderMeta();});
 document.querySelectorAll('[data-engine]').forEach(b=>b.onclick=()=>{state.engine=b.dataset.engine;state.selected='Piston';renderLibrary()});
 document.querySelectorAll('[data-system]').forEach(b=>b.onclick=()=>{state.system=b.dataset.system;document.querySelectorAll('[data-system]').forEach(x=>x.classList.toggle('active',x.dataset.system===state.system));updateVisibility();refreshCatalog()});
 document.querySelectorAll('.partRow').forEach(b=>b.onclick=()=>select(b.dataset.part));
 document.querySelector('#explodeBtn').onclick=()=>{state.explode=!state.explode;{const off=camera.position.clone().sub(controls.target).multiplyScalar(state.explode?1.3:1/1.3);focusTarget.copy(controls.target);focusTarget.y+=state.explode?2.2:-2.2;focusCamera.copy(focusTarget).add(off);focusAnimating=true}document.querySelector('#explodeBtn').textContent=state.explode?'ASSEMBLE':'EXPLODE';document.querySelector('#explodeBtn').classList.toggle('active',state.explode)};
 document.querySelector('#cutBtn').onclick=()=>{state.cutaway=!state.cutaway;document.querySelector('#cutBtn').textContent=state.cutaway?'SOLID':'CUTAWAY';document.querySelector('#cutBtn').classList.toggle('active',state.cutaway);updateVisibility()};
 document.querySelector('#isoBtn').onclick=()=>{state.isolate=!state.isolate;document.querySelector('#isoBtn').textContent=state.isolate?'SHOW ALL':'ISOLATE';document.querySelector('#isoBtn').classList.toggle('active',state.isolate);updateVisibility()};
 document.querySelector('#reset').onclick=()=>{dyno.running=false;dyno.points=[];dyno.peakTorque=0;dyno.peakPower=0;document.querySelector('#dynoStart').textContent='▶ RUN DYNO PULL';state.explode=false;state.cutaway=false;state.isolate=false;state.cycle=0;state.running=false;state.throttle=18;state.load=25;state.rpm=900;physics.reset();physics.throttle=.18;physics.load=.25;physics.rpm=900;focusTarget.copy(home.target);focusCamera.copy(home.cam);focusAnimating=false;controls.reset();updateVisibility();select(state.selected,false);requestRenderMeta();document.querySelector('#throttle').value=18;document.querySelector('#load').value=25;document.querySelector('#throttleVal').textContent='18%';document.querySelector('#loadVal').textContent='25%';physics.sparkAdvance=12;document.querySelector('#advance').value=12;document.querySelector('#advanceVal').textContent='12°'};
 document.querySelector('#play').onclick=()=>{state.running=!state.running;requestRenderMeta();};
 document.querySelector('#dynoLoad').oninput=e=>{state.load=+e.target.value;physics.load=state.load/100;document.querySelector('#dynoLoadValue').textContent=state.load+'%';document.querySelector('#load').value=state.load;document.querySelector('#loadVal').textContent=state.load+'%';};
 document.querySelector('#dynoStart').onclick=()=>{
   dyno.running=!dyno.running;
   if(dyno.running){dyno.points=[];dyno.peakTorque=0;dyno.peakPower=0;dyno.elapsed=0;dyno.lastSample=0;state.running=true;state.throttle=100;state.load=+document.querySelector('#dynoLoad').value;physics.throttle=1;physics.load=state.load/100;document.querySelector('#throttle').value=100;document.querySelector('#throttleVal').textContent='100%';document.querySelector('#load').value=state.load;document.querySelector('#loadVal').textContent=state.load+'%';document.querySelector('#dynoStart').textContent='Ⅱ STOP DYNO PULL';}
   else{document.querySelector('#dynoStart').textContent='▶ RUN DYNO PULL';}
   requestRenderMeta();drawDyno();
 };
 document.querySelector('#dynoClear').onclick=()=>{dyno.running=false;dyno.points=[];dyno.peakTorque=0;dyno.peakPower=0;document.querySelector('#dynoStart').textContent='▶ RUN DYNO PULL';drawDyno();};
 drawDyno();
 document.querySelector('#throttle').oninput=e=>{state.throttle=+e.target.value;physics.throttle=state.throttle/100;document.querySelector('#throttleVal').textContent=state.throttle+'%'};document.querySelector('#load').oninput=e=>{state.load=+e.target.value;physics.load=state.load/100;document.querySelector('#loadVal').textContent=state.load+'%'};document.querySelector('#advance').oninput=e=>{physics.sparkAdvance=+e.target.value;document.querySelector('#advanceVal').textContent=physics.sparkAdvance+'°'};
 document.querySelector('#clear').onclick=()=>{state.system='All';state.search='';document.querySelector('#search').value='';document.querySelectorAll('[data-system]').forEach(x=>x.classList.toggle('active',x.dataset.system==='All'));updateVisibility();refreshCatalog()}
}
function learn(){
 document.querySelector('#workspace').innerHTML=`<div class="learning panel"><span class="eyebrow">HOW IT WORKS</span><h2>One cycle. Two crank revolutions.</h2><p class="lead">A four-stroke engine moves through intake, compression, power and exhaust. In a typical four-stroke layout the camshaft rotates at half crankshaft speed.</p><div class="cycleCards">${[['01','INTAKE','Piston moves down; the intake valve opens and fresh charge enters.'],['02','COMPRESSION','Both valves close; the piston moves up and compresses the charge.'],['03','POWER','Ignition initiates combustion and expanding gases push the piston down.'],['04','EXHAUST','The exhaust valve opens and the rising piston expels spent gases.']].map(x=>`<article><span>${x[0]}</span><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}</div><div class="sourceBox"><b>Knowledge note</b><p>Component descriptions are synthesized from automotive engineering references. Actual designs vary by engine, fuel system, valvetrain, emissions package and manufacturer.</p></div></div>`
 document.querySelector('#workspace .learning').insertAdjacentHTML('beforeend','<section id="engineQuiz" class="quizPanel"><div class="quizTop"><div><span class="eyebrow">KNOWLEDGE CHECK</span><h2>Test your engine IQ</h2></div><span id="quizProgress">QUESTION 1 / 3</span></div><p id="quizPrompt" class="quizPrompt"></p><div id="quizOptions" class="quizOptions"></div><div id="quizFeedback" class="quizFeedback" aria-live="polite"></div><div class="quizFooter"><span id="quizScore">Score: 0</span><button id="quizNext" class="quizNext" disabled>Next question →</button></div></section>');setupQuiz(document.querySelector('#engineQuiz'));
}
function compare(){
 document.querySelector('#workspace').innerHTML=`<div class="compare panel"><span class="eyebrow">ARCHITECTURES</span><h2>Road-engine families</h2><div class="compareGrid">${Object.entries(engines).map(([id,e])=>`<button data-engine="${id}"><div class="orb">◌</div><b>${e.name}</b><span>${e.sub}</span><small>${e.cyl} cylinders · bore ${e.bore.toFixed(2)} · stroke ${e.stroke.toFixed(2)}</small></button>`).join('')}</div></div>`;document.querySelectorAll('.compareGrid button').forEach(b=>b.onclick=()=>{state.engine=b.dataset.engine;tab('library')})
}
function tab(t){document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));t==='library'?renderLibrary():t==='learn'?learn():compare()}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>tab(b.dataset.tab));let searchTimer;document.querySelector('#search').oninput=e=>{state.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>refreshCatalog(),120);};document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#search').focus()}});
renderLibrary();
if(new URLSearchParams(location.search).has('debug'))window.__pieces={state,get eng(){return eng},get camera(){return camera},get controls(){return controls},get physics(){return physics},THREE};
