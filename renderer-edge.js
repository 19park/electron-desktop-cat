const remote = require('@electron/remote');
const path = require('path');

const catContainer = document.getElementById('lottie-cat');
const contextMenu = document.getElementById('contextMenu');
const edgeIndicator = document.getElementById('edgeIndicator');

const win = remote.getCurrentWindow();
const screen = remote.screen;

const EDGES = { BOTTOM: 'bottom', TOP: 'top', LEFT: 'left', RIGHT: 'right' };

let currentEdge = EDGES.BOTTOM;
let currentXPosition = 0.5;
let isVisible = false;
let isAnimating = false;

const APPEAR_DURATION = 1000; // 1초 (더 빠르게)
const STAY_DURATION = 4000; // 4초 (조금 짧게)
const HIDE_DURATION = 1000; // 1초 (더 빠르게)

console.log('Loading Lottie animation...');

const lottieAnimation = window.lottie.loadAnimation({
    container: catContainer,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    path: path.join(__dirname, 'assets/lottie/cat.json'),
    rendererSettings: {
        preserveAspectRatio: 'xMidYMax meet', // Focus on bottom portion where cat is
        viewBoxOnly: true
    }
});

lottieAnimation.addEventListener('DOMLoaded', () => {
    console.log('Lottie ready!');
    setTimeout(() => {
        startPeekingBehavior();
    }, 1000);
});

