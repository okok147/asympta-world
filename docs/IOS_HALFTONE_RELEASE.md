# Asympta World — 白紙與淡色角色更新

2026-11-03（香港時間）。已實作、分發 **TestFlight 1.0（6）**，並在 Dev iPad 的正式 TestFlight 同版完成本輪實機場景驗證。

## 已實作

- 接近白色的紙底，只有極細紙紋；角色色調沒有跟著漂白。
- 五個獨立、可點選的半色調角色：戴帽旅人、小貓、小兔、刺蝟、小羊。
- 淡藍、淡黃與淡橘網點光暈；角色圖像和 Aura 分開繪製。
- 移除標題、鳥、海報／郵票、花卉、樹木、天空、河流、地形、路徑與石拱門。
- 底部 Home／Explore／Friends；Home 保留 Aura、語言、動態設定及筆記入口。
- 保留原角色識別碼、個人存檔格式、收藏與筆記；沒有資料遷移、清除或新增網路權限。

## 發佈證據

- Bundle：`com.asympta.world`；Apple App：`6828764417`。
- 正式產品來源：[5fec447c3512cd61499ae3bab96af3515a7b40b6](https://github.com/okok147/asympta-world/commit/5fec447c3512cd61499ae3bab96af3515a7b40b6)，已推送並核對 remote main。
- Apple build：`418ebdc2-373f-4128-b4a3-36b50f299c86`，provider 狀態 `VALID`。
- Existing Internal Testers：`03c11663-f390-47ae-8c72-797473d1cfd8`，已獨立查得群組可取得此版。
- 簽署封裝成功；IPA family `[1]`、直向、版本1.0（6），新角色素材與來源逐位元相符。
- IPA SHA256：`7eb05f69534795b4b8b6ef1859f96784bb808c4b8f17fe61eec0b3fba02b300e`。
- 封裝／Apple／群組收據保留於本聊天輸出目錄。。

## 同版實機結果

使用者接回並解鎖後，原生 lockState 確認已解鎖，裝置池確認 Dev idle／無其他 owner；取得獨佔後透過 TestFlight 的精確 build6 offer 點 Update／Open，CoreDevice 獨立核對正式 bundle1.0（6）。實際系統提示與控制中心覆蓋畫面曾阻擋測試，保留失敗紀錄；沒有把被遮住的底層 App 樹或操作器成功當成通過。以一次正常 Home／返回產品收起控制中心，按實際 StoreKit Share Feedback 的原生 Continue 後，才進行場景。

下列結果有實際操作、前後原生狀態及截圖：

- 近白色紙底、五個半色調角色、低不透明度網點光暈；沒有標題或背景景物，初始構圖無角色裁切。
- 點選旅人 → 角色面板 → Close；Friends → 前往刺蝟 → 實際聚焦 → Explore 回到五角色構圖。
- Home → Aura；實際切換Gentle並查看紙面，再還原原本Curious。
- 全域語言切換繁體中文、日本語、英文；底部導覽實際隨語言改變，最後還原英文。
- 拖曳、雙指縮放、Explore回位、背景返回、一次冷啟動。
- 原有個人資料在變更及還原後逐位元相同；沒有把私有資料內容放進交付檔。
- 裝置池release收據確認本session已釋放，active=null，沒有取消其他工作。

同版完整結果及截圖保留於原任務outputs/build6；原始失敗、原生狀態、操作器與xcresult保留於work/build6，未提交私有資料。

驗證範圍是Dev iPad的iPhone相容模式；未宣稱實體iPhone、所有輔助字級、長時間穩定性或真人藝術評價。沒有使用Simulator、側載產品或內部測試替代。未提交公開App Review。

## 素材

使用內建 imagegen，依本聊天確認的v6視覺稿製作透明五角色圖集。核心提示：保留五個淡色半色調角色，以等寬五格排列、透明背景、無光暈及景物；光暈與白紙由 App 原生分開繪製。圖集與來源記錄已在正式產品 commit 中保存。
