// Sharkz.io remake — canvas client-side game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const image = new Image();
image.src = 'images%20(1).jpg';
let babySharkImageReady = false;
image.onload = () => { babySharkImageReady = true; prepareBabySharkImage(); };

// The repository image is a JPEG with water behind the shark. Build a transparent
// canvas copy at runtime so the baby sharks keep the shark while the water disappears.
const babySharkCanvas = document.createElement('canvas');
const babySharkCtx = babySharkCanvas.getContext('2d', { willReadFrequently: true });
function prepareBabySharkImage() {
  const w = image.naturalWidth, h = image.naturalHeight;
  if (!w || !h) return;
  babySharkCanvas.width = w;
  babySharkCanvas.height = h;
  babySharkCtx.drawImage(image, 0, 0);
  const data = babySharkCtx.getImageData(0, 0, w, h);
  const p = data.data;
  // Estimate the water from the outer border and remove pixels close to that color.
  const samples = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 80));
  for (let x = 0; x < w; x += step) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4; samples.push([p[i], p[i + 1], p[i + 2]]);
    }
  }
  for (let y = 0; y < h; y += step) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4; samples.push([p[i], p[i + 1], p[i + 2]]);
    }
  }
  const avg = samples.reduce((a, s) => [a[0]+s[0], a[1]+s[1], a[2]+s[2]], [0,0,0]).map(v => v / samples.length);
  const queue = [];
  const seen = new Uint8Array(w * h);
  const tolerance = 58;
  const colorDistance = (i) => {
    const dr = p[i] - avg[0], dg = p[i + 1] - avg[1], db = p[i + 2] - avg[2];
    return Math.sqrt(dr*dr + dg*dg + db*db);
  };
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const n = y * w + x;
    if (seen[n]) return;
    const i = n * 4;
    if (colorDistance(i) <= tolerance) { seen[n] = 1; queue.push(n); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h-1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w-1, y); }
  for (let q = 0; q < queue.length; q++) {
    const n = queue[q], x = n % w, y = (n / w) | 0;
    p[n*4+3] = 0;
    push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1);
  }
  babySharkCtx.putImageData(data, 0, 0);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const world = { width: 4000, height: 4000 };
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);
window.addEventListener('keydown', e => { if (e.code === 'Space') mouse.down = true; });
window.addEventListener('keyup', e => { if (e.code === 'Space') mouse.down = false; });

const rand = (a,b) => a + Math.random() * (b-a);
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);

class Entity {
  constructor(x,y,r) { this.x=x; this.y=y; this.r=r; this.vx=0; this.vy=0; }
  move(dt) { this.x=clamp(this.x+this.vx*dt,this.r,world.width-this.r); this.y=clamp(this.y+this.vy*dt,this.r,world.height-this.r); }
}

class Food extends Entity {
  constructor() { super(rand(20,world.width-20),rand(20,world.height-20),rand(3,7)); this.phase=rand(0,6.28); }
  update(dt) { this.phase += dt*2; this.y += Math.sin(this.phase)*dt*3; }
  draw(cam) { ctx.beginPath(); ctx.fillStyle='#f7d76b'; ctx.arc(this.x-cam.x,this.y-cam.y,this.r,0,Math.PI*2); ctx.fill(); }
}

