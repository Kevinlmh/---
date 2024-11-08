// @ts-nocheck
let dom_replay = document.querySelector("#replay");
let dom_score = document.querySelector("#score");
let dom_canvas = document.createElement("canvas");
document.querySelector("#canvas").appendChild(dom_canvas);
let CTX = dom_canvas.getContext("2d");
let isFirstStart = true; // 标志变量，初始为 true

let timer = 15; // 当前剩余时间
let interval;

const W = (dom_canvas.width = 500);
const H = (dom_canvas.height = 500);

// 添加选择器元素
let modeSelector = document.getElementById("modeSelector");
let timeSelectorSpan = document.querySelector(".timeSelector");
let timeSelector = document.getElementById("timeSelector");

let snake,
  food,
  obstacle,
  currentHue,
  cells = 20,
  cellSize,
  isGameOver = false,
  tails = [],
  score = "00",
  maxScore = window.localStorage.getItem("maxScore") || undefined,
  particles = [],
  splashingParticleCount = 20,
  cellsCount,
  requestID;

let helpers = {
  Vec: class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    add(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }
    mult(v) {
      if (v instanceof helpers.Vec) {
        this.x *= v.x;
        this.y *= v.y;
        return this;
      } else {
        this.x *= v;
        this.y *= v;
        return this;
      }
    }
  },
  isCollision(v1, v2) {
    return v1.x == v2.x && v1.y == v2.y;
  },
  garbageCollector() {
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].size <= 0) {
        particles.splice(i, 1);
      }
    }
  },
  drawGrid() {
    CTX.lineWidth = 1.1;

    CTX.strokeStyle = "#181825";

    CTX.shadowBlur = 0;
    for (let i = 1; i < cells; i++) {
      let f = (W / cells) * i;

      CTX.beginPath();

      CTX.moveTo(f, 0);

      CTX.lineTo(f, H);

      CTX.stroke();

      CTX.beginPath();

      CTX.moveTo(0, f);

      CTX.lineTo(W, f);

      CTX.stroke();

      CTX.closePath();
    }
  },
  randHue() {
    return ~~(Math.random() * 360);
  },
  hsl2rgb(hue, saturation, lightness) {
    if (hue == undefined) {
      return [0, 0, 0];
    }
    var chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    var huePrime = hue / 60;
    var secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

    huePrime = ~~huePrime;
    var red;
    var green;
    var blue;

    if (huePrime === 0) {
      red = chroma;
      green = secondComponent;
      blue = 0;
    } else if (huePrime === 1) {
      red = secondComponent;
      green = chroma;
      blue = 0;
    } else if (huePrime === 2) {
      red = 0;
      green = chroma;
      blue = secondComponent;
    } else if (huePrime === 3) {
      red = 0;
      green = secondComponent;
      blue = chroma;
    } else if (huePrime === 4) {
      red = secondComponent;
      green = 0;
      blue = chroma;
    } else if (huePrime === 5) {
      red = chroma;
      green = 0;
      blue = secondComponent;
    }

    var lightnessAdjustment = lightness - chroma / 2;

    red += lightnessAdjustment;

    green += lightnessAdjustment;

    blue += lightnessAdjustment;

    return [
      Math.round(red * 255),

      Math.round(green * 255),

      Math.round(blue * 255),
    ];
  },
  lerp(start, end, t) {
    return start * (1 - t) + end * t;
  },
  randomColor() {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  },
};

let KEY = {
  ArrowUp: false,
  ArrowRight: false,
  ArrowDown: false,
  ArrowLeft: false,
  resetState() {
    this.ArrowUp = false;
    this.ArrowRight = false;
    this.ArrowDown = false;
    this.ArrowLeft = false;
  },
  listen() {
    addEventListener(
      "keydown",
      (e) => {
        if (e.key === "ArrowUp" && this.ArrowDown) return;
        if (e.key === "ArrowDown" && this.ArrowUp) return;
        if (e.key === "ArrowLeft" && this.ArrowRight) return;
        if (e.key === "ArrowRight" && this.ArrowLeft) return;
        this[e.key] = true;
        Object.keys(this)
          .filter((f) => f !== e.key && f !== "listen" && f !== "resetState")
          .forEach((k) => {
            this[k] = false;
          });
      },
      false
    );
  },
};

class Snake {
  constructor(i) {
    this.pos = new helpers.Vec(W / 2, H / 2);
    this.dir = new helpers.Vec(0, 0);
    this.size = W / cells;
    this.color = helpers.randomColor();
    this.history = [];
    this.total = 1;
    this.delay = parseInt(document.getElementById("speedSelector").value);
  }