// 고양이는 항상 하단에서 위로 올라오는 형태
// 각 가장자리에 맞게 회전과 위치 조정
function getEdgePosition(edge, xPos, screenBounds, isHidden = false) {
    const windowSize = 200;

    // cat.json: 고양이는 하단에서 위로 올라오는 애니메이션
    // preserveAspectRatio: 'xMidYMax meet' 사용으로 하단 포커스

    // 멀티 모니터 환경: 인접 디스플레이 확인
    const allDisplays = screen.getAllDisplays();
    const currentDisplay = screen.getDisplayNearestPoint({
        x: screenBounds.x + screenBounds.width / 2,
        y: screenBounds.y + screenBounds.height / 2
    });

    let x, y, rotation;

    switch(edge) {
        case EDGES.BOTTOM:
            // 하단: 윈도우 하단을 화면 하단에 정확히 붙임
            // 보임 상태: 윈도우 하단 = 화면 하단 → y = screenBounds.bottom - windowSize
            // 숨김 상태: 윈도우를 아래로 내림 → y 증가
            x = screenBounds.x + (screenBounds.width - windowSize) * xPos;
            if (isHidden) {
                y = (screenBounds.y + screenBounds.height) - windowSize + 170; // 대부분 숨김
            } else {
                y = (screenBounds.y + screenBounds.height) - windowSize; // 윈도우 하단이 화면 하단에 딱 붙음
            }
            rotation = 0;
            break;

        case EDGES.TOP:
            // 상단: 180도 회전하여 고양이 머리가 아래로
            // 보임 상태: 윈도우 상단 = 화면 상단 → y = screenBounds.y
            // 숨김 상태: 윈도우를 위로 올림 → y 감소
            x = screenBounds.x + (screenBounds.width - windowSize) * xPos;
            if (isHidden) {
                y = screenBounds.y - 170;
            } else {
                y = screenBounds.y;
            }
            rotation = 180;
            break;

        case EDGES.LEFT:
            // 왼쪽: 90도 회전
            // 보임 상태: 윈도우 좌측 = 화면 좌측 → x = screenBounds.x
            // 숨김 상태: 왼쪽에 다른 모니터가 있는지 확인
            if (isHidden) {
                // 왼쪽에 인접한 디스플레이가 있는지 확인
                const leftEdge = screenBounds.x;
                const hasLeftDisplay = allDisplays.some(d => {
                    const isNotSelf = d.id !== currentDisplay.id;
                    const isOnLeft = d.bounds.x + d.bounds.width <= leftEdge + 10; // 현재 화면 왼쪽 끝에서 끝남
                    const isClose = d.bounds.x + d.bounds.width >= leftEdge - 10; // 10px 오차 허용

                    console.log('Checking left display:', {
                        displayId: d.id,
                        currentId: currentDisplay.id,
                        displayBounds: d.bounds,
                        leftEdge,
                        isNotSelf,
                        isOnLeft,
                        isClose,
                        result: isNotSelf && isOnLeft && isClose
                    });

                    return isNotSelf && isOnLeft && isClose;
                });

                console.log('Left edge - hasLeftDisplay:', hasLeftDisplay);
                console.log('Screen bounds:', screenBounds);

                if (hasLeftDisplay) {
                    // 왼쪽에 모니터가 있으면 현재 화면 안쪽에 완전히 숨김
                    // 윈도우가 화면 경계를 절대 넘지 않도록
                    x = screenBounds.x; // 현재 화면 내부 왼쪽 끝
                } else {
                    // 왼쪽에 모니터 없으면 완전히 화면 밖으로
                    x = screenBounds.x - windowSize;
                }

                console.log('Hidden x position:', x);
            } else {
                x = screenBounds.x;
            }
            y = screenBounds.y + (screenBounds.height - windowSize) * xPos;
            rotation = 90;
            break;

        case EDGES.RIGHT:
            // 오른쪽: -90도 회전
            // 보임 상태: 윈도우 우측 = 화면 우측 → x = screenBounds.right - windowSize
            // 숨김 상태: 오른쪽에 다른 모니터가 있는지 확인
            if (isHidden) {
                // 오른쪽에 인접한 디스플레이가 있는지 확인
                const rightEdge = screenBounds.x + screenBounds.width;
                const hasRightDisplay = allDisplays.some(d => {
                    const isNotSelf = d.id !== currentDisplay.id;
                    const isOnRight = d.bounds.x >= rightEdge - 10; // 현재 화면 오른쪽 끝에서 시작
                    const isClose = d.bounds.x <= rightEdge + 10; // 10px 오차 허용

                    console.log('Checking right display:', {
                        displayId: d.id,
                        currentId: currentDisplay.id,
                        displayBounds: d.bounds,
                        rightEdge,
                        isNotSelf,
                        isOnRight,
                        isClose,
                        result: isNotSelf && isOnRight && isClose
                    });

                    return isNotSelf && isOnRight && isClose;
                });

                console.log('Right edge - hasRightDisplay:', hasRightDisplay);
                console.log('Screen bounds:', screenBounds);

                if (hasRightDisplay) {
                    // 오른쪽에 모니터가 있으면 현재 화면 안쪽에 완전히 숨김
                    // 윈도우가 화면 경계를 절대 넘지 않도록
                    x = (screenBounds.x + screenBounds.width) - windowSize; // 현재 화면 내부 오른쪽 끝
                } else {
                    // 오른쪽에 모니터 없으면 완전히 화면 밖으로
                    x = screenBounds.x + screenBounds.width;
                }

                console.log('Hidden x position:', x);
            } else {
                x = (screenBounds.x + screenBounds.width) - windowSize;
            }
            y = screenBounds.y + (screenBounds.height - windowSize) * xPos;
            rotation = -90;
            break;
    }

    // NaN 체크 및 디버깅
    if (isNaN(x) || isNaN(y)) {
        console.error('Invalid position calculated:', { edge, xPos, screenBounds, x, y, isHidden });
        x = x || 0;
        y = y || 0;
    }

    console.log('Position:', { edge, isHidden, x: Math.round(x), y: Math.round(y), rotation });
    return { x: Math.round(x), y: Math.round(y), rotation };
}

function animateWindowPosition(toX, toY, duration) {
    return new Promise(resolve => {
        // NaN 체크
        if (isNaN(toX) || isNaN(toY) || !isFinite(toX) || !isFinite(toY)) {
            console.error('Invalid target position:', { toX, toY });
            resolve();
            return;
        }

        // 정수로 변환
        toX = Math.round(toX);
        toY = Math.round(toY);

        if (duration === 0) {
            win.setPosition(toX, toY);
            resolve();
            return;
        }

        const fromBounds = win.getBounds();

        // fromBounds 유효성 검사
        if (isNaN(fromBounds.x) || isNaN(fromBounds.y)) {
            console.error('Invalid current position:', fromBounds);
            win.setPosition(toX, toY);
            resolve();
            return;
        }

        const startTime = Date.now();
        const fromX = Math.round(fromBounds.x);
        const fromY = Math.round(fromBounds.y);

        function step() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            const x = Math.round(fromX + (toX - fromX) * eased);
            const y = Math.round(fromY + (toY - fromY) * eased);

            // 각 단계에서도 NaN 체크
            if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
                try {
                    win.setPosition(x, y);
                } catch (err) {
                    console.error('setPosition error:', { x, y, err });
                }
            } else {
                console.error('Invalid position in animation:', { x, y, fromX, fromY, toX, toY, eased });
            }

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        step();
    });
}

