// ==========================================================================
// 3D EIGEN VISUALIZER ENGINE (Three.js WebGL)
// このファイルは、Three.js を用いて3次元空間の線形変換と固有ベクトルを可視化します。
// ==========================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('canvas-container-3d');

// --- Three.js Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(10, 8, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
// Shift focus point slightly to left for balanced presentation
controls.target.set(-1.5, 0, 0);
controls.update();
controls.saveState();

// Resize handling
function resize3D() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}
window.addEventListener('resize', resize3D);
window.resizeCanvas3D = resize3D;

// --- Animation States ---
let transformState = 0; // 0: Idle, 1: Highlighting, 2: Transforming, 3: Diagonalizing
let highlightTick = 0;
let animationProgress = 0;

let targetMatrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
let currentMatrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
let matrixP = null, matrixD = null, matrixPInv = null;
let isDiagonalizable = false;

// 3D Groups
const gridGroup = new THREE.Group();
scene.add(gridGroup);

const basisGroup = new THREE.Group();
scene.add(basisGroup);

const eigenGroup = new THREE.Group();
scene.add(eigenGroup);

// --- Create 3D Grid ---
const gridSize = 5;
const gridColor = new THREE.Color(0x10b981); // Emerald accent for 3D
const materialGrid = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.15 });

const gridLinesOriginal = [];

function createInitialGrid() {
    gridGroup.clear();
    gridLinesOriginal.length = 0;

    for (let i = -gridSize; i <= gridSize; i++) {
        for (let j = -gridSize; j <= gridSize; j++) {
            // Z-axis lines
            let geometryZ = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(i, j, -gridSize),
                new THREE.Vector3(i, j, gridSize)
            ]);
            gridLinesOriginal.push({ geom: geometryZ, p1: [i, j, -gridSize], p2: [i, j, gridSize] });

            // Y-axis lines
            let geometryY = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(i, -gridSize, j),
                new THREE.Vector3(i, gridSize, j)
            ]);
            gridLinesOriginal.push({ geom: geometryY, p1: [i, -gridSize, j], p2: [i, gridSize, j] });

            // X-axis lines
            let geometryX = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-gridSize, i, j),
                new THREE.Vector3(gridSize, i, j)
            ]);
            gridLinesOriginal.push({ geom: geometryX, p1: [-gridSize, i, j], p2: [gridSize, i, j] });
        }
    }

    gridLinesOriginal.forEach(line => {
        const mesh = new THREE.Line(line.geom, materialGrid);
        gridGroup.add(mesh);
    });
}
createInitialGrid();

// Create Faint Background Axes
const axesHelper = new THREE.AxesHelper(gridSize * 1.5);
const axesColors = axesHelper.geometry.attributes.color;
for (let i = 0; i < axesColors.count; i++) {
    axesColors.setXYZ(i, axesColors.getX(i) * 0.3, axesColors.getY(i) * 0.3, axesColors.getZ(i) * 0.3);
}
scene.add(axesHelper);

// --- Create Basis Vectors ---
let iHat, jHat, kHat;
function createBasis() {
    basisGroup.clear();
    const origin = new THREE.Vector3(0, 0, 0);
    const length = 1.5;

    iHat = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, length, 0xf87171, 0.25, 0.15); // Coral
    jHat = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, length, 0x34d399, 0.25, 0.15); // Emerald
    kHat = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, length, 0x60a5fa, 0.25, 0.15); // Blue

    basisGroup.add(iHat);
    basisGroup.add(jHat);
    basisGroup.add(kHat);
}
createBasis();

