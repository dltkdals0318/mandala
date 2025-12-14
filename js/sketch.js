// ============================================
// Digital Mandala
// ============================================

// ============================================
// Firebase reset
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyB1eT-iQ9VwSOsF9fbrw_W1xqRXQ1geRFE",
  authDomain: "sm-mandara.firebaseapp.com",
  databaseURL: "https://sm-mandara-default-rtdb.firebaseio.com",
  projectId: "sm-mandara",
  storageBucket: "sm-mandara.firebasestorage.app",
  messagingSenderId: "194575466944",
  appId: "1:194575466944:web:4d3306915931a21e85c825",
  measurementId: "G-XDHJ1H21P6",
};

function isFirebaseConfigValid(config) {
  if (!config) return false;

  return Object.values(config).every((value) => {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    return trimmed.length > 0 && !trimmed.includes("YOUR");
  });
}

let database;
let usersRef;
let myConnectionRef;
let userId;
let heartbeatInterval = null;

// ============================================
// 전역 상태 변수
// ============================================

let connectedUsers = 0;
let activeTouches = {};
let audioLayers = [];
const MAX_LAYERS = 7;
let prayerSound;
let prayerFont;
let titleFont;
let decorFont;
let mantraImg;
let mantraImages = [];

const MANDALA_COLORS = ["#fefff0", "#fffae3", "#fff1ae", "#ffec7b"];
const TEXT_PATTERNS = ["circular"];

let completionFlash = {
  active: false,
  startTime: 0,
  duration: 400,
};

let BASE_RADIUS_RATIO = 0.96;
let RING_SPACING_RATIO = 0.72;
let SYMBOL_SIZE_RATIO = 1.2;
let DECOR_TEXT_RADIUS_RATIO = 0.6;
let DECOR_TEXT_OFFSET = 0;
let DECOR_TEXT_CENTER_X = 40;
let DECOR_TEXT_CENTER_Y = -140;
let DECOR_TEXT_ROTATION_SPEED = 0.0125;

let baseRadius = 150;
let ringSpacing = 100;
let symbolSize = 120;
let symbolAspectRatio = 1;
let lastUpdate = 0;
const UPDATE_INTERVAL = 50;
let testMode = false;
let virtualUsers = [];

const COMPLETION_TIME = 27000;
const SYMBOLS_PER_MANTRA = 7;
const MAX_MANTRAS = 3;
const MANTRA_LIFETIME = 60000;
const MANTRA_FADEOUT_TIME = 10000;
const COMPLETION_FADEOUT_TIME = 2000;
let touchStartTime = 0;
let currentProgress = 0;
let completedMantras = [];
let totalMantraCount = 0;
let currentMantraRotation = 0;
let animatedMantraRotation = 0;
const ROTATION_SPEED = 0.005;
let lastActiveCount = 0;
let completionFadeoutStart = 0;
let isCompletionFadingOut = false;
let fadingOutImageIndex = 0;
let hasCompletedCurrentMantra = false;
let currentScale = 1.0;
let targetScale = 1.0;
const SCALE_LERP_AMOUNT = 0.03;
const MANTRA_IMAGE_COUNT = 4;

const LORDS_PRAYER = [
  "하늘에",
  "계신",
  "우리",
  "아버지여,",
  "이름이",
  "거룩히",
  "여김을",
  "받으시오며,",
  "나라가",
  "임하시오며",
  "뜻이",
  "하늘에서",
  "이루어진",
  "것",
  "같이",
  "땅에서도",
  "이루어지이다.",
  "",
  "오늘",
  "우리에게",
  "일용할",
  "양식을",
  "주시옵고,",
  "우리가",
  "우리에게",
  "죄",
  "지은",
  "자를",
  "사하여",
  "준",
  "것",
  "같이",
  "우리",
  "죄를",
  "사하여",
  "주시고,",
  "우리를",
  "시험에",
  "들게",
  "하지",
  "마시고,",
  "다만",
  "악에서",
  "구하시옵소서.",
  "",
  "나라와",
  "권세와",
  "영광이",
  "아버지께",
  "영원히",
  "있사옵나이다.",
];

// ============================================
// 3. p5.js 프리로드
// ============================================

