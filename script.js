const photoContainer = document.getElementById('photoContainer');
const templateOverlay = document.getElementById('templateOverlay');
const editPanel = document.getElementById('editPanel');

let activeImg = null;
let isDragging = false;
let startX, startY, initX, initY;

// SCAN TEMPLATE ENGINE
document.getElementById('magicScan').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
        photoContainer.innerHTML = '';
        templateOverlay.src = img.src;
        templateOverlay.style.display = 'block';
        detectTransparentAreas(img);
        URL.revokeObjectURL(url);
    };

    img.src = url;
});

// MULTI-DIRECTIONAL FLOOD FILL ENGINE (Lebih Fleksibel untuk Bentuk Lengkung/Hati)
function detectTransparentAreas(imgSource) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imgSource.naturalWidth;
    canvas.height = imgSource.naturalHeight;

    ctx.drawImage(imgSource, 0, 0, canvas.width, canvas.height);

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const imgData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    const pixelData = imgData.data;
    const visited = new Uint8Array(WIDTH * HEIGHT);

    // Langkah pemindaian (Semakin kecil semakin presisi, optimal di angka 2-4)
    const step = 2; 
    // Ambang batas transparansi (Diperlonggar ke 120 agar piksel semi-transparan/blur ikut terbaca)
    const alphaThreshold = 120; 

    for (let y = 0; y < HEIGHT; y += step) {
        for (let x = 0; x < WIDTH; x += step) {
            const idx = (y * WIDTH + x) * 4;
            
            if (pixelData[idx + 3] < alphaThreshold && !visited[y * WIDTH + x]) {
                let xMin = x, xMax = x, yMin = y, yMax = y;
                let stack = [[x, y]];
                visited[y * WIDTH + x] = 1;
                
                while (stack.length > 0) {
                    let [cx, cy] = stack.pop();
                    xMin = Math.min(xMin, cx); xMax = Math.max(xMax, cx);
                    yMin = Math.min(yMin, cy); yMax = Math.max(yMax, cy);
                    
                    // Ekspedisi 8 Arah Mata Angin (Mencari celah lengkungan ke atas, bawah, kiri, kanan, & diagonal)
                    const directions = [
                        [cx + 4, cy], [cx - 4, cy], [cx, cy + 4], [cx, cy - 4],
                        [cx + 4, cy + 4], [cx - 4, cy + 4], [cx + 4, cy - 4], [cx - 4, cy - 4]
                    ];

                    for (let i = 0; i < directions.length; i++) {
                        const [nx, ny] = directions[i];
                        if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
                            const nIdx = ny * WIDTH + nx;
                            if (!visited[nIdx]) {
                                const pIdx = nIdx * 4;
                                if (pixelData[pIdx + 3] < alphaThreshold) {
                                    visited[nIdx] = 1;
                                    stack.push([nx, ny]);
                                }
                            }
                        }
                    }
                }
                
                // Membuat kotak foto jika ukuran area valid
                if ((xMax - xMin) > 40 && (yMax - yMin) > 40) {
                    createPhotoBox(xMin, yMin, (xMax - xMin), (yMax - yMin));
                }
            }
        }
    }
}

function createPhotoBox(x, y, w, h) {
    const box = document.createElement('div');
    box.className = 'photo-box';
    
    // GAP FIX: Diperbesar sedikit agar ujung foto masuk lebih dalam ke bagian belakang templat
    const gapFix = 8; 
    
    box.style.cssText = `
        left: ${x - gapFix}px; 
        top: ${y - gapFix}px; 
        width: ${w + (gapFix * 2)}px; 
        height: ${h + (gapFix * 2)}px;
    `;
    
    box.onclick = (e) => {
        if (e.target.classList.contains('remove-photo-btn')) return;
        const img = box.querySelector('img');
        if (img) selectPhoto(img);
        else triggerImageUpload(box);
    };
    photoContainer.appendChild(box);
}

