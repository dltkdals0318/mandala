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
  availableSpace *= 1.3; // 여백 -30% (화면보다 30% 더 크게 허용)

  if (requiredSpace > availableSpace) {
    return availableSpace / requiredSpace;
  }

  // 기본 스케일 1.0으로 복원
  return 1.0;
}

function renderVisualLayers(activeCount = 0) {
  targetScale = calculateGlobalScale(activeCount);
  currentScale = lerp(currentScale, targetScale, SCALE_LERP_AMOUNT);
  let globalScale = currentScale;

  // 완성된 만트라들을 birthOrder 내림차순 정렬 (최신이 앞에)
  let sortedMantras = [...completedMantras].sort(
    (a, b) => b.birthOrder - a.birthOrder
  );

  for (let i = 0; i < sortedMantras.length; i++) {
    let mantra = sortedMantras[i];

    // 정렬된 배열에서의 인덱스 = 목표 링 인덱스
    let targetRingIndex = i;

    // 처음 생성될 때만 animatedRingIndex 초기화
    if (mantra.animatedRingIndex === undefined) {
      // 첫 번째 만트라(birthOrder=0)는 즉시 목표 위치에 배치
      if (mantra.birthOrder === 0) {
        mantra.animatedRingIndex = targetRingIndex;
      } else {
        // 두 번째 이후는 중앙에서 시작하여 애니메이션
        mantra.animatedRingIndex = 0;
      }
    }

    // 이전 목표 링 인덱스 저장 (처음 초기화)
    if (mantra.prevTargetRingIndex === undefined) {
      mantra.prevTargetRingIndex = targetRingIndex;
    }

    // 목표 링이 변경되었는지 확인 (새로운 만다라가 밀어냄)
    let isPushedOut = targetRingIndex > mantra.prevTargetRingIndex;
    if (isPushedOut) {
      mantra.prevTargetRingIndex = targetRingIndex;
      // 밀려날 때 확장 애니메이션 시작
      if (!mantra.pushScale) mantra.pushScale = 1.0;
      mantra.targetPushScale = 1.15; // 15% 확장
    }

    // 목표 링으로 부드럽게 이동 (안쪽에서 바깥쪽으로)
    mantra.animatedRingIndex = lerp(
      mantra.animatedRingIndex,
      targetRingIndex,
      0.08
    );

    // 반지름 계산: ring 0이 진행중인 만트라 위치이므로, 완성된 만트라는 +1부터 시작
    let radius = baseRadius + (mantra.animatedRingIndex + 1) * ringSpacing;

    let mantraAlpha = 255;
    let mantraScale = 1.0;
    let age = millis() - mantra.createdTime;

    // 새로 생성된 만다라 초기 등장 애니메이션
    if (mantra.isNewlyCreated) {
      // 생성 후 1초 동안 등장 애니메이션 적용
      let birthAge = age;
      let birthDuration = 1000; // 1초

      if (birthAge < birthDuration) {
        let birthProgress = birthAge / birthDuration;
        // ease-out cubic으로 부드럽게 확대
        let eased = 1 - pow(1 - birthProgress, 3);

        // 30%에서 100%로 확대되며 등장
        let birthScale = 0.3 + eased * 0.7;
        mantra.currentScale = birthScale;

        // 투명도도 페이드인
        mantraAlpha = 255 * eased;
      } else {
        // 등장 애니메이션 완료
        mantra.isNewlyCreated = false;
      }
    }

    // 밀려나는 확장 효과 처리
    if (!mantra.pushScale) mantra.pushScale = 1.0;
    if (!mantra.targetPushScale) mantra.targetPushScale = 1.0;

    // 확장 후 원래 크기로 부드럽게 복귀
    mantra.pushScale = lerp(mantra.pushScale, mantra.targetPushScale, 0.1);
    if (mantra.pushScale > 1.01) {
      mantra.targetPushScale = lerp(mantra.targetPushScale, 1.0, 0.05);
    }

    // 페이드아웃 처리 (바깥으로 밀려나면서 자연스럽게 확장)
    if (age > MANTRA_LIFETIME) {
      let fadeProgress = (age - MANTRA_LIFETIME) / MANTRA_FADEOUT_TIME;
      fadeProgress = constrain(fadeProgress, 0, 1);

      let eased =
        fadeProgress < 0.5
          ? 4 * fadeProgress * fadeProgress * fadeProgress
          : 1 - pow(-2 * fadeProgress + 2, 3) / 2;

      mantraAlpha = 255 * (1 - eased);

      // 바깥으로 나가면서 점진적으로 크기 증가 (1.0 → 1.6)
      mantra.targetScale = 1.0 + eased * 0.6;

      // 바깥으로 밀려나는 효과 (animatedRingIndex 증가, 더 부드럽게)
      mantra.animatedRingIndex += eased * 0.5;
    } else if (!mantra.isNewlyCreated) {
      // 페이드아웃 전이고 등장 애니메이션 완료: 밀려나는 확장 효과 적용
      mantra.targetScale = mantra.pushScale;
    }

    if (!mantra.currentScale) mantra.currentScale = 1.0;

    // 등장 애니메이션 중이 아닐 때만 보간 적용
    if (!mantra.isNewlyCreated) {
      mantra.currentScale = lerp(mantra.currentScale, mantra.targetScale, 0.08);
    }

    mantraScale = mantra.currentScale;

    // 심볼 개수와 이미지 인덱스 먼저 가져오기
    let symbolCount = mantra.symbolCount || SYMBOLS_PER_MANTRA;

    // 위치에 따라 동적으로 이미지 인덱스 결정 (4→3→2→1)
    // targetRingIndex: 0=첫번째링, 1=두번째링, 2=세번째링, 3=네번째링...
    let imageIndex;
    if (targetRingIndex === 0) {
      imageIndex = 2; // 첫 번째 링 → 3번 이미지 (세 번째로 진함)
    } else if (targetRingIndex === 1) {
      imageIndex = 1; // 두 번째 링 → 2번 이미지 (두 번째로 진함)
    } else {
      imageIndex = 0; // 세 번째 링 이후 → 1번 이미지 (가장 연함)
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
    // 만다라 색상에 맞춰 원형 선 색상 설정
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
    // 진행 중인 만트라는 항상 첫 번째 링(중앙)에 표시
    let ringIndex = 0;
    let radius = baseRadius + ringIndex * ringSpacing;

    animatedMantraRotation = lerp(
      animatedMantraRotation,
      currentMantraRotation,
      0.2
    );

    // 진행 중인 만다라는 항상 4번 이미지(인덱스 3) 사용
    let progressImageIndex = 3; // 4번 이미지

    push();
    translate(width / 2, height / 2);
    scale(globalScale);
    rotate(animatedMantraRotation);
    translate(-width / 2, -height / 2);

    push();
    translate(width / 2, height / 2);
    noFill();
    // 진행 중인 만트라는 4번 이미지 색상 사용
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

// 만다라 심볼 그리기 (이미지 + 장식 텍스트)
function drawMantraSymbol(angle, radius, scale, alpha, imageIndex = null) {
  if (mantraImages.length === 0) return;

  push();
  translate(width / 2, height / 2);
  rotate(angle);

  // DECOR_TEXT_OFFSET을 적용하여 만다라 중심점 위치 조정
  let adjustedRadius = radius + DECOR_TEXT_OFFSET;
  translate(adjustedRadius, 0);
  rotate(HALF_PI + PI);

  let finalScale = scale;
  let imgWidth = symbolSize * symbolAspectRatio * finalScale;
  let imgHeight = symbolSize * finalScale;

  // 이미지 선택
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

  // 만다라 이미지 그리기
  tint(255, alpha);
  imageMode(CENTER);
  image(selectedImage, 0, 0, imgWidth, imgHeight);
  noTint();

  // 장식 텍스트 효과 추가
  drawDecorativeText(imgWidth, imgHeight, alpha, imageIndex);

  pop();
}

// 장식 효과 - 영어 단어를 원형으로 배치하며 회전
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

  // 설정 가능한 반지름 사용
  let decorRadius = imgWidth * DECOR_TEXT_RADIUS_RATIO;

  // 만다라 색상 가져오기
  let mandalaColor = MANDALA_COLORS[seedIndex % MANDALA_COLORS.length];

  push();
  textAlign(CENTER, CENTER);
  if (decorFont) {
    textFont(decorFont);
  }

  for (let i = 0; i < wordCount; i++) {
    // frameCount를 이용한 회전 효과 (시계방향으로 회전 - 중심원과 동일)
    let baseAngle = (i * TWO_PI) / wordCount - HALF_PI; // -90도부터 시작
    let rotationOffset = frameCount * DECOR_TEXT_ROTATION_SPEED; // 시계방향 (양수)
    let angle = baseAngle + rotationOffset;

    // X/Y 중심점 조정 적용
    let x = cos(angle) * decorRadius + DECOR_TEXT_CENTER_X;
    let y = sin(angle) * decorRadius + DECOR_TEXT_CENTER_Y;

    push();
    translate(x, y);

    // 텍스트가 바깥쪽을 향하도록 회전
    let textRotation = angle + HALF_PI;
    rotate(textRotation);

    let textSizeVal = imgWidth * 0.09; // 이미지 크기의 10% (더 작게 조정)

    // 만다라 색상 사용 (투명도 높게 - 0.95로 증가)
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
  // 2명 이상일 때 진행도 표시 (주술적인 원형 디자인)
  if (activeCount >= 2 && currentProgress > 0) {
    push();
    translate(width / 2, height / 2);

    // 진행 중인 만다라는 항상 4번 색상
    let progressImageIndex = 3; // 4번 이미지 색상
    let progressColor = color(MANDALA_COLORS[progressImageIndex]);

    // 외곽 원 (고정) - 매우 얇고 은은하게
    noFill();
    stroke(red(progressColor), green(progressColor), blue(progressColor), 80);
    strokeWeight(1);
    let outerRadius = 35;
    ellipse(0, 0, outerRadius * 2, outerRadius * 2);

    // 진행도 원호 (시계방향으로 채워짐)
    stroke(red(progressColor), green(progressColor), blue(progressColor), 200);
    strokeWeight(2.5);
    noFill();
    let startAngle = -HALF_PI; // 12시 방향부터 시작
    let endAngle = startAngle + TWO_PI * currentProgress;
    arc(0, 0, outerRadius * 2, outerRadius * 2, startAngle, endAngle);

    // 내부 펄스 원 (맥박처럼 뛰는 효과)
    let pulseAmount = sin(frameCount * 0.1) * 0.15 + 0.85; // 0.7 ~ 1.0
    let innerRadius = 20 * pulseAmount;
    fill(
      red(progressColor),
      green(progressColor),
      blue(progressColor),
      100 * currentProgress
    );
    noStroke();
    ellipse(0, 0, innerRadius * 2, innerRadius * 2);

    // 중앙 발광 점
    fill(
      red(progressColor),
      green(progressColor),
      blue(progressColor),
      255 * currentProgress
    );
    ellipse(0, 0, 8, 8);

    // 회전하는 7개의 점들 (7명이 함께 기도하는 의미)
    let dotCount = 7;
    for (let i = 0; i < dotCount; i++) {
      let angle = (i * TWO_PI) / dotCount + frameCount * 0.02 - HALF_PI; // -90도부터 시작 (위쪽)
      let dotX = cos(angle) * (outerRadius + 8);
      let dotY = sin(angle) * (outerRadius + 8);

      // 진행도에 따라 점이 나타남
      let dotProgress = currentProgress * dotCount - i;
      dotProgress = constrain(dotProgress, 0, 1);

      fill(
        red(progressColor),
        green(progressColor),
        blue(progressColor),
        200 * dotProgress
      );
      ellipse(dotX, dotY, 5, 5); // 크기 4 → 5로 증가
    }

    pop();
  }
}

// 주기도문 표시 (원형으로 만다라 주변에 배치)
function displayLordsPrayer(activeCount = 0) {
  let globalScale = currentScale;

  // 1. 완성된 만트라들의 텍스트 표시 (항상 유지)
  // 위치 기반으로 색상 결정을 위해 정렬
  let sortedMantras = [...completedMantras].sort(
    (a, b) => b.birthOrder - a.birthOrder
  );

  for (let i = 0; i < sortedMantras.length; i++) {
    let mantra = sortedMantras[i];
    let targetRingIndex = i; // 정렬된 인덱스 = 목표 링 인덱스

    // 만트라에 저장된 텍스트가 있으면 표시
    if (mantra.prayerWords && mantra.prayerWords.length > 0) {
      let textRadius =
        baseRadius +
        (mantra.animatedRingIndex + 1) * ringSpacing +
        symbolSize * 0.3;

      // 위치에 따라 동적으로 색상 결정 (4→3→2→1)
      let imageIndex;
      if (targetRingIndex === 0) {
        imageIndex = 2; // 첫 번째 링 → 3번 색상
      } else if (targetRingIndex === 1) {
        imageIndex = 1; // 두 번째 링 → 2번 색상
      } else {
        imageIndex = 0; // 세 번째 링 이후 → 1번 색상
      }

      let textColor = color(MANDALA_COLORS[imageIndex]);

      // 페이드아웃 처리
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

  // 2. 진행 중인 만트라 텍스트 표시 (점진적으로 나타남)
  if (activeCount >= 2 && currentProgress > 0) {
    // 텍스트는 linear하게 등장
    let elapsedTime = millis() - touchStartTime;
    let linearProgress = constrain(elapsedTime / COMPLETION_TIME, 0, 1);
    let wordCount = floor(linearProgress * LORDS_PRAYER.length);

    // 빈 문자열 제외한 실제 단어들만 필터링
    let wordsToShow = [];
    for (let i = 0; i < wordCount && i < LORDS_PRAYER.length; i++) {
      if (LORDS_PRAYER[i] !== "") {
        wordsToShow.push(LORDS_PRAYER[i]);
      }
    }

    if (wordsToShow.length > 0) {
      let ringIndex = 0;
      let textRadius = baseRadius + ringIndex * ringSpacing + symbolSize * 0.3;
      // 진행 중인 만다라는 항상 4번 색상
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

// 원형 텍스트 그리기 헬퍼 함수 (단어 폭 기반 균등 배치)
function drawCircularText(words, radius, textColor, alpha) {
  if (words.length === 0) return;

  textAlign(CENTER, CENTER);
  textSize(84); // 크기 증가 (72 → 84)
  if (prayerFont) {
    textFont(prayerFont);
  } else {
    textFont("serif");
  }
  textStyle(BOLD); // 굵게 설정

  // 1단계: 각 단어의 폭 측정 및 총 폭 계산
  let wordWidths = [];
  let totalWidth = 0;
  for (let i = 0; i < words.length; i++) {
    let w = textWidth(words[i]);
    wordWidths.push(w);
    totalWidth += w;
  }

  // 2단계: 단어 간 최소 간격 추가 (각 단어 사이에 평균 폭의 30% 간격)
  let avgWidth = totalWidth / words.length;
  let spacingWidth = avgWidth * 0.3; // 간격을 평균 폭의 30%로 설정
  let totalWidthWithSpacing = totalWidth + spacingWidth * words.length;

  // 3단계: 각 단어에 비례적으로 각도 할당
  let currentAngle = -HALF_PI; // 12시 방향부터 시작

  for (let i = 0; i < words.length; i++) {
    push();

    // 현재 단어의 중심 각도 계산 (폭의 절반만큼 이동)
    let wordProportion = (wordWidths[i] + spacingWidth) / totalWidthWithSpacing;
    let wordAngle = TWO_PI * wordProportion;
    let centerAngle = currentAngle + wordAngle / 2;

    let x = width / 2 + cos(centerAngle) * radius;
    let y = height / 2 + sin(centerAngle) * radius;

    translate(x, y);

    // 텍스트가 원을 따라 회전
    if (centerAngle > HALF_PI && centerAngle < PI + HALF_PI) {
      rotate(centerAngle + HALF_PI + PI);
    } else {
      rotate(centerAngle + HALF_PI);
    }

    // 텍스트 색상 - 만다라 색상과 동일하게
    fill(red(textColor), green(textColor), blue(textColor), alpha);
    noStroke();

    text(words[i], 0, 0);

    pop();

    // 다음 단어를 위해 각도 이동
    currentAngle += wordAngle;
  }
}

// ============================================
// 11. 유틸리티 함수
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

// 오래된 만트라 제거 및 페이드아웃 처리
function updateMantraLifetime() {
  // 생존 시간이 지난 만트라들을 필터링하여 제거
  let currentTime = millis();

  completedMantras = completedMantras.filter((mantra) => {
    let age = currentTime - mantra.createdTime;
    // 생존 시간 + 페이드아웃 시간이 지나면 제거
    return age < MANTRA_LIFETIME + MANTRA_FADEOUT_TIME;
  });
}

// 만트라 완성 진행도 업데이트
function updateCompletionProgress() {
  let activeCount = countActiveTouches();

  // 사람 수가 변경되었는지 체크
  if (activeCount !== lastActiveCount && activeCount >= 2) {
    // 사람 수가 변경되면 진행도 초기화 (2명 이상일 때만)
    touchStartTime = millis();
    currentProgress = 0;

    // 기도 오디오 재시작
    if (prayerSound) {
      if (prayerSound.isPlaying()) {
        prayerSound.stop();
      }
      prayerSound.play();
    }
  }

  // 2명 이상이 터치하고 있으면 진행도 시작
  if (activeCount >= 2) {
    // 처음 터치 시작 (완성된 적이 없을 때만)
    if (touchStartTime === 0 && !hasCompletedCurrentMantra) {
      touchStartTime = millis();

      // 기도 오디오 재생 시작
      if (prayerSound && !prayerSound.isPlaying()) {
        prayerSound.play();
      }
    }

    // 진행도 계산 (터치 시작된 경우에만)
    if (touchStartTime > 0) {
      let elapsedTime = millis() - touchStartTime;
      let linearProgress = constrain(elapsedTime / COMPLETION_TIME, 0, 1);

      // ease-in-out cubic (더 드라마틱한 가속/감속)
      currentProgress =
        linearProgress < 0.5
          ? 4 * linearProgress * linearProgress * linearProgress
          : 1 - pow(-2 * linearProgress + 2, 3) / 2;
    }

    // 완성 체크 (27초 경과) - 아직 완성하지 않았을 때만
    if (
      touchStartTime > 0 &&
      currentProgress >= 1 &&
      !hasCompletedCurrentMantra
    ) {
      // ===== 플래시 효과 시작 =====
      completionFlash.active = true;
      completionFlash.startTime = millis();

      // 만트라 완성 플래그 설정 및 진행 초기화
      hasCompletedCurrentMantra = true;
      touchStartTime = 0; // 새로운 터치 세션 필요
      currentProgress = 0;

      // 만트라 완성! (현재 접속자 수만큼 심볼 생성)
      // 이미지는 위치에 따라 동적으로 결정되므로 여기서는 저장하지 않음

      // 완성된 텍스트 저장 (전체 주기도문)
      let completedWords = [];
      for (let i = 0; i < LORDS_PRAYER.length; i++) {
        if (LORDS_PRAYER[i] !== "") {
          completedWords.push(LORDS_PRAYER[i]);
        }
      }

      completedMantras.push({
        rotation: currentMantraRotation,
        createdTime: millis(), // 생성 시간 기록
        ringIndex: completedMantras.length, // 고정된 링 인덱스 저장
        targetScale: 1.0, // 목표 스케일
        currentScale: 0.3, // 생성 시 작은 크기에서 시작 (30%)
        symbolCount: activeCount, // 완성 당시의 접속자 수 저장
        // imageIndex는 위치에 따라 동적으로 결정됨
        animatedRingIndex: 0, // 가장 안쪽에서 시작 (중앙에서 완성됨)
        birthOrder: totalMantraCount, // 생성 순서 (정렬용)
        isNewlyCreated: true, // 새로 생성된 만다라 표시
        prayerWords: completedWords, // 완성된 주기도문 텍스트 저장
      });

      totalMantraCount++; // 전체 생성 횟수 증가

      // 최대 개수 제한 (오래된 것부터 제거)
      if (completedMantras.length > MAX_MANTRAS) {
        completedMantras.shift(); // 가장 오래된 만트라 제거
      }

      // 회전은 연속적으로 유지 (초기화 안 함)
    }

    // 현재 진행 중인 만트라 회전
    currentMantraRotation += ROTATION_SPEED * 0.5; // 완성 전에는 천천히 회전
  } else if (activeCount === 1) {
    // 1명일 때는 진행도는 안 올라가지만 회전은 함
    currentMantraRotation += ROTATION_SPEED * 0.3; // 더 천천히 회전
    touchStartTime = 0;
    currentProgress = 0;
    hasCompletedCurrentMantra = false; // 완성 플래그 초기화

    // 기도 오디오 정지
    if (prayerSound && prayerSound.isPlaying()) {
      prayerSound.stop();
    }
  } else {
    // 아무도 없으면 진행도만 초기화 (회전은 부드럽게 감속)
    touchStartTime = 0;
    currentProgress = 0;
    hasCompletedCurrentMantra = false; // 완성 플래그 초기화
    // 회전 속도를 점진적으로 줄임
    currentMantraRotation += ROTATION_SPEED * 0.1;

    // 기도 오디오 정지
    if (prayerSound && prayerSound.isPlaying()) {
      prayerSound.stop();
    }
  }

  // 현재 활성 사용자 수 저장
  lastActiveCount = activeCount;
  return activeCount;
}

// 반응형 크기 계산
function calculateResponsiveSizes() {
  // 화면 대각선 길이 계산
  let diagonal = sqrt(width * width + height * height);

  // 화면 크기에 비례하여 크기 계산
  baseRadius = diagonal * BASE_RADIUS_RATIO;
  ringSpacing = diagonal * RING_SPACING_RATIO;
  symbolSize = diagonal * SYMBOL_SIZE_RATIO;
}

// 윈도우 크기 변경 대응
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateResponsiveSizes();
}

// ============================================
// 12. 테스트 모드 함수들
// ============================================

// 가상 사용자 생성
function createVirtualUser() {
  let virtualUserId =
    "test_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  virtualUsers.push(virtualUserId);

  // activeTouches에 추가
  activeTouches[virtualUserId] = {
    active: true,
    x: random(0.3, 0.7), // 랜덤 위치
    y: random(0.3, 0.7),
    visualLayer: null,
  };

  refreshConnectionCount();
}

// 가상 사용자 제거
function removeVirtualUser() {
  if (virtualUsers.length > 0) {
    let removedUserId = virtualUsers.pop();
    delete activeTouches[removedUserId];
    refreshConnectionCount();
  }
}

// 모든 가상 사용자 제거
function removeAllVirtualUsers() {
  virtualUsers.forEach((uid) => {
    delete activeTouches[uid];
  });

  virtualUsers = [];
  refreshConnectionCount();
}

// 특정 개수의 가상 사용자 설정
function setVirtualUserCount(count) {
  // 기존 가상 사용자 모두 제거
  removeAllVirtualUsers();

  // 새로운 가상 사용자 생성
  for (let i = 0; i < count; i++) {
    createVirtualUser();
  }
}

// 키보드 입력 처리
function keyPressed() {
  if (testMode) {
    // 숫자 키 1-9: 해당 개수만큼 가상 사용자 생성
    if (key >= "1" && key <= "9") {
      let count = parseInt(key);
      setVirtualUserCount(count);
      return false;
    }

    // 0: 모든 가상 사용자 제거
    if (key === "0") {
      removeAllVirtualUsers();
      return false;
    }

    // +: 사용자 1명 추가
    if (key === "+" || key === "=") {
      createVirtualUser();
      return false;
    }

    // -: 사용자 1명 제거
    if (key === "-" || key === "_") {
      removeVirtualUser();
      return false;
    }
  }
}
