(function () {
    const canvas = document.getElementById('gameCanvas') || document.createElement('canvas');
    if (!canvas.parentNode) document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // UI elements fallback safety routing - FIXED SYNTAX HERE
    const scoreEl = document.getElementById('score') || { set innerText(v){} };
    const sizeEl = document.getElementById('shark-size') || { set innerText(v){} };
    const leaderboardList = document.getElementById('leaderboard-list') || document.createElement('ol');
    const gameOverScreen = document.getElementById('game-over-screen') || document.createElement('div');
    const restartBtn = document.getElementById('restart-btn') || document.createElement('button');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const WORLD_SIZE = 4000; 
    const TOTAL_SHARKS = 100; 
    const MAX_FOOD = 600;
    const TOTAL_PREDATORS = 25; 

    let player;
    let sharks = [];
    let food = [];
    let predators = [];
    let babySharks = [];
    let mouse = { x: 0, y: 0 };
    let isGameOver = false;

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX - canvas.width / 2;
        mouse.y = e.clientY - canvas.height / 2;
    });

    function randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    function getDistance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }

    class Food {
        constructor() {
            this.x = randomRange(0, WORLD_SIZE);
            this.y = randomRange(0, WORLD_SIZE);
            this.radius = randomRange(3, 6);
            this.color = `hsl(${randomRange(140, 240)}, 100%, 60%)`;
        }
        draw(camX, camY) {
            ctx.beginPath();
            ctx.arc(this.x - camX, this.y - camY, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.closePath();
        }
    }

    class Shark {
        constructor(x, y, isPlayer, name) {
            this.x = x || randomRange(0, WORLD_SIZE);
            this.y = y || randomRange(0, WORLD_SIZE);
            this.radius = 20;
            this.score = 0;
            this.isPlayer = isPlayer;
            this.name = name;
            this.color = isPlayer ? '#00ffff' : '#557799';
            this.speed = 4;
            this.angle = randomRange(0, Math.PI * 2);
            this.babyCooldown = 0;
        }

        update() {
            if (this.babyCooldown > 0) this.babyCooldown--;

            if (this.isPlayer) {
                if (getDistance(0, 0, mouse.x, mouse.y) > 10) {
                    this.angle = Math.atan2(mouse.y, mouse.x);
                    this.x += Math.cos(this.angle) * this.speed;
                    this.y += Math.sin(this.angle) * this.speed;
                }
            } else {
                let nearestFood = null;
                let minDist = 300;
                for (let f of food) {
                    let d = getDistance(this.x, this.y, f.x, f.y);
                    if (d < minDist) { minDist = d; nearestFood = f; }
                }
                if (nearestFood) {
                    this.angle = Math.atan2(nearestFood.y - this.y, nearestFood.x - this.x);
                } else if (Math.random() < 0.02) {
                    this.angle += randomRange(-1, 1);
                }
                this.x += Math.cos(this.angle) * (this.speed * 0.8);
                this.y += Math.sin(this.angle) * (this.speed * 0.8);
            }

            this.x = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.x));
            this.y = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.y));
            this.speed = Math.max(2, 5 - (this.radius / 50));
        }

        draw(camX, camY) {
            let screenX = this.x - camX;
            let screenY = this.y - camY;
            if (screenX < -100 || screenX > canvas.width + 100 || screenY < -100 || screenY > canvas.height + 100) return;

            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(this.angle);

            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius * 1.5, this.radius, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(-this.radius * 1.3, 0);
            ctx.lineTo(-this.radius * 2, -this.radius * 0.6);
            ctx.lineTo(-this.radius * 2, this.radius * 0.6);
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.radius * 0.6, -this.radius * 0.4, 3, 0, Math.PI * 2);
            ctx.arc(this.radius * 0.6, this.radius * 0.4, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'black';
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.name} (${Math.floor(this.radius)})`, screenX, screenY - this.radius - 5);
        }

        summonBaby(target) {
            if (this.babyCooldown === 0) {
                babySharks.push(new BabyShark(this, target));
                this.babyCooldown = 120;
            }
        }
    }

    class Predator {
        constructor() {
            this.x = randomRange(0, WORLD_SIZE);
            this.y = randomRange(0, WORLD_SIZE);
            this.type = Math.random() > 0.5 ? 'Hammerhead' : 'Lamprey';
            this.radius = this.type === 'Hammerhead' ? 45 : 30;
            this.color = this.type === 'Hammerhead' ? '#444455' : '#773322';
            this.speed = this.type === 'Hammerhead' ? 3.5 : 4.5;
            this.angle = randomRange(0, Math.PI * 2);
        }

        update() {
            let target = null;
            let minDist = 500;
            for (let shark of sharks) {
                let d = getDistance(this.x, this.y, shark.x, shark.y);
                if (d < minDist && shark.radius < this.radius) { minDist = d; target = shark; }
            }
            if (target) {
                this.angle = Math.atan2(target.y - this.y, target.x - this.x);
                if (minDist < 250) target.summonBaby(this);
            } else if (Math.random() < 0.01) {
                this.angle += randomRange(-1, 1);
            }
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;

            if (this.x < 0 || this.x > WORLD_SIZE) this.angle = Math.PI - this.angle;
            if (this.y < 0 || this.y > WORLD_SIZE) this.angle = -this.angle;
        }

        draw(camX, camY) {
            let screenX = this.x - camX;
            let screenY = this.y - camY;
            if (screenX < -100 || screenX > canvas.width + 100 || screenY < -100 || screenY > canvas.height + 100) return;

            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(this.angle);

            if (this.type === 'Hammerhead') {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.radius * 1.4, this.radius * 0.8, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillRect(this.radius * 0.8, -this.radius * 1.1, this.radius * 0.4, this.radius * 2.2);
                ctx.strokeRect(this.radius * 0.8, -this.radius * 1.1, this.radius * 0.4, this.radius * 2.2);
            } else {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.radius * 2, this.radius * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
            
            ctx.fillStyle = '#ff3333';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.type, screenX, screenY - this.radius - 5);
        }
    }

    class BabyShark {
        constructor(parent, target) {
            this.x = parent.x;
            this.y = parent.y;
            this.parent = parent;
            this.target = target;
            this.radius = 8;
            this.speed = 7; 
            this.lifeSpan = 300; 
            this.angle = parent.angle;
        }

        update() {
            this.lifeSpan--;
            if (!predators.includes(this.target) && !sharks.includes(this.target)) {
                this.target = this.parent;
            }
            if (this.target) {
                this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            }
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;

            if (this.target && this.target !== this.parent) {
                if (getDistance(this.x, this.y, this.target.x, this.target.y) < this.target.radius) {
                    this.target.radius = Math.max(15, this.target.radius - 1.5); 
                    this.parent.score += 15;
                    this.lifeSpan = 0; 
                }
            }
        }

        draw(camX, camY) {
            ctx.beginPath();
            ctx.arc(this.x - camX, this.y - camY, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffff00'; 
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            ctx.closePath();
        }
    }

    function init() {
        isGameOver = false;
        if(gameOverScreen.classList) gameOverScreen.classList.add('hidden');
        
        player = new Shark(WORLD_SIZE / 2, WORLD_SIZE / 2, true, "You");
        sharks = [player];

        for (let i = 1; i < TOTAL_SHARKS; i++) {
            sharks.push(new Shark(null, null, false, `Shark_${i}`));
        }
        predators = [];
        for (let i = 0; i < TOTAL_PREDATORS; i++) {
            predators.push(new Predator());
        }
        food = [];
        for (let i = 0; i < MAX_FOOD; i++) {
            food.push(new Food());
        }
        babySharks = [];
    }

    function gameLoop() {
        if (isGameOver) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let camX = player.x - canvas.width / 2;
        let camY = player.y - canvas.height / 2;

        ctx.strokeStyle = '#002244';
        ctx.lineWidth = 1;
        const gridSize = 100;
        for (let x = -camX % gridSize; x < canvas.width; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = -camY % gridSize; y < canvas.height; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        if (food.length < MAX_FOOD) food.push(new Food());
        for (let i = food.length - 1; i >= 0; i--) {
            food[i].draw(camX, camY);
            for (let shark of sharks) {
                if (getDistance(shark.x, shark.y, food[i].x, food[i].y) < shark.radius) {
                    shark.radius += 0.2; 
                    shark.score += 10;
                    food.splice(i, 1);
                    break;
                }
            }
        }

        for (let predator of predators) {
            predator.update();
            predator.draw(camX, camY);
            for (let i = sharks.length - 1; i >= 0; i--) {
                let shark = sharks[i];
                if (getDistance(predator.x, predator.y, shark.x, shark.y) < predator.radius && predator.radius > shark.radius) {
                    if (shark.isPlayer) endGame();
                    else {
                        sharks.splice(i, 1);
                        sharks.push(new Shark(null, null, false, `Shark_${Math.floor(Math.random()*500)}`));
                    }
                }
            }
        }

        for (let i = babySharks.length - 1; i >= 0; i--) {
            babySharks[i].update();
            if (babySharks[i].lifeSpan <= 0) babySharks.splice(i, 1);
            else babySharks[i].draw(camX, camY);
        }

        for (let i = sharks.length - 1; i >= 0; i--) {
            let s1 = sharks[i];
            s1.update();
            s1.draw(camX, camY);

            for (let j = sharks.length - 1; j >= 0; j--) {
                if (i === j) continue;
                let s2 = sharks[j];
                if (getDistance(s1.x, s1.y, s2.x, s2.y) < s1.radius && s1.radius > s2.radius * 1.1) {
                    s1.radius += s2.radius * 0.15;
                    s1.score += Math.floor(s2.score + 50);
                    if (s2.isPlayer) endGame();
                    else {
                        sharks.splice(j, 1);
                        sharks.push(new Shark(null, null, false, `Shark_${Math.floor(Math.random()*500)}`));
                    }
                }
            }
        }

        if(scoreEl) scoreEl.innerText = Math.floor(player.score);
        if(sizeEl) sizeEl.innerText = Math.floor(player.radius);
        updateLeaderboard();

        requestAnimationFrame(gameLoop);
    }

    function updateLeaderboard() {
        let sorted = [...sharks].sort((a, b) => b.score - a.score).slice(0, 5);
        if(leaderboardList) {
            leaderboardList.innerHTML = '';
            sorted.forEach(shark => {
                let li = document.createElement('li');
                li.innerText = `${shark.name}: ${Math.floor(shark.score)}`;
                if (shark.isPlayer) li.style.color = '#00ffff';
                leaderboardList.appendChild(li);
            });
        }
    }

    function endGame() {
        isGameOver = true;
        if(gameOverScreen.classList) gameOverScreen.classList.remove('hidden');
    }

    if(restartBtn) {
        restartBtn.addEventListener('click', () => {
            init();
            gameLoop();
        });
    }

    init();
    gameLoop();
})();