function preload() {
  for (let i = 0; i < 4; i++) {
    const imageNumber = i + 1;
    const index = i;
    let img = loadImage(
      `source/mandala${imageNumber}.png`,
      () => {
        if (index === 0) {
          symbolAspectRatio = mantraImages[0].width / mantraImages[0].height;
        }
      },
      () => {}
    );
    mantraImages[index] = img;
  }
  mantraImg = mantraImages[0];
  prayerSound = loadSound(
    "source/pray.mp3",
    () => {},
    () => {}
  );
  prayerFont = "Ohmin";
  titleFont = "Ohmin";
  decorFont = "Tikkeul";
}

// ============================================
// p5.js setup
// ============================================

function setup() {
  createCanvas(windowWidth, windowHeight, P2D);
  textFont("Ohmin");
  calculateResponsiveSizes();

  const firebaseAvailable = typeof firebase !== "undefined";
  const configReady = isFirebaseConfigValid(firebaseConfig);
  const shouldUseFirebase = !testMode && firebaseAvailable && configReady;

  if (shouldUseFirebase) {
    initFirebase();
  } else {
    if (!testMode) {
      testMode = true;
    }
    initTestMode();
  }
  initAudio();
  textAlign(LEFT, TOP);
  textFont("monospace");
}

// ============================================
// 5. Firebase reset
// ============================================

function initFirebase() {
  firebase.initializeApp(firebaseConfig);
  database = firebase.database();

  userId = Date.now() + "_" + Math.floor(Math.random() * 10000);

  usersRef = database.ref("users");
  myConnectionRef = usersRef.child(userId);

  const connectedRef = database.ref(".info/connected");
  connectedRef.on("value", (snapshot) => {
    if (snapshot.val() === true) {
      // user data
      myConnectionRef.set({
        online: true,
        touchActive: false,
        touchX: 0.5,
        touchY: 0.5,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
      });

      // auto remove on disconnect
      myConnectionRef.onDisconnect().remove();

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      heartbeatInterval = setInterval(() => {
        if (myConnectionRef) {
          myConnectionRef.update({
            lastSeen: firebase.database.ServerValue.TIMESTAMP,
          });
        }
      }, 10000);
    } else {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
  });

  setupPresenceTracking();

  setTimeout(() => {
    usersRef.once("value", (snapshot) => {
      cleanupStaleConnections(snapshot);
    });
  }, 2000);
}

function initTestMode() {
  userId = "local_" + Date.now();
  activeTouches[userId] = {
    active: false,
    x: 0.5,
    y: 0.5,
    visualLayer: null,
  };

  refreshConnectionCount();
}

// ============================================
// Presence System
// ============================================

function setupPresenceTracking() {
  usersRef.on("value", (snapshot) => {
    connectedUsers = snapshot.numChildren();

    cleanupStaleConnections(snapshot);
  });

  usersRef.on("child_added", (snapshot) => {
    const user = snapshot.val();
    const uid = snapshot.key;

    activeTouches[uid] = {
      active: user.touchActive || false,
      x: user.touchX || 0.5,
      y: user.touchY || 0.5,
      visualLayer: null,
    };
  });

  usersRef.on("child_changed", (snapshot) => {
    const user = snapshot.val();
    const uid = snapshot.key;

    // local data update
    if (activeTouches[uid]) {
      activeTouches[uid].active = user.touchActive;
      activeTouches[uid].x = user.touchX;
      activeTouches[uid].y = user.touchY;
    }
  });

  usersRef.on("child_removed", (snapshot) => {
    const uid = snapshot.key;

    delete activeTouches[uid];
  });
}

function cleanupStaleConnections(snapshot) {
  const now = Date.now();
  const TIMEOUT = 30000;

  snapshot.forEach((childSnapshot) => {
    const uid = childSnapshot.key;
    const user = childSnapshot.val();

    if (!user.lastSeen) {
      usersRef.child(uid).remove();
      return;
    }

    const lastSeen = user.lastSeen;
    const timeSinceLastSeen = now - lastSeen;

    if (timeSinceLastSeen > TIMEOUT) {
      usersRef.child(uid).remove();
    }
  });
}

// ============================================
// audio presetup
// ============================================

function initAudio() {
  audioLayers.forEach((layer) => {
    if (layer) {
      layer.loop();
      layer.setVolume(0);
    }
  });
}

function updateAudioLayers(activeCount = 0) {
  let layerIndex = 0;

  if (activeCount > 0) {
    for (let uid in activeTouches) {
      if (activeTouches[uid].active && layerIndex < MAX_LAYERS) {
        if (audioLayers[layerIndex]) {
          audioLayers[layerIndex].setVolume(1, 0.5);
        }
        layerIndex++;
      }
    }
  }

  for (let i = layerIndex; i < MAX_LAYERS; i++) {
    if (audioLayers[i]) {
      audioLayers[i].setVolume(0, 0.5);
    }
  }
}

// ============================================
// Touch / Mouse Event Handlers
// ============================================

function touchStarted() {
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    if (getAudioContext().state !== "running") {
      getAudioContext().resume();
    }

    let normalizedX = mouseX / width;
    let normalizedY = mouseY / height;

    if (myConnectionRef) {
      myConnectionRef.update({
        touchActive: true,
        touchX: normalizedX,
        touchY: normalizedY,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP,
      });
    } else {
      updateLocalTouchState(true, normalizedX, normalizedY);
    }

    return false;
  }
}