// --- Update Matrix Transformations in 3D Elements ---
function updateObjectsWithMatrix(mat) {
    let idx = 0;
    gridGroup.children.forEach(lineMesh => {
        const orig = gridLinesOriginal[idx];

        const tx1 = mat[0][0] * orig.p1[0] + mat[0][1] * orig.p1[1] + mat[0][2] * orig.p1[2];
        const ty1 = mat[1][0] * orig.p1[0] + mat[1][1] * orig.p1[1] + mat[1][2] * orig.p1[2];
        const tz1 = mat[2][0] * orig.p1[0] + mat[2][1] * orig.p1[1] + mat[2][2] * orig.p1[2];

        const tx2 = mat[0][0] * orig.p2[0] + mat[0][1] * orig.p2[1] + mat[0][2] * orig.p2[2];
        const ty2 = mat[1][0] * orig.p2[0] + mat[1][1] * orig.p2[1] + mat[1][2] * orig.p2[2];
        const tz2 = mat[2][0] * orig.p2[0] + mat[2][1] * orig.p2[1] + mat[2][2] * orig.p2[2];

        const positions = lineMesh.geometry.attributes.position.array;
        positions[0] = tx1; positions[1] = ty1; positions[2] = tz1;
        positions[3] = tx2; positions[4] = ty2; positions[5] = tz2;
        lineMesh.geometry.attributes.position.needsUpdate = true;

        idx++;
    });

    const vI = new THREE.Vector3(mat[0][0], mat[1][0], mat[2][0]);
    const vJ = new THREE.Vector3(mat[0][1], mat[1][1], mat[2][1]);
    const vK = new THREE.Vector3(mat[0][2], mat[1][2], mat[2][2]);

    if (vI.lengthSq() > 1e-10) {
        const len = vI.length() * 1.5;
        iHat.setDirection(vI.clone().normalize());
        iHat.setLength(len, Math.min(0.25, len * 0.5), Math.min(0.15, len * 0.5));
        iHat.visible = true;
    } else {
        iHat.visible = false;
    }

    if (vJ.lengthSq() > 1e-10) {
        const len = vJ.length() * 1.5;
        jHat.setDirection(vJ.clone().normalize());
        jHat.setLength(len, Math.min(0.25, len * 0.5), Math.min(0.15, len * 0.5));
        jHat.visible = true;
    } else {
        jHat.visible = false;
    }

    if (vK.lengthSq() > 1e-10) {
        const len = vK.length() * 1.5;
        kHat.setDirection(vK.clone().normalize());
        kHat.setLength(len, Math.min(0.25, len * 0.5), Math.min(0.15, len * 0.5));
        kHat.visible = true;
    } else {
        kHat.visible = false;
    }
}

// --- HUD Controller for 3D ---
const hudStatus = document.getElementById('hud-status');

function updateHUD(status, progress = null) {
    if (!document.body.classList.contains('mode-3d')) return;
    hudStatus.textContent = status;
}

// --- Reset 3D App State ---
window.resetApp3D = function () {
    transformState = 0;
    highlightTick = 0;
    animationProgress = 0;
    eigenGroup.clear();
    document.getElementById('results').style.display = 'none';
    document.getElementById('btn-diagonalize').disabled = true;
    controls.reset();

    // Reset standard grid lines
    currentMatrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    updateObjectsWithMatrix(currentMatrix);

    const labelEl = document.getElementById('step-label');
    if (labelEl) labelEl.remove();

    updateHUD("待機中");
};

// --- Render Loop (Three.js Loop) ---
/**
 * 3D空間のメイン描画ループ。
 * Three.js の renderer を用いてシーンを描画し、状態に応じた行列アニメーションを実行します。
 */
