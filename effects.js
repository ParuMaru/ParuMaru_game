class EffectManager {

    // 斬撃エフェクト：赤い斜めの閃光
    slashEffect(targetId) {
    let target = document.getElementById(targetId);
    if (!target) return;

    // もしターゲットが画像(enemy-sprite)だったら、親のコンテナ(enemy-target)を取得
    if (target.tagName === 'IMG') {
        target = target.parentElement;
    }
        
    target.style.position = 'relative'; 
    target.style.overflow = 'visible';
        
    // 斬撃要素を作成
    const slash = document.createElement('div');
    slash.className = 'slash-line';
    slash.style.zIndex = "200";
    target.appendChild(slash);

    // 0.15秒で消去
    setTimeout(() => {
        slash.remove();
    }, 150);

    // 衝撃で敵を揺らす
    this.shake(targetId);
    }
    
    // 魔法攻撃エフェクト：青白い爆発のような光
    magicExplosion(targetId) {
        let target = document.getElementById(targetId);
        if (!target) return;
        
        // もしターゲットが画像(enemy-sprite)だったら、親のコンテナ(enemy-target)を取得
        if (target.tagName === 'IMG') {
            target = target.parentElement;
        }
        
        target.style.position = 'relative';
        
        const circle = document.createElement('div');
        circle.className = 'magic-circle';
        target.appendChild(circle);

        setTimeout(() => circle.remove(), 500);
        // 魔法は画面全体を少し光らせる
        this.flash("rgba(69, 34, 197, 0.3)");
    }

    // 共通の揺れ
    shake(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.animation = 'none';
            void el.offsetHeight; // リフローを強制してアニメーションを再トリガー
            el.style.animation = 'shake 0.3s';
        }
    }

    // 画面フラッシュ
    flash(color = "white") {
        const f = document.createElement('div');
        f.className = 'screen-flash';
        f.style.background = color;
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 100);
    }

    // 数字ポップアップ
    damagePopup(value, targetId, color = "#ff4757") {
        const target = document.getElementById(targetId);
        if (!target) return;
        const p = document.createElement('div');
        p.innerText = value;
        p.className = 'damage-popup';
        p.style.color = color;
        target.appendChild(p);
        setTimeout(() => p.remove(), 800);
    }

    // 回復エフェクト
    healEffect(targetCardId) {
    const target = document.getElementById(targetCardId);
    if (!target) return;

    // もしカードが relative になっていなかったら強制的に設定（位置ズレ防止）
    target.style.position = 'relative';

    const h = document.createElement('div');
    h.className = 'heal-light';
    target.appendChild(h);

    // アニメーション終了後に削除
    setTimeout(() => h.remove(), 600);
}
    
    // 蘇生のエフェクト（金色の強い光）
    resurrectionEffect(targetCardId) {
        const target = document.getElementById(targetCardId);
        if (!target) return; // IDが見つからない場合のエラー防止を追加

        target.style.animation = 'none'; // 一度リセット
        void target.offsetHeight; // リフロー
        target.style.animation = 'resurrectionFlash 1s ease-out';
        
        // アニメーションが終わったらクリア
        setTimeout(() => {
            if (target) target.style.animation = '';
        }, 1000);
    }


    enemyDeath(targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;
        
        // 震えながら白く光り、消えていくアニメーション
        target.style.transition = "all 2.0s ease-out";
        target.style.filter = "brightness(5) contrast(1.2) blur(2px)";
        target.style.opacity = "0";
        target.style.transform = "scale(1.2) translateY(-20px)";
        
        // 画面全体を一瞬白くフラッシュさせる
        this.flash("rgba(255, 255, 255, 0.5)");
    }
}