// Real-time reduced-order four-stroke engine model for interactive browser simulation.
// It couples crank kinematics, cylinder pressure, combustion timing, air/fuel flow,
// turbo response, thermal state and brake torque. Educational model, not CFD/ECU calibration.

const R_AIR=287.05, GAMMA=1.34, DEG=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

export const ENGINE_PHYSICS={
 i4:{bore:.086,stroke:.086,compression:10.5,ve:.91,inertia:.22,friction:12,afr:14.7,redline:7000,boostMax:0},
 v6:{bore:.086,stroke:.086,compression:10.5,ve:.90,inertia:.30,friction:16,afr:14.7,redline:6800,boostMax:0},
 diesel:{bore:.084,stroke:.100,compression:17.5,ve:.94,inertia:.28,friction:18,afr:19.5,redline:4800,boostMax:1.25},
 bike:{bore:.076,stroke:.055,compression:11.5,ve:.96,inertia:.11,friction:6,afr:14.7,redline:10500,boostMax:0}
};

export class EnginePhysics{
 constructor(type='i4'){this.type=type;this.spec=ENGINE_PHYSICS[type]||ENGINE_PHYSICS.i4;this.cylinders=type==='v6'?6:4;this.sparkAdvance=12;this.reset()}
 reset(){this.rpm=900;this.theta=0;this.throttle=.18;this.load=.25;this.temperature=92;this.oil=95;this.exhaustTemp=280;this.manifoldPressure=35;this.torque=0;this.power=0;this.fuelRate=0;this.pressure=1;this.boost=0;this.knock=0;this.efficiency=0;this.imep=0;this.bmep=0;this.airMass=0;this.intakeFlow=0}
 displacementPerCylinder(){const s=this.spec;return Math.PI*s.bore*s.bore/4*s.stroke}
 pistonPosition(t){const r=this.spec.stroke/2,L=this.spec.stroke*1.9,c=Math.cos(t),u=Math.max(0,L*L-r*r*(1-c*c));return r*(1-c)+L-Math.sqrt(u)}
 volume(t){const s=this.spec,a=Math.PI*s.bore*s.bore/4,sw=a*s.stroke,vc=sw/(s.compression-1);return vc+a*this.pistonPosition(t)}
 volumeDerivative(t){const h=1e-5;return (this.volume(t+h)-this.volume(t-h))/(2*h)}
 pistonVelocity(theta){const h=1e-4;return (this.pistonPosition(theta+h)-this.pistonPosition(theta-h))/(2*h)*this.rpm*2*Math.PI/60}
 valveLift(localDeg,type='intake'){const a=((localDeg%720)+720)%720;const center=type==='intake'?115:595;const width=type==='intake'?145:135;const d=Math.abs((((a-center+360)%720)-360));return Math.pow(clamp(1-d/width,0,1),1.6)}
 cylinderPressure(localDeg,throttle=this.throttle){
  const a=((localDeg%720)+720)%720,V=this.volume(a*DEG),vB=this.volume(Math.PI),vc=this.displacementPerCylinder()/(this.spec.compression-1);
  const pAmb=101e3, pInt=pAmb*(.18+.82*Math.pow(clamp(throttle,0,1),.62))+this.boost*1e5;
  const m=pInt*this.displacementPerCylinder()*this.spec.ve/(R_AIR*330);this.airMass=m;
  let p=pInt;
  if(a<180)p=pInt;
  else if(a<360)p=pInt*Math.pow(vB/V,GAMMA);
  else if(a<520){
   const comp=pInt*Math.pow(vB/Vc,GAMMA);
   const ignition=this.type==='diesel'?350:360-this.sparkAdvance;
   const burn=smooth(ignition,ignition+16,a)*(1-smooth(ignition+55,ignition+120,a));
   const heat=this.type==='diesel'?23:14;
   p=comp*Math.pow(1+heat*Math.pow(clamp(throttle,0,1),.5)*burn,GAMMA);
   p=Math.max(p,comp*Math.pow(Vc/V,GAMMA));
  }else p=108e3;
  return clamp(p,8e4,1.8e7)
 }
 cylinderWorkTorque(phaseDeg){let tq=0,peak=0;const steps=120;for(let i=0;i<steps;i++){const a=phaseDeg+i*720/steps,l=((a%720)+720)%720,p=this.cylinderPressure(l),dv=this.volumeDerivative(l*DEG);tq+=-p*dv;peak=Math.max(peak,p)}return{torque:tq/steps,peak}}
 step(dt){
  dt=clamp(dt,.0001,.03);
  const phases=Array.from({length:this.cylinders},(_,i)=>i*720/this.cylinders);
  let indicated=0,peak=0;for(const ph of phases){const q=this.cylinderWorkTorque(ph);indicated+=q.torque;peak=Math.max(peak,q.peak)}
  const loadTorque=4+this.load*82,friction=this.spec.friction+.000004*this.rpm*this.rpm,pumping=(1-this.throttle)*5;
  const brake=Math.max(-20,indicated*.78-pumping-friction-loadTorque),omega=Math.max(20,this.rpm*2*Math.PI/60);
  this.rpm=clamp(this.rpm+brake/this.spec.inertia*dt*60/(2*Math.PI),550,this.spec.redline);
  this.theta=(this.theta+omega*dt/DEG)%720;
  const totalAirSec=this.airMass*this.cylinders*this.rpm/120;this.intakeFlow=totalAirSec*1000;
  this.fuelRate=totalAirSec/this.spec.afr*clamp(this.throttle,0,1);
  this.torque=Math.max(0,indicated*.78-pumping-friction);this.power=this.torque*this.rpm*2*Math.PI/60/1000;
  const targetBoost=this.spec.boostMax*Math.pow(this.throttle,1.2)*clamp((this.rpm-900)/2500,0,1);
  this.boost+=(targetBoost-this.boost)*clamp(dt*3,0,1);
  this.manifoldPressure=101*(.18+.82*this.throttle)+this.boost*100;
  this.pressure=peak/1e5;this.imep=Math.max(0,indicated/this.displacementPerCylinder()/this.cylinders/1e5);
  this.bmep=this.torque*2*Math.PI/(this.displacementPerCylinder()*this.cylinders*2);
  const heatLoad=this.pressure*.8+this.rpm*.012;this.temperature+=((88+heatLoad)-this.temperature)*dt*.08;
  this.oil+=((this.temperature+10)-this.oil)*dt*.018;this.exhaustTemp+=(280+this.throttle*700+this.rpm*.018-this.exhaustTemp)*dt*.12;
  this.knock=clamp((this.pressure-85)/90,0,1)*clamp((this.temperature-105)/50,0,1);
  this.efficiency=clamp(this.power/(Math.max(.01,this.fuelRate*44)),0,.55);
  return this.snapshot()
 }
 snapshot(){return{rpm:this.rpm,theta:this.theta,torque:this.torque,power:this.power,pressure:this.pressure,manifold:this.manifoldPressure,fuel:this.fuelRate*3600,temperature:this.temperature,oil:this.oil,exhaust:this.exhaustTemp,boost:this.boost,imep:this.imep,bmep:this.bmep,efficiency:this.efficiency*100,knock:this.knock*100,intakeFlow:this.intakeFlow}}
}