function touchMoved() {
  if (mouseIsPressed) {
    let now = millis();
    if (now - lastUpdate > UPDATE_INTERVAL) {
      let normalizedX = mouseX / width;
      let normalizedY = mouseY / height;

      if (myConnectionRef) {
        myConnectionRef.update({
          touchX: normalizedX,
          touchY: normalizedY,
          lastUpdate: firebase.database.ServerValue.TIMESTAMP,
        });
      } else {
        updateLocalTouchState(true, normalizedX, normalizedY);
      }

      lastUpdate = now;
    }
  }
  return false;
}

function touchEnded() {
  if (myConnectionRef) {
    // firebase update
    myConnectionRef.update({
      touchActive: false,
    });
  } else {
    updateLocalTouchState(false);
  }

  return false;
}

// mouse events for desktop testing
function mousePressed() {
  return touchStarted();
}

function mouseDragged() {
  return touchMoved();
}

function mouseReleased() {
  return touchEnded();
}

function updateLocalTouchState(isActive, normalizedX, normalizedY) {
  if (!testMode) return;

  if (!activeTouches[userId]) {
    activeTouches[userId] = {
      active: false,
      x: 0.5,
      y: 0.5,
      visualLayer: null,
    };
  }

  const localUser = activeTouches[userId];
  localUser.active = isActive;

  if (typeof normalizedX === "number") {
    localUser.x = constrain(normalizedX, 0, 1);
  }

  if (typeof normalizedY === "number") {
    localUser.y = constrain(normalizedY, 0, 1);
  }

  refreshConnectionCount();
}

// ============================================
// main draw loop
// ============================================

function draw() {
  background("#111320ff");

  const activeCount = updateCompletionProgress();

  updateMantraLifetime();

  displayConnectionInfo(activeCount);

  renderVisualLayers(activeCount);

  displayCompletionState(activeCount);

  displayLordsPrayer(activeCount);

  // ===== flash effect =====
  if (completionFlash.active) {
    let elapsed = millis() - completionFlash.startTime;
    let progress = elapsed / completionFlash.duration;

    if (progress < 1) {
      // flash alpha (ease-out)
      let flashAlpha = 128 * (1 - pow(progress, 1.5));

      push();
      fill(255, 255, 255, flashAlpha);
      rect(0, 0, width, height);
      pop();
    } else {
      completionFlash.active = false;
    }
  }

  updateAudioLayers(activeCount);

  displayBottomSymbol();
}

// ============================================
// UI rendering functions
// ============================================

function displayConnectionInfo(activeCount = 0) {
  if (testMode) {
    refreshConnectionCount();
  }

  push();

  let displayText;
  if (connectedUsers === 1) {
    displayText = "하나님의 자녀 한 명";
  } else if (connectedUsers === 2) {
    displayText = "하나님의 자녀 두 명";
  } else if (connectedUsers === 3) {
    displayText = "하나님의 자녀 세 명";
  } else if (connectedUsers === 4) {
    displayText = "하나님의 자녀 네 명";
  } else if (connectedUsers === 5) {
    displayText = "하나님의 자녀 다섯 명";
  } else if (connectedUsers === 6) {
    displayText = "하나님의 자녀 여섯 명";
  } else if (connectedUsers === 7) {
    displayText = "하나님의 자녀 일곱 명";
  } else if (connectedUsers === 8) {
    displayText = "하나님의 자녀 여덟 명";
  } else if (connectedUsers === 9) {
    displayText = "하나님의 자녀 아홉 명";
  } else {
    displayText = `하나님의 자녀 ${connectedUsers} 명`;
  }

  fill(254, 255, 240, 200);
  textAlign(CENTER, TOP);
  textSize(20);
  if (titleFont) {
    textFont(titleFont);
  } else {
    textFont("serif");
  }
  textStyle(BOLD);
  text(displayText, width / 2, 30);

  // test mode
  if (testMode) {
    textAlign(CENTER, TOP);
    fill(200, 200, 200, 200);
    textSize(10);
    textStyle(NORMAL);
    text("테스트: 1-9", width / 2, 60);
  }

  textAlign(LEFT, BASELINE);
  textStyle(NORMAL);

  pop();
}

