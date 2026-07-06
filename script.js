const photoContainer = document.getElementById('photoContainer');
const templateOverlay = document.getElementById('templateOverlay');
const editPanel = document.getElementById('editPanel');

let activeImg = null;
let isDragging = false;
let startX, startY, initX, initY;

// SCAN TEMPLATE ENGINE (Satu Input untuk Semua)
document.getElementById('magicScan').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
        photoContainer.innerHTML = ''; // Reset slot lama
        templateOverlay.src = img.src;
        templateOverlay.style.display = 'block';
        
        // Deteksi area transparan dan bungkus jadi kotak persegi
        detectTransparentAreas(img);
        URL.revokeObjectURL(url);
    };

    img.src = url;
});

// HIGH-PRECISION BOUNDING BOX ENGINE FOR CURVED FRAMES
function detectTransparentAreas(imgSource) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Gunakan standar dimensi kanvas cetak 4R agar output konsisten
    canvas.width = 1200;
    canvas.height = 1800;

    ctx.drawImage(imgSource, 0, 0, canvas.width, canvas.height);

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const imgData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    const pixelData = imgData.data;
    
    const visited = new Uint8Array(WIDTH * HEIGHT);
    
    // Threshold Alpha: Di bawah 180 dianggap lubang transparan (aman untuk efek blur/lace di pinggir frame hati)
    const alphaThreshold = 180; 
    const step = 4; // Langkah scan dipercepat untuk efisiensi

    for (let y = 0; y < HEIGHT; y += step) {
        for (let x = 0; x < WIDTH; x += step) {
            const idx = (y * WIDTH + x) * 4;
            
            // Jika menemukan piksel transparan yang belum diproses
            if (pixelData[idx + 3] < alphaThreshold && !visited[y * WIDTH + x]) {
                
                let xMin = x, xMax = x;
                let yMin = y, yMax = y;
                
                let queue = [[x, y]];
                visited[y * WIDTH + x] = 1;
                
                while (queue.length > 0) {
                    let [cx, cy] = queue.shift();
                    
                    if (cx < xMin) xMin = cx;
                    if (cx > xMax) xMax = cx;
                    if (cy < yMin) yMin = cy;
                    if (cy > yMax) yMax = cy;
                    
                    // Jangkauan lompatan (12px) diperbesar agar bisa menyeberangi objek lengkung/ornamen di dalam lubang hati
                    const neighbors = [
                        [cx + 12, cy], [cx - 12, cy], [cx, cy + 12], [cx, cy - 12]
                    ];
                    
                    for (let i = 0; i < neighbors.length; i++) {
                        const [nx, ny] = neighbors[i];
                        if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
                            const nIdx = ny * WIDTH + nx;
                            if (!visited[nIdx]) {
                                if (pixelData[nIdx * 4 + 3] < alphaThreshold) {
                                    visited[nIdx] = 1;
                                    queue.push([nx, ny]);
                                }
                            }
                        }
                    }
                }
                
                const boxWidth = xMax - xMin;
                const boxHeight = yMax - yMin;
                
                // Validasi ukuran: Abaikan noise kecil, buat slot jika ukurannya memadai
                if (boxWidth > 120 && boxHeight > 120) {
                    // Berikan gapFix ekstra agar tepi kotak masuk sedikit ke dalam frame (tidak bocor putih)
                    const gapFix = 6;
                    createPhotoBox(xMin - gapFix, yMin - gapFix, boxWidth + (gapFix * 2), boxHeight + (gapFix * 2));
                }
            }
        }
    }
}

function createPhotoBox(x, y, w, h) {
    const box = document.createElement('div');
    box.className = 'photo-box';
    box.style.cssText = `left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px;`;
    
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
            
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'img-wrapper';

            const img = document.createElement('img');
            img.src = ev.target.result;

            img.dataset.scale = 1; 
            img.dataset.bright = 100; 
            img.dataset.contrast = 100; 
            img.dataset.sat = 100;      
            img.dataset.x = 0; 
            img.dataset.y = 0;

            imgWrapper.appendChild(img);
            box.appendChild(imgWrapper);
            
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
            
            img.onload = () => {
                centerImageInBox(img, box);
                selectPhoto(img);
                applyStyles();
            };
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function centerImageInBox(img, box) {
    const boxRatio = box.clientWidth / box.clientHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;

    if (imgRatio > boxRatio) {
        img.style.height = '100%';
        img.style.width = 'auto';
    } else {
        img.style.width = '100%';
        img.style.height = 'auto';
    }
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
    img.closest('.photo-box').style.outline = `3px dashed var(--accent)`;
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
    if (e.target.tagName === 'IMG' && e.target.closest('.photo-box')) {
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
    setTimeout(() => { window.print(); }, 500);
};

// DOWNLOAD ENGINE
document.getElementById('downloadBtn').onclick = () => {
    const btn = document.getElementById('downloadBtn');
    btn.innerText = 'PROCESSING...';
    const xBtns = document.querySelectorAll('.remove-photo-btn');
    xBtns.forEach(b => b.style.display = 'none');
    document.querySelectorAll('.photo-box').forEach(b => b.style.outline = 'none');

    const captureArea = document.getElementById("captureArea");
    const ratio = 1200 / captureArea.clientWidth;

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