function renderLoop() {
    requestAnimationFrame(renderLoop);

    if (!document.body.classList.contains('mode-3d')) return;

    controls.update();

    if (transformState === 1) {
        highlightTick++;
        updateHUD("固有空間の解析中...", Math.min(1.0, highlightTick / 90.0));
        if (highlightTick > 90) {
            transformState = 2;
            animationProgress = 0;
        }
    } else if (transformState === 2) {
        if (animationProgress < 1.0) {
            animationProgress += 0.006;
            if (animationProgress >= 1.0) {
                animationProgress = 1.0;
                updateHUD("変形完了");
            } else {
                updateHUD("空間変形アニメーション中", animationProgress);
            }
        }
    } else if (transformState === 3) {
        if (highlightTick < 60) {
            highlightTick++;
            updateHUD("対角化: 基底変換中 (P⁻¹)", 0);
        } else if (animationProgress < 3.0) {
            animationProgress += 0.004;
            if (animationProgress >= 3.0) {
                animationProgress = 3.0;
                updateHUD("対角化完了");
            } else {
                let stage = "基底変換中 (P⁻¹)";
                if (animationProgress >= 2.0) {
                    stage = "元の空間へ戻る (P)";
                } else if (animationProgress >= 1.0) {
                    stage = "固有値倍に伸縮 (D)";
                }
                updateHUD(`対角化: ${stage}`, animationProgress / 3.0);
            }
        }
    }

    let ease = (transformState === 2) ? (1 - Math.pow(1 - animationProgress, 3)) : 0;
    let stepLabel = "";

    if (transformState === 0 || transformState === 1) {
        currentMatrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    } else if (transformState === 2) {
        currentMatrix = [
            [1 + (targetMatrix[0][0] - 1) * ease, 0 + (targetMatrix[0][1] - 0) * ease, 0 + (targetMatrix[0][2] - 0) * ease],
            [0 + (targetMatrix[1][0] - 0) * ease, 1 + (targetMatrix[1][1] - 1) * ease, 0 + (targetMatrix[1][2] - 0) * ease],
            [0 + (targetMatrix[2][0] - 0) * ease, 0 + (targetMatrix[2][1] - 0) * ease, 1 + (targetMatrix[2][2] - 1) * ease]
        ];
    } else if (transformState === 3) {
        if (highlightTick < 60) {
            currentMatrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        } else {
            let p = animationProgress;

            function interpolate3x3(M1, M2, t) {
                let easeT = 1 - Math.pow(1 - t, 3);
                let res = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        res[i][j] = M1[i][j] + (M2[i][j] - M1[i][j]) * easeT;
                    }
                }
                return res;
            }

            function multiply3x3(A, B) {
                let res = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        res[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
                    }
                }
                return res;
            }

            const Identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            if (p < 1) {
                currentMatrix = interpolate3x3(Identity, matrixPInv, p);
                stepLabel = "Step 1: 基底変換 (P⁻¹)";
            } else if (p < 2) {
                let d_p_inv = multiply3x3(matrixD, matrixPInv);
                currentMatrix = interpolate3x3(matrixPInv, d_p_inv, p - 1);
                stepLabel = "Step 2: 固有値倍 (D)";
            } else {
                let d_p_inv = multiply3x3(matrixD, matrixPInv);
                let p_d_p_inv = multiply3x3(matrixP, d_p_inv);
                currentMatrix = interpolate3x3(d_p_inv, p_d_p_inv, p - 2);
                stepLabel = "Step 3: 元の基底へ (P)";
            }
        }
    }

    updateObjectsWithMatrix(currentMatrix);

    // Animate Real Eigenvectors Glow
    let glowStrength = (transformState === 1) ? Math.min(1.0, highlightTick / 30.0) : 1.0;
    if (transformState === 0) glowStrength = 0;

    // 生き生きとした呼吸するような明滅(パルス)を追加して静的な基底ベクトルと区別
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.004);

    eigenGroup.children.forEach(line => {
        line.material.opacity = glowStrength * 0.85 * pulse;
        if (line.userData.originalVector) {
            let orig = line.userData.originalVector;
            let tx = currentMatrix[0][0] * orig.x + currentMatrix[0][1] * orig.y + currentMatrix[0][2] * orig.z;
            let ty = currentMatrix[1][0] * orig.x + currentMatrix[1][1] * orig.y + currentMatrix[1][2] * orig.z;
            let tz = currentMatrix[2][0] * orig.x + currentMatrix[2][1] * orig.y + currentMatrix[2][2] * orig.z;
            
            let tv = new THREE.Vector3(tx, ty, tz);
            if (tv.lengthSq() > 1e-10) {
                tv.normalize().multiplyScalar(gridSize * 1.5);
            }
            
            const positions = line.geometry.attributes.position.array;
            positions[0] = -tv.x; positions[1] = -tv.y; positions[2] = -tv.z;
            positions[3] = tv.x; positions[4] = tv.y; positions[5] = tv.z;
            line.geometry.attributes.position.needsUpdate = true;
        }
    });

    renderer.render(scene, camera);

    // Overlay Step labels
    let labelEl = document.getElementById('step-label');
    if (stepLabel) {
        if (!labelEl) {
            labelEl = document.createElement('div');
            labelEl.id = 'step-label';
            labelEl.style.position = 'absolute';
            labelEl.style.top = '120px';
            labelEl.style.width = '100%';
            labelEl.style.textAlign = 'center';
            labelEl.style.fontSize = '20px';
            labelEl.style.fontWeight = 'bold';
            labelEl.style.fontFamily = "'Outfit', sans-serif";
            labelEl.style.color = 'rgba(255, 255, 255, 0.9)';
            labelEl.style.textShadow = '0 0 10px rgba(168, 85, 247, 0.6)';
            labelEl.style.pointerEvents = 'none';
            labelEl.style.zIndex = '5';
            document.body.appendChild(labelEl);
        }
        labelEl.innerText = stepLabel;
    } else if (labelEl) {
        labelEl.remove();
    }
}

