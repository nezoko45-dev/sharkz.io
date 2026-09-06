// Sharkz.io remake — canvas client-side game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const sharkImage = new Image();
sharkImage.src = 'images%20(2).jpg';
const sharkSprite = document.createElement('canvas');
const sharkSpriteCtx = sharkSprite.getContext('2d');
let sharkSpriteReady = false;
let sharkAspect = 1;

function prepareSharkSprite() {
  const iw = sharkImage.naturalWidth, ih = sharkImage.naturalHeight;
  if (!iw || !ih) return;
  sharkAspect = iw / ih || 1;
  const maxDim = 256, scale = Math.min(1, maxDim / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
  sharkSprite.width = w; sharkSprite.height = h;
  sharkSpriteCtx.clearRect(0, 0, w, h); sharkSpriteCtx.drawImage(sharkImage, 0, 0, w, h);
  const img = sharkSpriteCtx.getImageData(0, 0, w, h), p = img.data;
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const whiteTolerance = 52;
  const isWhite = n => { const i=n*4,r=p[i],g=p[i+1],b=p[i+2]; return Math.min(r,g,b)>=255-whiteTolerance && Math.max(r,g,b)-Math.min(r,g,b)<=18; };
  const add = (x,y) => { if(x<0||y<0||x>=w||y>=h)return; const n=y*w+x; if(seen[n]||!isWhite(n))return; seen[n]=1;queue[tail++]=n; };
  for(let x=0;x<w;x++){add(x,0);add(x,h-1);} for(let y=0;y<h;y++){add(0,y);add(w-1,y);}
  while(head<tail){const n=queue[head++],x=n%w,y=(n/w)|0;p[n*4+3]=0;add(x+1,y);add(x-1,y);add(x,y+1);add(x,y-1);}
  sharkSpriteCtx.putImageData(img,0,0); sharkSpriteReady=true;
}
sharkImage.onload=prepareSharkSprite;

function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
window.addEventListener('resize',resize);resize();
const world={width:4000,height:4000};
const mouse={x:canvas.width/2,y:canvas.height/2,down:false};
window.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
window.addEventListener('mousedown',()=>mouse.down=true); window.addEventListener('mouseup',()=>mouse.down=false);
window.addEventListener('keydown',e=>{if(e.code==='Space')mouse.down=true;}); window.addEventListener('keyup',e=>{if(e.code==='Space')mouse.down=false;});
const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

class Entity{constructor(x,y,r){this.x=x;this.y=y;this.r=r;this.vx=0;this.vy=0;}move(dt){this.x=clamp(this.x+this.vx*dt,this.r,world.width-this.r);this.y=clamp(this.y+this.vy*dt,this.r,world.height-this.r);}}
class Food extends Entity{constructor(){super(rand(20,world.width-20),rand(20,world.height-20),rand(3,7));this.phase=rand(0,6.28);}update(dt){this.phase+=dt*2;this.y+=Math.sin(this.phase)*dt*3;}draw(c){ctx.beginPath();ctx.fillStyle='#f7d76b';ctx.arc(this.x-c.x,this.y-c.y,this.r,0,Math.PI*2);ctx.fill();}}

class Coral extends Entity{
 constructor(){super(rand(140,world.width-140),rand(140,world.height-140),rand(42,70));this.branches=4+((Math.random()*4)|0);}
 draw(c){const x=this.x-c.x,y=this.y-c.y;ctx.save();ctx.translate(x,y);ctx.strokeStyle='#d85f76';ctx.lineWidth=10;ctx.lineCap='round';for(let i=0;i<this.branches;i++){const a=i/this.branches*Math.PI*2+.3,len=this.r*rand(.65,1);ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len);ctx.stroke();}ctx.fillStyle='#e36b83';ctx.beginPath();ctx.arc(0,0,this.r*.25,0,Math.PI*2);ctx.fill();ctx.restore();}
}
const corals=[];for(let i=0;i<34;i++)corals.push(new Coral());