// bottom symbol
function displayBottomSymbol() {
  if (!mantraImages[0]) return;

  push();

  let baseSize = min(width, height) * 0.125;

  let imgWidth = baseSize * symbolAspectRatio;
  let imgHeight = baseSize;

  let symbolX = width / 2;
  let symbolY = height - imgHeight / 2 - 30;

  imageMode(CENTER);
  image(mantraImages[0], symbolX, symbolY, imgWidth, imgHeight);
  noTint();

  pop();
}

// ============================================
// Visual Layer Rendering
// ============================================

function calculateGlobalScale(activeCount = 0) {
  let fixedMantraCount = 2;
  let maxRadius = baseRadius + fixedMantraCount * ringSpacing;

  let requiredSpace = maxRadius + symbolSize;
  let availableSpace = min(width, height) / 2;
  availableSpace *= 1.3;

  if (requiredSpace > availableSpace) {
    return availableSpace / requiredSpace;
  }

  return 1.0;
}

function renderVisualLayers(activeCount = 0) {
  targetScale = calculateGlobalScale(activeCount);
  currentScale = lerp(currentScale, targetScale, SCALE_LERP_AMOUNT);
  let globalScale = currentScale;

  let sortedMantras = [...completedMantras].sort(
    (a, b) => b.birthOrder - a.birthOrder
  );

  for (let i = 0; i < sortedMantras.length; i++) {
    let mantra = sortedMantras[i];

    let targetRingIndex = i;

    if (mantra.animatedRingIndex === undefined) {
      if (mantra.birthOrder === 0) {
        mantra.animatedRingIndex = targetRingIndex;
      } else {
        mantra.animatedRingIndex = 0;
      }
    }

    if (mantra.prevTargetRingIndex === undefined) {
      mantra.prevTargetRingIndex = targetRingIndex;
    }

    let isPushedOut = targetRingIndex > mantra.prevTargetRingIndex;
    if (isPushedOut) {
      mantra.prevTargetRingIndex = targetRingIndex;
      if (!mantra.pushScale) mantra.pushScale = 1.0;
      mantra.targetPushScale = 1.15;
    }

    mantra.animatedRingIndex = lerp(
      mantra.animatedRingIndex,
      targetRingIndex,
      0.08
    );

    let radius = baseRadius + (mantra.animatedRingIndex + 1) * ringSpacing;

    let mantraAlpha = 255;
    let mantraScale = 1.0;
    let age = millis() - mantra.createdTime;

    if (mantra.isNewlyCreated) {
      let birthAge = age;
      let birthDuration = 1000;

      if (birthAge < birthDuration) {
        let birthProgress = birthAge / birthDuration;
        let eased = 1 - pow(1 - birthProgress, 3);

        let birthScale = 0.3 + eased * 0.7;
        mantra.currentScale = birthScale;

        mantraAlpha = 255 * eased;
      } else {
        mantra.isNewlyCreated = false;
      }
    }

    if (!mantra.pushScale) mantra.pushScale = 1.0;
    if (!mantra.targetPushScale) mantra.targetPushScale = 1.0;

    mantra.pushScale = lerp(mantra.pushScale, mantra.targetPushScale, 0.1);
    if (mantra.pushScale > 1.01) {
      mantra.targetPushScale = lerp(mantra.targetPushScale, 1.0, 0.05);
    }

    if (age > MANTRA_LIFETIME) {
      let fadeProgress = (age - MANTRA_LIFETIME) / MANTRA_FADEOUT_TIME;
      fadeProgress = constrain(fadeProgress, 0, 1);

      let eased =
        fadeProgress < 0.5
          ? 4 * fadeProgress * fadeProgress * fadeProgress
          : 1 - pow(-2 * fadeProgress + 2, 3) / 2;

      mantraAlpha = 255 * (1 - eased);

      mantra.targetScale = 1.0 + eased * 0.6;

      mantra.animatedRingIndex += eased * 0.5;
    } else if (!mantra.isNewlyCreated) {
      mantra.targetScale = mantra.pushScale;
    }

    if (!mantra.currentScale) mantra.currentScale = 1.0;

    if (!mantra.isNewlyCreated) {
      mantra.currentScale = lerp(mantra.currentScale, mantra.targetScale, 0.08);
    }

    mantraScale = mantra.currentScale;

    let symbolCount = mantra.symbolCount || SYMBOLS_PER_MANTRA;

    let imageIndex;
    if (targetRingIndex === 0) {
      imageIndex = 2;
    } else if (targetRingIndex === 1) {
      imageIndex = 1;
    } else {
      imageIndex = 0;
    }

    push();
    translate(width / 2, height / 2);
    scale(globalScale);
    rotate(mantra.rotation);
    scale(mantraScale);
    translate(-width / 2, -height / 2);

    push();
    translate(width / 2, height / 2);
    noFill();
    let ringColor = color(MANDALA_COLORS[imageIndex]);
    stroke(
      red(ringColor),
      green(ringColor),
      blue(ringColor),
      100 * (mantraAlpha / 255)
    );
    strokeWeight(1 / (globalScale * mantraScale));
    ellipse(0, 0, radius * 2, radius * 2);
    pop();

    for (let j = 0; j < symbolCount; j++) {
      let angle = (j * TWO_PI) / symbolCount - HALF_PI;
      drawMantraSymbol(angle, radius, 1.0, mantraAlpha, imageIndex);
    }

    pop();

    if (age > MANTRA_LIFETIME) {
      let fadeProgress = (age - MANTRA_LIFETIME) / MANTRA_FADEOUT_TIME;
      mantra.rotation += ROTATION_SPEED * (1 + fadeProgress * 3);
    } else {
      mantra.rotation += ROTATION_SPEED;
    }
  }

  if (activeCount > 0) {
    let ringIndex = 0;
    let radius = baseRadius + ringIndex * ringSpacing;

    animatedMantraRotation = lerp(
      animatedMantraRotation,
      currentMantraRotation,
      0.2
    );

    let progressImageIndex = 3;

    push();
    translate(width / 2, height / 2);
    scale(globalScale);
    rotate(animatedMantraRotation);
    translate(-width / 2, -height / 2);

    push();
    translate(width / 2, height / 2);
    noFill();
    let progressRingColor = color(MANDALA_COLORS[progressImageIndex]);
    stroke(
      red(progressRingColor),
      green(progressRingColor),
      blue(progressRingColor),
      150
    );
    strokeWeight(2 / globalScale);
    drawingContext.setLineDash([5, 10]);
    ellipse(0, 0, radius * 2, radius * 2);
    drawingContext.setLineDash([]);
    pop();

    for (let i = 0; i < activeCount; i++) {
      let angle = (i * TWO_PI) / activeCount - HALF_PI;
      let alpha = 255;
      drawMantraSymbol(angle, radius, 1.0, alpha, progressImageIndex);
    }

    pop();
  }
}

