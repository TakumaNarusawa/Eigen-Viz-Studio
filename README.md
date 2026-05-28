# Eigen-Viz Studio
> **固有値・固有ベクトルの極上可視化Webアプリケーション**

> 🤖 **AI-Assisted Development**  
> 本プロジェクトは、Google DeepMindが開発したAIコーディングアシスタント **Antigravity** とのペアプログラミングによって開発・リファクタリングされています。

Eigen-Viz Studio は、線形代数学における「線形変換」「固有値」「固有ベクトル」を、ブラウザ上で直感的かつ美しく可視化する教育・研究用Webアプリケーションです。
ブラウザ内で動作する強力な数学エンジン（**Pyodide & SymPy**）と、美しい 3D WebGL グラフィックス（**Three.js**）を融合させ、空間の変形と固有空間の関係性を極上のビジュアルで表現します。

- **デモサイトURL**: [Eigen-Viz Studio デモサイト](https://eigen-viz-studio.takumanarusawa.workers.dev/)
- **開発言語・環境**: HTML5 / JavaScript (Vanilla) / CSS3 (ガラスモフィズムUI) / Cloudflare Pages

---

## 🌌 主な機能と特徴

### 1. 2D/3D空間の動的可視化
- **2D平面**: 空間グリッドの変形アニメーションと共に、固有空間（シアン色の光の軸）をダイナミックに描画。
- **3D空間**: 3x3行列による空間全体の伸縮や回転変形に対し、回転の不変軸や伸縮方向をエメラルドグリーンの光の軸として立体的に可視化。

### 2. 複素固有値と不変楕円の軌道
- 実固有ベクトルが存在しない（固有値が複素共役）場合、空間が回転・伸縮する軌道を示す**不変空間（不変楕円の軌道：マゼンタ色の光）**を自動計算して美しく可視化。

### 3. 行列の対角化（Diagonalization）の3ステップアニメーション
- $\mathbf{A} = \mathbf{P}\mathbf{D}\mathbf{P}^{-1}$ のプロセスを独自の幾何学アニメーションで視覚的に説明。
  1. **Step 1 (基底変換 $\mathbf{P}^{-1}$)**: 固有ベクトルを新しい座標軸とする「固有空間」へ世界を歪ませます。
  2. **Step 2 (伸縮 $\mathbf{D}$)**: 新しい座標軸に沿って、固有値倍だけ純粋に直交伸縮させます。
  3. **Step 3 (元の空間への射影 $\mathbf{P}$)**: 伸縮された世界を、元の座標系へと引き戻します。

---

## 🛠️ 技術スタック

- **フロントエンド**: HTML5, Vanilla JavaScript, CSS3 (ガラスモフィズムUI)
- **3Dグラフィックス**: Three.js (WebGL)
- **数式計算エンジン**: Pyodide & SymPy (WebAssemblyによるブラウザ側Python実行環境)
- **非同期計算処理**: WebWorkerによるメインスレッドと計算スレッドの完全分離（フリーズ防止・タイムアウト制御）
- **数式レンダリング**: KaTeX
- **ホスティング**: Cloudflare Pages

---

## 🚀 ローカルでの動作手順

本アプリケーションは完全にブラウザ側で完結する静的アセット構成となっています。セキュリティ上の制約（WebWorkerの読み込み制限など）のため、ローカルで動作確認を行う際は、ローカル Web サーバーの起動が必要です。

```bash
# 1. リポジトリのクローン
git clone https://github.com/あなたのユーザー名/Eigen-Viz-Studio.git
cd Eigen-Viz-Studio

# 2. ローカルサーバーの起動 (例: Python)
python -m http.server 8000

# (または Node.js / npm の場合)
# npx http-server -p 8000
```
ブラウザで [http://localhost:8000](http://localhost:8000) にアクセスしてください。

---

## 📂 ディレクトリ構成

```text
Eigen-Viz-Studio/
├── index.html       # メイン UI（ガラスモフィズム構造、タブ切替ロジック）
├── style.css        # ハーモニアス・ダークネオンのデザインシステム定義
├── main_2d.js       # 2D Canvas 描画エンジン、Worker管理、2Dロジック
├── main_3d.js       # 3D Three.js WebGL レンダラー、3Dコントロール
├── worker.js        # WebWorker 上で動作する Pyodide & SymPy 計算コア
├── wrangler.jsonc   # Cloudflare Pages へのデプロイ・アセット設定
├── LICENSE          # MIT ライセンスドキュメント
├── RELEASE_NOTES.md # リリース履歴と変更点
└── README.md        # 本書
```

---

## 📝 リリースノート

詳細な更新履歴や過去の変更点については、[RELEASE_NOTES.md](RELEASE_NOTES.md) をご参照ください。

---

## 📄 ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。商用・個人利用・二次配布を問わず自由にご利用いただけます。