// Grid A*: sharks use this navigation mesh to weave around coral instead of
// swimming directly through it. The grid is intentionally coarse for speed.
const NAV_CELL=100,NAV_W=Math.ceil(world.width/NAV_CELL),NAV_H=Math.ceil(world.height/NAV_CELL),navBlocked=new Uint8Array(NAV_W*NAV_H);
const navIndex=(x,y)=>y*NAV_W+x;
function markNavObstacles(){navBlocked.fill(0);for(let y=0;y<NAV_H;y++)for(let x=0;x<NAV_W;x++){const cx=x*NAV_CELL+50,cy=y*NAV_CELL+50;for(const c of corals){const rr=c.r+42;if((cx-c.x)**2+(cy-c.y)**2<rr*rr){navBlocked[navIndex(x,y)]=1;break;}}}}
markNavObstacles();
function navCell(x,y){return{x:clamp(Math.floor(x/NAV_CELL),0,NAV_W-1),y:clamp(Math.floor(y/NAV_CELL),0,NAV_H-1)}}
function heuristic(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)}
function findPathAStar(sx,sy,tx,ty){
 let start=navCell(sx,sy),goal=navCell(tx,ty);const startId=navIndex(start.x,start.y);if(navBlocked[startId])return[];
 if(navBlocked[navIndex(goal.x,goal.y)]){let found=null;for(let r=1;r<=3&&!found;r++)for(let y=goal.y-r;y<=goal.y+r&&!found;y++)for(let x=goal.x-r;x<=goal.x+r;x++)if(x>=0&&y>=0&&x<NAV_W&&y<NAV_H&&!navBlocked[navIndex(x,y)]){found={x,y};break;}if(found)goal=found;}
 const goalId=navIndex(goal.x,goal.y),open=[startId],came=new Int32Array(NAV_W*NAV_H);came.fill(-1),g=new Float32Array(NAV_W*NAV_H),f=new Float32Array(NAV_W*NAV_H),closed=new Uint8Array(NAV_W*NAV_H);g.fill(Infinity);f.fill(Infinity);g[startId]=0;f[startId]=heuristic(start,goal);
 const dirs=[[1,0],[-1,0],[0,1],[0,-1]];let guard=0;
 while(open.length&&guard++<1600){let bi=0;for(let i=1;i<open.length;i++)if(f[open[i]]<f[open[bi]])bi=i;const cur=open.splice(bi,1)[0];if(cur===goalId){const path=[];let n=cur;while(n!==-1&&n!==startId){const x=n%NAV_W,y=(n/NAV_W)|0;path.push({x:x*NAV_CELL+50,y:y*NAV_CELL+50});n=came[n];}path.reverse();return path;}if(closed[cur])continue;closed[cur]=1;const cx=cur%NAV_W,cy=(cur/NAV_W)|0;for(const d of dirs){const nx=cx+d[0],ny=cy+d[1];if(nx<0||ny<0||nx>=NAV_W||ny>=NAV_H)continue;const ni=navIndex(nx,ny);if(navBlocked[ni]||closed[ni])continue;const ng=g[cur]+1;if(ng<g[ni]){came[ni]=cur;g[ni]=ng;f[ni]=ng+heuristic({x:nx,y:ny},goal);if(!open.includes(ni))open.push(ni);}}}
 return [];
}
function steer(entity,target,dt,speed){const dx=target.x-entity.x,dy=target.y-entity.y,d=Math.hypot(dx,dy)||1;entity.vx+=(dx/d*speed-entity.vx)*Math.min(1,dt*5);entity.vy+=(dy/d*speed-entity.vy)*Math.min(1,dt*5);}
function navigate(entity,target,dt,speed){const changed=!entity.pathTarget||Math.hypot(target.x-entity.pathTarget.x,target.y-entity.pathTarget.y)>150;const expired=performance.now()-entity.pathTime>850;if(!entity.path||entity.pathIndex>=entity.path.length||changed||expired){entity.path=findPathAStar(entity.x,entity.y,target.x,target.y);entity.pathIndex=0;entity.pathTarget={x:target.x,y:target.y};entity.pathTime=performance.now();}let wp=entity.path[entity.pathIndex];if(wp&&Math.hypot(wp.x-entity.x,wp.y-entity.y)<35)wp=entity.path[++entity.pathIndex];steer(entity,wp||target,dt,speed);}