// Mandala symbol
function drawMantraSymbol(angle, radius, scale, alpha, imageIndex = null) {
  if (mantraImages.length === 0) return;

  push();
  translate(width / 2, height / 2);
  rotate(angle);

  // DECOR_TEXT_OFFSET
  let adjustedRadius = radius + DECOR_TEXT_OFFSET;
  translate(adjustedRadius, 0);
  rotate(HALF_PI + PI);

  let finalScale = scale;
  let imgWidth = symbolSize * symbolAspectRatio * finalScale;
  let imgHeight = symbolSize * finalScale;

  // image selection
  let selectedImage;
  if (
    imageIndex !== null &&
    imageIndex >= 0 &&
    imageIndex < mantraImages.length
  ) {
    selectedImage = mantraImages[imageIndex];
  } else {
    selectedImage = mantraImages[0];
  }

  if (!selectedImage) {
    pop();
    return;
  }

  // draw
  tint(255, alpha);
  imageMode(CENTER);
  image(selectedImage, 0, 0, imgWidth, imgHeight);
  noTint();

  drawDecorativeText(imgWidth, imgHeight, alpha, imageIndex);

  pop();
}

// decorative text around symbol
function drawDecorativeText(imgWidth, imgHeight, alpha, seedIndex) {
  let words = [
    "NAME",
    "KINGDOM",
    "WILL",
    "BREAD",
    "FORGIVENESS",
    "TEMPTATION",
    "DELIVERANCE",
  ];
  let wordCount = words.length;

  let decorRadius = imgWidth * DECOR_TEXT_RADIUS_RATIO;

  let mandalaColor = MANDALA_COLORS[seedIndex % MANDALA_COLORS.length];

  push();
  textAlign(CENTER, CENTER);
  if (decorFont) {
    textFont(decorFont);
  }

  for (let i = 0; i < wordCount; i++) {
    let baseAngle = (i * TWO_PI) / wordCount - HALF_PI;
    let rotationOffset = frameCount * DECOR_TEXT_ROTATION_SPEED;
    let angle = baseAngle + rotationOffset;

    let x = cos(angle) * decorRadius + DECOR_TEXT_CENTER_X;
    let y = sin(angle) * decorRadius + DECOR_TEXT_CENTER_Y;

    push();
    translate(x, y);

    let textRotation = angle + HALF_PI;
    rotate(textRotation);

    let textSizeVal = imgWidth * 0.09;

    let c = color(mandalaColor);
    fill(red(c), green(c), blue(c), alpha * 0.95);
    noStroke();
    textSize(textSizeVal);
    text(words[i], 0, 0);
    pop();
  }

  pop();
}

