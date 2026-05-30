importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

let pyodideReady = false;
let pyodideInstance = null;

async function init() {
    try {
        pyodideInstance = await loadPyodide();
        await pyodideInstance.loadPackage("sympy");
        
        // Python code string supporting both 2D (2x2) and 3D (3x3)
        const pythonCode = `
import sympy as sp
import json

def calculate_eigen_json(matrix_str):
    try:
        matrix = json.loads(matrix_str)
        n = len(matrix)
        
        # Check if all elements are integers (either integer type or float with integral value)
        is_all_ints = all(isinstance(x, (int, float)) and x.is_integer() if isinstance(x, float) else isinstance(x, int) for row in matrix for x in row)
        
        def format_latex(val):
            if is_all_ints:
                return sp.latex(sp.simplify(val))
            else:
                val_f = val.evalf()
                re_part = float(sp.re(val_f))
                im_part = float(sp.im(val_f))
                re_round = round(re_part, 2)
                im_round = round(im_part, 2)
                if im_round == 0:
                    if int(re_round) == re_round:
                        return f"{int(re_round)}"
                    return f"{re_round:.2f}"
                else:
                    sign = "+" if im_round > 0 else "-"
                    img = abs(im_round)
                    re_str = f"{int(re_round)}" if int(re_round) == re_round else f"{re_round:.2f}"
                    im_str = f"{int(img)}" if int(img) == img else f"{img:.2f}"
                    if re_round == 0:
                        return f"{sign if sign == '-' else ''}{im_str}i"
                    return f"{re_str} {sign} {im_str}i"

        def clean_complex(val):
            val_f = val.evalf()
            re_val = float(sp.re(val_f))
            im_val = float(sp.im(val_f))
            # 1e-10以下の極めて微小な虚部は数値演算ノイズとみなして0.0に丸める
            if abs(im_val) < 1e-10:
                im_val = 0.0
            return re_val, im_val

        if n == 2:
            M = sp.Matrix([
                [sp.Rational(str(matrix[0][0])), sp.Rational(str(matrix[0][1]))],
                [sp.Rational(str(matrix[1][0])), sp.Rational(str(matrix[1][1]))]
            ])
            
            a = M[0,0]
            b = M[0,1]
            c = M[1,0]
            d = M[1,1]
            
            trace = a + d
            det_val = a * d - b * c
            discriminant = trace**2 - 4 * det_val
            
            if discriminant < 0:
                eigen_data = M.eigenvects()
                eigenvalues_latex = []
                eigenvectors_latex = []
                eigenvalues_complex = []
                eigenvectors_complex = []
                
                for val, mult, vects in eigen_data:
                    l_latex = format_latex(val)
                    re_val, im_val = clean_complex(val)
                    
                    for v in vects:
                        eigenvalues_latex.append(l_latex)
                        eigenvalues_complex.append([re_val, im_val])
                        eigenvectors_latex.append([format_latex(v[0]), format_latex(v[1])])
                        
                        v_comp = []
                        for comp in v:
                            re_c, im_c = clean_complex(comp)
                            v_comp.append([re_c, im_c])
                        eigenvectors_complex.append(v_comp)
                
                val, mult, vects = eigen_data[0]
                v = vects[0]
                
                # 複素固有ベクトルの実部・虚部を抽出
                re_v0, im_v0 = clean_complex(v[0])
                re_v1, im_v1 = clean_complex(v[1])
                u = [re_v0, re_v1]
                w = [im_v0, im_v1]
                
                return json.dumps({
                    "dim": 2,
                    "has_real_eigenvectors": False,
                    "has_complex_eigenvectors": True,
                    "complex_u": u,
                    "complex_w": w,
                    "eigenvalues_float": [],
                    "eigenvectors_float": [],
                    "eigenvalues_latex": eigenvalues_latex,
                    "eigenvectors_latex": eigenvectors_latex,
                    "eigenvalues_complex": eigenvalues_complex,
                    "eigenvectors_complex": eigenvectors_complex
                })
                
            eigen_data = M.eigenvects()
            
            eigenvalues_latex = []
            eigenvalues_float = []
            eigenvectors_float = []
            eigenvectors_latex = []
            eigenvalues_complex = []
            eigenvectors_complex = []
            
            for val, mult, vects in eigen_data:
                l_latex = format_latex(val)
                re_val, im_val = clean_complex(val)
                l_float = re_val
                
                for v in vects:
                    eigenvalues_latex.append(l_latex)
                    eigenvalues_float.append(l_float)
                    eigenvalues_complex.append([re_val, im_val])
                    
                    re_v1, _ = clean_complex(v[0])
                    re_v2, _ = clean_complex(v[1])
                    eigenvectors_float.append([re_v1, re_v2])
                    
                    eigenvectors_latex.append([format_latex(v[0]), format_latex(v[1])])
                    
                    v_comp = []
                    for comp in v:
                        re_c, im_c = clean_complex(comp)
                        v_comp.append([re_c, im_c])
                    eigenvectors_complex.append(v_comp)
            
            is_diagonalizable = False
            p_matrix = []
            d_matrix = []
            p_inv_matrix = []
            not_diagonalizable_reason = None

            try:
                if M.is_diagonalizable():
                    P, D = M.diagonalize()
                    
                    if P.det() != 0:
                        P_inv = P.inv()
                        
                        def mat_to_list(mat):
                            # 対角化行列の値もclean_complexで浮動小数点化
                            r00, _ = clean_complex(mat[0,0])
                            r01, _ = clean_complex(mat[0,1])
                            r10, _ = clean_complex(mat[1,0])
                            r11, _ = clean_complex(mat[1,1])
                            return [[r00, r01], [r10, r11]]
                        
                        p_matrix = mat_to_list(P)
                        d_matrix = mat_to_list(D)
                        p_inv_matrix = mat_to_list(P_inv)
                        is_diagonalizable = True
                    else:
                        is_diagonalizable = False
                        not_diagonalizable_reason = "singular_p_matrix"
                else:
                    is_diagonalizable = False
                    not_diagonalizable_reason = "repeated_eigenvalues"
            except Exception as e:
                is_diagonalizable = False
                not_diagonalizable_reason = str(e)
                    
            return json.dumps({
                "dim": 2,
                "has_real_eigenvectors": True,
                "has_complex_eigenvectors": False,
                "eigenvalues_float": eigenvalues_float,
                "eigenvectors_float": eigenvectors_float,
                "eigenvalues_latex": eigenvalues_latex,
                "eigenvectors_latex": eigenvectors_latex,
                "eigenvalues_complex": eigenvalues_complex,
                "eigenvectors_complex": eigenvectors_complex,
                "is_diagonalizable": is_diagonalizable,
                "matrix_p": p_matrix,
                "matrix_d": d_matrix,
                "matrix_p_inv": p_inv_matrix,
                "not_diagonalizable_reason": not_diagonalizable_reason
            })
            
        elif n == 3:
            M = sp.Matrix([
                [sp.Rational(str(matrix[0][0])), sp.Rational(str(matrix[0][1])), sp.Rational(str(matrix[0][2]))],
                [sp.Rational(str(matrix[1][0])), sp.Rational(str(matrix[1][1])), sp.Rational(str(matrix[1][2]))],
                [sp.Rational(str(matrix[2][0])), sp.Rational(str(matrix[2][1])), sp.Rational(str(matrix[2][2]))]
            ])
            
            eigen_data = M.eigenvects()
            
            eigenvalues_latex = []
            eigenvalues_float = []
            eigenvectors_float = []
            eigenvectors_latex = []
            has_complex_eigenvectors = False
            eigenvalues_complex = []
            eigenvectors_complex = []
            
            for val, mult, vects in eigen_data:
                l_latex = format_latex(val)
                re_val, im_val = clean_complex(val)
                l_float = re_val
                
                if abs(im_val) > 1e-6:
                    has_complex_eigenvectors = True
                
                for v in vects:
                    eigenvalues_latex.append(l_latex)
                    eigenvalues_float.append(l_float)
                    eigenvalues_complex.append([re_val, im_val])
                    
                    re_v1, _ = clean_complex(v[0])
                    re_v2, _ = clean_complex(v[1])
                    re_v3, _ = clean_complex(v[2])
                    eigenvectors_float.append([re_v1, re_v2, re_v3])
                    
                    eigenvectors_latex.append([format_latex(v[0]), format_latex(v[1]), format_latex(v[2])])
                    
                    v_comp = []
                    for comp in v:
                        re_c, im_c = clean_complex(comp)
                        v_comp.append([re_c, im_c])
                    eigenvectors_complex.append(v_comp)
            
            is_diagonalizable = False
            p_matrix = []
            d_matrix = []
            p_inv_matrix = []
            not_diagonalizable_reason = None

            try:
                if M.is_diagonalizable() and not has_complex_eigenvectors:
                    P, D = M.diagonalize()
                    
                    if P.det() != 0:
                        P_inv = P.inv()
                        
                        def mat_to_list(mat):
                            r00, _ = clean_complex(mat[0,0])
                            r01, _ = clean_complex(mat[0,1])
                            r02, _ = clean_complex(mat[0,2])
                            r10, _ = clean_complex(mat[1,0])
                            r11, _ = clean_complex(mat[1,1])
                            r12, _ = clean_complex(mat[1,2])
                            r20, _ = clean_complex(mat[2,0])
                            r21, _ = clean_complex(mat[2,1])
                            r22, _ = clean_complex(mat[2,2])
                            return [[r00, r01, r02],
                                    [r10, r11, r12],
                                    [r20, r21, r22]]
                        
                        p_matrix = mat_to_list(P)
                        d_matrix = mat_to_list(D)
                        p_inv_matrix = mat_to_list(P_inv)
                        is_diagonalizable = True
                    else:
                        is_diagonalizable = False
                        not_diagonalizable_reason = "singular_p_matrix"
                elif has_complex_eigenvectors:
                    is_diagonalizable = False
                    not_diagonalizable_reason = "complex_eigenvalues"
                else:
                    is_diagonalizable = False
                    not_diagonalizable_reason = "repeated_eigenvalues"
            except Exception as e:
                is_diagonalizable = False
                not_diagonalizable_reason = str(e)
                    
            return json.dumps({
                "dim": 3,
                "has_complex_eigenvectors": has_complex_eigenvectors,
                "eigenvalues_float": eigenvalues_float,
                "eigenvectors_float": eigenvectors_float,
                "eigenvalues_latex": eigenvalues_latex,
                "eigenvectors_latex": eigenvectors_latex,
                "eigenvalues_complex": eigenvalues_complex,
                "eigenvectors_complex": eigenvectors_complex,
                "is_diagonalizable": is_diagonalizable,
                "matrix_p": p_matrix,
                "matrix_d": d_matrix,
                "matrix_p_inv": p_inv_matrix,
                "not_diagonalizable_reason": not_diagonalizable_reason
            })
        else:
            return json.dumps({"error": "Unsupported matrix size."})
    except Exception as e:
        return json.dumps({"error": "Internal calculation error. (Pyodide: " + str(e) + ")"})
`
        pyodideInstance.runPython(pythonCode);
        pyodideReady = true;
        postMessage({ type: 'STATUS', status: 'ready' });
    } catch (err) {
        postMessage({ type: 'ERROR', error: err.message });
    }
}

self.onmessage = async (event) => {
    let msg = event.data;
    if (msg.type === "CALCULATE") {
        if (!pyodideReady) {
            postMessage({ type: 'RESULT', payload: JSON.stringify({error: "エンジンがまだ準備中"})});
            return;
        }
        try {
            pyodideInstance.globals.set("js_matrix_data", JSON.stringify(msg.matrix));
            const pyResultStr = pyodideInstance.runPython(`calculate_eigen_json(js_matrix_data)`);
            postMessage({ type: 'RESULT', payload: pyResultStr });
        } catch (err) {
            postMessage({ type: 'RESULT', payload: JSON.stringify({error: "Python実行エラー: " + err.message})});
        }
    }
};

init();