async function showCat() {
    if (isAnimating || isVisible) return;
    isAnimating = true;

    // 현재 윈도우가 있는 디스플레이 가져오기 (멀티 모니터 지원)
    const bounds = win.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const screenBounds = display.workArea;

    const hiddenPos = getEdgePosition(currentEdge, currentXPosition, screenBounds, true);
    const visiblePos = getEdgePosition(currentEdge, currentXPosition, screenBounds, false);

    // 회전 설정
    catContainer.style.transform = `rotate(${visiblePos.rotation}deg)`;

    // 숨은 위치에서 시작 (순간이동)
    console.log('ShowCat: Teleporting to hidden position', { edge: currentEdge, hiddenPos });
    win.setPosition(hiddenPos.x, hiddenPos.y);

    // Lottie 애니메이션 재생
    lottieAnimation.setDirection(1);
    lottieAnimation.goToAndPlay(0, true);

    // 보이는 위치로 부드럽게 이동
    await animateWindowPosition(visiblePos.x, visiblePos.y, APPEAR_DURATION);

    isVisible = true;
    isAnimating = false;
    console.log('Cat appeared at', currentEdge);
}

async function hideCat() {
    if (isAnimating || !isVisible) return;
    isAnimating = true;

    // 현재 윈도우가 있는 디스플레이 가져오기 (멀티 모니터 지원)
    const bounds = win.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const screenBounds = display.workArea;

    const hiddenPos = getEdgePosition(currentEdge, currentXPosition, screenBounds, true);

    // Lottie 역재생
    lottieAnimation.setDirection(-1);
    lottieAnimation.play();

    // 숨은 위치로 부드럽게 이동
    await animateWindowPosition(hiddenPos.x, hiddenPos.y, HIDE_DURATION);

    isVisible = false;
    isAnimating = false;
    console.log('Cat hidden');
}

async function moveToEdge(edge, xPos = 0.5) {
    // 현재 보이면 먼저 숨기기 (이전 엣지 기준으로)
    if (isVisible) {
        await hideCat();
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 새 위치로 설정 (hideCat 후에 변경)
    currentEdge = edge;
    currentXPosition = xPos;

    const edgeNames = { bottom: '아래', top: '위', left: '왼쪽', right: '오른쪽' };
    edgeIndicator.textContent = `${edgeNames[edge]} 가장자리`;
    edgeIndicator.style.display = 'block';
    setTimeout(() => edgeIndicator.style.display = 'none', 2000);

    // 새 위치에서 나타나기
    await showCat();
    await new Promise(resolve => setTimeout(resolve, STAY_DURATION));
    await hideCat();
}

async function peekCycle() {
    await showCat();
    await new Promise(resolve => setTimeout(resolve, STAY_DURATION));
    await hideCat();
}

async function startPeekingBehavior() {
    while (true) {
        await peekCycle();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 대기 시간 3초 → 2초

        // 40% 확률로 다른 가장자리로 이동 (더 자주 이동)
        if (Math.random() < 0.4) {
            const edges = Object.values(EDGES);
            const newEdge = edges[Math.floor(Math.random() * edges.length)];
            currentEdge = newEdge;
            currentXPosition = 0.3 + Math.random() * 0.4;

            console.log('Moving to', newEdge);
        }
    }
}

// Context menu using Electron Menu
const { Menu } = remote;

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    const menu = Menu.buildFromTemplate([
        {
            label: '아래로 이동',
            click: () => moveToEdge(EDGES.BOTTOM, 0.5)
        },
        {
            label: '위로 이동',
            click: () => moveToEdge(EDGES.TOP, 0.5)
        },
        {
            label: '왼쪽으로 이동',
            click: () => moveToEdge(EDGES.LEFT, 0.5)
        },
        {
            label: '오른쪽으로 이동',
            click: () => moveToEdge(EDGES.RIGHT, 0.5)
        },
        { type: 'separator' },
        {
            label: '랜덤 위치',
            click: () => {
                const edges = Object.values(EDGES);
                const randomEdge = edges[Math.floor(Math.random() * edges.length)];
                moveToEdge(randomEdge, 0.3 + Math.random() * 0.4);
            }
        },
        { type: 'separator' },
        {
            label: '닫기',
            click: () => win.close()
        }
    ]);

    menu.popup({ window: win });
});

