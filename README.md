# Crossy Road 3D Prototype (天天過馬路 3D 原型開發文件)

本專案為基於 **Three.js** 與 **Vanilla JS** 打造的 3D 體素 (Voxel) 風格 Crossy Road 遊戲原型，融入了**極簡單鈕道具**與**3秒快節奏復活機制**。

---

## 一、 遊戲操作說明 (Controls & Keybindings)

### 1. 角色移動 (Movement)
- **`[W]`**：向前跳躍 1 格 (Forward)
- **`[A]`**：向左跳躍 1 格 (Left)
- **`[D]`**：向右跳躍 1 格 (Right)
- **`[S]`** / **`[▼]`**：向後跳躍 1 格 (Backward)
- **行動裝置 / 滑鼠**：可直接點擊畫面右下角虛擬 D-Pad 或點擊螢幕向前跳。

### 2. 局內道具快捷鍵 (Item Keybindings)
- **`[1]`**：切換並立即使用 **🛡️ 金剛護盾 (Shield)**
- **`[2]`**：切換並立即使用 **🚀 火箭跳躍 (Rocket Hop)**
- **`[3]`**：切換並立即使用 **⏳ 個人超感時間 (Reflex Hyper)**
- **`[Space]` / `[E]`**：觸發當前裝備之道具

---

## 二、 核心道具與視覺演出 (Items & Visual VFX)

| 快捷鍵 | 道具名稱 | 類型 | 機制說明 (對自己有利) | 視覺與打擊感演出 (VFX) |
| :---: | :--- | :--- | :--- | :--- |
| **`[1]`** | **金剛護盾** | 防禦保命 | 開啟後 3.5 秒內抵擋 1 次車輛撞擊或落水。 | 雙層金光防護罩，**車輛撞擊時會半透明穿透 (Phase Through)** 滑過小雞，流暢不卡腳；落水時凝結金色水波浮台。 |
| **`[2]`** | **火箭跳躍** | 瞬間位移 | 正前方爆衝 3 個網格，跨越寬河或密集車道。 | 尾部噴出體素火焰與灰煙粒子，落腳時發出「咚！」重音與地面環狀震塵波。 |
| **`[3]`** | **個人超感時間** | 環境控制 | 個人跳躍頻率提升 2 倍（冷卻時間減半），輕鬆過馬路。 | 以小雞為中心擴散淡藍色時鐘波紋，全螢幕邊緣出現微藍慢動作濾鏡與殘影。 |

---

## 三、 復活機制 (3-Second Fast Respawn)

- **3秒原地復活**：當玩家撞車或落水死亡時，可點擊 **「⚡ 3秒原地復活」** 按鈕。
- **演出**：角色將在 3 秒內帶著傘降特效從 10 單位高空慢慢降落回安全草地上，分數不中斷，免去重開局與大廳等待。

---

## 四、 專案架構與檔案說明 (Project Structure)

```text
crossy-road-prototype/
├── index.html              # 遊戲主 HTML 載體、HUD 介面與快捷鍵提示
├── style.css               # 玻璃擬態 HUD 樣式、道具面板與彈窗
├── README.md               # 本開發說明文件
├── package.json            # Three.js 與 Vite 配置
├── src/
│   ├── main.js             # 遊戲主入口與主渲染 Loop
│   ├── config.js           # 網格大小 (GRID_SIZE=1.2)、色彩與參數定義
│   ├── graphics/
│   │   ├── SceneSetup.js   # Three.js 正交相機 (OrthographicCamera) 與軟陰影
│   │   └── VoxelModels.js  # Voxel 體素模型 (小雞, 車輛, 樹木, 木塊, 火車, 護盾, 火箭, 時空波紋)
│   ├── mechanics/
│   │   ├── Player.js       # 玩家角色網格跳躍、3秒復活與轉向控制器
│   │   ├── MapGenerator.js # 無限動態地圖生成器 (Grass, Road, River, Railroad)
│   │   ├── Physics.js      # AABB 碰撞檢測、護盾車輛穿透與網格 Bump 判定
│   │   └── ItemSystem.js   # 道具冷卻管理與 3D VFX 粒子觸發
│   └── ui/
│       └── UIManager.js    # HUD 選項切換與冷卻時間 UI 畫圈更新
```

---

## 五、 如何在本地執行 (How to Run)

### 方法 A：使用靜態伺服器 / VSCode Live Server (開箱即用)
使用任何 HTTP 靜態伺服器開啟 `index.html` 即可直接瀏覽試玩。

### 方法 B：使用 Node.js / Vite
```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```