function displayCompletionState(activeCount = 0) {
  if (activeCount >= 2 && currentProgress > 0) {
    push();
    translate(width / 2, height / 2);

    let progressImageIndex = 3;
    let progressColor = color(MANDALA_COLORS[progressImageIndex]);

    noFill();
    stroke(red(progressColor), green(progressColor), blue(progressColor), 80);
    strokeWeight(1);
    let outerRadius = 35;
    ellipse(0, 0, outerRadius * 2, outerRadius * 2);

    stroke(red(progressColor), green(progressColor), blue(progressColor), 200);
    strokeWeight(2.5);
    noFill();
    let startAngle = -HALF_PI;
    let endAngle = startAngle + TWO_PI * currentProgress;
    arc(0, 0, outerRadius * 2, outerRadius * 2, startAngle, endAngle);

    let pulseAmount = sin(frameCount * 0.1) * 0.15 + 0.85;
    let innerRadius = 20 * pulseAmount;
    fill(
      red(progressColor),
      green(progressColor),
      blue(progressColor),
      100 * currentProgress
    );
    noStroke();
    ellipse(0, 0, innerRadius * 2, innerRadius * 2);

    fill(
      red(progressColor),
      green(progressColor),
      blue(progressColor),
      255 * currentProgress
    );
    ellipse(0, 0, 8, 8);

    let dotCount = 7;
    for (let i = 0; i < dotCount; i++) {
      let angle = (i * TWO_PI) / dotCount + frameCount * 0.02 - HALF_PI;
      let dotX = cos(angle) * (outerRadius + 8);
      let dotY = sin(angle) * (outerRadius + 8);

      let dotProgress = currentProgress * dotCount - i;
      dotProgress = constrain(dotProgress, 0, 1);

      fill(
        red(progressColor),
        green(progressColor),
        blue(progressColor),
        200 * dotProgress
      );
      ellipse(dotX, dotY, 5, 5);
    }

    pop();
  }
}

