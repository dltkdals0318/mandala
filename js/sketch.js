// ============================================
// 디지털 공동체 만트라 - Digital Collective Mantra
// ============================================

// ============================================
// 1. Firebase 설정 및 초기화
// ============================================

// Firebase 설정 (sm-mandara 프로젝트)
// Firebase SDK는 index.html에서 로드됨 (compat 버전)
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

// Firebase 초기화
let database;
let usersRef;
let myConnectionRef;
let userId;
let heartbeatInterval = null; // heartbeat 인터벌 ID 저장

// ============================================
// 2. 전역 상태 변수
// ============================================

// 접속자 관리
let connectedUsers = 0;
let activeTouches = {}; // 모든 사용자의 터치 데이터 저장

// 오디오 관리
let audioLayers = []; // 7개의 오디오 레이어
const MAX_LAYERS = 7; // 최대 레이어 수 (완전한 만트라를 위해 필요한 사람 수)
let prayerSound; // 기도 오디오 (pray.mp3)

// 폰트 관리
let prayerFont; // 주기도문 텍스트용 폰트
let titleFont; // "하나님의 자녀" 타이틀용 폰트
let decorFont; // 만다라 주변 장식 텍스트용 폰트 (Tikkeul)

// 비주얼 관리
let mantraImg; // 만트라 심볼 이미지 (레거시, 사용 안 함)
let mantraImages = []; // 6개의 만다라 이미지 배열

// 만다라 색상 코드 (1~6) - visual.js와 동기화
const MANDALA_COLORS = [
  "#ae00ff", // 만다라 1
  "#ffffff", // 만다라 2
  "#00ff2a", // 만다라 3
  "#ffe000", // 만다라 4
  "#0000ff", // 만다라 5
  "#ff0000", // 만다라 6
];

// 텍스트 만다라용 패턴 정의 - 원형 패턴만 사용
const TEXT_PATTERNS = [
  "circular", // 원형 패턴 (유일한 패턴)
];

// 완성 플래시 효과
let completionFlash = {
  active: false,
  startTime: 0,
  duration: 400, // 0.4초로 단축
};

// 반응형 크기 설정 (화면 크기의 비율) - 2배로 증가
let BASE_RADIUS_RATIO = 0.96; // 0.48 * 2
let RING_SPACING_RATIO = 0.72; // 0.36 * 2
let SYMBOL_SIZE_RATIO = 1.2; // 0.60 * 2

// ===== 만다라 주변 텍스트 회전 설정 (여기서 조정 가능) =====
let DECOR_TEXT_RADIUS_RATIO = 0.6; // 이미지 크기 대비 텍스트 반지름 (0.0 ~ 1.0)
// 0.3 = 이미지에 매우 가깝게, 0.5 = 중간, 0.7 = 이미지에서 멀게

let DECOR_TEXT_OFFSET = 0; // 만다라 중심점으로부터 추가 거리 (픽셀)
// 음수 = 안쪽으로, 0 = 변화없음, 양수 = 바깥쪽으로

let DECOR_TEXT_CENTER_X = 40; // 텍스트 원의 중심점 X축 조정 (픽셀)
// 음수 = 왼쪽으로, 0 = 변화없음, 양수 = 오른쪽으로
// 예: -10 = 왼쪽으로 10px, 10 = 오른쪽으로 10px

let DECOR_TEXT_CENTER_Y = -140; // 텍스트 원의 중심점 Y축 조정 (픽셀)
// 음수 = 위쪽으로, 0 = 변화없음, 양수 = 아래쪽으로
// 예: -10 = 위쪽으로 10px, 10 = 아래쪽으로 10px

let DECOR_TEXT_ROTATION_SPEED = 0.0125; // 텍스트 회전 속도
// 0.005 = 매우 느리게, 0.01 = 보통, 0.02 = 빠르게
// ========================================================

// 실제 픽셀 크기 (화면 크기에 따라 계산됨)
let baseRadius = 150;
let ringSpacing = 100;
let symbolSize = 120; // 기본 60 * 2

let symbolAspectRatio = 1; // 이미지 비율 (width/height)

// 업데이트 쓰로틀링
let lastUpdate = 0;
const UPDATE_INTERVAL = 50; // 50ms마다 업데이트 (초당 20회)

