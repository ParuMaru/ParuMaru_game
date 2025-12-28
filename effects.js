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
    


    meteorEffect(targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;

        // 1. ターゲット（敵）の画面上の位置を取得
        const rect = target.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        // 2. 岩を生成
        const rock = document.createElement('div');
        rock.className = 'meteor-rock';
        // 最初は画面上の外
        rock.style.left = `${targetX}px`;
        rock.style.top = `0px`; 
        document.body.appendChild(rock);

        // 3. 画面を揺らし始める
        document.body.classList.add('screen-shake');

        // 4. 少し遅らせてターゲットの位置まで落下させる
        setTimeout(() => {
            rock.style.transform = `translate(-50%, ${targetY}px) scale(1.2)`;
        }, 10);

        // 5. 着弾時の処理
        setTimeout(() => {
            // 岩を消す
            rock.style.opacity = "0";

            // 爆発エフェクトを敵の位置に出す
            const explosion = document.createElement('div');
            explosion.className = 'meteor-explosion';
            target.parentElement.appendChild(explosion); // 敵の親要素に追加

            // 閃光と揺れの停止
            this.flash("rgba(255, 255, 255, 0.8)");
            setTimeout(() => document.body.classList.remove('screen-shake'), 200);

            // 要素の掃除
            setTimeout(() => {
                if (rock.parentNode) rock.parentNode.removeChild(rock);
                if (explosion.parentNode) explosion.parentNode.removeChild(explosion);
            }, 500);
        }, 410); // transitionの0.4sに合わせる
    }

    fireEffect(targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        const ball = document.createElement('div');
        ball.className = 'fireball';

        // 画面の下側（魔法使いの位置あたり）から発射
        ball.style.left = `50%`; 
        ball.style.top = `90%`;
        document.body.appendChild(ball);

        // 敵に向かって飛ばす
        setTimeout(() => {
            ball.style.transform = `translate(${targetX - (window.innerWidth/2)}px, -${window.innerHeight * 0.9 - targetY}px) scale(1.2)`;
        }, 20);

        // 着弾
        setTimeout(() => {
            ball.style.opacity = "0";

            const fire = document.createElement('div');
            fire.className = 'fire-burn';
            target.parentElement.appendChild(fire);

            // 小さなフラッシュ
            this.flash("rgba(255, 69, 0, 0.4)");

            setTimeout(() => {
                if (ball.parentNode) ball.parentNode.removeChild(ball);
                if (fire.parentNode) fire.parentNode.removeChild(fire);
            }, 500);
        }, 320);
    }

    allFireEffect(enemies) {
        enemies.forEach((enemy, i) => {
            if (!enemy.is_alive()) return;

            const targetId = `enemy-sprite-${i}`;
            const target = document.getElementById(targetId);
            if (!target) return;

            
            [0, 1, 2].forEach((j) => {
                setTimeout(() => {
                    const fire = document.createElement('div');
                    fire.className = 'fire-burn';
                    fire.style.marginLeft = `${(j - 1) * 15}px`;
                    target.parentElement.appendChild(fire);

                    setTimeout(() => {
                        if (fire.parentNode) fire.parentNode.removeChild(fire);
                    }, 600);
                }, j * 80); 
            });
        });

        document.body.classList.add('screen-shake');
        this.flash("rgba(255, 69, 0, 0.6)");
        setTimeout(() => document.body.classList.remove('screen-shake'), 400);
    }
    
    
}