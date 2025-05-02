// 完整版：Arduino 控制愛心生成速率的動畫 + 愛心靠近變色＋閃電（心電圖線）效果，新增紫色與白色隨機切換 + 呼吸動畫
const CONFIG = {
    LINE_COUNT: 20,
    LINE_THICKNESS_MIN: 0.3,
    LINE_THICKNESS_MAX: 1,
    LINE_OPACITY: 0.3,
    LINE_COLOR: "255, 150, 200",

    POINT_MIN_COUNT: 2,
    POINT_MAX_COUNT: 5,
    POINT_AMPLITUDE_MIN: 30,
    POINT_AMPLITUDE_MAX: 200,

    HEART_SIZE_MIN: 5,
    HEART_SIZE_MAX: 12,
    HEART_SPEED_MIN: 0.001,
    HEART_SPEED_MAX: 0.005,

    CONNECTION_DISTANCE: 100,
    MAX_HEARTS_PER_LINE: 10
};

class BackgroundHearts {
    constructor() {
        this.canvas = document.getElementById('waveCanvas') || document.createElement('canvas');
        this.canvas.id = 'waveCanvas';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.lines = [];
        this.animationTime = 0;
        this.potValue = 300;
        this.heartSpawnTimer = 0;
        this.heartSpawnInterval = 1000;

        // 添加連接按鈕
        this.connectButton = document.createElement('button');
        this.connectButton.textContent = '連接 Arduino';
        this.connectButton.style.position = 'fixed';
        this.connectButton.style.top = '10px';
        this.connectButton.style.left = '10px';
        this.connectButton.style.padding = '10px 20px';
        this.connectButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        this.connectButton.style.color = 'white';
        this.connectButton.style.border = '1px solid white';
        this.connectButton.style.borderRadius = '5px';
        this.connectButton.style.cursor = 'pointer';
        this.connectButton.style.zIndex = '1000';
        this.connectButton.style.fontFamily = 'Arial';
        
        // 滑鼠懸停效果
        this.connectButton.addEventListener('mouseover', () => {
            this.connectButton.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        });
        this.connectButton.addEventListener('mouseout', () => {
            this.connectButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        // 點擊事件
        this.connectButton.addEventListener('click', () => {
            this.setupArduino();
        });
        
        document.body.appendChild(this.connectButton);

        this.resizeCanvas();
        this.initLines();
        this.animate();
    }

    async setupArduino() {
        try {
            this.connectButton.disabled = true;
            this.connectButton.textContent = '連接中...';
            
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            
            this.connectButton.textContent = '已連接';
            this.connectButton.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
            
            const reader = port.readable.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                try {
                    const { value, done } = await reader.read();
                    if (done) {
                        this.connectButton.textContent = '連接已關閉';
                        this.connectButton.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                        this.connectButton.disabled = false;
                        break;
                    }

                    buffer += decoder.decode(value);
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const value = parseInt(line.trim(), 10);
                        if (!isNaN(value)) {
                            this.potValue = value;
                        }
                    }
                } catch (error) {
                    console.error('讀取錯誤:', error);
                    this.connectButton.textContent = '讀取錯誤';
                    this.connectButton.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                    this.connectButton.disabled = false;
                }
            }
        } catch (error) {
            console.error('Arduino 連接錯誤:', error);
            this.connectButton.textContent = '連接失敗';
            this.connectButton.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            this.connectButton.disabled = false;
        }
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.ctx.scale(dpr, dpr);
    }

    initLines() {
        this.lines = [];
        for (let i = 0; i < CONFIG.LINE_COUNT; i++) {
            const pointCount = Math.floor(Math.random() * (CONFIG.POINT_MAX_COUNT - CONFIG.POINT_MIN_COUNT + 1)) + CONFIG.POINT_MIN_COUNT;
            const y = Math.random() * window.innerHeight;
            const points = [];

            for (let j = 0; j < pointCount; j++) {
                const x = (window.innerWidth / (pointCount - 1)) * j;
                points.push({ x, y, baseY: y, amplitude: Math.random() * 100 + 50 });
            }

            this.lines.push({ points, hearts: [] });
        }
    }