  draw() {
    let { x, y } = this.pos;

    CTX.fillStyle = this.color;

    CTX.shadowBlur = 20;

    CTX.shadowColor = "rgba(255,255,255,.3 )";

    CTX.fillRect(x, y, this.size, this.size);

    CTX.shadowBlur = 0;
    if (this.total >= 2) {
      for (let i = 0; i < this.history.length - 1; i++) {
        let { x, y } = this.history[i];

        CTX.lineWidth = 1;

        CTX.fillStyle = this.color;

        CTX.fillRect(x, y, this.size, this.size);

        CTX.strokeStyle = "black";

        CTX.strokeRect(x, y, this.size, this.size);
      }
    }
  }

  walls() {
    let { x, y } = this.pos;
    if (x + cellSize > W) {
      isGameOver = true; // 碰到右侧墙壁
    }
    if (y + cellSize > H) {
      isGameOver = true; // 碰到下方墙壁
    }
    if (y < 0) {
      isGameOver = true; // 碰到上方墙壁
    }
    if (x < 0) {
      isGameOver = true; // 碰到左侧墙壁
    }
  }

  controlls() {
    let dir = this.size;
    if (KEY.ArrowUp) {
      this.dir = new helpers.Vec(0, -dir);
    }
    if (KEY.ArrowDown) {
      this.dir = new helpers.Vec(0, dir);
    }
    if (KEY.ArrowLeft) {
      this.dir = new helpers.Vec(-dir, 0);
    }
    if (KEY.ArrowRight) {
      this.dir = new helpers.Vec(dir, 0);
    }
  }

  selfCollision() {
    for (let i = 0; i < this.history.length; i++) {
      let p = this.history[i];
      if (helpers.isCollision(this.pos, p)) {
        isGameOver = true;
      }
    }
  }

  obstacleCollision() {
    if (helpers.isCollision(this.pos, obstacle.pos)) {
      isGameOver = true; // 碰到障碍物
    }
  }

  update() {
    this.walls();
    this.draw();
    this.controlls();
    if (!this.delay--) {
      if (helpers.isCollision(this.pos, food.pos)) {
        incrementScore();
        particleSplash();
        food.spawn();
        obstacle.spawn(food.pos, this.history); // 生成新障碍物
        this.total++;
      }
      this.history[this.total - 1] = new helpers.Vec(this.pos.x, this.pos.y);
      for (let i = 0; i < this.total - 1; i++) {
        this.history[i] = this.history[i + 1];
      }
      this.pos.add(this.dir);
      this.delay = parseInt(document.getElementById("speedSelector").value); // 每次更新速度
      this.total > 3 ? this.selfCollision() : null;
    }
    this.obstacleCollision();
  }
}

class Food {
  constructor() {
    this.pos = new helpers.Vec(
      ~~(Math.random() * cells) * cellSize,
      ~~(Math.random() * cells) * cellSize
    );
    this.color = "red";
    this.size = cellSize;
    this.spawn(); // 生成初始食物
  }

  draw() {
    let { x, y } = this.pos;

    CTX.globalCompositeOperation = "lighter";

    CTX.shadowColor = this.color;

    CTX.fillStyle = this.color;

    CTX.beginPath();

    CTX.arc(
      x + this.size / 2,
      y + this.size / 2,
      this.size / 2,
      0,
      Math.PI * 2
    );

    CTX.fill();

    CTX.globalCompositeOperation = "source-over";

    CTX.shadowBlur = 0;
  }

  spawn() {

    // 随机生成食物的X、Y坐标，范围是0到canvas宽度、高度的整数倍
    let randX = ~~(Math.random() * cells) * this.size;
    let randY = ~~(Math.random() * cells) * this.size;

    // 遍历蛇的历史位置，检查新生成的食物位置是否与蛇身重叠
    for (let path of snake.history) {
      // 创建一个新的向量对象来表示随机生成的位置，并与蛇身的位置进行碰撞检测
      if (helpers.isCollision(new helpers.Vec(randX, randY), path)) {
        // 如果与蛇身重叠，递归调用 spawn 方法重新生成位置
        return this.spawn();
      }
    }
    this.color = "red"; // 设置食物的颜色为红色
    this.pos = new helpers.Vec(randX, randY); //将随机生成的位置赋值给食物的位置属性
  }
}

class Obstacle {
  constructor() {
    this.pos = new helpers.Vec(0, 0);
    this.color = "black"; // 障碍物的颜色
    this.size = cellSize;
  }

  draw() {
    let { x, y } = this.pos;
    CTX.fillStyle = this.color;
    CTX.fillRect(x, y, this.size, this.size);
  }

