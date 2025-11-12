const remote = require('@electron/remote');
const path = require('path');

const catContainer = document.getElementById('lottie-cat');

const win = remote.getCurrentWindow();
const screen = remote.screen;

let currentXPosition = 0.5;
let isVisible = false;
let isAnimating = false;

const APPEAR_DURATION = 1000; // 1초
const STAY_DURATION = 60000; // 60초 (1분)
const HIDE_DURATION = 1000; // 1초

console.log('Loading Lottie animation...');

const lottieAnimation = window.lottie.loadAnimation({
    container: catContainer,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    path: path.join(__dirname, 'assets/lottie/cat.compact.json'),
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

// 고양이는 하단에서만 나타남
function getEdgePosition(xPos, screenBounds, isHidden = false) {
    const windowSize = 154;
    const windowWidth = 200;

    const x = screenBounds.x + (screenBounds.width - windowWidth) * xPos;
    let y;

    if (isHidden) {
        y = (screenBounds.y + screenBounds.height) - windowSize + 131; // 대부분 숨김
    } else {
        y = (screenBounds.y + screenBounds.height) - windowSize; // 윈도우 하단이 화면 하단에 딱 붙음
    }

    return { x: Math.round(x), y: Math.round(y) };
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

    const hiddenPos = getEdgePosition(currentXPosition, screenBounds, true);
    const visiblePos = getEdgePosition(currentXPosition, screenBounds, false);

    // 숨은 위치에서 시작 (순간이동)
    win.setPosition(hiddenPos.x, hiddenPos.y);

    // Lottie 애니메이션 재생
    lottieAnimation.setDirection(1);
    lottieAnimation.goToAndPlay(0, true);

    // 보이는 위치로 부드럽게 이동
    await animateWindowPosition(visiblePos.x, visiblePos.y, APPEAR_DURATION);

    isVisible = true;
    isAnimating = false;
}

async function hideCat() {
    if (isAnimating || !isVisible) return;
    isAnimating = true;

    // 현재 윈도우가 있는 디스플레이 가져오기 (멀티 모니터 지원)
    const bounds = win.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const screenBounds = display.workArea;

    const hiddenPos = getEdgePosition(currentXPosition, screenBounds, true);

    // Lottie 역재생
    lottieAnimation.setDirection(-1);
    lottieAnimation.play();

    // 숨은 위치로 부드럽게 이동
    await animateWindowPosition(hiddenPos.x, hiddenPos.y, HIDE_DURATION);

    isVisible = false;
    isAnimating = false;
}

async function peekCycle() {
    await showCat();
    await new Promise(resolve => setTimeout(resolve, STAY_DURATION));
    await hideCat();
}

async function startPeekingBehavior() {
    while (true) {
        await peekCycle();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 30% 확률로 좌우 위치 변경
        if (Math.random() < 0.3) {
            currentXPosition = 0.3 + Math.random() * 0.4;
        }
    }
}

// Context menu using Electron Menu
const { Menu } = remote;

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    const menu = Menu.buildFromTemplate([
        {
            label: '닫기',
            click: () => win.close()
        }
    ]);

    menu.popup({ window: win });
});

document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape' || e.key === 'q') win.close();
    if (e.key === ' ') {
        if (isVisible) await hideCat();
        else await peekCycle();
    }
});

// 커스텀 드래그 로직 (방향 제한)
let isDragging = false;
let isDragStarted = false; // 실제로 드래그가 시작되었는지
let dragStartPos = { x: 0, y: 0 };
let windowStartPos = { x: 0, y: 0 };
const DRAG_THRESHOLD = 5; // 5px 이상 움직여야 드래그로 인식

const catContainerElement = document.querySelector('.cat-container');
catContainerElement.addEventListener('mousedown', (e) => {
    // 우클릭(button === 2)이면 드래그하지 않음
    if (e.button === 2) return;

    isDragging = true;
    isDragStarted = false;
    dragStartPos = { x: e.screenX, y: e.screenY };
    const bounds = win.getBounds();
    windowStartPos = { x: bounds.x, y: bounds.y };
    e.preventDefault();
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

    // 하단 엣지: 좌우로만 이동 가능
    const newX = windowStartPos.x + deltaX;
    const newY = windowStartPos.y; // Y는 고정

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
            const windowWidth = 200;
            const windowHeight = 154;

            // 좌우 위치 계산 (0~1)
            currentXPosition = (bounds.x - screenBounds.x) / (screenBounds.width - windowWidth);
            currentXPosition = Math.max(0, Math.min(1, currentXPosition));

            // 새 디스플레이의 하단에 맞춰 y 위치 재조정
            const newY = (screenBounds.y + screenBounds.height) - windowHeight;
            win.setPosition(bounds.x, newY);
        }

        isDragStarted = false;
    }
});
