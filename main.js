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

        // エフェクトマネージャーの初期化（他の処理より先に作るのが安全）
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
            const ratio = (hp / member.max_hp) * 100;
            document.getElementById(`p${i}-hp-bar`).style.width = `${ratio}%`;
            document.getElementById(`p${i}-hp-text`).innerText = `HP: ${hp}`;
            document.getElementById(`p${i}-mp-text`).innerText = `MP: ${member.get_mp()}`;
            
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

        const member = this.party[this.current_turn_index];
        if (!member.is_alive()) {
            this.current_turn_index += 1;
            this.next_player_step();
            return;
        }

        this.setup_command_buttons(member);
    }

    setup_command_buttons(member) {
        document.getElementById('turn-label').innerText = `▼ ${member.name} の行動選択`;
        this.hide_all_command_btns();

        // 攻撃ボタン
        this.show_btn(0, "攻撃", "#c0392b", () => this.execute_action("attack"));

        // 特殊スキル（Hero, Healer）
        if (member instanceof Hero || member instanceof Healer) {
            const can_use = member.get_mp() >= 10;
            this.show_btn(1, "ヒール(10MP)", "#27ae60", () => this.select_target("heal"), can_use);
        }

        // 魔法（Wizard）
        if (member instanceof Wizard) {
            const can_use = member.get_mp() >= 15;
            this.show_btn(1, "魔法(15MP)", "#2980b9", () => this.execute_action("magic"), can_use);
        }

        // 蘇生（Healer）
        if (member instanceof Healer) {
            this.show_btn(2, "蘇生", "#8e44ad", () => this.select_target("resurrection"));
        }
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

    finish_turn() {
        this.update_display();
        this.current_turn_index += 1;
        setTimeout(() => this.next_player_step(), 600);
    }

    slime_turn() {
        const alive_members = this.party.filter(m => m.is_alive());
        if (alive_members.length === 0) return;

        const action_roll = Math.random();
        if (action_roll < 0.2) {     //20%で回復
            const h_val = this.slime.heal(this.slime);
            this.effects.healEffect('canvas-area'); // 敵も回復エフェクト
            this.add_log(`${this.slime.name}の再生！ ${h_val}回復`, "#e67e22");
            
        } else if (action_roll < 0.5) { //30%で全体攻撃
            this.add_log(`${this.slime.name}の「のしかかり」！`, "#e74c3c", true);
            
            this.effects.flash("rgba(231, 76, 60, 0.5)"); // 画面全体が赤く光る
            const canvas = document.getElementById('canvas-area');
            canvas.classList.add('heavy-shake');
            setTimeout(() => canvas.classList.remove('heavy-shake'), 400);
            
            alive_members.forEach(m => {
                const dmg = Math.floor(Math.random() * 21) + 20;
                m.set_hp(-dmg);
                const idx = this.party.indexOf(m);
                const target_id =  `card-${idx}`;
                
                this.effects.slashEffect(target_id);
                this.effects.damagePopup(dmg, target_id);
                this.add_log(` > ${m.name}に${dmg}ダメ`);
                
                if (!m.is_alive()){
                    this.add_log(` ！！${m.name}が倒れた！！`, "#e74c3c", true);
                }
                
            });
        } else {    //残りの50％で単体攻撃
            const target = alive_members[Math.floor(Math.random() * alive_members.length)];
            const [dmg, crit] = this.slime.attack(target);
            const idx = this.party.indexOf(target);
            const target_id = `card-${idx}`;
            
            this.effects.slashEffect(target_id); 
            this.effects.damagePopup(dmg, target_id, crit ? "#c0392b" : "#ff4757");
            this.effects.shake(target_id);
            
            this.add_log(`${this.slime.name}の攻撃！ ${target.name}に${dmg}ダメ`, "#e67e22");
            if (crit) this.add_log(" > 痛恨の一撃！！！", "#c0392b");
            
            if (!target.is_alive()) {
            this.add_log(` ！！ ${target.name}が倒れた！！ `, "#e74c3c", true);
            }
        }

        this.update_display();
        if (this.party.every(m => !m.is_alive())) {
            setTimeout(() => {
                alert("パーティは全滅しました...");
                location.reload();
            }, 1000);
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