// --- ゲーム管理クラス ---
class BattleManager {
    constructor() {
        // パーティの初期化 (entities.jsのクラスを使用)
        this.party = [
            new Hero("勇者ぱるむ"),
            new Wizard("魔法使いはな"),
            new Healer("癒し手なつ")
        ];
        this.slime = new Slime("キングスライム");
        this.current_turn_index = 0;
        
        this.items = [
            { id: "potion", name: "ポーション", count: 3, effect: 50, description: "HPを50回復" },
            { id: "ether", name: "エーテル", count: 1, effect: 30, description: "MPを30回復" },
            { id: "leaf", name: "世界樹の葉", count: 1, effect: 0.5, description: "仲間一人をHP50%で蘇生" }
];

        // エフェクトマネージャーの初期化
        this.effects = new EffectManager();

        // 初期表示の更新
        this.update_display();
        this.add_log(`★ ${this.slime.name}が現れた！`, "#f1c40f", true);
        this.next_player_step();
    }

    // ログを追加する関数
    add_log(message, color = "white", is_bold = false) {
        const logElement = document.getElementById('log');
        const newMessage = document.createElement('div');
        newMessage.style.color = color;
        if (is_bold) newMessage.style.fontWeight = "bold";
        newMessage.innerText = message;
        
        // prependにより最新ログが一番上に来る設定
        logElement.prepend(newMessage); 
    }

    // 画面表示を更新する
    update_display() {
        
        // 敵のHP更新
        const slime_hp = this.slime.get_hp();
        const slime_ratio = (slime_hp / this.slime.max_hp) * 100;
        document.getElementById('enemy-name').innerText = this.slime.name;
        document.getElementById('enemy-hp-bar').style.width = `${slime_ratio}%`;
        document.getElementById('enemy-hp-text').innerText = `HP: ${slime_hp}`;
        
        // 味方のステータス更新
        this.party.forEach((member, i) => {
            const hp = member.get_hp();
            const mp = member.get_mp();
            const hp_ratio = (hp / member.max_hp) * 100;
            const mp_ratio = (mp / member.max_mp) * 100;
            document.getElementById(`p${i}-name`).innerText = member.name;
            document.getElementById(`p${i}-hp-bar`).style.width = `${hp_ratio}%`;
            document.getElementById(`p${i}-mp-bar`).style.width = `${mp_ratio}%`;
            document.getElementById(`p${i}-hp-text`).innerText = `HP: ${hp}`;
            document.getElementById(`p${i}-mp-text`).innerText = `MP: ${mp}`;
        
            // --- ★追加：バフ・状態アイコンの更新 ---
            const statusElem = document.getElementById(`p${i}-status`);
            if (statusElem) {
                statusElem.innerHTML = ""; // 一旦リセット
                
                //生きてる場合のみバッジを表示
                if (member.is_alive()) {
                    // 攻撃力UPバッジ
                    if (member.buff_turns > 0) {
                        const atkBadge = document.createElement('span');
                        atkBadge.className = "badge badge-atk";
                        atkBadge.innerText = `ATK ▲${member.buff_turns}`;
                        statusElem.appendChild(atkBadge);
                    }
                
                    // かばうバッジ
                    if (member.is_covering) {
                        const coverBadge = document.createElement('span');
                        coverBadge.className = "badge badge-cover";
                        coverBadge.innerText = "かばう";
                        statusElem.appendChild(coverBadge);
                    }
                }else{
                    // キャラクターが死んでいる場合、データ上のバフもリセット
                    member.buff_turns = 0;
                    member.is_covering = false;
                }
                    
            }
            
            // ------------------------------------

            const nameElem = document.getElementById(`p${i}-name`);
            nameElem.style.color = member.is_alive() ? "#3498db" : "#95a5a6";
            
            // 倒れている場合はカードを少し暗くする
            const card = document.getElementById(`card-${i}`);
            if (card) {
                card.style.opacity = member.is_alive() ? "1" : "0.5";
            }
        });
    }

    next_player_step() {
        const member = this.party[this.current_turn_index];
        if (!this.slime.is_alive()) {
            this.add_log("勝利！キングスライムを討伐した！", "#f1c40f", true);
            alert("勝利！キングスライムを討伐した！");
            location.reload();
            return;
        }
    
        if (this.current_turn_index >= this.party.length) {
            this.current_turn_index = 0;
            setTimeout(() => this.slime_turn(), 800);
            return;
        }   
        if (!member.is_alive()) {
            this.current_turn_index += 1;
            this.next_player_step();
            return;
        }
        
        if (member && member.is_alive() && member.buff_turns > 0) {
        member.buff_turns--;
    }
        
        this.setup_command_buttons(member);
    }
    