document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape' || e.key === 'q') win.close();
    if (e.key === 'ArrowDown' || e.key === 's') moveToEdge(EDGES.BOTTOM, 0.5);
    if (e.key === 'ArrowUp' || e.key === 'w') moveToEdge(EDGES.TOP, 0.5);
    if (e.key === 'ArrowLeft' || e.key === 'a') moveToEdge(EDGES.LEFT, 0.5);
    if (e.key === 'ArrowRight' || e.key === 'd') moveToEdge(EDGES.RIGHT, 0.5);
    if (e.key === ' ') {
        if (isVisible) await hideCat();
        else await peekCycle();
    }
});

document.addEventListener('dblclick', () => {
    if (isVisible) hideCat();
    else peekCycle();
});

// 커스텀 드래그 로직 (방향 제한)
let isDragging = false;
let isDragStarted = false; // 실제로 드래그가 시작되었는지
let dragStartPos = { x: 0, y: 0 };
let windowStartPos = { x: 0, y: 0 };
const DRAG_THRESHOLD = 5; // 5px 이상 움직여야 드래그로 인식

document.querySelectorAll('.drag-area').forEach(area => {
    area.addEventListener('mousedown', (e) => {
        // 우클릭(button === 2)이면 드래그하지 않음
        if (e.button === 2) return;

        isDragging = true;
        isDragStarted = false;
        dragStartPos = { x: e.screenX, y: e.screenY };
        const bounds = win.getBounds();
        windowStartPos = { x: bounds.x, y: bounds.y };
        e.preventDefault();
    });
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.screenX - dragStartPos.x;
    const deltaY = e.screenY - dragStartPos.y;

    // 임계값 체크: 일정 거리 이상 움직였을 때만 드래그 시작
    if (!isDragStarted) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance < DRAG_THRESHOLD) return;
        isDragStarted = true;
    }

    let newX = windowStartPos.x;
    let newY = windowStartPos.y;

    // 현재 엣지에 따라 드래그 방향 제한
    if (currentEdge === EDGES.BOTTOM || currentEdge === EDGES.TOP) {
        // 상하 엣지: 좌우로만 이동 가능
        newX = windowStartPos.x + deltaX;
        newY = windowStartPos.y; // Y는 고정
    } else if (currentEdge === EDGES.LEFT || currentEdge === EDGES.RIGHT) {
        // 좌우 엣지: 상하로만 이동 가능
        newX = windowStartPos.x; // X는 고정
        newY = windowStartPos.y + deltaY;
    }

    win.setPosition(Math.round(newX), Math.round(newY));
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;

        // 실제로 드래그가 시작된 경우에만 위치 업데이트
        if (isDragStarted) {
            // 드래그 후 현재 위치를 기준으로 currentXPosition 업데이트
            const bounds = win.getBounds();
            const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
            const screenBounds = display.workArea;
            const windowSize = 200;

            if (currentEdge === EDGES.BOTTOM || currentEdge === EDGES.TOP) {
                // 좌우 위치 계산 (0~1)
                currentXPosition = (bounds.x - screenBounds.x) / (screenBounds.width - windowSize);
                currentXPosition = Math.max(0, Math.min(1, currentXPosition));
            } else if (currentEdge === EDGES.LEFT || currentEdge === EDGES.RIGHT) {
                // 상하 위치 계산 (0~1)
                currentXPosition = (bounds.y - screenBounds.y) / (screenBounds.height - windowSize);
                currentXPosition = Math.max(0, Math.min(1, currentXPosition));
            }

            console.log('Drag ended, new position:', currentXPosition);
        }

        isDragStarted = false;
    }
});
