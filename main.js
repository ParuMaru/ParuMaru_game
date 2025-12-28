class BattleManager {
    constructor() {
        this.party = [
            new Hero("勇者ぱるむ"),
            new Wizard("魔法使いはな"),
            new Healer("癒し手なつ")
        ];
        
        this.enemies = [new Slime("キングスライム"),];
        
        this.current_turn_index = 0;
        this.effects = new EffectManager();
        this.items = [
            { id: "potion", name: "ポーション", count: 3, effect: 50, description: "HPを50回復" },
            { id: "ether", name: "エーテル", count: 2, effect: 30, description: "MPを30回復" },
            { id: "phoenix", name: "フェニックスの尾", count: 1, effect: 0.5, description: "仲間一人をHP50%で蘇生" }
        ];

        this.update_display();
        // ★ 最初の敵の名前を出す以前の仕様
        this.add_log(`★ ${this.enemies[0].name}が現れた！`, "#f1c40f", true);
        this.next_player_step();
        
        window.addEventListener('keydown', (e) => {
            if (e.key === 'b' || e.key === 'B') {this.debug_damage_enemies();}
            if (e.key === 'p' || e.key === 'P') {this.debug_damage_party();}

        });
    }
    
    debug_damage_enemies() {
        this.add_log("--- デバッグ: 敵全員に50ダメージ ---", "#ff4757");
        this.enemies.forEach((enemy, i) => {
        if (enemy.is_alive()) {
            enemy.set_hp(-50);
            const targetId = `enemy-sprite-${i}`;
            this.effects.damagePopup(50, targetId, "#fff");
            this.effects.slashEffect(targetId);
        }
    });
        
        this.update_display(); // 分裂判定なども自動で走る
    }

    debug_damage_party() {
    this.add_log("--- デバッグ: 味方全員に致命傷 ---", "#ff4757");
    this.party.forEach((m, i) => {
        m.set_hp(-m.get_hp() + 1); // 残りHP 1 にする
        this.effects.damagePopup("Danger!", `card-${i}`, "#ff4757");
    });
    this.update_display();
}
    
    add_log(message, color = "white", is_bold = false) {
        const logElement = document.getElementById('log');
        const newMessage = document.createElement('div');
        newMessage.style.color = color;
        if (is_bold) newMessage.style.fontWeight = "bold";
        newMessage.innerText = message;
        logElement.prepend(newMessage); 
    }

    update_display() {
    const targetArea = document.getElementById('enemy-target');
    targetArea.innerHTML = ""; 
    this.enemies.forEach((enemy, i) => {
        const unit = document.createElement('div');
        unit.className = "enemy-unit";
        
        if (enemy.is_king && enemy.is_alive()) {
            unit.classList.add("king-size");
        }
        
        // 生きている時だけ中身を表示、死んでいたら空にするか隠す
        if (enemy.is_alive()) {
            const hp_ratio = (enemy.get_hp() / enemy.max_hp) * 100;
            unit.innerHTML = `
                <div class="enemy-label">${enemy.name}</div>
                <div class="enemy-hp-container"><div class="enemy-hp-bar" style="width:${hp_ratio}%"></div></div>
                <img src="${enemy.img}" id="enemy-sprite-${i}" class="enemy-img">
            `;
        } else {
            // 死んでいる場合は、IDを保持したまま見えない要素を置いておく（座標ズレ防止）
            unit.innerHTML = `<div id="enemy-sprite-${i}" style="display:none;"></div>`;
        }
        targetArea.appendChild(unit);
    });
        
        // --- 味方のステータス表示 (バッジの色を完全復元) ---
        this.party.forEach((member, i) => {
            const hp_ratio = (member.get_hp() / member.max_hp) * 100;
            const mp_ratio = (member.get_mp() / member.max_mp) * 100;
            document.getElementById(`p${i}-hp-bar`).style.width = `${hp_ratio}%`;
            document.getElementById(`p${i}-mp-bar`).style.width = `${mp_ratio}%`;
            document.getElementById(`p${i}-hp-text`).innerText = `HP: ${member.get_hp()}`;
            document.getElementById(`p` + i + `-mp-text`).innerText = `MP: ${member.get_mp()}`;
            
            const statusElem = document.getElementById(`p${i}-status`);
            if (statusElem) {
                statusElem.innerHTML = "";
                if (member.is_alive()) {
                    // ★ バッジの背景色をインラインスタイルまたはCSSクラスで確実に指定
                    if (member.buff_turns > 0) {
                        statusElem.innerHTML += `<span class="badge" style="background-color: #f1c40f; color: #2c3e50;">ATK ▲${member.buff_turns}</span>`;
                    }
                    if (member.is_covering) {
                        statusElem.innerHTML += `<span class="badge" style="background-color: #3498db; color: white;">かばう</span>`;
                    }
                }
            }
            document.getElementById(`card-${i}`).style.opacity = member.is_alive() ? "1" : "0.5";
            document.getElementById(`card-${i}`).classList.remove('active-member');
        });

        if (this.current_turn_index < this.party.length) {
            document.getElementById(`card-${this.current_turn_index}`).classList.add('active-member');
        }
    }

    next_player_step() {
        
        if (this.enemies.every(e => !e.is_alive())) {
            this.hide_all_command_btns();
            document.getElementById('turn-label').innerText = "VICTORY!!";
            this.effects.enemyDeath('enemy-target');
            this.add_log(`★ 敵をすべて討伐した！`, "#f1c40f", true);
            setTimeout(() => {
                this.add_log("平和が訪れた...", "#ecf0f1");
                setTimeout(() => {
                    if(confirm("もう一度戦いますか？")) location.reload();
                }, 500);
            }, 1000);
            return;
        }

        if (this.current_turn_index >= this.party.length) {
            this.current_turn_index = 0;
            setTimeout(() => this.slime_turn(), 800);
            return;
        }

        const member = this.party[this.current_turn_index];
        if (!member.is_alive()) {
            this.current_turn_index++;
            this.next_player_step();
            return;
        }
        if (member.buff_turns > 0) {
            member.buff_turns--;
            // バフが切れたら通知して即座に表示を更新
            if (member.buff_turns === 0) {
                this.add_log(` > ${member.name}の攻撃力アップが切れた`, "#bdc3c7");
                this.update_display(); 
            }
        }
        
        this.setup_command_buttons(member);
    }

    setup_command_buttons(member) {
        this.hide_all_command_btns();
        document.getElementById('turn-label').innerText = `▼ ${member.name} の行動選択`;
        
        this.show_btn(0, "攻撃", "#c0392b", () => this.select_enemy_target("attack"));
        
        if (member instanceof Hero) {
            this.show_btn(1, "勇者の鼓舞(15)", "#f1c40f", () => this.execute_hero_skill(), member.get_mp() >= 15);
            this.show_btn(2, "かばう(10)", "#3498db", () => this.execute_cover(), member.get_mp() >= 10);
        } else if (member instanceof Wizard) {
            this.show_btn(1, "魔法(20)", "#2980b9", () => this.select_enemy_target("magic"), member.get_mp() >= 20);
            this.show_btn(2, "瞑想", "#9b59b6", () => this.execute_meditation());
        } else if (member instanceof Healer) {
            this.show_btn(1, "ヒール(15)", "#27ae60", () => this.select_target("heal"), member.get_mp() >= 15);
            // ★ 蘇生ボタンの動的名称変更を復元
            const can_res = member.get_mp() >= 40;
            this.show_btn(2, can_res ? "蘇生(40)" : "命の代償", "#8e44ad", () => this.select_target("resurrection"));
        }
        this.show_btn(3, "どうぐ", "#d35400", () => this.show_item_list());
    }

    select_enemy_target(action_type) {
        document.getElementById('turn-label').innerText = "どの敵を狙いますか？";
        this.hide_all_command_btns();

        // 生きている敵のインデックスだけを抽出
        const aliveEnemies = this.enemies
            .map((enemy, index) => ({ enemy, index }))
            .filter(item => item.enemy.is_alive());

        aliveEnemies.forEach((item, i) => {
            // ボタンのインデックス(i)は0〜3の範囲で使用
            if (i < 4) {
                this.show_btn(i, item.enemy.name, "#c0392b", () => this.execute_action(action_type, item.index));
            }
        });

        // 3番目のボタン（一番右）を常に「戻る」に設定（敵が3体以上の場合は調整が必要 現状はこれでOK）
        this.show_btn(3, "戻る", "#95a5a6", () => this.setup_command_buttons(this.party[this.current_turn_index]));
    }

    execute_action(action_type, target_index) {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const target = this.enemies[target_index];
        const targetId = `enemy-sprite-${target_index}`;

        if (action_type === "attack") {
            const [dmg, crit] = member.attack(target);
            this.effects.slashEffect(targetId);
            this.effects.damagePopup(dmg, targetId, crit ? "#f1c40f" : "#ff4757");
            if (crit) this.effects.flash("#fff");
            this.add_log(`${member.name}の攻撃！`, "#70ABDB", true);
            if (crit) this.add_log(" > 会心の一撃！！！", "#f1c40f");
            this.add_log(` > ${target.name}に${dmg}のダメージ`);
        } else if (action_type === "magic") {
            const dmg = member.magic_attack(target);
            this.effects.magicExplosion(targetId);
            this.effects.damagePopup(dmg, targetId, "#4522c5");
            this.add_log(`${member.name}の魔法攻撃！`, "#70ABDB", true);
            this.add_log(` > ${target.name}に${dmg}のダメージ`);
        }
        setTimeout(() => {
            this.finish_turn();
        }, 500);
    
     
    }

    select_target(type) {
        document.getElementById('turn-label').innerText = type === "heal" ? "誰を回復しますか？" : "誰を蘇生しますか？";
        this.hide_all_command_btns();
        this.party.forEach((m, i) => {
            let can_select = (type === "heal") ? m.is_alive() : !m.is_alive();
            this.show_btn(i, m.name, "#2ecc71", () => {
                if (type === "heal") this.execute_heal(m);
                else this.execute_resurrection(m);
            }, can_select);
        });
        this.show_btn(3, "戻る", "#95a5a6", () => this.setup_command_buttons(this.party[this.current_turn_index]));
    }

    execute_heal(target) {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const h_val = member.heal(target);
        const targetIdx = this.party.indexOf(target);
        this.effects.healEffect(`card-${targetIdx}`);
        this.effects.damagePopup(`+${h_val}`, `card-${targetIdx}`, "#2ecc71");
        this.add_log(`${member.name}の回復魔法！`, "#1C9C51", true);
        this.add_log(` > ${target.name}を${h_val}回復`);
        this.finish_turn();
    }

    execute_resurrection(target) {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const res_type = member.resurrection(target);
        const targetIdx = this.party.indexOf(target);
        this.effects.resurrectionEffect(`card-${targetIdx}`);
        if (res_type === "magic") {
            this.add_log(`${member.name}の蘇生呪文！`, "#f39c12", true);
            this.add_log(` > ${target.name}が蘇った！`);
        } else {
            this.effects.flash("#ff4757");
            this.add_log(`${member.name}の命の代償！`, "#e74c3c", true);
            this.add_log(` > ${target.name}を完全蘇生した！`);
            this.add_log(` ！！${member.name}が倒れた！！`, "#e74c3c", true);
        }
        this.finish_turn();
    }

    execute_cover() {
        const hero = this.party[this.current_turn_index];
        if (hero.skill_cover()) {
            this.add_log(`${hero.name}は身構えた！`, "#3498db", true);
            this.add_log(` > 仲間全員をかばい、受けるダメージを軽減する！`);
            this.finish_turn();
        }
    }

    execute_hero_skill() {
        const hero = this.party[this.current_turn_index];
        if (hero.skill_encourage(this.party)) {
            this.effects.flash("#f1c40f");
            this.add_log(`${hero.name}の勇者の鼓舞！`, "#f1c40f", true);
            this.add_log(" > 全員の攻撃力が上がった！");
            this.party.forEach((m, i) => { if(m.is_alive()) this.effects.damagePopup("ATK UP!", `card-${i}`, "#f1c40f"); });
            this.finish_turn();
        }
    }

    execute_meditation() {
        const member = this.party[this.current_turn_index];
        const recover = 30;
        member.set_mp(recover);
        this.effects.healEffect(`card-${this.current_turn_index}`);
        this.effects.damagePopup(`+${recover}MP`, `card-${this.current_turn_index}`, "#9b59b6");
        this.add_log(`${member.name}は瞑想した。MPが${recover}回復！`, "#9b59b6", true);
        this.finish_turn();
    }

    show_item_list() {
        this.hide_all_command_btns();
        this.items.forEach((item, i) => {
            this.show_btn(i, `${item.name}(${item.count})`, "#e67e22", () => this.select_item_target(item), item.count > 0);
        });
        this.show_btn(3, "戻る", "#95a5a6", () => this.setup_command_buttons(this.party[this.current_turn_index]));
    }

    select_item_target(item) {
        this.hide_all_command_btns();
        this.party.forEach((m, i) => {
            let can_select = (item.id === "phoenix") ? !m.is_alive() : m.is_alive();
            this.show_btn(i, m.name, "#2ecc71", () => this.execute_use_item(item, m), can_select);
        });
        this.show_btn(3, "戻る", "#95a5a6", () => this.show_item_list());
    }

    execute_use_item(item, target) {
        item.count--;
        const member = this.party[this.current_turn_index];
        const targetIdx = this.party.indexOf(target);
        if (item.id === "phoenix") {
            target.revive(Math.floor(target.max_hp * item.effect));
            this.effects.resurrectionEffect(`card-${targetIdx}`);
            this.add_log(`${member.name}は${item.name}を使った！`, "#e67e22");
            this.add_log(` > ${target.name}が蘇った！`);
        } else if (item.id === "potion") {
            target.set_hp(item.effect);
            this.effects.healEffect(`card-${targetIdx}`);
            this.effects.damagePopup(`+${item.effect}`, `card-${targetIdx}`, "#2ecc71");
            this.add_log(`${member.name}は${item.name}を使った！`, "#e67e22");
            this.add_log(` > ${target.name}のHPが${item.effect}回復した`);
        } else if (item.id === "ether") {
            target.set_mp(item.effect);
            this.effects.damagePopup(`+${item.effect}MP`, `card-${targetIdx}`, "#3498db");
            this.add_log(`${member.name}は${item.name}を使った！`, "#e67e22");
            this.add_log(` > ${target.name}のMPが${item.effect}回復した`);
        }
        this.finish_turn();
    }

    finish_turn() {
        // 全ての敵に対して分裂の判定を行う
        this.enemies.forEach((enemy, index) => {
            if (enemy.is_king && !enemy.has_split && enemy.is_alive() && enemy.get_hp() <= enemy.max_hp / 2) {
                this.execute_split(index);
            }
        });

        // 敵が死んだ時のログ出力もここで行うと、どの手段で倒してもログが出る
        this.enemies.forEach(enemy => {
            if (!enemy.is_alive() && !enemy.has_split && !enemy.death_logged) {
                this.add_log(`★ ${enemy.name}を倒した！`, "#f1c40f", true);
                enemy.death_logged = true; // 重複ログ防止用のフラグ（Entityに持たせるかここで一時管理）
            }
        });

        this.update_display();
        this.current_turn_index++;
        setTimeout(() => this.next_player_step(), 200);
    }

    slime_turn() {
        this.enemies.forEach((enemy, i) => {
            if (!enemy.is_alive()) return;
            const alive_members = this.party.filter(m => m.is_alive());
            if (alive_members.length === 0) return;

            const action_roll = Math.random();
            const hero = this.party[0];

            if (action_roll < 0.2) {
                const h_val = enemy.heal(enemy);
                this.effects.healEffect(`enemy-sprite-${i}`);
                this.add_log(`${enemy.name}の再生！ ${h_val}回復`, "#e67e22");
            } else if (action_roll < 0.5) { // 確率と内容を復元
                this.add_log(`${enemy.name}の「のしかかり」！`, "#e74c3c", true);
                this.effects.flash("rgba(231, 76, 60, 0.5)");
                alive_members.forEach(m => {
                    let raw_dmg = Math.floor(Math.random() * 21) + 40; 
                    let dmg = Math.max(5, raw_dmg - Math.floor(m.def / 2));
                    if (hero.is_alive() && hero.is_covering && m !== hero) dmg = Math.floor(dmg * 0.5);
                    m.set_hp(-dmg);
                    const idx = this.party.indexOf(m);
                    this.effects.slashEffect(`card-${idx}`);
                    this.effects.damagePopup(dmg, `card-${idx}`);
                    this.add_log(` > ${m.name}に${dmg}ダメ`);
                });
            } else {
                const target = alive_members[Math.floor(Math.random() * alive_members.length)];
                let [dmg, crit] = enemy.attack(target);
                let final_target = target;
                if (hero.is_alive() && hero.is_covering && target !== hero) {
                    final_target = hero;
                    let [hd, hc] = enemy.attack(hero);
                    dmg = Math.floor(hd * 0.5); crit = hc;
                    this.add_log(` > ${hero.name}が仲間の盾になった！`, "#3498db");
                }
                final_target.set_hp(-dmg);
                const idx = this.party.indexOf(final_target);
                this.effects.slashEffect(`card-${idx}`);
                this.effects.damagePopup(dmg, `card-${idx}`, crit ? "#c0392b" : "#ff4757");
                this.add_log(`${enemy.name}の攻撃！`, "#e67e22", true);
                if (crit) this.add_log(" > 痛恨の一撃！！！", "#c0392b");
                this.add_log(` > ${final_target.name}に${dmg}のダメージ`);
            }
        });
        this.party.forEach(m => m.is_covering = false);
        
        this.update_display();
        if (this.party.every(m => !m.is_alive())) {
            setTimeout(() => { alert("パーティは全滅しました..."); location.reload(); }, 200);
        } else {
            this.next_player_step();
        }
    }
    
    //  分裂実行処理
    execute_split(index) {
        const king = this.enemies[index];
        king.has_split = true;
        const kingSprite = document.getElementById(`enemy-sprite-${index}`);
        
        this.add_log(`！！ ${king.name}の体が震えている ！！`, "#f1c40f", true);
        if (kingSprite) kingSprite.classList.add('splitting');

        setTimeout(() => {
            king.set_hp(-9999);
            this.effects.flash("#fff");
            
            // 新しい通常スライムを生成
            const s1 = new Slime("スライムA", "normal");
            const s2 = new Slime("スライムB", "normal");
            this.enemies = [s1, s2];
            
            this.add_log(` > ${king.name}が2体に分裂した！`, "#f1c40f");
            
            // 表示を更新（ここで新しいDOM要素が作られる）
            this.update_display();

            // 新しく作られた要素を取得
            const spriteA = document.getElementById('enemy-sprite-0');
            const spriteB = document.getElementById('enemy-sprite-1');

            if (spriteA) spriteA.classList.add('appear-left');
            if (spriteB) spriteB.classList.add('appear-right');

            // ★ 演出が終わったらクラスを消して、定位置に固定する
            setTimeout(() => {
                if (spriteA) spriteA.classList.remove('appear-left');
                if (spriteB) spriteB.classList.remove('appear-right');
            }, 600); // CSSの0.6sに合わせる

        }, 800);
    }

    show_btn(index, text, color, action, enabled = true) {
        const btn = document.getElementById(`btn-${index}`);
        if (!btn) return;
        btn.innerText = text;
        btn.style.backgroundColor = color;
        btn.style.display = "inline-block";
        btn.disabled = !enabled;
        btn.onclick = action;
    }

    hide_all_command_btns() {
        for (let i = 0; i < 4; i++) {
            const btn = document.getElementById(`btn-${i}`);
            if (btn) btn.style.display = "none";
        }
    }
}

window.onload = () => { new BattleManager(); };