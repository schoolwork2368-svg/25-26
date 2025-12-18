document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selectors ---
    const gridSizeSelect = document.getElementById('gridSize');
    const pixelGrid = document.getElementById('pixelGrid');
    const primaryColorPicker = document.getElementById('primaryColor');
    const secondaryColorPicker = document.getElementById('secondaryColor');
    const colorHistoryContainer = document.getElementById('colorHistory');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const eraserToggle = document.getElementById('eraserToggle');
    const addFrameBtn = document.getElementById('addFrameBtn');
    const framesContainer = document.getElementById('framesContainer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const fpsRange = document.getElementById('fpsRange');
    const fpsValue = document.getElementById('fpsValue');
    const previewCanvas = document.getElementById('animationPreview');
    const previewCtx = previewCanvas.getContext('2d');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mainContent = document.getElementById('mainContent');

    // --- State Variables ---
    let gridSize = parseInt(gridSizeSelect.value, 10);
    let primaryColor = primaryColorPicker.value;
    let secondaryColor = secondaryColorPicker.value;
    let isEraserOn = false;
    let isMouseDown = false;
    let frames = [];
    let currentFrameIndex = 0;
    let history = [];
    let historyIndex = -1;
    let colorHistory = [];
    const MAX_COLOR_HISTORY = 5;
    let animationInterval = null;
    let isPlaying = false;

    // --- State Management (Undo/Redo) ---
    function saveState() {
        const state = frames[currentFrameIndex].grid;
        history = history.slice(0, historyIndex + 1);
        history.push(JSON.parse(JSON.stringify(state)));
        historyIndex++;
        updateUndoRedoButtons();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            frames[currentFrameIndex].grid = JSON.parse(JSON.stringify(history[historyIndex]));
            drawGrid();
            updateFrameThumbnail(currentFrameIndex);
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            frames[currentFrameIndex].grid = JSON.parse(JSON.stringify(history[historyIndex]));
            drawGrid();
            updateFrameThumbnail(currentFrameIndex);
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    function resetHistory() {
        history = [];
        historyIndex = -1;
        saveState();
    }

    // --- Grid and Drawing ---
    function createGrid() {
        pixelGrid.innerHTML = '';
        pixelGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
        pixelGrid.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

        for (let i = 0; i < gridSize * gridSize; i++) {
            const pixel = document.createElement('div');
            pixel.dataset.index = i;
            pixel.style.aspectRatio = '1 / 1';
            // Add a faint border to each pixel to create a visible grid
            pixel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            pixelGrid.appendChild(pixel);
        }
        drawGrid();
    }

    function drawGrid() {
        const pixels = pixelGrid.children;
        const currentGridData = frames[currentFrameIndex].grid;
        for (let i = 0; i < pixels.length; i++) {
            pixels[i].style.backgroundColor = currentGridData[i] || 'transparent';
        }
        updateFrameThumbnail(currentFrameIndex);
    }

    function handlePixelInteraction(e) {
        if (e.target === pixelGrid) return;
        const index = parseInt(e.target.dataset.index, 10);
        // Use e.buttons for mousemove events as e.button is not reliable.
        // 1 = left mouse button, 2 = right mouse button.
        // On mousedown, e.button is reliable (0 for left, 2 for right).
        const color = (e.buttons === 2 || e.button === 2) ? secondaryColor : primaryColor;

        const newColor = isEraserOn ? 'transparent' : color;
        if (frames[currentFrameIndex].grid[index] !== newColor) {
            frames[currentFrameIndex].grid[index] = newColor;
            e.target.style.backgroundColor = newColor;
            if (!isEraserOn) updateColorHistory(color);
        }
    }

    // --- Color Management ---
    function updateColorHistory(color) {
        if (colorHistory.includes(color)) {
            colorHistory = colorHistory.filter(c => c !== color);
        }
        colorHistory.unshift(color);
        if (colorHistory.length > MAX_COLOR_HISTORY) colorHistory.pop();
        renderColorHistory();
    }

    function renderColorHistory() {
        colorHistoryContainer.innerHTML = '';
        colorHistory.forEach(color => {
            const swatch = document.createElement('div');
            swatch.style.backgroundColor = color;
            swatch.className = 'w-6 h-6 rounded border-2 border-gray-500 cursor-pointer hover:border-white';
            swatch.addEventListener('click', () => {
                primaryColorPicker.value = color;
                primaryColor = color;
            });
            colorHistoryContainer.appendChild(swatch);
        });
    }

    // --- Animation Frames ---
    function createNewFrameData() {
        return {
            grid: Array(gridSize * gridSize).fill('transparent'),
            thumbnail: null
        };
    }

    function addFrame() {
        frames.push(createNewFrameData());
        switchToFrame(frames.length - 1);
        renderFrames();
    }

    function switchToFrame(index) {
        currentFrameIndex = index;
        createGrid();
        resetHistory();
        renderFrames(); // To update active state
    }

    function deleteFrame(index) {
        if (frames.length <= 1) return; // Prevent deleting the last frame
        frames.splice(index, 1);
        if (currentFrameIndex >= frames.length) currentFrameIndex = frames.length - 1;
        renderFrames();
        switchToFrame(currentFrameIndex);
    }

    function renderFrames() {
        framesContainer.innerHTML = '';
        frames.forEach((frame, index) => {
            const frameWrapper = document.createElement('div');
            frameWrapper.className = `relative p-1 rounded border-2 ${index === currentFrameIndex ? 'border-blue-500' : 'border-gray-600'}`;
 
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            canvas.className = 'bg-white cursor-pointer';
            canvas.addEventListener('click', () => switchToFrame(index));
            frame.thumbnail = canvas;

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;';
            deleteButton.className = 'absolute top-0 right-0 w-5 h-5 bg-gray-600 hover:bg-red-600 text-white rounded-full text-xl leading-none flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent switching to this frame
                deleteFrame(index);
            });

            frameWrapper.appendChild(deleteButton);


            frameWrapper.appendChild(canvas); 
            framesContainer.appendChild(frameWrapper);
            updateFrameThumbnail(index);
        });
    }

    function updateFrameThumbnail(index) {
        const frame = frames[index];
        if (!frame || !frame.thumbnail) return;

        const ctx = frame.thumbnail.getContext('2d');
        const frameGridSize = Math.sqrt(frame.grid.length);
        const pixelSize = frame.thumbnail.width / frameGridSize;
        ctx.clearRect(0, 0, frame.thumbnail.width, frame.thumbnail.height);

        for (let i = 0; i < frame.grid.length; i++) {
            if (frame.grid[i] !== 'transparent') {
                ctx.fillStyle = frame.grid[i];
                const x = (i % frameGridSize) * pixelSize;
                const y = Math.floor(i / frameGridSize) * pixelSize;
                ctx.fillRect(x, y, pixelSize, pixelSize);
            }
        }
    }

    // --- Animation Playback ---
    function playAnimation() {
        let frameIdx = 0;
        const fps = parseInt(fpsRange.value, 10);
        if (animationInterval) clearInterval(animationInterval);

        animationInterval = setInterval(() => {
            const frame = frames[frameIdx];
            const frameGridSize = Math.sqrt(frame.grid.length);
            const pixelSize = previewCanvas.width / frameGridSize;

            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            for (let i = 0; i < frame.grid.length; i++) {
                if (frame.grid[i] !== 'transparent') {
                    previewCtx.fillStyle = frame.grid[i];
                    const x = (i % frameGridSize) * pixelSize;
                    const y = Math.floor(i / frameGridSize) * pixelSize;
                    previewCtx.fillRect(x, y, pixelSize, pixelSize);
                }
            }

            frameIdx = (frameIdx + 1) % frames.length;
        }, 1000 / fps);
    }

    function togglePlay() {
        isPlaying = !isPlaying;
        if (isPlaying && frames.length > 0) {
            playPauseBtn.textContent = 'Pause';
            playAnimation();
        } else {
            playPauseBtn.textContent = 'Play';
            clearInterval(animationInterval);
            animationInterval = null;
        }
    }

    // --- UI Functions ---
    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        const isOpen = !sidebar.classList.contains('-translate-x-full');
        sidebarToggle.classList.toggle('translate-x-80', isOpen);
        mainContent.style.marginLeft = isOpen ? '20rem' : '0'; // 20rem is w-80
    }

    // --- Event Listeners ---
    gridSizeSelect.addEventListener('change', (e) => {
        const confirmation = confirm("Changing the grid size will resize all frames and may result in data loss. Are you sure?");
        if (confirmation) {
            const newGridSize = parseInt(e.target.value, 10);
            const oldGridSize = gridSize;
            gridSize = newGridSize;

            // Resize all frames
            frames.forEach(frame => {
                const oldGrid = frame.grid;
                const newGrid = Array(newGridSize * newGridSize).fill('transparent');
                const smallerSize = Math.min(oldGridSize, newGridSize);
                for (let y = 0; y < smallerSize; y++) {
                    for (let x = 0; x < smallerSize; x++) {
                        newGrid[y * newGridSize + x] = oldGrid[y * oldGridSize + x];
                    }
                }
                frame.grid = newGrid;
            });

            createGrid();
            resetHistory();
            renderFrames(); // Redraw all thumbnails
        } else {
            e.target.value = gridSize; // Revert selection
        } 
    });

    primaryColorPicker.addEventListener('input', (e) => primaryColor = e.target.value);
    primaryColorPicker.addEventListener('change', (e) => updateColorHistory(e.target.value));
    secondaryColorPicker.addEventListener('input', (e) => secondaryColor = e.target.value);
    secondaryColorPicker.addEventListener('change', (e) => updateColorHistory(e.target.value));

    eraserToggle.addEventListener('click', () => {
        isEraserOn = !isEraserOn;
        eraserToggle.classList.toggle('bg-blue-600', isEraserOn);
        pixelGrid.style.cursor = isEraserOn ? 'grab' : 'crosshair';
    });

    pixelGrid.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isMouseDown = true;
        handlePixelInteraction(e);
    });
    pixelGrid.addEventListener('mousemove', (e) => {
        e.preventDefault();
        if (isMouseDown) handlePixelInteraction(e);
    });
    document.addEventListener('mouseup', () => {
        if (isMouseDown) {
            isMouseDown = false;
            saveState();
        }
    });
    pixelGrid.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click menu

    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') undo();
        if (e.ctrlKey && e.key === 'y') redo();
    });

    addFrameBtn.addEventListener('click', addFrame);
    playPauseBtn.addEventListener('click', togglePlay);
    fpsRange.addEventListener('input', (e) => {
        fpsValue.textContent = e.target.value;
        if (isPlaying) playAnimation(); // Update speed while playing
    });


    sidebarToggle.addEventListener('click', toggleSidebar);

    // --- Initialization ---
    function init() {
        addFrame(); // Start with one frame
        updateColorHistory(primaryColor);
        updateColorHistory(secondaryColor);
    }

    init();
});