// 테스트 모드 (키패드로 가상 사용자 추가/제거)
// 주의: GitHub Pages 배포 시 반드시 false로 설정!
let testMode = false; // false로 설정하면 실제 Firebase 모드
let virtualUsers = []; // 가상 사용자 목록

// 만트라 완성 시간 설정
const COMPLETION_TIME = 27000; // 27초 동안 터치 유지 필요 (밀리초) - pray.mp3 길이에 맞춤
const SYMBOLS_PER_MANTRA = 7; // 한 만트라당 심볼 개수
const MAX_MANTRAS = 3; // 최대 만트라 개수 (성능 최적화: 5 → 3)
const MANTRA_LIFETIME = 60000; // 만트라 생존 시간 (60초로 증가)
const MANTRA_FADEOUT_TIME = 10000; // 페이드아웃 시간 (10초로 증가)
const COMPLETION_FADEOUT_TIME = 2000; // 완성 후 텍스트 페이드아웃 시간 (2초로 증가)
let touchStartTime = 0; // 터치 시작 시간
let currentProgress = 0; // 현재 진행도 (0~1)
let completedMantras = []; // 완성된 만트라들의 배열
let totalMantraCount = 0; // 전체 만트라 생성 횟수 (제거되어도 계속 증가)
let currentMantraRotation = 0; // 현재 진행 중인 만트라의 회전 각도
let animatedMantraRotation = 0; // 부드럽게 보간된 회전 각도
const ROTATION_SPEED = 0.005; // 회전 속도 (라디안/프레임)
let lastActiveCount = 0; // 이전 프레임의 활성 사용자 수
let completionFadeoutStart = 0; // 완성 후 페이드아웃 시작 시간
let isCompletionFadingOut = false; // 완성 후 페이드아웃 중인지 여부
let fadingOutImageIndex = 0; // 페이드아웃 중인 만다라의 이미지 인덱스 (이전 색상 유지용)
let hasCompletedCurrentMantra = false; // 현재 세션에서 만트라 완성 여부

// 스케일 애니메이션
let currentScale = 1.0; // 현재 스케일 값
let targetScale = 1.0; // 목표 스케일 값
const SCALE_LERP_AMOUNT = 0.03; // 스케일 보간 속도 (0~1, 작을수록 부드럽게) - 더 부드럽게 (0.05 → 0.03)

// 만다라 이미지 개수
const MANTRA_IMAGE_COUNT = 6;

// 주기도문 텍스트 (단어별로 분리)
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

// 후광/입자 효과는 성능 문제로 제거됨

// ============================================
// 3. p5.js 프리로드 - 오디오 파일 로딩
// ============================================

function preload() {
  // 6개의 만다라 PNG 이미지 로드
  for (let i = 0; i < 6; i++) {
    const imageNumber = i + 1;
    const index = i;

    let img = loadImage(
      `source/mandara${imageNumber}.png`,
      () => {
        console.log(
          `✅ 만다라 이미지 ${imageNumber} 로드 완료 (인덱스: ${index})`
        );
        if (index === 0) {
          symbolAspectRatio = mantraImages[0].width / mantraImages[0].height;
          console.log(
            "이미지 크기:",
            mantraImages[0].width,
            "x",
            mantraImages[0].height
          );
        }
      },
      () => console.error(`❌ 만다라 이미지 ${imageNumber} 로드 실패`)
    );
    mantraImages[index] = img;
  }

  mantraImg = mantraImages[0];

  // 기도 오디오 파일 로드
  prayerSound = loadSound(
    "source/pray.mp3",
    () => console.log("✅ 기도 오디오 로드 완료"),
    () => console.error("❌ 기도 오디오 로드 실패")
  );

  // 폰트는 CSS @font-face로 로드됨
  prayerFont = "Ohmin";
  titleFont = "Ohmin";
  decorFont = "Tikkeul";
  console.log("✅ CSS 폰트 'Ohmin', 'Tikkeul' 설정 완료");
}

// ============================================
// 4. p5.js 셋업
// ============================================