        setup_command_buttons(member) {
            // 誰のターンか分かりやすくカードを光らせる
            this.party.forEach((_, i) => document.getElementById(`card-${i}`).classList.remove('active-member'));
            const idx = this.party.indexOf(member);
        document.getElementById(`card-${idx}`).classList.add('active-member');

            document.getElementById('turn-label').innerText = `▼ ${member.name} の行動選択`;
        this.hide_all_command_btns();
            
        // 0番: 攻撃ボタン（MP消費なし）
            this.show_btn(0, "攻撃", "#c0392b", () => this.execute_action("attack"));
            
            // キャラクターごとの固有スキル
            if (member instanceof Hero) {
                // 勇者：1.鼓舞(15) / 2.かばう(10)
                const can_buff = member.get_mp() >= 15;
                const can_cover = member.get_mp() >= 10;
            this.show_btn(1, "勇者の鼓舞(15)", "#f1c40f", () => this.execute_hero_skill(), can_buff);
            this.show_btn(2, "かばう(10)", "#3498db", () => this.execute_cover(), can_cover);

        } else if (member instanceof Wizard) {
            // 魔法使い：1.魔法(15) / 2.瞑想(0)
            const can_use = member.get_mp() >= 15;
            this.show_btn(1, "魔法(15MP)", "#2980b9", () => this.execute_action("magic"), can_use);
            this.show_btn(2, "瞑想", "#9b59b6", () => this.execute_meditation());

        } else if (member instanceof Healer) {
            // ヒーラー：1.ヒール(10) / 2.蘇生(40)
            const can_heal = member.get_mp() >= 10;
        const can_res = member.get_mp() >= 40; 
            
        this.show_btn(1, "ヒール(10MP)", "#27ae60", () => this.select_target("heal"), can_heal);

            if (can_res) {
                // MPが40以上ある場合：通常の蘇生魔法
                this.show_btn(2, "蘇生(40MP)", "#8e44ad", () => this.select_target("resurrection"), true);
            } else {
                // MPが足りない場合：「命の代償」としてボタンを有効化（true）して表示
            // これにより、MPがなくても自分の命と引き換えに蘇生ができる
                this.show_btn(2, "命の代償", "#e74c3c", () => this.select_target("resurrection"), true);
            }
        }

        // 3番: どうぐ（常に有効）
        this.show_btn(3, "どうぐ", "#d35400", () => this.show_item_list());
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

    execute_action(action_type) {
        // 連打防止。まず全てのボタンを隠す
        this.hide_all_command_btns();
        
        const member = this.party[this.current_turn_index];
        if (action_type === "attack") {
            const [dmg, crit] = member.attack(this.slime);
            
            // 敵にエフェクト
            this.effects.slashEffect('enemy-target');
            this.effects.damagePopup(dmg, 'enemy-target', crit ? "#f1c40f" : "#ff4757");
            if (crit) this.effects.flash("#fff");
            
            this.add_log(`${member.name}の攻撃！`, "#70ABDB", true);
            if (crit) this.add_log(" > 会心の一撃！！！", "#f1c40f");
            this.add_log(` > ${this.slime.name}に${dmg}のダメージ`);
            
        } else if (action_type === "magic") {
            const dmg = member.magic_attack(this.slime);
            
            this.effects.magicExplosion('enemy-target');
            this.effects.damagePopup(dmg, 'enemy-target', "#4522c5");
            
            this.add_log(`${member.name}の魔法攻撃！`, "#70ABDB", true);
            this.add_log(` > ${this.slime.name}に${dmg}のダメージ`);
        }
        this.finish_turn();
    }

    execute_heal(target) {
        // 連打防止。まず全てのボタンを隠す
        this.hide_all_command_btns();
        
        const member = this.party[this.current_turn_index];
        const h_val = member.heal(target);
        member.set_mp(-10);
    
        // 対象(target)がパーティの何番目かを探す
        const targetIdx = this.party.indexOf(target);
    
        // その番号のカードIDに対してのみエフェクトを実行
        this.effects.healEffect(`card-${targetIdx}`);
        this.effects.damagePopup(`+${h_val}`, `card-${targetIdx}`, "#2ecc71");
    
        this.add_log(`${member.name}の回復魔法！`, "#1C9C51", true);
        this.add_log(` > ${target.name}を${h_val}回復`);
        this.finish_turn();
    }

    execute_resurrection(target) {        
        // 連打防止。まず全てのボタンを隠す
        this.hide_all_command_btns();
        
        const member = this.party[this.current_turn_index];
        const res_type = member.resurrection(target);
        
        const targetIdx = this.party.indexOf(target);
        // 蘇生対象を光らせる
        this.effects.resurrectionEffect(`card-${targetIdx}`);
        
        if (res_type === "magic") {
            this.add_log(`${member.name}の蘇生呪文！`, "#f39c12", true);
            this.add_log(` > ${target.name}が蘇った！`);
        } else {
            this.effects.flash("#ff4757"); // 命の代償フラッシュ
            // ヒーラー自身も倒れる演出として光らせる
            this.effects.resurrectionEffect(`card-${this.current_turn_index}`);
            this.add_log(`${member.name}の命の代償！`, "#e74c3c", true);
            this.add_log(` > ${target.name}を完全蘇生した！`);
            this.add_log(` ！！${member.name}が倒れた！！`, "#e74c3c", true);
        }
        this.finish_turn();
    }
    
    execute_cover() {
        const hero = this.party[this.current_turn_index];
        if (hero.skill_cover()) { // Entity側のメソッドを実行
            this.hide_all_command_btns();
            this.add_log(`${hero.name}は身構えた！`, "#3498db", true);
            this.add_log(` > 仲間全員をかばい、受けるダメージを軽減する！`);
            this.finish_turn();
        }
    }
    
            
    
    //ヒーロースキル（鼓舞）
    execute_hero_skill() {
        const hero = this.party[this.current_turn_index];

        // Entity側のロジックを実行
        if (hero.skill_encourage(this.party)) {
            this.hide_all_command_btns();
        
            // 演出処理
            this.effects.flash("#f1c40f"); // 黄金のフラッシュ
            this.add_log(`${hero.name}の勇者の鼓舞！`, "#f1c40f", true);
            this.add_log(" > 全員の攻撃力が上がった！");

            // 全員のカードに「ATK UP!」のポップアップを出す
            this.party.forEach((m, i) => {
                if (m.is_alive()) {
                    this.effects.damagePopup("ATK UP!", `card-${i}`, "#f1c40f");
                }
            });

            this.finish_turn();
        } else {
            this.add_log("MPが足りません！");
        }
    }
    
    //瞑想
    execute_meditation() {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const recover = 30;
        member.set_mp(recover); // set_mpでプラス値を送れるようにentities.js側を確認
        this.effects.healEffect(`card-${this.current_turn_index}`);
        this.effects.damagePopup(`+${recover}MP`, `card-${this.current_turn_index}`, "#9b59b6");
        this.add_log(`${member.name}は瞑想した。MPが${recover}回復！`, "#9b59b6", true);
        this.finish_turn();
    }
    
    show_item_list() {
        document.getElementById('turn-label').innerText = "どれを使いますか？";
        this.hide_all_command_btns();

        this.items.forEach((item, i) => {
            const can_use = item.count > 0;
            this.show_btn(i, `${item.name}(${item.count})`, "#e67e22", () => {
                this.select_item_target(item);
            }, can_use);
        });

        this.show_btn(3, "戻る", "#95a5a6", () => this.setup_command_buttons(this.party[this.current_turn_index]));
    }
    
    select_item_target(item) {
        document.getElementById('turn-label').innerText = `${item.name}を誰に使いますか？`;
        this.hide_all_command_btns();
        this.party.forEach((m, i) => {
            let can_select = false;

            // アイテムの種類によって選択可能 な対象を変える
            if (item.id === "leaf") {
                // 蘇生アイテムは「死んでいるキャラ」のみ
                can_select = !m.is_alive();
            } else {
                // それ以外（ポーション等）は「生きているキャラ」のみ
                can_select = m.is_alive();
            }
            this.show_btn(i, m.name, "#2ecc71", () => {
                this.execute_use_item(item, m);
            }, can_select);
        });

        this.show_btn(3, "戻る", "#95a5a6", () => this.show_item_list());
    }

    execute_use_item(item, target) {
        this.hide_all_command_btns();
        item.count -= 1; // 個数を減らす

        const targetIdx = this.party.indexOf(target);
        const member = this.party[this.current_turn_index];

        if (item.id === "leaf") {
            // --- 蘇生アイテムの処理 ---
            const revive_hp = Math.floor(target.max_hp * item.effect);
            target.revive(revive_hp); // Entityに追加したreviveメソッドを使用
            
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
        this.update_display();
        this.current_turn_index += 1;
        setTimeout(() => this.next_player_step(), 200);
    }
    
    
    slime_turn() {
    const alive_members = this.party.filter(m => m.is_alive());
    if (alive_members.length === 0) return;

    const hero = this.party[0]; // 勇者を特定
    const action_roll = Math.random();

    if (action_roll < 0.2) { 
        // --- 再生 ---
        const h_val = this.slime.heal(this.slime);
        this.effects.healEffect('canvas-area');
        this.add_log(`${this.slime.name}の再生！ ${h_val}回復`, "#e67e22");
        
    } else if (action_roll < 0.5) { 
        // --- 30%で全体攻撃 ---
        this.add_log(`${this.slime.name}の「のしかかり」！`, "#e74c3c", true);
        
        this.effects.flash("rgba(231, 76, 60, 0.5)");
        const canvas = document.getElementById('canvas-area');
        canvas.classList.add('heavy-shake');
        setTimeout(() => canvas.classList.remove('heavy-shake'), 400);

        alive_members.forEach(m => {
            // --- ダメージ計算の修正 ---
            // 基本威力(40〜60)から、各キャラの防御力(def)の半分を引く計算
            let raw_dmg = Math.floor(Math.random() * 21) + 40; 
            let dmg = Math.max(5, raw_dmg - Math.floor(m.def / 2));

            // 勇者が「かばう」を使っている場合、仲間へのダメージをさらに半分にする
            if (hero.is_alive() && hero.is_covering && m !== hero) {
                dmg = Math.floor(dmg * 0.5);
            }

            m.set_hp(-dmg);
            // -----------------------

            const idx = this.party.indexOf(m);
            const target_id = `card-${idx}`;
    
            this.effects.slashEffect(target_id);
            this.effects.damagePopup(dmg, target_id);
            this.add_log(` > ${m.name}に${dmg}ダメ`);
    
            if (!m.is_alive()){
                this.add_log(` ！！${m.name}が倒れた！！`, "#e74c3c", true);
            }
        });
        
    } else { 
        // --- 残りの50％で単体攻撃 ---
        const target = alive_members[Math.floor(Math.random() * alive_members.length)];
        let [dmg, crit] = this.slime.attack(target);
        let final_target = target;
        
        // かばう判定の適用
        if (hero.is_alive() && hero.is_covering && target !== hero) {
            final_target = hero;
            // ダメージはスライムがheroを攻撃したと仮定して再計算（かつ軽減）
            let [hero_dmg, hero_crit] = this.slime.attack(hero);
            dmg = Math.floor(hero_dmg * 0.5);
            crit = hero_crit; 
            this.add_log(` > ${hero.name}が仲間の盾になった！`, "#3498db");
        }
        
        // 実際にダメージを与える（かばった場合は勇者に、そうでないなら本来のtargetに）
        if (final_target !== target) {
            target.set_hp(dmg * 2); // さっき引かれた分を一度戻す(簡略化のため)
            final_target.set_hp(-dmg);
        }

        const idx = this.party.indexOf(final_target);
        const target_id = `card-${idx}`;
        
        this.effects.slashEffect(target_id); 
        this.effects.damagePopup(dmg, target_id, crit ? "#c0392b" : "#ff4757");
        this.effects.shake(target_id);
        
        this.add_log(`${this.slime.name}の攻撃！ ${final_target.name}に${dmg}ダメ`, "#e67e22");
        if (crit) this.add_log(" > 痛恨の一撃！！！", "#c0392b");
        
        if (!final_target.is_alive()) {
            this.add_log(` ！！ ${final_target.name}が倒れた！！ `, "#e74c3c", true);
        }
    }
    
    // かばう解除
    this.party.forEach(m => { 
        m.is_covering = false;
    });

    this.update_display();
    
    // 全滅判定
    if (this.party.every(m => !m.is_alive())) {
        setTimeout(() => {
            alert("パーティは全滅しました...");
            location.reload();
        }, 200);
    } else {
        this.next_player_step();
    }
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

window.onload = () => {
    new BattleManager();
};