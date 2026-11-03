# Asympta World — 白紙與淡色角色更新

2026-11-03（香港時間）。已實作並分發 **TestFlight 1.0（6）**；尚未安裝或完成本版實體 iPad 場景驗證。

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
- 本聊天輸出目錄保留封裝、Apple及群組JSON；私有工作目錄保留原始封裝與裝置失敗證據。。

## 實機阻礙及接續

TestFlight 發佈完成後，原本可見的 Dev iPad 變成離線。裝置池 acquire 回傳 `pool_waiting`／`offline`、`executed_steps:0`，沒有取得租約或操作裝置。精確 Dev UDID 的原生 lockState 讀取也回傳 CoreDevice4016、無法滿足可信連線／電源 assertion。原因未知，不能推定是設定或信任故障。

需要 Dev iPad 接回同一 Mac 並解鎖。恢復後沿用相同 Apple build、來源及 IPA，不重傳。只用正式 TestFlight Update → Open → 實際提示 → 核對已安裝1.0（6），再執行以下尚未測項目：

1. 白色紙底、五個角色與淡色網點光暈，沒有任何已移除的背景景物；無裁切或重疊。
2. 點選角色、開啟／關閉角色面板與 Friends，相遇返回可操作紙面。
3. Home、Aura、全域語言與個人設定正常；還原原選擇並保護存檔。
4. 拖曳／縮放後 Explore 回到五角色構圖。
5. 背景返回、冷啟動與原有個人資料保留。

編譯、上傳及可下載不代表以上場景已通過。沒有使用 Simulator、側載產品或內部測試替代。未提交公開 App Review。

## 素材

使用內建 imagegen，依本聊天確認的v6視覺稿製作透明五角色圖集。核心提示：保留五個淡色半色調角色，以等寬五格排列、透明背景、無光暈及景物；光暈與白紙由 App 原生分開繪製。圖集與來源記錄已在正式產品 commit 中保存。