function setup() {
  // 캔버스 생성 (전체 화면) - P2D 렌더러로 성능 최적화
  createCanvas(windowWidth, windowHeight, P2D);

  // 텍스트 렌더링 최적화
  textFont("Ohmin");

  // 반응형 크기 계산
  calculateResponsiveSizes();

  const firebaseAvailable = typeof firebase !== "undefined";
  const configReady = isFirebaseConfigValid(firebaseConfig);
  const shouldUseFirebase = !testMode && firebaseAvailable && configReady;

  if (shouldUseFirebase) {
    initFirebase();
  } else {
    if (!testMode) {
      console.warn("Firebase 설정이 준비되지 않아 테스트 모드로 전환합니다.");
      testMode = true;
    }
    initTestMode();
  }

  // 오디오 초기화
  initAudio();

  // 시각적 설정
  textAlign(LEFT, TOP);
  textFont("monospace");

  console.log("디지털 만트라 시스템 초기화 완료");
  console.log(`사용자 ID: ${userId}`);
}

// ============================================
// 5. Firebase 초기화 및 실시간 동기화
// ============================================

function initFirebase() {
  // Firebase 앱 초기화
  firebase.initializeApp(firebaseConfig);
  database = firebase.database();

  // 고유 사용자 ID 생성 (timestamp + 랜덤값)
  userId = Date.now() + "_" + Math.floor(Math.random() * 10000);

  // Firebase 참조 설정
  usersRef = database.ref("users");
  myConnectionRef = usersRef.child(userId);

  // Firebase 연결 상태 모니터링
  const connectedRef = database.ref(".info/connected");
  connectedRef.on("value", (snapshot) => {
    if (snapshot.val() === true) {
      // 연결됨 - 사용자 데이터 설정
      myConnectionRef.set({
        online: true,
        touchActive: false,
        touchX: 0.5,
        touchY: 0.5,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
      });

      // 연결 끊길 때 자동 제거
      myConnectionRef.onDisconnect().remove();

      // 기존 heartbeat 인터벌 제거 (중복 방지)
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      // lastSeen 업데이트 (10초마다)
      heartbeatInterval = setInterval(() => {
        if (myConnectionRef) {
          myConnectionRef.update({
            lastSeen: firebase.database.ServerValue.TIMESTAMP,
          });
        }
      }, 10000);

      console.log("Firebase 연결됨:", userId);
    } else {
      console.log("Firebase 연결 끊김");
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
  });

  // 실시간 접속자 추적 시작
  setupPresenceTracking();

  // 초기 정리 (페이지 로드 시 한번 실행)
  setTimeout(() => {
    usersRef.once("value", (snapshot) => {
      console.log("초기 데이터베이스 정리 시작...");
      cleanupStaleConnections(snapshot);
    });
  }, 2000); // 2초 후 실행

  console.log("Firebase 초기화 완료");
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
  console.log("테스트 모드 활성화 - Firebase 없이 로컬로 동작합니다.");
}

// ============================================
// 6. 실시간 접속자 추적 (Presence System)
// ============================================

function setupPresenceTracking() {
  // 전체 사용자 목록 변경 감지
  usersRef.on("value", (snapshot) => {
    connectedUsers = snapshot.numChildren();
    console.log(`현재 접속자: ${connectedUsers}명`);

    // 오래된 연결 정리 (60초 이상 lastSeen 업데이트 없음)
    cleanupStaleConnections(snapshot);
  });

  // 새로운 사용자 접속
  usersRef.on("child_added", (snapshot) => {
    const user = snapshot.val();
    const uid = snapshot.key;

    console.log(`사용자 접속: ${uid}`);

    // 로컬 활성 터치 데이터에 추가
    activeTouches[uid] = {
      active: user.touchActive || false,
      x: user.touchX || 0.5,
      y: user.touchY || 0.5,
      visualLayer: null, // 나중에 비주얼 객체 저장
    };
  });

  // 기존 사용자 데이터 변경
  usersRef.on("child_changed", (snapshot) => {
    const user = snapshot.val();
    const uid = snapshot.key;

    // 로컬 데이터 업데이트
    if (activeTouches[uid]) {
      activeTouches[uid].active = user.touchActive;
      activeTouches[uid].x = user.touchX;
      activeTouches[uid].y = user.touchY;
    }
  });

  // 사용자 연결 해제
  usersRef.on("child_removed", (snapshot) => {
    const uid = snapshot.key;
    console.log(`사용자 퇴장: ${uid}`);

    // 로컬 데이터에서 삭제
    delete activeTouches[uid];
  });
}

// 오래된 연결 정리 함수
function cleanupStaleConnections(snapshot) {
  const now = Date.now();
  const TIMEOUT = 30000; // 30초 (heartbeat가 10초이므로 3번 놓치면 제거)

  snapshot.forEach((childSnapshot) => {
    const uid = childSnapshot.key;
    const user = childSnapshot.val();

    // lastSeen이 없는 오래된 데이터는 무조건 제거
    if (!user.lastSeen) {
      console.log(`오래된 데이터 제거 (lastSeen 없음): ${uid}`);
      usersRef.child(uid).remove();
      return;
    }

    const lastSeen = user.lastSeen;
    const timeSinceLastSeen = now - lastSeen;

    // 30초 이상 업데이트 없으면 제거
    if (timeSinceLastSeen > TIMEOUT) {
      console.log(
        `비활성 연결 제거: ${uid} (마지막 활동: ${Math.floor(
          timeSinceLastSeen / 1000
        )}초 전)`
      );
      usersRef.child(uid).remove();
    }
  });
}

// ============================================
// 7. 오디오 초기화 및 관리
// ============================================

function initAudio() {
  // 오디오 레이어를 루프로 설정하되, 처음엔 볼륨 0
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
    // 활성 사용자 순서대로 필요한 레이어만 켬
    for (let uid in activeTouches) {
      if (activeTouches[uid].active && layerIndex < MAX_LAYERS) {
        if (audioLayers[layerIndex]) {
          audioLayers[layerIndex].setVolume(1, 0.5); // 0.5초 페이드인
        }
        layerIndex++;
      }
    }
  }

  // 나머지 레이어는 항상 페이드아웃
  for (let i = layerIndex; i < MAX_LAYERS; i++) {
    if (audioLayers[i]) {
      audioLayers[i].setVolume(0, 0.5); // 0.5초 페이드아웃
    }
  }
}

