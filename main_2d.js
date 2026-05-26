// ==========================================================================
// 2D EIGEN VISUALIZER ENGINE & MATHEMATICAL CONTROLLER
// このファイルは、2D空間における線形変換（行列）と固有ベクトルの可視化を担当します。
// WebWorker (Pyodide & SymPy) を呼び出し、リアルタイムに行列計算を行います。
// ==========================================================================

(function () {
    const container = document.getElementById('canvas-container-2d');
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let width, height, centerX, centerY;

    function resize() {
        width = container.clientWidth;
        height = container.clientHeight;
        centerX = width / 2;
        centerY = height / 2;
        canvas.width = width;
        canvas.height = height;
    }
    window.addEventListener('resize', resize);
    window.resizeCanvas2D = resize;
    resize();

    // --- Animation States ---
    let transformState = 0; // 0: Idle, 1: Highlighting, 2: Transforming, 3: Diagonalization
    let highlightTick = 0;
    let animationProgress = 0;

    let targetMatrix = [[1, 0], [0, 1]];
    let eigenAngles = [];
    let eigenvalues = [];
    let matrixP = null, matrixD = null, matrixPInv = null;
    let isDiagonalizable = false;

    // Complex invariant space variables
    let complexU = null;
    let complexW = null;

    // --- HUD updates ---
    const hudStatus = document.getElementById('hud-status');
    const progressContainer = document.getElementById('hud-anim-progress-container');
    const progressBar = document.getElementById('hud-progress-bar');

    function updateHUD(status, progress = null) {
        hudStatus.textContent = status;
        if (progress !== null) {
            progressContainer.style.display = 'flex';
            progressBar.style.width = `${progress * 100}%`;
        } else {
            progressContainer.style.display = 'none';
        }
    }

    // --- Reset 2D State ---
    window.resetApp2D = function () {
        transformState = 0;
        highlightTick = 0;
        animationProgress = 0;
        eigenAngles = [];
        complexU = null;
        complexW = null;
        document.getElementById('results').style.display = 'none';
        document.getElementById('btn-diagonalize').style.display = 'none';
        updateHUD("待機中");
    };

    // --- Main 2D Animation Loop ---
    /**
     * 2Dキャンバスのメイン描画ループ。
     * 行列の変換アニメーション、グリッド、固有ベクトル、不変楕円などを毎フレーム描画します。
     * 状態(transformState)に応じて、補間アニメーションを実行します。
     */
    function render() {
        requestAnimationFrame(render);

        // Render only if currently in 2D mode
        if (!document.body.classList.contains('mode-2d')) return;

        // Update logic
        if (transformState === 1) {
            highlightTick++;
            updateHUD("固有空間の解析中...", Math.min(1.0, highlightTick / 90.0));
            if (highlightTick > 90) { // Approx 1.5s delay
                transformState = 2;
                animationProgress = 0;
            }
        } else if (transformState === 2) {
            if (animationProgress < 1.0) {
                animationProgress += 0.006;
                if (animationProgress >= 1.0) {
                    animationProgress = 1.0;
                    updateHUD("変換完了");
                } else {
                    updateHUD("線形変換アニメーション中", animationProgress);
                }
            }
        } else if (transformState === 3) {
            // Diagonalization animation logic
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
                        stage = "元の空間へ射影中 (P)";
                    } else if (animationProgress >= 1.0) {
                        stage = "固有値倍の伸縮中 (D)";
                    }
                    updateHUD(`対角化: ${stage}`, animationProgress / 3.0);
                }
            }
        }

        let ease = (transformState === 2) ? (1 - Math.pow(1 - animationProgress, 3)) : 0;
        let currentMatrix = [[1, 0], [0, 1]];
        let stepLabel = "";

        if (transformState === 2) {
            currentMatrix = [
                [1 + (targetMatrix[0][0] - 1) * ease, 0 + (targetMatrix[0][1] - 0) * ease],
                [0 + (targetMatrix[1][0] - 0) * ease, 1 + (targetMatrix[1][1] - 1) * ease]
            ];
        } else if (transformState === 3) {
            // Multi-stage diagonalization animation
            if (highlightTick < 60) {
                // Keep static Identity matrix before animation triggers
                currentMatrix = [[1, 0], [0, 1]];
            } else {
                let p = animationProgress;

                function interpolate(M1, M2, t) {
                    let easeT = 1 - Math.pow(1 - t, 3);
                    return [
                        [M1[0][0] + (M2[0][0] - M1[0][0]) * easeT, M1[0][1] + (M2[0][1] - M1[0][1]) * easeT],
                        [M1[1][0] + (M2[1][0] - M1[1][0]) * easeT, M1[1][1] + (M2[1][1] - M1[1][1]) * easeT]
                    ];
                }

                function multiply(A, B) {
                    return [
                        [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
                        [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]
                    ];
                }

                const Identity = [[1, 0], [0, 1]];
                if (p < 1) {
                    currentMatrix = interpolate(Identity, matrixPInv, p);
                    stepLabel = "Step 1: 基底変換 (P⁻¹)";
                } else if (p < 2) {
                    let d_p_inv = multiply(matrixD, matrixPInv);
                    currentMatrix = interpolate(matrixPInv, d_p_inv, p - 1);
                    stepLabel = "Step 2: 固有値倍 (D)";
                } else {
                    let d_p_inv = multiply(matrixD, matrixPInv);
                    let p_d_p_inv = multiply(matrixP, d_p_inv);
                    currentMatrix = interpolate(d_p_inv, p_d_p_inv, p - 2);
                    stepLabel = "Step 3: 元の基底へ (P)";
                }
            }
        }

        ctx.clearRect(0, 0, width, height);

        // Draw Step Label (Diagonalization)
        if (stepLabel) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.font = "bold 20px 'Outfit', sans-serif";
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(168, 85, 247, 0.5)";
            ctx.shadowBlur = 8;
            ctx.fillText(stepLabel, centerX, 120);
            ctx.shadowBlur = 0; // Reset shadow
        }

        const unit = 50;
        const gridLimit = Math.ceil(Math.max(width, height) / unit);

        // 1. DRAW ORIGINAL STATIC GRID
        ctx.lineCap = "butt";
        for (let i = -gridLimit; i <= gridLimit; i++) {
            if (i === 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 0.8;
            }

            let x = centerX + i * unit;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();

            let y = centerY - i * unit;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // 2. DRAW EIGEN/INVARIANT STRUCTURES IN BACKGROUND
        let glowStrength = (transformState === 1) ? Math.min(1.0, highlightTick / 30.0) : 1.0;
        if (transformState === 0) glowStrength = 0;

        if (glowStrength > 0) {
            if (eigenAngles.length > 0) {
                // Real Eigenvectors Axis
                for (let j = 0; j < eigenAngles.length; j++) {
                    let angle = eigenAngles[j];
                    let ex = Math.cos(angle);
                    let ey = Math.sin(angle);
                    
                    let tx = currentMatrix[0][0] * ex + currentMatrix[0][1] * ey;
                    let ty = currentMatrix[1][0] * ex + currentMatrix[1][1] * ey;
                    
                    let len = Math.sqrt(tx * tx + ty * ty);
                    if (len > 0) {
                        tx = (tx / len) * width;
                        ty = (ty / len) * width;
                    }
                    
                    let dx = tx;
                    let dy = -ty; // Canvas Y axis is downwards

                    ctx.lineCap = "round";

                    ctx.beginPath();
                    ctx.moveTo(centerX - dx, centerY - dy); ctx.lineTo(centerX + dx, centerY + dy);
                    ctx.strokeStyle = `rgba(0, 229, 255, ${0.12 * glowStrength})`; ctx.lineWidth = 16; ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(centerX - dx, centerY - dy); ctx.lineTo(centerX + dx, centerY + dy);
                    ctx.strokeStyle = `rgba(0, 229, 255, ${0.4 * glowStrength})`; ctx.lineWidth = 4; ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(centerX - dx, centerY - dy); ctx.lineTo(centerX + dx, centerY + dy);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * glowStrength})`; ctx.lineWidth = 1.2; ctx.stroke();
                }
            } else if (complexU && complexW) {
                // Complex Invariant Ellipse orbit
                ctx.lineCap = "round";

                function drawEllipsePath(c) {
                    c.beginPath();
                    for (let k = 0; k <= 100; k++) {
                        let theta = k * Math.PI * 2 / 100;
                        let ex = Math.cos(theta) * complexU[0] + Math.sin(theta) * complexW[0];
                        let ey = Math.cos(theta) * complexU[1] + Math.sin(theta) * complexW[1];
                        let tx = currentMatrix[0][0] * ex + currentMatrix[0][1] * ey;
                        let ty = currentMatrix[1][0] * ex + currentMatrix[1][1] * ey;
                        if (k === 0) c.moveTo(centerX + tx, centerY - ty);
                        else c.lineTo(centerX + tx, centerY - ty);
                    }
                }

                // Ellipse glow (Vibrant Magenta)
                drawEllipsePath(ctx);
                ctx.strokeStyle = `rgba(168, 85, 247, ${0.15 * glowStrength})`; ctx.lineWidth = 16; ctx.stroke();

                drawEllipsePath(ctx);
                ctx.strokeStyle = `rgba(168, 85, 247, ${0.4 * glowStrength})`; ctx.lineWidth = 4; ctx.stroke();

                drawEllipsePath(ctx);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * glowStrength})`; ctx.lineWidth = 1.5; ctx.stroke();

                // Track dynamic warping ellipse
                if (transformState > 1 && ease > 0 && ease < 1) {
                    ctx.beginPath();
                    for (let k = 0; k <= 100; k++) {
                        let theta = k * Math.PI * 2 / 100;
                        let ex = Math.cos(theta) * complexU[0] + Math.sin(theta) * complexW[0];
                        let ey = Math.cos(theta) * complexU[1] + Math.sin(theta) * complexW[1];
                        let tx = currentMatrix[0][0] * ex + currentMatrix[0][1] * ey;
                        let ty = currentMatrix[1][0] * ex + currentMatrix[1][1] * ey;
                        if (k === 0) ctx.moveTo(centerX + tx, centerY - ty);
                        else ctx.lineTo(centerX + tx, centerY - ty);
                    }
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * Math.sin(animationProgress * Math.PI)})`;
                    ctx.lineWidth = 1.0; ctx.stroke();
                }

                // Markers tracking points along the ellipse
                for (let m = 0; m < 5; m++) {
                    let theta = m * (Math.PI * 2 / 5);
                    let origX = Math.cos(theta) * complexU[0] + Math.sin(theta) * complexW[0];
                    let origY = Math.cos(theta) * complexU[1] + Math.sin(theta) * complexW[1];

                    let tx = currentMatrix[0][0] * origX + currentMatrix[0][1] * origY;
                    let ty = currentMatrix[1][0] * origX + currentMatrix[1][1] * origY;

                    ctx.beginPath();
                    ctx.arc(centerX + tx, centerY - ty, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = `#fff`; ctx.fill();
                    ctx.strokeStyle = `rgba(168, 85, 247, ${glowStrength})`; ctx.lineWidth = 2; ctx.stroke();
                }
            }
        }

        // 3. DRAW DYNAMIC MOVING GRID
        ctx.lineCap = "butt";
        for (let i = -gridLimit; i <= gridLimit; i++) {
            if (i === 0) {
                ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
                ctx.lineWidth = 2.0;
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
                ctx.lineWidth = 0.8;
            }

            // Vertical grid lines mapped
            let vx1 = currentMatrix[0][0] * i + currentMatrix[0][1] * (-gridLimit);
            let vy1 = currentMatrix[1][0] * i + currentMatrix[1][1] * (-gridLimit);
            let vx2 = currentMatrix[0][0] * i + currentMatrix[0][1] * (gridLimit);
            let vy2 = currentMatrix[1][0] * i + currentMatrix[1][1] * (gridLimit);

            ctx.beginPath();
            ctx.moveTo(centerX + vx1 * unit, centerY - vy1 * unit);
            ctx.lineTo(centerX + vx2 * unit, centerY - vy2 * unit);
            ctx.stroke();

            // Horizontal grid lines mapped
            let hx1 = currentMatrix[0][0] * (-gridLimit) + currentMatrix[0][1] * i;
            let hy1 = currentMatrix[1][0] * (-gridLimit) + currentMatrix[1][1] * i;
            let hx2 = currentMatrix[0][0] * (gridLimit) + currentMatrix[0][1] * i;
            let hy2 = currentMatrix[1][0] * (gridLimit) + currentMatrix[1][1] * i;

            ctx.beginPath();
            ctx.moveTo(centerX + hx1 * unit, centerY - hy1 * unit);
            ctx.lineTo(centerX + hx2 * unit, centerY - hy2 * unit);
            ctx.stroke();
        }

        // 4. DRAW BASIS VECTORS (i-hat, j-hat)
        let ix = currentMatrix[0][0], iy = currentMatrix[1][0];
        let jx = currentMatrix[0][1], jy = currentMatrix[1][1];
        let scale = 1.0 * unit;

        function drawArrow(x1, y1, x2, y2, color) {
            let headlen = 10;
            let angle = Math.atan2(y2 - y1, x2 - x1);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
            ctx.strokeStyle = color;
            ctx.lineWidth = 3.5;
            ctx.lineJoin = "round";
            ctx.stroke();
        }

        // i-hat (Red/Coral)
        drawArrow(centerX, centerY, centerX + ix * scale, centerY - iy * scale, '#f87171');
        // j-hat (Green/Emerald)
        drawArrow(centerX, centerY, centerX + jx * scale, centerY - jy * scale, '#34d399');

        // DRAW ORIGIN POINT
        ctx.beginPath(); ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    requestAnimationFrame(render);

    // ==========================================================================
    // MATHEMATICAL WEB WORKER CONTROLLER (2D/3D SHARED ENGINE INITIALIZATION)
    // ==========================================================================
    window.pyodideReady = false;
    window.myWorker = new Worker('worker.js');

    const statusBadge = document.getElementById('engine-status-badge');
    const loadingOverlay = document.getElementById('loading-overlay');

    window.myWorker.onmessage = function (e) {
        if (e.data.type === 'STATUS' && e.data.status === 'ready') {
            window.pyodideReady = true;
            statusBadge.textContent = "SymPy Engine Ready";
            statusBadge.className = "badge ready";
            loadingOverlay.style.opacity = '0';
            setTimeout(() => loadingOverlay.style.display = 'none', 500);
        } else if (e.data.type === 'ERROR') {
            console.error("Worker Core Fail:", e.data.error);
            document.getElementById('loading-text').innerHTML = `
              <h2 style="color: #ef4444;">エンジン起動エラー</h2>
              <p>数学エンジンの準備に失敗しました。<br><span style="color: #9ca3af; font-size: 0.8em;">${e.data.error}</span></p>
            `;
        }
    };

    // --- Click Event: Matrix Transform (2D Part) ---
    /**
     * 変換実行ボタン押下時の処理。
     * ユーザーが入力した2x2行列を取得し、WebWorker上のSymPyエンジンに計算リクエスト（CALCULATE）を送信します。
     */
    document.getElementById('btn-transform').addEventListener('click', async () => {
        // Run only if mode is 2D
        if (!document.body.classList.contains('mode-2d')) return;

        if (transformState === 2 && animationProgress < 1.0) return;
        if (transformState === 3 && animationProgress < 3.0) return;
        if (transformState === 1 && highlightTick < 90) return;

        const rawM00 = document.getElementById('m00').value;
        const rawM01 = document.getElementById('m01').value;
        const rawM10 = document.getElementById('m10').value;
        const rawM11 = document.getElementById('m11').value;

        if (rawM00 === '' || rawM01 === '' || rawM10 === '' || rawM11 === '') {
            show2DError("数値をすべて入力してください。");
            return;
        }

        const m00 = parseFloat(rawM00);
        const m01 = parseFloat(rawM01);
        const m10 = parseFloat(rawM10);
        const m11 = parseFloat(rawM11);

        if (!isFinite(m00) || !isFinite(m01) || !isFinite(m10) || !isFinite(m11)) {
            show2DError("有効な数値を入力してください。");
            return;
        }

        if (Math.abs(m00) > 1e6 || Math.abs(m01) > 1e6 || Math.abs(m10) > 1e6 || Math.abs(m11) > 1e6) {
            show2DError("入力値の絶対値は 1,000,000 以下にしてください。");
            return;
        }

        targetMatrix = [[m00, m01], [m10, m11]];

        try {
            if (!window.pyodideReady) {
                show2DError("数学エンジンが起動処理中です...少々お待ちください。");
                return;
            }

            const resultsPanel = document.getElementById('results');
            const statusEl = document.getElementById('status');
            resultsPanel.style.display = 'block';
            statusEl.textContent = "SymPyで固有値解析中...";

            // Post task to WebWorker with 3 seconds timeout
            let pyResultStr;
            try {
                pyResultStr = await new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                        window.myWorker.terminate();
                        // Re-initialize a new worker to recover
                        window.myWorker = new Worker('worker.js');
                        reject(new Error("計算タイムアウト: 行列が複雑すぎて 3秒 を超えました。プロセスの暴走を防ぐため終了しました。"));
                    }, 3000);

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

            // Reset current visual structures
            eigenAngles = [];
            eigenvalues = [];
            complexU = null;
            complexW = null;
            matrixP = null;
            matrixD = null;
            matrixPInv = null;
            isDiagonalizable = false;
            document.getElementById('btn-diagonalize').style.display = 'none';

            if (resData.has_complex_eigenvectors) {
                let html = `実数の固有ベクトルが存在しません。<br>代わりに、<b>不変楕円の軌道</b>（複素固有ベクトルの実部・虚部が張る空間）が現れます。`;

                let lambdaLatex = resData.eigenvalues_latex[0];
                let vecLatex0 = resData.eigenvectors_latex[0][0];
                let vecLatex1 = resData.eigenvectors_latex[0][1];
                let mathHtml = katex.renderToString(`\\lambda = ${lambdaLatex},\\quad \\vec{v} = \\begin{bmatrix} ${vecLatex0} \\\\ ${vecLatex1} \\end{bmatrix}`, { throwOnError: false });

                html += `<div class="eigdiv">${mathHtml}</div>`;

                complexU = resData.complex_u;
                complexW = resData.complex_w;
                let maxR = 0.001;
                for (let k = 0; k < 100; k++) {
                    let theta = k * Math.PI * 2 / 100;
                    let x = Math.cos(theta) * complexU[0] + Math.sin(theta) * complexW[0];
                    let y = Math.cos(theta) * complexU[1] + Math.sin(theta) * complexW[1];
                    let r = Math.sqrt(x * x + y * y);
                    if (r > maxR) maxR = r;
                }

                // Normalize radius to 180px for visualization clarity
                let scaleVal = 180 / maxR;
                complexU[0] *= scaleVal; complexU[1] *= scaleVal;
                complexW[0] *= scaleVal; complexW[1] *= scaleVal;

                statusEl.innerHTML = html;
            } else {
                let html = '';
                let seenIndices = new Set();

                for (let i = 0; i < resData.eigenvalues_float.length; i++) {
                    if (seenIndices.has(i)) continue;

                    let lambdaVal = resData.eigenvalues_float[i];
                    let indices = [i];

                    for (let j = i + 1; j < resData.eigenvalues_float.length; j++) {
                        if (Math.abs(resData.eigenvalues_float[j] - lambdaVal) < 1e-7) {
                            indices.push(j);
                        }
                    }

                    indices.forEach(idx => seenIndices.add(idx));

                    let lambdaLatex = resData.eigenvalues_latex[i];
                    let vectorsLatex = indices.map(idx => {
                        let v0 = resData.eigenvectors_latex[idx][0];
                        let v1 = resData.eigenvectors_latex[idx][1];
                        return `\\begin{bmatrix} ${v0} \\\\ ${v1} \\end{bmatrix}`;
                    }).join(',\\ ');

                    let label = (indices.length > 1) ? " (重解)" : "";

                    let mathHtml = katex.renderToString(`\\lambda = ${lambdaLatex}${label},\\quad \\vec{v} = ${vectorsLatex}`, {
                        throwOnError: false,
                        displayMode: false
                    });
                    html += `<div class="eigdiv">${mathHtml}</div>`;

                    indices.forEach(idx => {
                        let vecF = resData.eigenvectors_float[idx];
                        eigenAngles.push(Math.atan2(vecF[1], vecF[0]));
                    });
                }

                if (resData.is_diagonalizable) {
                    isDiagonalizable = true;
                    matrixP = resData.matrix_p;
                    matrixD = resData.matrix_d;
                    matrixPInv = resData.matrix_p_inv;
                    document.getElementById('btn-diagonalize').style.display = 'inline-block';
                } else if (resData.not_diagonalizable_reason) {
                    let reasonText = "対角化できません。";
                    if (resData.not_diagonalizable_reason === "singular_p_matrix") {
                        reasonText = "固有ベクトルからなる行列Pが特異行列（行列式が0）のため逆行列が定義できず、対角化できません。";
                    } else if (resData.not_diagonalizable_reason === "repeated_eigenvalues") {
                        reasonText = "固有値が重解を持ち、独立な固有ベクトルが不足しているため対角化できません（代数的重複度 > 幾何学的重複度）。";
                    }
                    const warnDiv = document.createElement('div');
                    warnDiv.style.color = '#f59e0b';
                    warnDiv.style.marginTop = '10px';
                    warnDiv.style.fontSize = '0.85rem';
                    warnDiv.innerHTML = `※ ${reasonText}`;
                    html += warnDiv.outerHTML;
                }
                statusEl.innerHTML = html;
            }

            // Add symmetric matrix badge
            if (m01 === m10) {
                const symHtml = `<div class="symmetric-badge">
                    <span>✨ <b>対称行列</b>: 直交行列により対角化可能です（固有ベクトルが直交します）。</span>
                </div>`;
                statusEl.innerHTML = symHtml + statusEl.innerHTML;
            }

            transformState = 1;
            highlightTick = 0;
            animationProgress = 0;

        } catch (err) {
            console.error(err);
            document.getElementById('status').innerText = "エラー: 計算処理に失敗しました。";
        }
    });

    // --- Click Event: Reset ---
    document.getElementById('btn-reset').addEventListener('click', () => {
        if (!document.body.classList.contains('mode-2d')) return;
        window.resetApp2D();
    });

    // --- Click Event: Diagonalize ---
    document.getElementById('btn-diagonalize').addEventListener('click', () => {
        if (!document.body.classList.contains('mode-2d')) return;

        if (transformState === 2 && animationProgress < 1.0) return;
        if (transformState === 3 && animationProgress < 3.0) return;
        if (transformState === 1 && highlightTick < 90) return;

        transformState = 3;
        animationProgress = 0;
        highlightTick = 0;
    });

    function show2DError(msg) {
        const resultsPanel = document.getElementById('results');
        const statusEl = document.getElementById('status');
        resultsPanel.style.display = 'block';
        statusEl.innerHTML = `<span style="color:#ef4444">${msg}</span>`;
    }

})();