function drawSharkSprite(x,y,angle,size,alpha=1){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;if(sharkSpriteReady){const w=size,h=size/sharkAspect;ctx.drawImage(sharkSprite,-w/2,-h/2,w,h);}else{ctx.fillStyle='#9bc7d9';ctx.beginPath();ctx.ellipse(0,0,size/2,size*.23,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#263a42';ctx.beginPath();ctx.moveTo(size*.25,0);ctx.lineTo(size*.55,-size*.16);ctx.lineTo(size*.55,size*.16);ctx.closePath();ctx.fill();}ctx.restore();}

class BabyShark extends Entity{
 constructor(parent){super(parent.x+rand(-35,35),parent.y+rand(-35,35),12);this.parent=parent;this.angle=rand(0,6.28);this.speed=rand(70,100);this.path=[];this.pathIndex=0;this.pathTime=0;this.pathTarget=null;}
 update(dt){if(!this.parent||game.over)return;let target=this.parent,best=Infinity;for(let i=0;i<Math.min(foods.length,250);i++){const d=dist(this,foods[i]);if(d<best){best=d;target=foods[i];}}navigate(this,target,dt,this.speed);if(Math.abs(this.vx)+Math.abs(this.vy)>2)this.angle=Math.atan2(this.vy,this.vx);this.move(dt);if(target instanceof Food&&dist(this,target)<this.r+target.r+4){const i=foods.indexOf(target);if(i>=0)foods.splice(i,1);this.parent.grow(1.5);}}
 draw(c){drawSharkSprite(this.x-c.x,this.y-c.y,this.angle,34+this.parent.size*.10);}
}

class Shark extends Entity{
 constructor(playerControlled=false){super(playerControlled?world.width/2:rand(300,world.width-300),playerControlled?world.height/2:rand(300,world.height-300),playerControlled?24:rand(18,32));this.player=playerControlled;this.size=this.r;this.weight=this.r*12;this.health=100;this.maxHealth=100;this.energy=100;this.level=1;this.xp=0;this.angle=0;this.speed=playerControlled?180:rand(90,130);this.bite=0;this.attackCooldown=0;this.babies=[];this.path=[];this.pathIndex=0;this.pathTime=0;this.pathTarget=null;if(playerControlled)for(let i=0;i<2;i++)this.babies.push(new BabyShark(this));}
 grow(amount){this.weight+=amount;this.size=18+Math.sqrt(this.weight)*2.1;this.r=this.size;this.maxHealth=100+this.level*4;this.health=Math.min(this.maxHealth,this.health+amount*.25);}
 attack(target){if(this.attackCooldown>0||!target||target.dead||target.health<=0)return false;if(dist(this,target)>this.r+target.r+45)return false;target.health-=Math.max(12,this.size*.65);this.attackCooldown=.48;this.bite=.22;if(target.health<=0){this.grow(target.weight*.16);this.xp+=Math.max(2,Math.floor(target.weight/8));target.dead=true;}return true;}
 update(dt){
  this.attackCooldown=Math.max(0,this.attackCooldown-dt);
  if(this.player){const wx=mouse.x-canvas.width/2+camera.x,wy=mouse.y-canvas.height/2+camera.y,dx=wx-this.x,dy=wy-this.y,d=Math.hypot(dx,dy)||1,boosting=mouse.down&&this.energy>1,sp=boosting?280:180;this.vx+=(dx/d*sp-this.vx)*Math.min(1,dt*4);this.vy+=(dy/d*sp-this.vy)*Math.min(1,dt*4);this.energy=clamp(this.energy+(boosting?-28:15)*dt,0,100);if(Math.abs(this.vx)+Math.abs(this.vy)>2)this.angle=Math.atan2(this.vy,this.vx);if(mouse.down)this.bite=.18;for(const s of sharks)if(s!==this&&!s.dead&&dist(this,s)<this.r+s.r+45)this.attack(s);}
  else{let target=player,best=Infinity;for(let i=0;i<Math.min(foods.length,300);i++){const f=foods[i],d=dist(this,f);if(d<best){best=d;target=f;}}const pd=dist(this,player);if(this.weight>player.weight*1.08&&pd<700){target=player;best=pd;}navigate(this,target,dt,this.speed);if(Math.abs(this.vx)+Math.abs(this.vy)>2)this.angle=Math.atan2(this.vy,this.vx);if(target===player&&pd<this.r+player.r+45)this.attack(player);}
  this.bite=Math.max(0,this.bite-dt);this.move(dt);for(const b of this.babies)b.update(dt);
 }
 draw(c){drawSharkSprite(this.x-c.x,this.y-c.y,this.angle,Math.max(38,this.size*2));}
}

class Squid extends Entity{constructor(){super(rand(100,3900),rand(100,3900),rand(25,45));this.a=rand(0,6.28);}update(dt){this.a+=dt*.3;this.vx=Math.cos(this.a)*25;this.vy=Math.sin(this.a)*25;this.move(dt);}draw(c){const x=this.x-c.x,y=this.y-c.y;ctx.fillStyle='#9b63b6';ctx.beginPath();ctx.ellipse(x,y,this.r,this.r*.6,0,0,Math.PI*2);ctx.fill();}}
class Predator extends Entity{constructor(type){super(rand(100,3900),rand(100,3900),type==='hammerhead'?26:16);this.type=type;this.a=rand(0,6.28);this.speed=rand(50,80);}update(dt){if(this.type==='hammerhead'){const dx=player.x-this.x,dy=player.y-this.y,d=Math.hypot(dx,dy)||1;this.vx=dx/d*this.speed;this.vy=dy/d*this.speed;this.a=Math.atan2(this.vy,this.vx);}else{this.a+=Math.sin(performance.now()/1000)*dt;this.vx=Math.cos(this.a)*this.speed;this.vy=Math.sin(this.a)*this.speed;}this.move(dt);}draw(c){const x=this.x-c.x,y=this.y-c.y;ctx.save();ctx.translate(x,y);ctx.rotate(this.a);ctx.fillStyle=this.type==='hammerhead'?'#6e7478':'#b74d61';ctx.beginPath();ctx.ellipse(0,0,this.r,this.r*.45,0,0,Math.PI*2);ctx.fill();ctx.restore();}}

const foods=[];for(let i=0;i<650;i++)foods.push(new Food());
const sharks=[];for(let i=0;i<55;i++)sharks.push(new Shark(false));
const predators=[];for(let i=0;i<18;i++)predators.push(new Predator(i%2?'lamprey':'hammerhead'));
const squids=[];for(let i=0;i<8;i++)squids.push(new Squid());
const player=new Shark(true);sharks.push(player);
const camera={x:0,y:0};const game={over:false};

function eatCollisions(){
 for(let i=foods.length-1;i>=0;i--)if(dist(player,foods[i])<player.r+foods[i].r){foods.splice(i,1);player.grow(2);player.xp++;}
 for(const s of sharks){if(s===player||s.dead)continue;if(dist(player,s)<player.r+s.r*.65){if(player.weight>s.weight*1.08)player.attack(s);else if(s.attackCooldown<=0)s.attack(player);}}
 for(const p of predators)if(dist(player,p)<player.r+p.r)player.health-=25;
 for(const q of squids)if(dist(player,q)<player.r+q.r*.65)player.health-=12;
 for(let i=sharks.length-1;i>=0;i--)if(sharks[i].dead&&sharks[i]!==player)sharks.splice(i,1);
 if(player.health<=0)game.over=true;
}
function drawWorld(){ctx.fillStyle='#06283a';ctx.fillRect(0,0,canvas.width,canvas.height);camera.x=clamp(player.x-canvas.width/2,0,Math.max(0,world.width-canvas.width));camera.y=clamp(player.y-canvas.height/2,0,Math.max(0,world.height-canvas.height));ctx.save();ctx.strokeStyle='rgba(100,210,230,.07)';ctx.lineWidth=1;const grid=100;for(let x=Math.floor(camera.x/grid)*grid;x<camera.x+canvas.width+grid;x+=grid){ctx.beginPath();ctx.moveTo(x-camera.x,0);ctx.lineTo(x-camera.x,canvas.height);ctx.stroke();}for(let y=Math.floor(camera.y/grid)*grid;y<camera.y+canvas.height+grid;y+=grid){ctx.beginPath();ctx.moveTo(0,y-camera.y);ctx.lineTo(canvas.width,y-camera.y);ctx.stroke();}for(const c of corals)if(c.x+c.r>camera.x&&c.x-c.r<camera.x+canvas.width&&c.y+c.r>camera.y&&c.y-c.r<camera.y+canvas.height)c.draw(camera);for(const f of foods)if(f.x>camera.x-20&&f.x<camera.x+canvas.width+20&&f.y>camera.y-20&&f.y<camera.y+canvas.height+20)f.draw(camera);for(const s of sharks)if(!s.dead&&s.x+s.r>camera.x&&s.x-s.r<camera.x+canvas.width&&s.y+s.r>camera.y&&s.y-s.r<camera.y+canvas.height)s.draw(camera);for(const p of predators)if(p.x+p.r>camera.x&&p.x-p.r<camera.x+canvas.width&&p.y+p.r>camera.y&&p.y-p.r<camera.y+canvas.height)p.draw(camera);for(const q of squids)if(q.x+q.r>camera.x&&q.x-q.r<camera.x+canvas.width&&q.y+q.r>camera.y&&q.y-q.r<camera.y+canvas.height)q.draw(camera);ctx.restore();}
function updateHUD(){const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('score',Math.floor(player.weight));set('size',Math.floor(player.size));set('level',player.level);set('health',Math.max(0,Math.floor(player.health)));set('energy',Math.floor(player.energy));const hb=document.getElementById('healthFill');if(hb)hb.style.width=`${clamp(player.health/player.maxHealth*100,0,100)}%`;const eb=document.getElementById('energyFill');if(eb)eb.style.width=`${player.energy}%`;}
function loop(now){const dt=Math.min(.033,(now-(loop.last||now))/1000);loop.last=now;if(!game.over){for(const f of foods)f.update(dt);for(const s of sharks)s.update(dt);for(const p of predators)p.update(dt);for(const q of squids)q.update(dt);eatCollisions();drawWorld();updateHUD();}else{drawWorld();const over=document.getElementById('gameOver');if(over)over.classList.remove('hidden');}requestAnimationFrame(loop);}
requestAnimationFrame(loop);
