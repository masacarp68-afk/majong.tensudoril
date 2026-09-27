# 麻雀 点数ドリル

スマホで暇な時間に麻雀の点数計算を練習できるWebアプリ。

## 機能
- **練習**：翻符→点（70符まで）／符計算／手牌→点／早見表
- **タイムアタック**：10問の合計タイム（誤答1問+5秒）。自己ベストを保存
- **対戦**：4桁の部屋番号で集まって早押し。一番早く正解した人に1点、誤答はお手つき
- **ランキング**：解答速度（タイムアタック）と累計正解数、それぞれのTOPを表示

ランキングと対戦は Firebase（匿名ログイン + Realtime Database）を使う。未設定でも練習・タイムアタックは動く。

## Firebase の設定
1. https://console.firebase.google.com でプロジェクトを作成
2. 「構築 → Authentication → ログイン方法」で **匿名** を有効化
3. 「構築 → Realtime Database」でデータベースを作成（ロックモードで開始）
4. Realtime Database の「ルール」に `database.rules.json` の中身を貼って公開
5. 「プロジェクトの設定 → マイアプリ → ウェブ(</>)」でアプリを登録し、表示された `firebaseConfig` を `firebase-config.js` に貼る
6. Authentication の「設定 → 承認済みドメイン」に `masacarp68-afk.github.io` を追加

## ファイル
- `engine.js` 手牌生成・役判定・符計算・点数計算
- `quiz.js` 問題作成・牌表示・解説
- `online.js` Firebase（ランキング・対戦部屋）
- `app.js` 画面
- `database.rules.json` Realtime Database のセキュリティルール

## ルール
- 手牌問題は50符以下のよく出る形
- 赤ドラ・本場・切り上げ満貫なし、連風牌の雀頭は4符
- 役満になる手は出題しない

## 素材
麻雀牌画像：あゆぴん素材「まるカド麻雀牌」