  spawn(foodPos, snakeHistory) {
    let randX, randY;
    let validPosition = false; //用于标记生成的位置是否有效

    while (!validPosition) {
      // 随机生成X、Y坐标，范围是0到canvas宽度、高度的整数倍
      randX = ~~(Math.random() * cells) * this.size;
      randY = ~~(Math.random() * cells) * this.size;

      // 检查生成位置是否与食物的位置重叠
      validPosition = !helpers.isCollision(new helpers.Vec(randX, randY),foodPos);
      // 遍历蛇的历史位置，检查新生成的位置是否与蛇身重叠
      for (let path of snakeHistory) {
        // 如果新位置与蛇身重叠，则设置validPosition为false，重新生成位置
        if (helpers.isCollision(new helpers.Vec(randX, randY), path)) {
          validPosition = false; // 重叠，位置无效
          break; //退出循环，重新生成位置
        }
      }
    }
    // 一旦找到有效位置，将该位置赋值给食物的pos属性
    this.pos = new helpers.Vec(randX, randY);
  }
}

class Particle {
  constructor(pos, color, size, vel) {
    this.pos = pos;
    this.color = color;
    this.size = Math.abs(size / 2);
    this.ttl = 0;
    this.gravity = -0.2;
    this.vel = vel;
  }

  draw() {
    let { x, y } = this.pos;
    let hsl = this.color
      .split("")
      .filter((l) => l.match(/[^hsl()$% ]/g))
      .join("")
      .split(",")
      .map((n) => +n);

    let [r, g, b] = helpers.hsl2rgb(hsl[0], hsl[1] / 100, hsl[2] / 100);

    CTX.shadowColor = "white";

    CTX.shadowBlur = 0;

    CTX.globalCompositeOperation = "lighter";

    CTX.fillStyle = "white";

    CTX.fillRect(x, y, this.size, this.size);

    CTX.globalCompositeOperation = "source-over";
  }

  update() {
    this.draw();
    this.size -= 0.3;
    this.ttl += 1;
    this.pos.add(this.vel);
    this.vel.y -= this.gravity;
  }
}

function incrementScore() {
  score++;
  dom_score.innerText = score.toString().padStart(2, "0");
  if (score % 5 === 0) {
    snake.color = helpers.randomColor();
  }
}

function particleSplash() {
  for (let i = 0; i < splashingParticleCount; i++) {
    let vel = new helpers.Vec(Math.random() * 6 - 3, Math.random() * 6 - 3);
    let position = new helpers.Vec(food.pos.x, food.pos.y);
    particles.push(new Particle(position, "", food.size, vel));
  }
}

function clear() {
  CTX.clearRect(0, 0, W, H);
}

function initialize() {
  // 禁用图像平滑处理，以确保图像在绘制时不模糊
  CTX.imageSmoothingEnabled = false;
  KEY.listen();// 监听键盘键入事件
  cellsCount = cells * cells;// 计算总单元格数量
  cellSize = W / cells;// 计算单元格大小
  snake = new Snake();
  food = new Food();
  obstacle = new Obstacle(); 
  // 生成初始障碍物
  obstacle.spawn(food.pos, snake.history); 
  // 第一次开始游戏，更新按钮文本
  if (isFirstStart) {
    document.getElementById("replay").innerHTML =
      '<i class="fas fa-play"></i> 开始游戏';
  }
  // 为重玩按钮增加点击事件监听，点击时调用reset函数
  dom_replay.addEventListener("click", reset, false);

  // 启用模式和难度/时间选择器
  modeSelector.disabled = false;
  speedSelector.disabled = false;
  timeSelector.disabled = false;

  // 初始化时更新UI
  updateUI();

  // 添加模式选择事件监听，模式选择发生变化时更新用户界面
  modeSelector.addEventListener("change", updateUI);

  // 添加键盘监听事件，用于开始游戏后禁用选择器
  document.addEventListener("keydown", disableSelectorsOnGameStart);

  // 启动游戏循环，开始游戏的主要逻辑
  loop();
}

function loop() {
  clear(); // 清理画布，为下一帧准备
  // 检查限时模式下是否时间到
  if (modeSelector.value === "timed" && timer <= 0) {
    isGameOver = true; // 时间到，结束游戏
  }
  // 如果游戏未结束，继续执行游戏循环
  if (!isGameOver) {
    requestID = requestAnimationFrame(loop); // 请求下一帧的动画更新
    helpers.drawGrid(); // 绘制游戏网格
    snake.update(); // 更新蛇的位置和状态（移动、碰撞测试）
    // 绘制食物和障碍物在画布上的位置
    food.draw();
    obstacle.draw();
    // 更新所有粒子效果
    for (let p of particles) {
      p.update(); // 更新每个粒子的状态（运动、消亡）
    }
    helpers.garbageCollector();// 垃圾收集器，处理不再需要的对象（如消亡的粒子）
  } else {
    clear(); //清理画布
    gameOver(); // 调用游戏结束函数
  }
}