    drawHeart(x, y, size, rotation, color) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);
        this.ctx.scale(size / 16, size / 16);
        this.ctx.beginPath();
        this.ctx.moveTo(0, -5);
        this.ctx.bezierCurveTo(-8, -13, -16, 0, 0, 10);
        this.ctx.bezierCurveTo(16, 0, 8, -13, 0, -5);
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.restore();
    }

    spawnNewHeart() {
        const line = this.lines[Math.floor(Math.random() * this.lines.length)];
        if (line.hearts.length >= CONFIG.MAX_HEARTS_PER_LINE) return;

        const heart = {
            offset: 0,
            speed: Math.random() * (CONFIG.HEART_SPEED_MAX - CONFIG.HEART_SPEED_MIN) + CONFIG.HEART_SPEED_MIN,
            size: Math.random() * (CONFIG.HEART_SIZE_MAX - CONFIG.HEART_SIZE_MIN) + CONFIG.HEART_SIZE_MIN,
            color: 'rgba(255, 80, 100, 0.9)',
            isConnected: false
        };
        line.hearts.push(heart);
    }

    drawHeartbeatLine(x1, y1, x2, y2) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const spikeHeight = 10;

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(midX - 10, midY);
        this.ctx.lineTo(midX - 5, midY - spikeHeight);
        this.ctx.lineTo(midX, midY);
        this.ctx.lineTo(midX + 5, midY + spikeHeight);
        this.ctx.lineTo(midX + 10, midY);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.animationTime += 0.01;

        const allHearts = [];

        this.lines.forEach(line => {
            line.points.forEach((p, i) => {
                const angle = this.animationTime + i * 0.5;
                const ampFactor = this.potValue / 1023; // 0~1
p.y = p.baseY + Math.sin(angle) * p.amplitude * (0.1 + ampFactor * 0.4);
            });

            this.ctx.beginPath();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // 改為白色半透明
            this.ctx.lineWidth = 1;
            this.ctx.moveTo(line.points[0].x, line.points[0].y);
            for (let i = 1; i < line.points.length; i++) {
                this.ctx.lineTo(line.points[i].x, line.points[i].y);
            }
            this.ctx.stroke();

            line.hearts.forEach(heart => {
                heart.offset += heart.speed;
                if (heart.offset > 1) heart.offset = 0;

                const idx = Math.floor(heart.offset * (line.points.length - 1));
                const p1 = line.points[idx];
                const p2 = line.points[idx + 1] || p1;
                const t = (heart.offset * (line.points.length - 1)) % 1;

                const x = p1.x + (p2.x - p1.x) * t;
                const y = p1.y + (p2.y - p1.y) * t;
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                heart.x = x;
                heart.y = y;
                heart.isConnected = false;

                allHearts.push(heart);
            });
        });

        const shuffledHearts = allHearts.sort(() => Math.random() - 0.5);
let connectedPairs = 0;

for (let i = 0; i < shuffledHearts.length && connectedPairs < 1; i++) {
    for (let j = i + 1; j < shuffledHearts.length && connectedPairs < 1; j++) {
        const dx = shuffledHearts[i].x - shuffledHearts[j].x;
        const dy = shuffledHearts[i].y - shuffledHearts[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.CONNECTION_DISTANCE) {
            shuffledHearts[i].isConnected = true;
            shuffledHearts[j].isConnected = true;
            const useWhite = Math.random() < 0.5;
            const color = useWhite ? 'rgba(255,255,255,0.9)' : 'rgba(180,100,255,0.9)';
            shuffledHearts[i].connectionColor = color;
            shuffledHearts[j].connectionColor = color;
            const lineColor = useWhite ? 'rgba(255,255,255,0.8)' : 'rgba(200,100,255,0.8)';
            this.ctx.strokeStyle = lineColor;
            this.drawHeartbeatLine(shuffledHearts[i].x, shuffledHearts[i].y, shuffledHearts[j].x, shuffledHearts[j].y);
            connectedPairs++;
        }
    }
}

        allHearts.forEach(heart => {
            const angle = 0;
            const color = heart.isConnected ? (heart.connectionColor || 'rgba(180, 100, 255, 0.9)') : 'rgba(255, 80, 100, 0.9)';
            const pulse = 1 + 0.1 * Math.sin(this.animationTime * 2 + heart.x * 0.01);
            this.drawHeart(heart.x, heart.y, heart.size * pulse, angle, color);
        });

        const norm = Math.max(0.05, this.potValue / 1023);
        this.heartSpawnInterval = 2000 - norm * 1800;
        this.heartSpawnTimer += 16.67;
        if (this.heartSpawnTimer >= this.heartSpawnInterval) {
            this.spawnNewHeart();
            this.heartSpawnTimer = 0;
        }

        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => new BackgroundHearts());