function triggerImageUpload(box) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            box.innerHTML = '';
            const img = document.createElement('img');
            img.src = ev.target.result;

            img.dataset.scale = 1; 
            img.dataset.bright = 115; 
            img.dataset.contrast = 110; 
            img.dataset.sat = 95;      
            img.dataset.x = 0; 
            img.dataset.y = 0;

            box.appendChild(img);
            
            const btn = document.createElement('button');
            btn.className = 'remove-photo-btn';
            btn.innerHTML = '×';
            btn.onclick = (ev) => {
                ev.stopPropagation();
                box.innerHTML = '';
                activeImg = null;
                editPanel.style.display = 'none';
            };
            box.appendChild(btn);
            
            selectPhoto(img);
            applyStyles(); 
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function selectPhoto(img) {
    activeImg = img;
    editPanel.style.display = 'block';
    ['Scale', 'Bright', 'Contrast', 'Sat'].forEach(p => {
        const val = img.dataset[p.toLowerCase()];
        document.getElementById(`img${p}`).value = val;
        document.getElementById(`val-${p.toLowerCase()}`).innerText = p === 'Scale' ? val : val + '%';
    });
    document.querySelectorAll('.photo-box').forEach(b => b.style.outline = 'none');
    img.parentElement.style.outline = `2px solid var(--accent)`;
}

['imgScale', 'imgBright', 'imgContrast', 'imgSat'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
        if (!activeImg) return;
        const val = e.target.value;
        const key = id.replace('img', '').toLowerCase();
        activeImg.dataset[key] = val;
        document.getElementById(`val-${key}`).innerText = key === 'scale' ? val : val + '%';
        applyStyles();
    });
});

function applyStyles() {
    if (!activeImg) return;
    const d = activeImg.dataset;
    activeImg.style.transform = `translate(${d.x}px, ${d.y}px) scale(${d.scale})`;
    activeImg.style.filter = `brightness(${d.bright}%) contrast(${d.contrast}%) saturate(${d.sat}%)`;
}

// DRAG SYSTEM
window.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('remove-photo-btn')) return;
    if (e.target.tagName === 'IMG' && e.target.parentElement.classList.contains('photo-box')) {
        isDragging = true; 
        activeImg = e.target;
        startX = e.clientX; 
        startY = e.clientY;
        initX = parseFloat(activeImg.dataset.x) || 0; 
        initY = parseFloat(activeImg.dataset.y) || 0;
        selectPhoto(activeImg);
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging || !activeImg) return;
    activeImg.dataset.x = initX + (e.clientX - startX);
    activeImg.dataset.y = initY + (e.clientY - startY);
    applyStyles();
});

window.addEventListener('mouseup', () => isDragging = false);

// PRINT ENGINE
document.getElementById('printBtn').onclick = () => {
    document.querySelectorAll('.photo-box').forEach(b => b.style.outline = 'none');
    setTimeout(() => {
        window.print();
    }, 500);
};

// DOWNLOAD ENGINE
document.getElementById('downloadBtn').onclick = () => {
    const btn = document.getElementById('downloadBtn');
    btn.innerText = 'PROCESSING...';
    const xBtns = document.querySelectorAll('.remove-photo-btn');
    xBtns.forEach(b => b.style.display = 'none');
    document.querySelectorAll('.photo-box').forEach(b => b.style.outline = 'none');

    const captureArea = document.getElementById("captureArea");
    const ratio = templateOverlay.naturalWidth / captureArea.clientWidth;

    html2canvas(captureArea, {
        scale: ratio,
        useCORS: true,
        backgroundColor: null,
        imageTimeout: 0,
        logging: false
    }).then(canvas => {
        const link = document.createElement("a");
        link.download = `REASTIC_STUDIO_${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        btn.innerText = "💾 SIMPAN HASIL HD";
        xBtns.forEach(b => b.style.display = "flex");
    });
};