function gameOver() {
  // 如果当前最高分未设置，则将当前分数设为最高分
  maxScore ? null : (maxScore = score);
  // 如果当前分数超过最高分，则更新最高分
  score > maxScore ? (maxScore = score) : null;
  // 将最高分存储到本地存储中，以便在刷新页面后仍有记录
  window.localStorage.setItem("maxScore", maxScore);
  // 设置文本的颜色
  CTX.fillStyle = "#F69B3AFF";
  // 设置文本的对齐方式为居中
  CTX.textAlign = "center";
  // 设置游戏结束提示的字体样式
  CTX.font = "bold 30px Poppins, sans-serif";
  // 在画布上显示“游戏结束”文本，位置在画布中心
  CTX.fillText("游戏结束", W / 2, H / 2);
  // 设置得分信息的字体样式
  CTX.font = "15px Poppins, sans-serif";
  //显示得分信息，并提示用户重新开始按钮
  CTX.fillText(`本局得分   ${score}`, W / 2, H / 2 + 60);
  CTX.fillText(`最高得分   ${maxScore}`, W / 2, H / 2 + 80);
  CTX.fillText("按下 '重新开始' 开始新游戏", W / 2, H / 2 + 120);

  // 启用模式和难度/时间选择器，让用户可以在游戏结束后重新选择
  modeSelector.disabled = false;
  speedSelector.disabled = false;
  timeSelector.disabled = false;

  // 重置计时器
  timer = 0; 

  // 更新 UI 以确保选择器正确显示
  updateUI();
}

function reset() {
  // 重置得分
  dom_score.innerText = "00";
  score = "00";

  snake = new Snake();
  food.spawn();
  KEY.resetState();// 重置键盘状态
  isGameOver = false;// 重置游戏状态

  // 重置计时器
  clearInterval(interval); // 清理之前的计时器
  timer = parseInt(timeSelector.value); // 重置为选择的时间限制
  document.getElementById("remainingTime").innerText = timer; // 更新显示的时间

  isFirstStart = false; // 游戏开始后，将标志设置为 false
  document.getElementById("replay").innerHTML =
    '<i class="fas fa-play"></i> 重新开始';

  // 启用模式和难度/时间选择器
  modeSelector.disabled = false;
  speedSelector.disabled = false;
  timeSelector.disabled = false;

  // 每次重置游戏时更新UI
  updateUI();

  // 再次添加键盘监听事件
  document.addEventListener("keydown", disableSelectorsOnGameStart);
  //取消当前动画帧请求，以避免重叠的动画循环
  cancelAnimationFrame(requestID);
  loop();
}

// 当游戏开始后禁用选择器
function disableSelectorsOnGameStart() {
  modeSelector.disabled = true;
  speedSelector.disabled = true;
  timeSelector.disabled = true;

  // 如果选择了限时模式，启动计时器
  if (modeSelector.value === "timed") {
    startTimer();
  }

  // 移除键盘监听事件，避免重复触发
  document.removeEventListener("keydown", disableSelectorsOnGameStart);
}

function updateUI() {
  const mode = modeSelector.value; // 获取当前选择的模式
  // 如果选择的是限时模式
  if (mode === "timed") {
    // 显示时间选择器
    timeSelectorSpan.style.display = "inline";
    timeSelector.style.display = "inline";
    // 显示计时器
    document.getElementById("timer").style.display = "inline";
  } else {
    // 如果不是限时模式，隐藏时间选择器
    timeSelectorSpan.style.display = "none";
    timeSelector.style.display = "none";
    // 隐藏计时器
    document.getElementById("timer").style.display = "none";
  }
}

function startTimer() {
  // 从时间选择器获取时间限制，并转换成整数
  timer = parseInt(timeSelector.value); 
  // 更新显示的剩余时间，将初始时间设置为用户选择的值
  updateRemainingTime();
  document.getElementById("timer").style.display = "inline"; // 显示计时器

  const interval = setInterval(() => {
    if (timer > 0) {
      timer--;
      updateRemainingTime(); // 更新剩余时间显示
    } else {
      clearInterval(interval); // 清除定时器
      isGameOver = true; // 时间到，游戏结束
    }
  }, 1000); // 每秒更新（1000ms）
}
function updateRemainingTime() {
  document.getElementById("remainingTime").innerText = timer; // 更新剩余时间显示
}

initialize();