function displayLordsPrayer(activeCount = 0) {
  let globalScale = currentScale;

  let sortedMantras = [...completedMantras].sort(
    (a, b) => b.birthOrder - a.birthOrder
  );

  for (let i = 0; i < sortedMantras.length; i++) {
    let mantra = sortedMantras[i];
    let targetRingIndex = i;

    if (mantra.prayerWords && mantra.prayerWords.length > 0) {
      let textRadius =
        baseRadius +
        (mantra.animatedRingIndex + 1) * ringSpacing +
        symbolSize * 0.3;

      // color selection (ring index)
      let imageIndex;
      if (targetRingIndex === 0) {
        imageIndex = 2;
      } else if (targetRingIndex === 1) {
        imageIndex = 1;
      } else {
        imageIndex = 0;
      }

      let textColor = color(MANDALA_COLORS[imageIndex]);

      // fade out
      let mantraAlpha = 255;
      let age = millis() - mantra.createdTime;
      if (age > MANTRA_LIFETIME) {
        let fadeProgress = (age - MANTRA_LIFETIME) / MANTRA_FADEOUT_TIME;
        fadeProgress = constrain(fadeProgress, 0, 1);
        let eased =
          fadeProgress < 0.5
            ? 4 * fadeProgress * fadeProgress * fadeProgress
            : 1 - pow(-2 * fadeProgress + 2, 3) / 2;
        mantraAlpha = 255 * (1 - eased);
      }

      push();
      translate(width / 2, height / 2);
      scale(globalScale);
      rotate(mantra.rotation);
      scale(mantra.currentScale || 1.0);
      translate(-width / 2, -height / 2);

      drawCircularText(mantra.prayerWords, textRadius, textColor, mantraAlpha);

      pop();
    }
  }

  if (activeCount >= 2 && currentProgress > 0) {
    // linear text
    let elapsedTime = millis() - touchStartTime;
    let linearProgress = constrain(elapsedTime / COMPLETION_TIME, 0, 1);
    let wordCount = floor(linearProgress * LORDS_PRAYER.length);

    let wordsToShow = [];
    for (let i = 0; i < wordCount && i < LORDS_PRAYER.length; i++) {
      if (LORDS_PRAYER[i] !== "") {
        wordsToShow.push(LORDS_PRAYER[i]);
      }
    }

    if (wordsToShow.length > 0) {
      let ringIndex = 0;
      let textRadius = baseRadius + ringIndex * ringSpacing + symbolSize * 0.3;
      let progressImageIndex = 3;
      let textColor = color(MANDALA_COLORS[progressImageIndex]);

      push();
      translate(width / 2, height / 2);
      scale(globalScale);
      rotate(animatedMantraRotation);
      translate(-width / 2, -height / 2);

      drawCircularText(wordsToShow, textRadius, textColor, 255);

      pop();
    }
  }
}

function drawCircularText(words, radius, textColor, alpha) {
  if (words.length === 0) return;

  textAlign(CENTER, CENTER);
  textSize(84);
  if (prayerFont) {
    textFont(prayerFont);
  } else {
    textFont("serif");
  }
  textStyle(BOLD);

  let wordWidths = [];
  let totalWidth = 0;
  for (let i = 0; i < words.length; i++) {
    let w = textWidth(words[i]);
    wordWidths.push(w);
    totalWidth += w;
  }

  let avgWidth = totalWidth / words.length;
  let spacingWidth = avgWidth * 0.3;
  let totalWidthWithSpacing = totalWidth + spacingWidth * words.length;

  let currentAngle = -HALF_PI;

  for (let i = 0; i < words.length; i++) {
    push();

    let wordProportion = (wordWidths[i] + spacingWidth) / totalWidthWithSpacing;
    let wordAngle = TWO_PI * wordProportion;
    let centerAngle = currentAngle + wordAngle / 2;

    let x = width / 2 + cos(centerAngle) * radius;
    let y = height / 2 + sin(centerAngle) * radius;

    translate(x, y);

    if (centerAngle > HALF_PI && centerAngle < PI + HALF_PI) {
      rotate(centerAngle + HALF_PI + PI);
    } else {
      rotate(centerAngle + HALF_PI);
    }

    fill(red(textColor), green(textColor), blue(textColor), alpha);
    noStroke();

    text(words[i], 0, 0);

    pop();

    currentAngle += wordAngle;
  }
}

// ============================================
// Utility Functions
// ============================================

function countActiveTouches() {
  let count = 0;
  for (let uid in activeTouches) {
    if (activeTouches[uid].active) {
      count++;
    }
  }
  return count;
}

function refreshConnectionCount() {
  if (testMode) {
    connectedUsers = Object.keys(activeTouches).length;
  }
}

function updateMantraLifetime() {
  let currentTime = millis();

  completedMantras = completedMantras.filter((mantra) => {
    let age = currentTime - mantra.createdTime;
    return age < MANTRA_LIFETIME + MANTRA_FADEOUT_TIME;
  });
}

