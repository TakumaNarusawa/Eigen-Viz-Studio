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
                
                for val, mult, vects in eigen_data:
                    l_latex = format_latex(val)
                    for v in vects:
                        eigenvalues_latex.append(l_latex)
                        eigenvectors_latex.append([format_latex(v[0]), format_latex(v[1])])
                
                val, mult, vects = eigen_data[0]
                v = vects[0]
                
                u = [float(sp.re(v[0]).evalf()), float(sp.re(v[1]).evalf())]
                w = [float(sp.im(v[0]).evalf()), float(sp.im(v[1]).evalf())]
                
                return json.dumps({
                    "dim": 2,
                    "has_real_eigenvectors": False,
                    "has_complex_eigenvectors": True,
                    "complex_u": u,
                    "complex_w": w,
                    "eigenvalues_float": [],
                    "eigenvectors_float": [],
                    "eigenvalues_latex": eigenvalues_latex,
                    "eigenvectors_latex": eigenvectors_latex
                })
                
            eigen_data = M.eigenvects()
            
            eigenvalues_latex = []
            eigenvalues_float = []
            eigenvectors_float = []
            eigenvectors_latex = []
            
            for val, mult, vects in eigen_data:
                val_f = val.evalf()
                l_float = float(sp.re(val_f))
                l_latex = format_latex(val)
                
                for v in vects:
                    eigenvalues_latex.append(l_latex)
                    eigenvalues_float.append(l_float)
                    
                    v1_float = float(sp.re(v[0].evalf()))
                    v2_float = float(sp.re(v[1].evalf()))
                    eigenvectors_float.append([v1_float, v2_float])
                    
                    eigenvectors_latex.append([format_latex(v[0]), format_latex(v[1])])
            
            is_diagonalizable = False
            p_matrix = []
            d_matrix = []
            p_inv_matrix = []
            not_diagonalizable_reason = None

            try:
                num_eigenvectors = len(eigenvectors_float)
                if num_eigenvectors == 2:
                    P, D = M.diagonalize()
                    
                    if P.det() != 0:
                        P_inv = P.inv()
                        
                        def mat_to_list(mat):
                            return [[float(sp.re(mat[0,0].evalf())), float(sp.re(mat[0,1].evalf()))],
                                    [float(sp.re(mat[1,0].evalf())), float(sp.re(mat[1,1].evalf()))]]
                        
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
            
            for val, mult, vects in eigen_data:
                val_f = val.evalf()
                l_float = float(sp.re(val_f))
                l_latex = format_latex(val)
                
                if abs(float(sp.im(val_f))) > 1e-6:
                    has_complex_eigenvectors = True
                
                for v in vects:
                    eigenvalues_latex.append(l_latex)
                    eigenvalues_float.append(l_float)
                    
                    v1_float = float(sp.re(v[0].evalf()))
                    v2_float = float(sp.re(v[1].evalf()))
                    v3_float = float(sp.re(v[2].evalf()))
                    eigenvectors_float.append([v1_float, v2_float, v3_float])
                    
                    eigenvectors_latex.append([format_latex(v[0]), format_latex(v[1]), format_latex(v[2])])
            
            is_diagonalizable = False
            p_matrix = []
            d_matrix = []
            p_inv_matrix = []
            not_diagonalizable_reason = None

            try:
                num_eigenvectors = len(eigenvectors_float)
                if num_eigenvectors == 3 and not has_complex_eigenvectors:
                    P, D = M.diagonalize()
                    
                    if P.det() != 0:
                        P_inv = P.inv()
                        
                        def mat_to_list(mat):
                            return [[float(sp.re(mat[0,0].evalf())), float(sp.re(mat[0,1].evalf())), float(sp.re(mat[0,2].evalf()))],
                                    [float(sp.re(mat[1,0].evalf())), float(sp.re(mat[1,1].evalf())), float(sp.re(mat[1,2].evalf()))],
                                    [float(sp.re(mat[2,0].evalf())), float(sp.re(mat[2,1].evalf())), float(sp.re(mat[2,2].evalf()))]]
                        
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
