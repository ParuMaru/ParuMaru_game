/**
 * バトル中の視覚演出（エフェクト）を管理するクラス
 */
class EffectManager {

    /**
     * 斬撃エフェクト：赤い斜めの閃光を表示
     * @param {string} targetId - エフェクトを表示する対象の要素ID
     */
    slashEffect(targetId) {
        let target = document.getElementById(targetId);
        if (!target) return;

        // ターゲットが画像(img)の場合は、レイアウト崩れを防ぐため親コンテナ(div)を対象にする
        if (target.tagName === 'IMG') {
            target = target.parentElement;
        }
            
        target.style.position = 'relative'; 
        target.style.overflow = 'visible';
            
        // 斬撃用のdiv要素（CSS: .slash-line）を生成して追加
        const slash = document.createElement('div');
        slash.className = 'slash-line';
        slash.style.zIndex = "200";
        target.appendChild(slash);

        // アニメーションが終わる0.15秒後に要素を削除
        setTimeout(() => {
            slash.remove();
        }, 150);

        // 斬撃の衝撃を表現するためにターゲットを揺らす
        this.shake(targetId);
    }
    
    /**
     * 魔法攻撃エフェクト：青白い円形の光を広げる
     */
    magicExplosion(targetId) {
        let target = document.getElementById(targetId);
        if (!target) return;
        
        if (target.tagName === 'IMG') {
            target = target.parentElement;
        }
        
        target.style.position = 'relative';
        
        // 魔法陣エフェクト（CSS: .magic-circle）を生成
        const circle = document.createElement('div');
        circle.className = 'magic-circle';
        target.appendChild(circle);

        setTimeout(() => circle.remove(), 500);
        // 魔法発動の瞬間、画面全体を青紫色にフラッシュさせる
        this.flash("rgba(69, 34, 197, 0.3)");
    }

    /**
     * ターゲットを小刻みに揺らす（ダメージを受けた時の演出）
     */
    shake(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.animation = 'none'; // 前のアニメーションをリセット
            void el.offsetHeight;        // リフローを強制（再描画させてアニメーションをやり直す）
            el.style.animation = 'shake 0.3s'; // CSS: @keyframes shake
        }
    }

    /**
     * 画面全体を一瞬指定した色で光らせる
     */
    flash(color = "white") {
        const f = document.createElement('div');
        f.className = 'screen-flash';
        f.style.background = color;
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 100);
    }

    /**
     * ダメージや回復の数値を飛び出させる
     */
    damagePopup(value, targetId, color = "#ff4757") {
        const target = document.getElementById(targetId);
        if (!target) return;
        const p = document.createElement('div');
        p.innerText = value;
        p.className = 'damage-popup'; // CSS: .damage-popup
        p.style.color = color;
        target.appendChild(p);
        setTimeout(() => p.remove(), 800);
    }

    /**
     * 回復エフェクト（味方のカードを緑色に光らせる）
     */
    healEffect(targetCardId) {
        const target = document.getElementById(targetCardId);
        if (!target) return;

        target.style.position = 'relative';

        const h = document.createElement('div');
        h.className = 'heal-light'; // CSS: .heal-light
        target.appendChild(h);

        setTimeout(() => h.remove(), 600);
    }
    
    /**
     * 蘇生エフェクト（キャラクターカード全体を光らせる）
     */
    resurrectionEffect(targetCardId) {
        const target = document.getElementById(targetCardId);
        if (!target) return;

        target.style.animation = 'none'; 
        void target.offsetHeight; 
        target.style.animation = 'resurrectionFlash 1s ease-out';
        
        setTimeout(() => {
            if (target) target.style.animation = '';
        }, 1000);
    }

    /**
     * 敵が倒れた時の消滅演出
     */
    enemyDeath(targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;
        
        // 徐々に白く光り、上に浮き上がりながら透明になる
        target.style.transition = "all 2.0s ease-out";
        target.style.filter = "brightness(5) contrast(1.2) blur(2px)";
        target.style.opacity = "0";
        target.style.transform = "scale(1.2) translateY(-20px)";
        
        // 撃破の瞬間に画面を白くフラッシュ
        this.flash("rgba(255, 255, 255, 0.5)");
    }

    /**
     * メテオ（究極魔法）：巨大な岩が空から降ってくる演出
     */
    meteorEffect(targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;

        // 敵の現在位置を取得して、着弾地点を計算
        const rect = target.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        // 隕石オブジェクトの生成
        const rock = document.createElement('div');
        rock.className = 'meteor-rock';
        rock.style.left = `${targetX}px`;
        rock.style.top = `0px`; 
        document.body.appendChild(rock);

        // 落下前から画面を激しく揺らす（地震のような演出）
        document.body.classList.add('screen-shake');

        // JSによる座標移動の開始
        setTimeout(() => {
            rock.style.transform = `translate(-50%, ${targetY}px) scale(1.2)`;
        }, 10);

        // 着弾（0.4秒後）
        setTimeout(() => {
            rock.style.opacity = "0";

            // 着弾地点に爆発エフェクトを生成
            const explosion = document.createElement('div');
            explosion.className = 'meteor-explosion';
            target.parentElement.appendChild(explosion);

            // 強烈な閃光と、揺れの停止
            this.flash("rgba(255, 255, 255, 0.8)");
            setTimeout(() => document.body.classList.remove('screen-shake'), 200);

            // 要素のクリーンアップ
            setTimeout(() => {
                if (rock.parentNode) rock.parentNode.removeChild(rock);
                if (explosion.parentNode) explosion.parentNode.removeChild(explosion);
            }, 500);
        }, 410); 
    }

    /**
     * ファイア（単体魔法）：火球が飛んでいき、敵が燃え上がる
     */
    fireEffect(targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        const ball = document.createElement('div');
        ball.className = 'fireball';

        // 画面下部（プレイヤー側）から発射
        ball.style.left = `50%`; 
        ball.style.top = `90%`;
        document.body.appendChild(ball);

        // 敵に向かって斜めに飛ばす計算
        setTimeout(() => {
            ball.style.transform = `translate(${targetX - (window.innerWidth/2)}px, -${window.innerHeight * 0.9 - targetY}px) scale(1.2)`;
        }, 20);

        // 着弾時の燃焼演出
        setTimeout(() => {
            ball.style.opacity = "0";

            const fire = document.createElement('div');
            fire.className = 'fire-burn';
            target.parentElement.appendChild(fire);

            this.flash("rgba(255, 69, 0, 0.4)");

            setTimeout(() => {
                if (ball.parentNode) ball.parentNode.removeChild(ball);
                if (fire.parentNode) fire.parentNode.removeChild(fire);
            }, 500);
        }, 320);
    }

    /**
     * ファイラ（全体魔法）：全ての生存している敵が順に燃え上がる
     */
    allFireEffect(enemies) {
        enemies.forEach((enemy, i) => {
            if (!enemy.is_alive()) return;

            const targetId = `enemy-sprite-${i}`;
            const target = document.getElementById(targetId);
            if (!target) return;

            // 1体につき3本の火柱を時間差で発生させて、炎の激しさを演出
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

        // 全体魔法の重量感を出すために画面を揺らす
        document.body.classList.add('screen-shake');
        this.flash("rgba(255, 69, 0, 0.6)");
        setTimeout(() => document.body.classList.remove('screen-shake'), 400);
    }
}