class BabyShark extends Entity {
  constructor(parent) {
    super(parent.x + rand(-35,35), parent.y + rand(-35,35), 12);
    this.parent = parent; this.angle = rand(0,Math.PI*2); this.target = null; this.speed = rand(70,100);
  }
  update(dt) {
    if (!this.parent || game.over) return;
    let tx=this.parent.x, ty=this.parent.y;
    let best=null, bd=230;
    for (const f of foods) { const d=dist(this,f); if (d<bd) {bd=d; best=f;} }
    if (best) { tx=best.x; ty=best.y; }
    else { tx += Math.cos(this.angle)*25; ty += Math.sin(this.angle)*25; }
    const dx=tx-this.x, dy=ty-this.y, d=Math.hypot(dx,dy)||1;
    this.vx += (dx/d*this.speed-this.vx)*Math.min(1,dt*5);
    this.vy += (dy/d*this.speed-this.vy)*Math.min(1,dt*5);
    this.angle = Math.atan2(this.vy,this.vx);
    this.move(dt);
    if (best && d < this.r + best.r + 4) {
      const i=foods.indexOf(best); if(i>=0) foods.splice(i,1);
      this.parent.grow(1.5);
    }
  }
  draw(cam) {
    const sx=this.x-cam.x, sy=this.y-cam.y;
    ctx.save(); ctx.translate(sx,sy);
    if (babySharkImageReady) {
      const maxSide = 34 + this.parent.size * 0.10;
      const aspect = image.naturalWidth / image.naturalHeight || 1;
      const w = aspect >= 1 ? maxSide : maxSide * aspect;
      const h = aspect >= 1 ? maxSide / aspect : maxSide;
      ctx.rotate(this.angle);
      ctx.drawImage(babySharkCanvas, -w/2, -h/2, w, h);
    } else {
      ctx.rotate(this.angle); ctx.fillStyle='#9bc7d9'; ctx.beginPath(); ctx.ellipse(0,0,18,9,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#243746'; ctx.beginPath(); ctx.arc(6,-2,2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

class Shark extends Entity {
  constructor(player=false) {
    super(rand(300,world.width-300),rand(300,world.height-300), player?24:rand(18,32));
    this.player=player; this.size=this.r; this.weight=this.r*12; this.health=100; this.energy=100;
    this.level=1; this.xp=0; this.angle=0; this.speed=player?180:rand(90,130); this.bite=0; this.babies=[];
    if(player) for(let i=0;i<2;i++) this.babies.push(new BabyShark(this));
  }
  grow(amount) { this.weight += amount; this.size = 18 + Math.sqrt(this.weight)*2.1; this.r=this.size; }
  update(dt) {
    if(this.player) {
      const wx=mouse.x-canvas.width/2+camera.x, wy=mouse.y-canvas.height/2+camera.y;
      const dx=wx-this.x,dy=wy-this.y,d=Math.hypot(dx,dy)||1;
      const boosting=mouse.down && this.energy>1;
      const sp=boosting?280:180;
      this.vx+=(dx/d*sp-this.vx)*Math.min(1,dt*4);
      this.vy+=(dy/d*sp-this.vy)*Math.min(1,dt*4);
      if(boosting) this.energy=clamp(this.energy-dt*28,0,100); else this.energy=clamp(this.energy+dt*15,0,100);
      this.angle=Math.atan2(this.vy,this.vx);
      if(mouse.down) this.bite=.18;
    } else {
      let target=player; let best=Infinity;
      for(const f of foods){const d=dist(this,f);if(d<best){best=d;target=f;}}
      if(this.weight > player.weight*1.12 && dist(this,player)<700){target=player;best=dist(this,player);}
      const dx=target.x-this.x,dy=target.y-this.y,d=Math.hypot(dx,dy)||1;
      this.vx+=(dx/d*this.speed-this.vx)*Math.min(1,dt*1.5); this.vy+=(dy/d*this.speed-this.vy)*Math.min(1,dt*1.5); this.angle=Math.atan2(this.vy,this.vx);
      if(best<80) this.bite=.15;
    }
    this.bite=Math.max(0,this.bite-dt); this.move(dt);
    for(const b of this.babies)b.update(dt);
  }
  draw(cam) {
    const sx=this.x-cam.x,sy=this.y-cam.y; ctx.save();ctx.translate(sx,sy);ctx.rotate(this.angle);
    ctx.fillStyle=this.player?'#2d9fc0':'#587887';ctx.beginPath();ctx.ellipse(0,0,this.size,this.size*.48,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#19333d';ctx.beginPath();ctx.moveTo(-this.size*.7,-this.size*.1);ctx.lineTo(-this.size*1.15,-this.size*.65);ctx.lineTo(-this.size*.45,-this.size*.25);ctx.fill();
    ctx.fillStyle='#eef7f7';ctx.beginPath();ctx.arc(this.size*.55,-this.size*.16,Math.max(2,this.size*.08),0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

class Squid extends Entity { constructor(){super(rand(100,3900),rand(100,3900),rand(25,45));this.a=rand(0,6.28);} update(dt){this.a+=dt*.3;this.vx=Math.cos(this.a)*25;this.vy=Math.sin(this.a)*25;this.move(dt);} draw(c){const x=this.x-c.x,y=this.y-c.y;ctx.fillStyle='#9b63b6';ctx.beginPath();ctx.ellipse(x,y,this.r,this.r*.6,0,0,Math.PI*2);ctx.fill();for(let i=0;i<5;i++){ctx.strokeStyle='#b884c8';ctx.beginPath();ctx.moveTo(x-this.r*.5+i*this.r*.25,y+this.r*.4);ctx.lineTo(x-this.r*.7+i*this.r*.3,y+this.r);ctx.stroke();}} }
class Predator extends Entity { constructor(type){super(rand(100,3900),rand(100,3900),type==='hammerhead'?26:16);this.type=type;this.a=rand(0,6.28);this.speed=rand(50,80);} update(dt){if(this.type==='hammerhead'){const dx=player.x-this.x,dy=player.y-this.y,d=Math.hypot(dx,dy)||1;this.vx=dx/d*this.speed;this.vy=dy/d*this.speed;this.a=Math.atan2(this.vy,this.vx);}else{this.a+=Math.sin(performance.now()/1000)*dt;this.vx=Math.cos(this.a)*this.speed;this.vy=Math.sin(this.a)*this.speed;}this.move(dt);} draw(c){const x=this.x-c.x,y=this.y-c.y;ctx.save();ctx.translate(x,y);ctx.rotate(this.a);ctx.fillStyle=this.type==='hammerhead'?'#6e7478':'#b74d61';ctx.beginPath();ctx.ellipse(0,0,this.r,this.r*.45,0,0,Math.PI*2);ctx.fill();ctx.restore();} }

const foods=[]; for(let i=0;i<650;i++)foods.push(new Food());
const sharks=[]; for(let i=0;i<55;i++)sharks.push(new Shark(false));
const predators=[]; for(let i=0;i<18;i++)predators.push(new Predator(i%2?'lamprey':'hammerhead'));
const squids=[]; for(let i=0;i<8;i++)squids.push(new Squid());
const player=new Shark(true); sharks.push(player);
const camera={x:0,y:0};
const game={over:false};

function eatCollisions(){
  for(let i=foods.length-1;i>=0;i--)if(dist(player,foods[i])<player.r+foods[i].r){foods.splice(i,1);player.grow(2);player.xp++;}
  for(const s of sharks){if(s===player)continue;if(dist(player,s)<player.r+s.r*.65){if(player.weight>s.weight*1.08){player.grow(s.weight*.08);s.health-=35;}else{player.health-=18;}}}
  for(const p of predators)if(dist(player,p)<player.r+p.r){player.health-=25;}
  if(player.health<=0)game.over=true;
}
function drawWorld(){
  ctx.fillStyle='#06283a';ctx.fillRect(0,0,canvas.width,canvas.height);
  camera.x=clamp(player.x-canvas.width/2,0,world.width-canvas.width);camera.y=clamp(player.y-canvas.height/2,0,world.height-canvas.height);
  ctx.save();
  ctx.strokeStyle='rgba(100,210,230,.07)';ctx.lineWidth=1;const grid=100;
  for(let x=Math.floor(camera.x/grid)*grid;x<camera.x+canvas.width+grid;x+=grid){ctx.beginPath();ctx.moveTo(x-camera.x,0);ctx.lineTo(x-camera.x,canvas.height);ctx.stroke();}
  for(let y=Math.floor(camera.y/grid)*grid;y<camera.y+canvas.height+grid;y+=grid){ctx.beginPath();ctx.moveTo(0,y-camera.y);ctx.lineTo(canvas.width,y-camera.y);ctx.stroke();}
  for(const f of foods)f.draw(camera); for(const s of sharks) s.draw(camera); for(const p of predators)p.draw(camera); for(const q of squids)q.draw(camera);
  ctx.restore();
}
function updateHUD(){
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('score',Math.floor(player.weight));set('size',Math.floor(player.size));set('level',player.level);set('health',Math.max(0,Math.floor(player.health)));set('energy',Math.floor(player.energy));
  const hb=document.getElementById('healthFill'); if(hb)hb.style.width=`${player.health}%`; const eb=document.getElementById('energyFill');if(eb)eb.style.width=`${player.energy}%`;
}
function loop(now){const dt=Math.min(.033,(now-(loop.last||now))/1000);loop.last=now;if(!game.over){for(const f of foods)f.update(dt);for(const s of sharks)s.update(dt);for(const p of predators)p.update(dt);for(const q of squids)q.update(dt);eatCollisions();drawWorld();updateHUD();}else{drawWorld();const over=document.getElementById('gameOver');if(over)over.classList.remove('hidden');}requestAnimationFrame(loop);}
requestAnimationFrame(loop);