// ============================================
// 8. 터치/마우스 이벤트 처리
// ============================================

function touchStarted() {
  // 캔버스 영역 내에서만 동작
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    // 오디오 컨텍스트 활성화 (브라우저 autoplay 정책 대응)
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

    console.log("터치 시작:", mouseX, mouseY);

    // 기본 동작 방지 (모바일 스크롤 등)
    return false;
  }
}

function touchMoved() {
  if (mouseIsPressed) {
    // 쓰로틀링: 너무 자주 업데이트하지 않기
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
    // Firebase에 터치 비활성화 상태 업데이트
    myConnectionRef.update({
      touchActive: false,
    });
  } else {
    updateLocalTouchState(false);
  }

  console.log("터치 종료");
  return false;
}

// 마우스 이벤트도 동일하게 처리 (데스크탑 대응)
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
// 9. 메인 드로우 루프
// ============================================

function draw() {
  // 배경 (검은색)
  background(0);

  // 만트라 완성 진행도 업데이트
  const activeCount = updateCompletionProgress();

  // 오래된 만트라 제거 및 페이드아웃 처리
  updateMantraLifetime();

  // 접속자 정보 표시
  displayConnectionInfo(activeCount);

  // 모든 활성 터치의 비주얼 레이어 렌더링
  renderVisualLayers(activeCount);

  // 완성 상태 시각화
  displayCompletionState(activeCount);

  // 주기도문 표시 (만다라와 함께)
  displayLordsPrayer(activeCount);

  // ===== 완성 플래시 효과 =====
  if (completionFlash.active) {
    let elapsed = millis() - completionFlash.startTime;
    let progress = elapsed / completionFlash.duration;

    if (progress < 1) {
      // 플래시 강도를 50%로 줄이고, 더 빠르게 사라지도록
      let flashAlpha = 128 * (1 - pow(progress, 1.5));

      push();
      fill(255, 255, 255, flashAlpha);
      rect(0, 0, width, height);
      pop();
    } else {
      completionFlash.active = false;
    }
  }

  // 오디오 레이어 업데이트
  updateAudioLayers(activeCount);
}

// ============================================
// 10. UI 렌더링 함수들
// ============================================

