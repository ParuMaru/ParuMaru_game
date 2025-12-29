function playGlobalSE(freqs, duration, type = "triangle", vol = 0.05) {
    // music.jsで作成されるはずの共通コンテキストを取得
    const ctx = window.globalAudioContext;
    if (!ctx) return; 
    if (ctx.state === 'suspended') ctx.resume();

    const startTime = ctx.currentTime;
    freqs.forEach(f => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f, startTime);
        osc.frequency.exponentialRampToValueAtTime(f / 2, startTime + duration);

        g.gain.setValueAtTime(vol, startTime);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(g).connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    });
}

class BattleManager {
    constructor() {
        this.bgm = new BattleBGM();
        this.preloadMidi();
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
            if (e.key === 'm' || e.key === 'M') {this.debug_mp_zero();}
        });
    }
    
    async preloadMidi() {
        try {
            // 同じフォルダにある "endymion.mid" を取得
            const response = await fetch('endymion.mid');
            const blob = await response.blob();
            const file = new File([blob], "endymion.mid");

            // 解析を実行
            await this.bgm.loadMidiFromFile(file);
            console.log("BGMの自動読み込みが完了しました");
        } catch (error) {
            console.error("MIDIの読み込みに失敗しました:", error);
        }
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
    
    debug_mp_zero() {
        this.add_log("--- デバッグ: MP:0 ---", "#ff4757");
        this.party.forEach((m, i) => {
        m.set_mp(-m.get_mp()); // 残りMP 0 にする
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
            const nameElem = document.getElementById(`p${i}-name`);
            if (nameElem) nameElem.innerText = member.name;
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
                    if (member.regen_turns > 0) {
                        statusElem.innerHTML += `<span class="badge" style="background-color: #2ecc71; color: white;">いのり ${member.regen_turns}</span>`;
                    }
                }
            }
            document.getElementById(`card-${i}`).style.opacity = member.is_alive() ? "1" : "0.5";
            document.getElementById(`card-${i}`).classList.remove('active-member');
        });

    }

    next_player_step() {
        
        if (this.enemies.every(e => !e.is_alive())) {
            this.hide_all_command_btns();
            this.bgm.stop();
            document.getElementById('turn-label').innerText = "VICTORY!!";
            this.bgm.playVictoryFanfare();
            this.effects.enemyDeath('enemy-target');
            this.add_log(`★ 敵をすべて討伐した！`, "#f1c40f", true);
            setTimeout(() => {
                this.add_log("平和が訪れた...", "#ecf0f1");
                this.show_btn(0, "もう一度戦う", "#2ecc71", () => location.reload());
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
        
        
        this.setup_command_buttons(member);
    }

    setup_command_buttons(member) {
        this.hide_all_command_btns();
        
        // current_turn_index が指しているカードを点灯させる
        const activeCard = document.getElementById(`card-${this.current_turn_index}`);
        if (activeCard) {
            activeCard.classList.add('active-member');
        }

        document.getElementById('turn-label').innerText = `▼ ${member.name} の行動選択`;
        
        this.show_btn(0, "攻撃", "#c0392b", () => this.select_enemy_target("attack"));
        
        if (member instanceof Hero) {
            this.show_btn(1, "勇者の鼓舞(15)", "#f1c40f", () => this.execute_hero_skill(), member.get_mp() >= 15);
            this.show_btn(2, "かばう(10)", "#3498db", () => this.execute_cover(), member.get_mp() >= 10);
        } else if (member instanceof Wizard) {
            this.show_btn(1, "魔法", "#2980b9", () => this.show_magic_list(member));
            this.show_btn(2, "瞑想", "#9b59b6", () => this.execute_meditation());
        } else if (member instanceof Healer) {
            this.show_btn(1, "魔法", "#27ae60", () => this.show_magic_list(member));
            this.show_btn(2, "いのり","#8e44ad", () => this.execute_prayer());
        }
        this.show_btn(3, "どうぐ", "#d35400", () => this.show_item_list());
    }

    show_magic_list(member) {
        this.hide_all_command_btns();
        document.getElementById('turn-label').innerText = "どの魔法を使いますか？";

        member.skills.forEach((skill, i) => {
            let can_use = member.get_mp() >= skill.cost;
            let btnText = `${skill.name}(${skill.cost})`;
            let btnColor = "#2980b9"; // 通常の魔法の色

            // --- 命の代償ロジック ---
            if (skill.type === "res") {
                if (!can_use) {
                    // MP不足時はテキストと色を「代償」仕様に変更
                    btnText = "！！命の代償！！";
                    btnColor = "#c0392b"; // 警告の赤色
                    can_use = true;       // MP不足でも押せるようにする
                } else {
                    btnColor = "#f39c12"; // 蘇生魔法が使える時はオレンジ色
                }
            }
            // ------------------------

            this.show_btn(i, btnText, btnColor, () => {
                if (skill.target === "all") {
                    this.execute_all_action(skill);
                } else if (skill.id === "meditation") {
                    this.execute_meditation();
                } else {
                    if (skill.type === "attack") {
                        this.select_enemy_target(skill.id);
                    } else {
                        this.select_target(skill.id);
                    }
                }
            }, can_use);
        });
        this.show_btn(3, "戻る", "#95a5a6", () => this.setup_command_buttons(member));
    }
    
    select_enemy_target(action_data) {
        document.getElementById('turn-label').innerText = "どの敵を狙いますか？";
        this.hide_all_command_btns();

        const aliveEnemies = this.enemies
            .map((enemy, index) => ({ enemy, index }))
            .filter(item => item.enemy.is_alive());

        aliveEnemies.forEach((item, i) => {
            if (i < 3) { // 3番目まで敵を表示
                this.show_btn(i, item.enemy.name, "#c0392b", () => {
                    // 実行関数に「選んだスキルのデータ」を渡す
                    this.execute_action(action_data, item.index);
                });
            }
        });

        this.show_btn(3, "戻る", "#95a5a6", () => {
            // 魔法選択から来た場合は魔法リストに戻る、そうでなければコマンドに戻る
                const currentMember = this.party[this.current_turn_index];
            if (typeof action_data === "object") {
                this.show_magic_list(currentMember);
            } else {
                this.setup_command_buttons(currentMember);
            }
        });
    }

    
    //攻撃と魔法の実行
    execute_action(action_type, target_index) {
        console.log("実行されたアクション:", action_type);
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const target = this.enemies[target_index];
        const targetId = `enemy-sprite-${target_index}`;

        let currentSkill = null;
        if (member.skills) {
            // action_typeが "fire" なら "fire" を、 "meteor" なら "meteor" を見つける
            currentSkill = member.skills.find(s => s.id === action_type);
        }

        if (action_type === "attack") {
            const [dmg, crit] = member.attack(target);
            if (member instanceof Hero){
                this.effects.slashEffect(targetId);
            }else{
                this.effects.magicExplosion(targetId);
            }
            this.effects.damagePopup(dmg, targetId, crit ? "#f1c40f" : "#ff4757");
            if (crit) this.effects.flash("#fff");
            this.add_log(`${member.name}の攻撃！`, "#70ABDB", true);
            if (crit) this.add_log(" > 会心の一撃！！！", "#f1c40f");
            this.add_log(` > ${target.name}に${dmg}のダメージ`);

        } else if (currentSkill && currentSkill.type === "attack") {
            member.set_mp(-currentSkill.cost);
            const dmg = member.magic_attack(target, currentSkill);

            // メテオの時だけさらに派手にするならここ
            if (currentSkill.id === "meteor") {
                this.effects.meteorEffect(targetId);
                this.effects.damagePopup(dmg, targetId, "#4522c5");
                this.add_log("空から巨大な隕石が降り注ぐ","#e74c3c",true);
            }else if(currentSkill.id === "fire"){
                this.effects.fireEffect(targetId);
                this.effects.damagePopup(dmg, targetId, "#4522c5");
            }

            this.add_log(`${member.name}の${currentSkill.name}！`, "#70ABDB", true);
            this.add_log(` > ${target.name}に${dmg}のダメージ`);
        }

        setTimeout(() => {
            this.finish_turn();
        }, 500);
    }

    select_target(action_id) {
        // action_id が "heal" や "curaga" など
        document.getElementById('turn-label').innerText = "誰を対象にしますか？";
        this.hide_all_command_btns();

        this.party.forEach((m, i) => {
            // 蘇生魔法(raise)かそれ以外かで選択可能なキャラを変える
            let can_select = (action_id === "raise") ? !m.is_alive() : m.is_alive();

            this.show_btn(i, m.name, "#2ecc71", () => {
                if (action_id === "raise") {
                    this.execute_resurrection(m); // 蘇生は専用メソッドへ
                } else {
                    this.execute_heal(action_id, m); // IDと対象を渡す
                }
            }, can_select);
        });

        this.show_btn(3, "戻る", "#95a5a6", () => this.show_magic_list(this.party[this.current_turn_index]));
    }

    execute_heal(action_id, target) {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const targetIdx = this.party.indexOf(target);

        // 引数で受け取った action_id を使って、正確なスキル情報を取得
        const skill = member.skills.find(s => s.id === action_id);

        // スキルが見つからない場合のフォールバック（通常回復など）
        const cost = skill ? skill.cost : 15;
        const skillName = skill ? skill.name : "回復魔法";

        // MP消費（スキルごとのコストを正確に引く）
        member.set_mp(-cost);

        // 回復量の計算
        // 基本は回復力(rec)の約1倍。魔法ごとに倍率を変えるならここで skill.id 判定を入れる
        let multiplier = 1.0;
        
        if (skill && skill.id === "curaga") multiplier = 2.5; // 強力な回復魔法を追加する場合

        let heal_val = Math.floor(member.rec * multiplier * (0.9 + Math.random() * 0.2));

        // クリティカル判定
        if (Math.random() < 0.2) {
            heal_val = Math.floor(heal_val * 1.5);
        }

        target.set_hp(heal_val);

        // 演出
        this.effects.healEffect(`card-${targetIdx}`);
        this.effects.damagePopup(`+${heal_val}`, `card-${targetIdx}`, "#2ecc71");

        // ログ出力（skill.name には(20)が入っていないので、そのまま表示）
        this.add_log(`${member.name}の${skillName}！`, "#1C9C51", true);
        this.add_log(` > ${target.name}を${heal_val}回復`);

        this.update_display();
        setTimeout(() => this.finish_turn(), 500);
    }

    execute_resurrection(target) {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const targetIdx = this.party.indexOf(target);

        // 魔法リストから「resurrection」タイプのスキルを探す
        const skill = member.skills.find(s => s.type === "res");
        const cost = skill ? skill.cost : 40;

        // 実際の蘇生処理を実行（戻り値で魔法か自爆か判定）
        const res_type = member.resurrection(target);

        this.effects.resurrectionEffect(`card-${targetIdx}`);

        if (res_type === "magic") {
            // スキル名（レイズなど）をログに反映
            const skillName = skill ? skill.name.split('(')[0] : "蘇生魔法";
            this.add_log(`${member.name}の${skillName}！`, "#f39c12", true);
            this.add_log(` > ${target.name}が蘇った！`);
        } else {
            // MPが足りなかった時の「命の代償」演出
            this.effects.flash("#ff4757");
            this.add_log(`${member.name}の命の代償！`, "#e74c3c", true);
            this.add_log(` > ${target.name}を完全蘇生した！`);
            this.add_log(` ！！${member.name}が倒れた！！`, "#e74c3c", true);
        } 
    // 蘇生直後にHPバーなどの表示を更新
    this.update_display();  
    setTimeout(() => this.finish_turn(), 500);
    }
    
    execute_prayer() {
        this.hide_all_command_btns();
        const healer = this.party[this.current_turn_index];

        this.party.forEach((m, i) => {
            if (m.is_alive()) {
                // 自分は直後の finish_turn で -1 されるので、
                // 仲間と同じ回数発動させたいなら自分だけ +1 ターンにする
                m.regen_turns = (i === this.current_turn_index) ? 4 : 3;
            }
        });
        this.effects.flash("#fff");
        this.add_log(`${healer.name}のいのり！`, "#8e44ad", true);
        this.add_log(" > 慈愛の心が仲間たちの傷を癒していく...");

        this.party.forEach((m, i) => {
            if(m.is_alive()) {
                this.effects.damagePopup("いのり", `card-${i}`, "#2ecc71");
                // 祈った瞬間にキラキラさせる
                this.effects.healEffect(`card-${i}`);
            }
        });

        setTimeout(() => this.finish_turn(), 600);
    }
   

    execute_cover() {
        this.hide_all_command_btns();
        const hero = this.party[this.current_turn_index];
        if (hero.skill_cover()) {
            this.add_log(`${hero.name}は身構えた！`, "#3498db", true);
            this.add_log(` > 仲間全員をかばい、受けるダメージを軽減する！`);
            this.finish_turn();
        }
    }

    execute_hero_skill() {
        this.hide_all_command_btns();
        const hero = this.party[this.current_turn_index];

        // 全員にバフをかける
        this.party.forEach((m, i) => {
            if (m.is_alive()) {
                if (i === this.current_turn_index) {
                    // ★ 今行動中の勇者本人は、この後の finish_turn で減るから「4」にする
                    m.buff_turns = 3;
                } else {
                    // ★ まだ行動していない仲間は、そのまま「3」にする
                    m.buff_turns = 2;
                }
            }
        });

        this.effects.flash("#f1c40f");
        this.add_log(`${hero.name}の勇者の鼓舞！`, "#f1c40f", true);
        this.add_log(" > 全員の攻撃力が上がった！");

        // エフェクト表示
        this.party.forEach((m, i) => { 
            if(m.is_alive()) this.effects.damagePopup("ATK UP!", `card-${i}`, "#f1c40f"); 
        });

        hero.set_mp(-15); 
        this.finish_turn(); 
    }

    execute_meditation() {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const recover = 30;
        member.set_mp(recover);
        this.effects.healEffect(`card-${this.current_turn_index}`);
        this.effects.damagePopup(`+${recover}MP`, `card-${this.current_turn_index}`, "#9b59b6");
        this.add_log(`${member.name}は瞑想した。MPが${recover}回復！`, "#9b59b6", true);
        this.finish_turn();
    }
    
    //全体攻撃・回復
    execute_all_action(skill) {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        member.set_mp(-skill.cost);

        if (skill.type === "attack") {
            this.add_log(`${member.name}の${skill.name}！`, "#e67e22", true);

        // ★ 1. まず全員の場所に一斉に火柱を出す！
        if (skill.id === "fira") { // ファイラの場合
            this.effects.allFireEffect(this.enemies);
        } else {
            this.effects.flash("#fff"); // それ以外は普通のフラッシュ
        }

        // ★ 2. 少しだけ（0.2秒くらい）待ってから、ダメージ数字を一斉に出す
        setTimeout(() => {
            this.enemies.forEach((target, i) => {
                if (target.is_alive()) {
                    const dmg = member.magic_attack(target, skill);
                    const targetId = `enemy-sprite-${i}`;
                    
                    this.effects.damagePopup(dmg, targetId, "#ff4500");
                    this.add_log(` > ${target.name}に${dmg}のダメージ`);
                }
            });
        }, 200);
    }
        else if (skill.type === "heal") {
            this.add_log(`${member.name}の${skill.name}！`, "#27ae60", true);
            this.party.forEach((m, i) => {
                if (m.is_alive()) {
                    // 基本倍率（単体回復ケアルよりは少し抑えるのが一般的）
                    let multiplier = 1.0; 
                    if (skill.id === "medica") multiplier = 0.9; // スキル名で倍率を変える場合

                    // ★ 乱数を導入 (0.9 ～ 1.1倍のバラツキ)
                    const variance = 0.9 + Math.random() * 0.2;
                    let h_val = Math.floor(member.rec * multiplier * variance);

                    // 回復クリティカル判定
                    if (Math.random() < 0.1) {
                        h_val = Math.floor(h_val * 1.5);
                    }

                    m.set_hp(h_val);
                    this.effects.healEffect(`card-${i}`);
                    this.effects.damagePopup(`+${h_val}`, `card-${i}`, "#2ecc71");
                    this.add_log(` > ${m.name}を${h_val}回復`);
                }
            });
        }

        setTimeout(() => this.finish_turn(), 800);
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
        this.hide_all_command_btns();
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
        // 現在の行動者を取得
        const member = this.party[this.current_turn_index];
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
        
        if (member.buff_turns > 0) {
            member.buff_turns--;
            // バフが切れたら通知して即座に表示を更新
            if (member.buff_turns === 0) {
                this.add_log(` > ${member.name}の攻撃力アップが切れた`, "#bdc3c7");
                this.update_display(); 
            }
        }
        
        if (member.is_alive() && member.regen_turns > 0) {
            const heal_percent = 0.10; 
            const heal_val = Math.floor(member.max_hp * heal_percent);

            member.set_hp(heal_val);

            // ★ 回復演出を追加
            this.effects.healEffect(`card-${this.current_turn_index}`);
            this.effects.damagePopup(`+${heal_val}`, `card-${this.current_turn_index}`, "#2ecc71");

            this.add_log(` > ${member.name}はいのりの効果で${heal_val}回復した`, "#2ecc71");

            member.regen_turns--;
            if (member.regen_turns === 0) {
                this.add_log(` > ${member.name}の継続回復が終わった`, "#bdc3c7");
            }
        }

        this.update_display();
        this.current_turn_index ++;
        setTimeout(() => this.next_player_step(), 200);
    }

    slime_turn(index = 0) {

        //  全員の行動が終わったかチェック
        if (index >= this.enemies.length) {
            // 全員のターンが終わったら「かばう」を解除して味方のターンへ
            this.party.forEach(m => m.is_covering = false);
            this.current_turn_index = 0;
            this.update_display();

            if (this.party.every(m => !m.is_alive())) {
                setTimeout(() => { alert("パーティは全滅しました..."); location.reload(); }, 200);
            } else {
                this.next_player_step();
            }
            return;
        }

        const enemy = this.enemies[index];
        const alive_members = this.party.filter(m => m.is_alive());

        //  この敵が死んでいる、または味方が全滅していたら即座に次の敵のチェックへ
        if (!enemy.is_alive() || alive_members.length === 0) {
            this.slime_turn(index + 1);
            return;
        }

        // --- ここから敵1体分の行動ロジック ---
        const action_roll = Math.random();
        const hero = this.party[0];

        if (action_roll < 0.2) {
            const h_val = enemy.heal(enemy);
            this.effects.healEffect(`enemy-sprite-${index}`);
            this.add_log(`${enemy.name}の再生！ ${h_val}回復`, "#e67e22");
        } else if (action_roll < 0.5) {
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

        this.update_display(); // 1体動くたびにHPバーを更新

        //  1秒待ってから「次のインデックスの敵」を呼び出す
        setTimeout(() => {
            this.slime_turn(index + 1);
        }, 1000); // 1000ms = 1秒間隔
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
            
            const currentMember = this.party[this.current_turn_index];
            if (currentMember) {
                this.setup_command_buttons(currentMember);
            }

            // 新しく作られた要素を取得
            const spriteA = document.getElementById('enemy-sprite-0');
            const spriteB = document.getElementById('enemy-sprite-1');

            if (spriteA) spriteA.classList.add('appear-left');
            if (spriteB) spriteB.classList.add('appear-right');

            // 演出が終わったらクラスを消して、定位置に固定する
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

window.onload = () => {
    const game = new BattleManager();
    const startBtn = document.getElementById('start-button');
    const overlay = document.getElementById('start-overlay');

    startBtn.onclick = () => {
        // 1. 真っ先に AudioContext を叩き起こす（これが最優先）
        game.bgm.initContext();
        
        overlay.style.display = 'none';
        
        // 2. Androidの内部処理待ちとして少しだけ（100ms）待ってから再生
        setTimeout(() => {
            game.bgm.start();
            game.add_log("--- バトル開始 ---", "#f1c40f");
        }, 100);
    };
};