renderLoop();

// --- Click Event: Matrix Transform (3D Part) ---
/**
 * 3D変換実行ボタン押下時の処理。
 * ユーザーが入力した3x3行列を取得し、SymPyエンジン（WebWorker）に計算リクエストを送信します。
 */
document.getElementById('btn-transform').addEventListener('click', async () => {
    // Run only if mode is 3D
    if (!document.body.classList.contains('mode-3d')) return;

    if (transformState === 2 && animationProgress < 1.0) return;
    if (transformState === 3 && animationProgress < 3.0) return;
    if (transformState === 1 && highlightTick < 90) return;

    let m = [];
    for (let i = 0; i < 3; i++) {
        let row = [];
        for (let j = 0; j < 3; j++) {
            let val = parseFloat(document.getElementById(`m3d_${i}${j}`).value);
            if (!isFinite(val)) {
                show3DError("有効な数値をすべて入力してください。");
                return;
            }
            row.push(val);
        }
        m.push(row);
    }

    targetMatrix = m;

    try {
        if (!window.pyodideReady) {
            show3DError("数学エンジンが読込中です...少々お待ちください。");
            return;
        }

        const resultsPanel = document.getElementById('results');
        const statusEl = document.getElementById('status');
        resultsPanel.style.display = 'block';
        statusEl.textContent = "SymPyで固有値空間を解析中...";

        let pyResultStr;
        try {
            pyResultStr = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    if (window.restartWorker) {
                        window.restartWorker();
                    } else {
                        window.myWorker.terminate();
                        window.myWorker = new Worker('worker.js');
                    }
                    reject(new Error("計算タイムアウト: 行列が複雑すぎて 5秒 を超えました。プロセスの暴走を防ぐため終了しました。"));
                }, 5000);

                const onMessage = (e) => {
                    if (e.data.type === 'RESULT') {
                        clearTimeout(timeoutId);
                        window.myWorker.removeEventListener('message', onMessage);
                        resolve(e.data.payload);
                    }
                };
                window.myWorker.addEventListener('message', onMessage);
                window.myWorker.postMessage({ type: 'CALCULATE', matrix: targetMatrix });
            });
        } catch (timeoutErr) {
            statusEl.textContent = timeoutErr.message;
            updateHUD("タイムアウトエラー");
            return;
        }

        const resData = JSON.parse(pyResultStr);

        if (resData.error) {
            statusEl.textContent = resData.error;
            updateHUD("解析エラー");
            return;
        }

        eigenGroup.clear();
        isDiagonalizable = false;
        document.getElementById('btn-diagonalize').disabled = true;

        let html = '';
        let seenIndices = new Set();

        for (let i = 0; i < resData.eigenvalues_float.length; i++) {
            if (seenIndices.has(i)) continue;

            let lambdaVal = resData.eigenvalues_float[i];
            let indices = [i];

            for (let j = i + 1; j < resData.eigenvalues_float.length; j++) {
                if (Math.abs(resData.eigenvalues_float[j] - lambdaVal) < 1e-6) {
                    indices.push(j);
                }
            }

            indices.forEach(idx => seenIndices.add(idx));

            let lambdaLatex = resData.eigenvalues_latex[i];
            let vectorsLatex = indices.map(idx => {
                let v0 = resData.eigenvectors_latex[idx][0];
                let v1 = resData.eigenvectors_latex[idx][1];
                let v2 = resData.eigenvectors_latex[idx][2];
                return `\\begin{bmatrix} ${v0} \\\\ ${v1} \\\\ ${v2} \\end{bmatrix}`;
            }).join(',\\ ');

            let label = (indices.length > 1) ? " (重解)" : "";

            let mathHtml = katex.renderToString(`\\lambda = ${lambdaLatex}${label},\\; \\vec{v} = ${vectorsLatex}`, {
                throwOnError: false,
                displayMode: false
            });
            html += `<div class="eigdiv">${mathHtml}</div>`;

            // Add 3D representation for each real eigenvector axis
            indices.forEach(idx => {
                let vecF = resData.eigenvectors_float[idx];
                if (vecF[0] !== 0 || vecF[1] !== 0 || vecF[2] !== 0) {
                    let v3 = new THREE.Vector3(vecF[0], vecF[1], vecF[2]).normalize().multiplyScalar(gridSize * 1.5);
                    const mat = new THREE.LineDashedMaterial({
                        color: 0x00f5ff, // 鮮やかなネオンシアンで基底(緑)と完全差別化
                        dashSize: 0.25,
                        gapSize: 0.12,
                        transparent: true,
                        opacity: 0
                    });
                    const geom = new THREE.BufferGeometry().setFromPoints([v3.clone().negate(), v3]);
                    const line = new THREE.Line(geom, mat);
                    line.userData.originalVector = new THREE.Vector3(vecF[0], vecF[1], vecF[2]);
                    line.computeLineDistances(); // 破線描画に必要
                    eigenGroup.add(line);
                }
            });
        }

        if (resData.is_diagonalizable) {
            isDiagonalizable = true;
            matrixP = resData.matrix_p;
            matrixD = resData.matrix_d;
            matrixPInv = resData.matrix_p_inv;
            document.getElementById('btn-diagonalize').disabled = false;
        } else if (resData.not_diagonalizable_reason) {
            let reasonText = "対角化できません。";
            if (resData.not_diagonalizable_reason === "singular_p_matrix") {
                reasonText = "固有ベクトルからなる行列Pが特異行列のため対角化できません。";
            } else if (resData.not_diagonalizable_reason === "repeated_eigenvalues") {
                reasonText = "固有値が重解を持ち、独立な固有ベクトルが不足しています（代数的重複度 > 幾何学的重複度）。";
            } else if (resData.not_diagonalizable_reason === "complex_eigenvalues") {
                reasonText = "複素固有値を含むため、実数範囲では対角化できません。";
            }
            const warnDiv = document.createElement('div');
            warnDiv.style.color = '#f59e0b';
            warnDiv.style.marginTop = '10px';
            warnDiv.style.fontSize = '0.85rem';
            warnDiv.textContent = `※ ${reasonText}`;
            html += warnDiv.outerHTML;
        }
        statusEl.innerHTML = html;

        // Check Symmetric 3x3
        let isSymmetric = true;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (m[i][j] !== m[j][i]) isSymmetric = false;
            }
        }
        if (isSymmetric) {
            const symHtml = `<div class="symmetric-badge">
                <span>✨ <b>対称行列</b>: 必ず直交行列により実数対角化可能です（すべての固有ベクトルが直交します）。</span>
            </div>`;
            statusEl.innerHTML = symHtml + statusEl.innerHTML;
        }

        transformState = 1;
        highlightTick = 0;
        animationProgress = 0;

    } catch (err) {
        console.error(err);
        show3DError("バックエンドでの計算処理に失敗しました。");
    }
});

// --- Click Event: Reset ---
document.getElementById('btn-reset').addEventListener('click', () => {
    if (!document.body.classList.contains('mode-3d')) return;
    window.resetApp3D();
});

// --- Click Event: Diagonalize ---
document.getElementById('btn-diagonalize').addEventListener('click', () => {
    if (!document.body.classList.contains('mode-3d')) return;

    if (transformState === 2 && animationProgress < 1.0) return;
    if (transformState === 3 && animationProgress < 3.0) return;
    if (transformState === 1 && highlightTick < 90) return;

    transformState = 3;
    animationProgress = 0;
    highlightTick = 0;
});

function show3DError(msg) {
    const resultsPanel = document.getElementById('results');
    const statusEl = document.getElementById('status');
    resultsPanel.style.display = 'block';
    statusEl.textContent = "";
    const span = document.createElement('span');
    span.style.color = "#ef4444";
    span.textContent = msg;
    statusEl.appendChild(span);
}