function displayConnectionInfo(activeCount = 0) {
  if (testMode) {
    refreshConnectionCount();
  }

  push();

  // 한국어로 명 수 표시 - 화면 맨 위 중앙
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

  fill(255, 255, 255, 200);
  textAlign(CENTER, TOP);
  textSize(28); // 크기 증가 (24 → 28)
  if (titleFont) {
    textFont(titleFont);
  } else {
    textFont("serif");
  }
  textStyle(BOLD);
  text(displayText, width / 2, 30);

  // 테스트 모드 안내 (작게, 밝은 회색)
  if (testMode) {
    textAlign(CENTER, TOP);
    fill(200, 200, 200, 200);
    textSize(10);
    textStyle(NORMAL);
    text("테스트: 1-9", width / 2, 60);
  }

  textAlign(LEFT, BASELINE); // 기본값으로 복원
  textStyle(NORMAL);

  pop();
}

// ============================================
// 10. 비주얼 렌더링 함수들
// ============================================

function calculateGlobalScale(activeCount = 0) {
  // 스케일 고정: 항상 2개 만다라 기준으로 계산 (최적의 화면 비율)
  // 진행 중인 만트라 1개 + 완성된 만트라 1개 = 총 2개 기준

  let fixedMantraCount = 2; // 2개 만다라 기준으로 고정
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
    let imageIndex = mantra.imageIndex !== undefined ? mantra.imageIndex : 0;

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

    // 다음에 완성될 만다라 이미지 인덱스 미리 계산
    let nextImageIndex = totalMantraCount % MANTRA_IMAGE_COUNT;

    push();
    translate(width / 2, height / 2);
    scale(globalScale);
    rotate(animatedMantraRotation);
    translate(-width / 2, -height / 2);

    push();
    translate(width / 2, height / 2);
    noFill();
    // 진행 중인 만트라는 다음에 완성될 만다라 색상 사용
    let progressRingColor = color(MANDALA_COLORS[nextImageIndex]);
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
      drawMantraSymbol(angle, radius, 1.0, alpha, nextImageIndex);
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
    "Name",
    "Kingdom",
    "Will",
    "Bread",
    "Forgiveness",
    "Temptation",
    "Deliverance",
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

    let textSizeVal = imgWidth * 0.16; // 이미지 크기의 16% (12%→16% 증가)

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

    // 다음 만다라 색상
    let nextImageIndex = totalMantraCount % MANTRA_IMAGE_COUNT;
    let progressColor = color(MANDALA_COLORS[nextImageIndex]);

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
  for (let i = 0; i < completedMantras.length; i++) {
    let mantra = completedMantras[i];

    // 만트라에 저장된 텍스트가 있으면 표시
    if (mantra.prayerWords && mantra.prayerWords.length > 0) {
      let ringIndex = 0;
      let textRadius =
        baseRadius +
        (mantra.animatedRingIndex + 1) * ringSpacing +
        symbolSize * 0.3;
      let textColor = color(MANDALA_COLORS[mantra.imageIndex]);

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
      let imageIndex = totalMantraCount % MANTRA_IMAGE_COUNT;
      let textColor = color(MANDALA_COLORS[imageIndex]);

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

// 원형 텍스트 그리기 헬퍼 함수
function drawCircularText(words, radius, textColor, alpha) {
  let totalWords = words.length;
  let angleStep = TWO_PI / totalWords;
  let startAngle = -HALF_PI;

  textAlign(CENTER, CENTER);
  textSize(84); // 크기 증가 (72 → 84)
  if (prayerFont) {
    textFont(prayerFont);
  } else {
    textFont("serif");
  }
  textStyle(BOLD); // 굵게 설정

  for (let i = 0; i < totalWords; i++) {
    push();

    let angle = startAngle + i * angleStep;
    let x = width / 2 + cos(angle) * radius;
    let y = height / 2 + sin(angle) * radius;

    translate(x, y);

    // 텍스트가 원을 따라 회전
    if (angle > HALF_PI && angle < PI + HALF_PI) {
      rotate(angle + HALF_PI + PI);
    } else {
      rotate(angle + HALF_PI);
    }

    // 텍스트 색상 - 만다라 색상과 동일하게
    fill(red(textColor), green(textColor), blue(textColor), alpha);
    noStroke();

    text(words[i], 0, 0);

    pop();
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
  let initialLength = completedMantras.length;

  completedMantras = completedMantras.filter((mantra) => {
    let age = currentTime - mantra.createdTime;
    // 생존 시간 + 페이드아웃 시간이 지나면 제거
    return age < MANTRA_LIFETIME + MANTRA_FADEOUT_TIME;
  });

  // 제거된 만트라가 있으면 로그 출력
  if (completedMantras.length < initialLength) {
    console.log(`만트라 자동 제거 - 현재 ${completedMantras.length}개 남음`);
  }
}

// 만트라 완성 진행도 업데이트
function updateCompletionProgress() {
  let activeCount = countActiveTouches();

  // 사람 수가 변경되었는지 체크
  if (activeCount !== lastActiveCount && activeCount >= 2) {
    // 사람 수가 변경되면 진행도 초기화 (2명 이상일 때만)
    touchStartTime = millis();
    currentProgress = 0;
    // 회전은 현재 위치에서 부드럽게 계속 (초기화 안 함)
    console.log(
      `인원 변경 (${lastActiveCount}명 → ${activeCount}명) - 진행도 초기화`
    );

    // 기도 오디오 재시작
    if (prayerSound) {
      if (prayerSound.isPlaying()) {
        prayerSound.stop();
      }
      prayerSound.play();
      console.log("🔄 기도 오디오 재시작 (인원 변경)");
    }
  }

  // 2명 이상이 터치하고 있으면 진행도 시작
  if (activeCount >= 2) {
    // 처음 터치 시작 (완성된 적이 없을 때만)
    if (touchStartTime === 0 && !hasCompletedCurrentMantra) {
      touchStartTime = millis();
      console.log(`${activeCount}명이 터치 시작 - 진행 중`);

      // 기도 오디오 재생 시작
      if (prayerSound && !prayerSound.isPlaying()) {
        prayerSound.play();
        console.log("🎵 기도 오디오 재생 시작");
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
      // 전체 생성 횟수 기반으로 색상 인덱스 계산 (오래된 만트라 제거되어도 순서 유지)
      let imageIndex = totalMantraCount % MANTRA_IMAGE_COUNT; // 이미지 순환 (0-5)

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
        imageIndex: imageIndex, // 이미지 인덱스 저장 (0-5)
        animatedRingIndex: 0, // 가장 안쪽에서 시작 (중앙에서 완성됨)
        birthOrder: totalMantraCount, // 생성 순서 (정렬용)
        isNewlyCreated: true, // 새로 생성된 만다라 표시
        prayerWords: completedWords, // 완성된 주기도문 텍스트 저장
      });

      totalMantraCount++; // 전체 생성 횟수 증가

      console.log(
        `✨ 만트라 완성! #${totalMantraCount} - 만다라 이미지 ${
          imageIndex + 1
        } 사용`
      );

      // 최대 개수 제한 (오래된 것부터 제거)
      if (completedMantras.length > MAX_MANTRAS) {
        completedMantras.shift(); // 가장 오래된 만트라 제거
        console.log(
          `오래된 만트라 제거 - 현재 ${completedMantras.length}개 유지`
        );
      }

      console.log(
        `만트라 완성! (${activeCount}명 참여) - 총 ${completedMantras.length}개`
      );

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
      console.log("🔇 기도 오디오 정지 (1명)");
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
      console.log("🔇 기도 오디오 정지 (0명)");
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

  console.log("반응형 크기:", {
    diagonal: diagonal.toFixed(0),
    baseRadius: baseRadius.toFixed(0),
    ringSpacing: ringSpacing.toFixed(0),
    symbolSize: symbolSize.toFixed(0),
  });
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

  console.log("가상 사용자 추가:", virtualUserId, "(총", connectedUsers, "명)");
}

// 가상 사용자 제거
function removeVirtualUser() {
  if (virtualUsers.length > 0) {
    let removedUserId = virtualUsers.pop();
    delete activeTouches[removedUserId];
    refreshConnectionCount();

    console.log(
      "가상 사용자 제거:",
      removedUserId,
      "(총",
      connectedUsers,
      "명)"
    );
  }
}

// 모든 가상 사용자 제거
function removeAllVirtualUsers() {
  virtualUsers.forEach((uid) => {
    delete activeTouches[uid];
  });

  virtualUsers = [];
  refreshConnectionCount();

  console.log("모든 가상 사용자 제거");
}

// 특정 개수의 가상 사용자 설정
function setVirtualUserCount(count) {
  // 기존 가상 사용자 모두 제거
  removeAllVirtualUsers();

  // 새로운 가상 사용자 생성
  for (let i = 0; i < count; i++) {
    createVirtualUser();
  }

  console.log(`가상 사용자 ${count}명으로 설정됨`);
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