function updateCompletionProgress() {
  let activeCount = countActiveTouches();

  if (activeCount !== lastActiveCount && activeCount >= 2) {
    touchStartTime = millis();
    currentProgress = 0;

    if (prayerSound) {
      if (prayerSound.isPlaying()) {
        prayerSound.stop();
      }
      prayerSound.play();
    }
  }

  if (activeCount >= 2) {
    if (touchStartTime === 0 && !hasCompletedCurrentMantra) {
      touchStartTime = millis();

      if (prayerSound && !prayerSound.isPlaying()) {
        prayerSound.play();
      }
    }

    if (touchStartTime > 0) {
      let elapsedTime = millis() - touchStartTime;
      let linearProgress = constrain(elapsedTime / COMPLETION_TIME, 0, 1);

      // ease-in-out cubic
      currentProgress =
        linearProgress < 0.5
          ? 4 * linearProgress * linearProgress * linearProgress
          : 1 - pow(-2 * linearProgress + 2, 3) / 2;
    }

    if (
      touchStartTime > 0 &&
      currentProgress >= 1 &&
      !hasCompletedCurrentMantra
    ) {
      // ===== flash =====
      completionFlash.active = true;
      completionFlash.startTime = millis();

      hasCompletedCurrentMantra = true;
      touchStartTime = 0;
      currentProgress = 0;

      // mandala 완성

      let completedWords = [];
      for (let i = 0; i < LORDS_PRAYER.length; i++) {
        if (LORDS_PRAYER[i] !== "") {
          completedWords.push(LORDS_PRAYER[i]);
        }
      }

      completedMantras.push({
        rotation: currentMantraRotation,
        createdTime: millis(),
        ringIndex: completedMantras.length,
        targetScale: 1.0,
        currentScale: 0.3,
        symbolCount: activeCount,
        animatedRingIndex: 0,
        birthOrder: totalMantraCount,
        isNewlyCreated: true,
        prayerWords: completedWords,
      });

      totalMantraCount++;

      if (completedMantras.length > MAX_MANTRAS) {
        completedMantras.shift();
      }
    }

    currentMantraRotation += ROTATION_SPEED * 0.5;
  } else if (activeCount === 1) {
    currentMantraRotation += ROTATION_SPEED * 0.15;
    touchStartTime = 0;
    currentProgress = 0;
    hasCompletedCurrentMantra = false;

    if (prayerSound && prayerSound.isPlaying()) {
      prayerSound.stop();
    }
  } else {
    touchStartTime = 0;
    currentProgress = 0;
    hasCompletedCurrentMantra = false;
    currentMantraRotation += ROTATION_SPEED * 0.1;

    if (prayerSound && prayerSound.isPlaying()) {
      prayerSound.stop();
    }
  }

  lastActiveCount = activeCount;
  return activeCount;
}

// responsive size calculation(반응형 디바이스)
function calculateResponsiveSizes() {
  let diagonal = sqrt(width * width + height * height);

  baseRadius = diagonal * BASE_RADIUS_RATIO;
  ringSpacing = diagonal * RING_SPACING_RATIO;
  symbolSize = diagonal * SYMBOL_SIZE_RATIO;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateResponsiveSizes();
}

// ============================================
// Test Mode
// ============================================

// 가상 사용자 생성
function createVirtualUser() {
  let virtualUserId =
    "test_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  virtualUsers.push(virtualUserId);

  // activeTouches
  activeTouches[virtualUserId] = {
    active: true,
    x: random(0.3, 0.7),
    y: random(0.3, 0.7),
    visualLayer: null,
  };

  refreshConnectionCount();
}

function removeVirtualUser() {
  if (virtualUsers.length > 0) {
    let removedUserId = virtualUsers.pop();
    delete activeTouches[removedUserId];
    refreshConnectionCount();
  }
}

function removeAllVirtualUsers() {
  virtualUsers.forEach((uid) => {
    delete activeTouches[uid];
  });

  virtualUsers = [];
  refreshConnectionCount();
}

function setVirtualUserCount(count) {
  removeAllVirtualUsers();

  for (let i = 0; i < count; i++) {
    createVirtualUser();
  }
}

function keyPressed() {
  if (testMode) {
    if (key >= "1" && key <= "9") {
      let count = parseInt(key);
      setVirtualUserCount(count);
      return false;
    }

    if (key === "0") {
      removeAllVirtualUsers();
      return false;
    }

    if (key === "+" || key === "=") {
      createVirtualUser();
      return false;
    }

    if (key === "-" || key === "_") {
      removeVirtualUser();
      return false;
    }
  }
}
