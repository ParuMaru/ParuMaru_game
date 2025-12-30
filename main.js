/**
 * 汎用SE再生関数
 * 短い効果音（配列による和音など）をWeb Audio APIで直接生成して鳴らす
 */
function playGlobalSE(freqs, duration, type = "triangle", vol = 0.05) {
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

/**
 * バトル全体の進行、UI更新、各マネージャーとの連携を司るメインクラス
 */
class BattleManager {
    constructor() {
        // --- 演出・BGM管理の初期化 ---
        this.bgm = new BattleBGM();
        this.effects = new EffectManager();
        
        this.bgm.initContext();
        this.preloadMidi();
        
        // 効果音ファイルの読み込み準備
        this.bgm.loadSE('slash', 'slash.mp3');
        this.bgm.loadSE('magic', 'magic.mp3');
        this.bgm.loadSE('fire', 'fire.mp3');
        this.bgm.loadSE('heal', 'heal.mp3');
        this.bgm.loadSE('meteor', 'meteor.mp3');
        this.bgm.loadSE('meditation', 'meditation.mp3');
        this.bgm.loadSE('kobu', 'kobu.mp3');
        this.bgm.loadSE('cover', 'cover.mp3');

        // --- パーティ・敵プロパティの初期化 ---
        this.party = [
            new Hero("勇者ぱるむ"),
            new Wizard("魔法使いはな"),
            new Healer("癒し手なつ")
        ];
        this.enemies = [new Slime("キングスライム"),];
        
        // 現在行動中の味方インデックス
        this.current_turn_index = 0;
        
        // 所持アイテムリスト
        this.items = [
            { id: "potion", name: "ポーション", count: 3, effect: 50, description: "HPを50回復" },
            { id: "ether", name: "エーテル", count: 2, effect: 30, description: "MPを30回復" },
            { id: "phoenix", name: "フェニックスの尾", count: 1, effect: 0.5, description: "仲間一人をHP50%で蘇生" }
        ];

        this.update_display();
        this.add_log(`★ ${this.enemies[0].name}が現れた！`, "#f1c40f", true);
        this.next_player_step();
        
        // デバッグ用キー操作の設定
        window.addEventListener('keydown', (e) => {
            if (e.key === 'b' || e.key === 'B') {this.debug_damage_enemies();}
            if (e.key === 'p' || e.key === 'P') {this.debug_damage_party();}
            if (e.key === 'm' || e.key === 'M') {this.debug_mp_zero();}
        });
    }
    
    /**
     * 特定のMIDIファイルをフェッチしてBGMとしてロードする
     */
    async preloadMidi() {
        try {
            const response = await fetch('endymion.mid');
            const blob = await response.blob();
            const file = new File([blob], "endymion.mid");
            await this.bgm.loadMidiFromFile(file);
            console.log("BGMの自動読み込みが完了しました");
        } catch (error) {
            console.error("MIDIの読み込みに失敗しました:", error);
        }
    }
    
    /**
     * [デバッグ] 全ての敵に固定ダメージを与える
     */
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
        this.update_display(); 
    }
    
    /**
     * [デバッグ] 全ての味方のMPを0にする
     */
    debug_mp_zero() {
        this.add_log("--- デバッグ: MP:0 ---", "#ff4757");
        this.party.forEach((m, i) => {
            m.set_mp(-m.get_mp()); 
        });
        this.update_display(); 
    }

    /**
     * [デバッグ] 全ての味方のHPを1にする
     */
    debug_damage_party() {
        this.add_log("--- デバッグ: 味方全員に致命傷 ---", "#ff4757");
        this.party.forEach((m, i) => {
            m.set_hp(-m.get_hp() + 1); 
            this.effects.damagePopup("Danger!", `card-${i}`, "#ff4757");
        });
        this.update_display();
    }
    
    /**
     * 画面上のログエリアにメッセージを追記する
     */
    add_log(message, color = "white", is_bold = false) {
        const logElement = document.getElementById('log');
        const newMessage = document.createElement('div');
        newMessage.style.color = color;
        if (is_bold) newMessage.style.fontWeight = "bold";
        newMessage.innerText = message;
        logElement.prepend(newMessage); 
    }

    /**
     * 敵のHPバー、味方のステータス、バフ表示などを最新の状態に更新する
     */
    update_display() {
        // 敵表示の更新
        const targetArea = document.getElementById('enemy-target');
        targetArea.innerHTML = ""; 
        this.enemies.forEach((enemy, i) => {
            const unit = document.createElement('div');
            unit.className = "enemy-unit";
            if (enemy.is_king && enemy.is_alive()) unit.classList.add("king-size");
            
            if (enemy.is_alive()) {
                const hp_ratio = (enemy.get_hp() / enemy.max_hp) * 100;
                unit.innerHTML = `
                    <div class="enemy-label">${enemy.name}</div>
                    <div class="enemy-hp-container"><div class="enemy-hp-bar" style="width:${hp_ratio}%"></div></div>
                    <img src="${enemy.img}" id="enemy-sprite-${i}" class="enemy-img">
                `;
            } else {
                unit.innerHTML = `<div id="enemy-sprite-${i}" style="display:none;"></div>`;
            }
            targetArea.appendChild(unit);
        });
        
        // 味方ステータス（HP/MPバー、バッジ）の更新
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
                    if (member.buff_turns > 0) statusElem.innerHTML += `<span class="badge" style="background-color: #f1c40f; color: #2c3e50;">ATK ▲${member.buff_turns}</span>`;
                    if (member.is_covering) statusElem.innerHTML += `<span class="badge" style="background-color: #3498db; color: white;">かばう</span>`;
                    if (member.regen_turns > 0) statusElem.innerHTML += `<span class="badge" style="background-color: #2ecc71; color: white;">いのり ${member.regen_turns}</span>`;
                }
            }
            document.getElementById(`card-${i}`).style.opacity = member.is_alive() ? "1" : "0.5";
            document.getElementById(`card-${i}`).classList.remove('active-member');
        });
    }

    /**
     * ターンの進行管理
     * 勝利判定、全行動終了判定、次の行動者の選定を行う
     */
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

    /**
     * 行動を選択するためのメインコマンドボタンを表示する
     */
    setup_command_buttons(member) {
        this.hide_all_command_btns();
        const activeCard = document.getElementById(`card-${this.current_turn_index}`);
        if (activeCard) activeCard.classList.add('active-member');

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

    /**
     * 魔法・スキルの一覧を表示する
     */
    show_magic_list(member) {
        this.hide_all_command_btns();
        document.getElementById('turn-label').innerText = "どの魔法を使いますか？";

        member.skills.forEach((skill, i) => {
            let can_use = member.get_mp() >= skill.cost;
            let btnText = `${skill.name}(${skill.cost})`;
            let btnColor = "#2980b9"; 

            if (skill.type === "res") {
                if (!can_use) {
                    btnText = "！！命の代償！！";
                    btnColor = "#c0392b"; 
                    can_use = true; 
                } else {
                    btnColor = "#f39c12"; 
                }
            }

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
    
    /**
     * 攻撃対象となる敵を選択するUIを表示する
     */
    select_enemy_target(action_data) {
        document.getElementById('turn-label').innerText = "どの敵を狙いますか？";
        this.hide_all_command_btns();

        const aliveEnemies = this.enemies
            .map((enemy, index) => ({ enemy, index }))
            .filter(item => item.enemy.is_alive());

        aliveEnemies.forEach((item, i) => {
            if (i < 3) { 
                this.show_btn(i, item.enemy.name, "#c0392b", () => {
                    this.execute_action(action_data, item.index);
                });
            }
        });

        this.show_btn(3, "戻る", "#95a5a6", () => {
            const currentMember = this.party[this.current_turn_index];
            if (typeof action_data === "object") {
                this.show_magic_list(currentMember);
            } else {
                this.setup_command_buttons(currentMember);
            }
        });
    }

    /**
     * 単体への攻撃・攻撃魔法を実際に計算し、演出を実行する
     */
    execute_action(action_type, target_index) {
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const target = this.enemies[target_index];
        const targetId = `enemy-sprite-${target_index}`;

        let currentSkill = null;
        if (member.skills) currentSkill = member.skills.find(s => s.id === action_type);

        if (action_type === "attack") {
            const [dmg, crit] = member.attack(target);
            if (member instanceof Hero){
                this.bgm.playAttack();
                this.effects.slashEffect(targetId);
            }else{
                this.bgm.playMagic();
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

            if (currentSkill.id === "meteor") {
                this.bgm.playMagicMeteor();
                this.effects.meteorEffect(targetId);
                this.effects.damagePopup(dmg, targetId, "#4522c5");
                this.add_log("空から巨大な隕石が降り注ぐ","#e74c3c",true);
            }else if(currentSkill.id === "fire"){
                this.bgm.playMagicFire();
                this.effects.fireEffect(targetId);
                this.effects.damagePopup(dmg, targetId, "#4522c5");
            }
            this.add_log(`${member.name}の${currentSkill.name}！`, "#70ABDB", true);
            this.add_log(` > ${target.name}に${dmg}のダメージ`);
        }

        setTimeout(() => this.finish_turn(), 500);
    }

    /**
     * 回復やアイテムの対象となる味方を選択するUIを表示する
     */
    select_target(action_id) {
        document.getElementById('turn-label').innerText = "誰を対象にしますか？";
        this.hide_all_command_btns();

        this.party.forEach((m, i) => {
            let can_select = (action_id === "raise") ? !m.is_alive() : m.is_alive();
            this.show_btn(i, m.name, "#2ecc71", () => {
                if (action_id === "raise") {
                    this.execute_resurrection(m); 
                } else {
                    this.execute_heal(action_id, m); 
                }
            }, can_select);
        });
        this.show_btn(3, "戻る", "#95a5a6", () => this.show_magic_list(this.party[this.current_turn_index]));
    }

    /**
     * 味方単体への回復魔法を実行する
     */
    execute_heal(action_id, target) {
        this.bgm.playHeal();
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const targetIdx = this.party.indexOf(target);

        const skill = member.skills.find(s => s.id === action_id);
        const cost = skill ? skill.cost : 15;
        const skillName = skill ? skill.name : "回復魔法";

        member.set_mp(-cost);

        let multiplier = 1.0;
        if (skill && skill.id === "curaga") multiplier = 2.5; 
        let heal_val = Math.floor(member.rec * multiplier * (0.9 + Math.random() * 0.2));

        if (Math.random() < 0.2) heal_val = Math.floor(heal_val * 1.5);
        target.set_hp(heal_val);

        this.effects.healEffect(`card-${targetIdx}`);
        this.effects.damagePopup(`+${heal_val}`, `card-${targetIdx}`, "#2ecc71");
        this.add_log(`${member.name}の${skillName}！`, "#1C9C51", true);
        this.add_log(` > ${target.name}のHPを${heal_val}回復`);

        this.update_display();
        setTimeout(() => this.finish_turn(), 500);
    }

    /**
     * 蘇生魔法（または命の代償）を実行する
     */
    execute_resurrection(target) {
        this.bgm.playHeal();
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const targetIdx = this.party.indexOf(target);
        const skill = member.skills.find(s => s.type === "res");
        
        const res_type = member.resurrection(target);
        this.effects.resurrectionEffect(`card-${targetIdx}`);

        if (res_type === "magic") {
            const skillName = skill ? skill.name.split('(')[0] : "蘇生魔法";
            this.add_log(`${member.name}の${skillName}！`, "#f39c12", true);
            this.add_log(` > ${target.name}が蘇った！`);
        } else {
            this.effects.flash("#ff4757");
            this.add_log(`${member.name}の命の代償！`, "#e74c3c", true);
            this.add_log(` > ${target.name}を完全蘇生した！`);
            this.add_log(` ！！${member.name}が倒れた！！`, "#e74c3c", true);
        } 
        this.update_display();  
        setTimeout(() => this.finish_turn(), 500);
    }
    
    /**
     * ヒーラー専用スキル：パーティ全員に継続回復を付与する
     */
    execute_prayer() {
        this.hide_all_command_btns();
        const healer = this.party[this.current_turn_index];

        this.party.forEach((m, i) => {
            if (m.is_alive()) {
                m.regen_turns = (i === this.current_turn_index) ? 4 : 3;
            }
        });
        this.bgm.playHeal();
        this.effects.flash("#fff");
        this.add_log(`${healer.name}のいのり！`, "#8e44ad", true);
        this.add_log(" > 慈愛の心が仲間たちの傷を癒していく...");

        this.party.forEach((m, i) => {
            if(m.is_alive()) {
                this.effects.damagePopup("いのり", `card-${i}`, "#2ecc71");
                this.effects.healEffect(`card-${i}`);
            }
        });
        setTimeout(() => this.finish_turn(), 600);
    }
   
    /**
     * 勇者専用スキル：次の敵のターンまで仲間を守る（ダメージ軽減）
     */
    execute_cover() {
        this.bgm.playCover();
        this.hide_all_command_btns();
        const hero = this.party[this.current_turn_index];
        if (hero.skill_cover()) {
            this.add_log(`${hero.name}は身構えた！`, "#3498db", true);
            this.add_log(` > 仲間全員をかばい、受けるダメージを軽減する！`);
            this.finish_turn();
        }
    }

    /**
     * 勇者専用スキル：パーティ全員の攻撃力を上げる
     */
    execute_hero_skill() {
        this.bgm.playKobu();
        this.hide_all_command_btns();
        const hero = this.party[this.current_turn_index];

        this.party.forEach((m, i) => {
            if (m.is_alive()) {
                m.buff_turns = (i === this.current_turn_index) ? 3 : 2;
            }
        });

        this.effects.flash("#f1c40f");
        this.add_log(`${hero.name}の勇者の鼓舞！`, "#f1c40f", true);
        this.add_log(" > 全員の攻撃力が上がった！");

        this.party.forEach((m, i) => { 
            if(m.is_alive()) this.effects.damagePopup("ATK UP!", `card-${i}`, "#f1c40f"); 
        });

        hero.set_mp(-15); 
        this.finish_turn(); 
    }

    /**
     * 自身のMPを回復する
     */
    execute_meditation() {
        this.bgm.playMeditation();
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        const recover = 30;
        member.set_mp(recover);
        this.effects.healEffect(`card-${this.current_turn_index}`);
        this.effects.damagePopup(`+${recover}MP`, `card-${this.current_turn_index}`, "#9b59b6");
        this.add_log(`${member.name}は瞑想した。MPが${recover}回復！`, "#9b59b6", true);
        this.finish_turn();
    }
    
    /**
     * 全体攻撃魔法や全体回復魔法を実行する
     */
    execute_all_action(skill) {
        this.bgm.playMagicFire();
        this.hide_all_command_btns();
        const member = this.party[this.current_turn_index];
        member.set_mp(-skill.cost);

        if (skill.type === "attack") {
            this.add_log(`${member.name}の${skill.name}！`, "#e67e22", true);
            if (skill.id === "fira") this.effects.allFireEffect(this.enemies);
            else this.effects.flash("#fff"); 

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
            this.bgm.playHeal();
            this.add_log(`${member.name}の${skill.name}！`, "#27ae60", true);
            this.party.forEach((m, i) => {
                if (m.is_alive()) {
                    let multiplier = (skill.id === "medica") ? 0.9 : 1.0; 
                    const variance = 0.9 + Math.random() * 0.2;
                    let h_val = Math.floor(member.rec * multiplier * variance);
                    if (Math.random() < 0.1) h_val = Math.floor(h_val * 1.5);

                    m.set_hp(h_val);
                    this.effects.healEffect(`card-${i}`);
                    this.effects.damagePopup(`+${h_val}`, `card-${i}`, "#2ecc71");
                    this.add_log(` > ${m.name}のHPを${h_val}回復`);
                }
            });
        }
        setTimeout(() => this.finish_turn(), 800);
    }

    /**
     * 所持アイテムの一覧を表示する
     */
    show_item_list() {
        this.hide_all_command_btns();
        this.items.forEach((item, i) => {
            this.show_btn(i, `${item.name}(${item.count})`, "#e67e22", () => this.select_item_target(item), item.count > 0);
        });
        this.show_btn(3, "戻る", "#95a5a6", () => this.setup_command_buttons(this.party[this.current_turn_index]));
    }

    /**
     * 使用するアイテムの対象となる味方を選択する
     */
    select_item_target(item) {
        this.hide_all_command_btns();
        this.party.forEach((m, i) => {
            let can_select = (item.id === "phoenix") ? !m.is_alive() : m.is_alive();
            this.show_btn(i, m.name, "#2ecc71", () => this.execute_use_item(item, m), can_select);
        });
        this.show_btn(3, "戻る", "#95a5a6", () => this.show_item_list());
    }

    /**
     * アイテムを消費し、その効果を適用する
     */
    execute_use_item(item, target) {
        this.hide_all_command_btns();
        item.count--;
        const member = this.party[this.current_turn_index];
        const targetIdx = this.party.indexOf(target);
        if (item.id === "phoenix") {
            target.revive(Math.floor(target.max_hp * item.effect));
            this.bgm.playHeal();
            this.effects.resurrectionEffect(`card-${targetIdx}`);
            this.add_log(`${member.name}は${item.name}を使った！`, "#e67e22");
            this.add_log(` > ${target.name}が蘇った！`);
        } else if (item.id === "potion") {
            target.set_hp(item.effect);
            this.bgm.playHeal();
            this.effects.healEffect(`card-${targetIdx}`);
            this.effects.damagePopup(`+${item.effect}`, `card-${targetIdx}`, "#2ecc71");
            this.add_log(`${member.name}は${item.name}を使った！`, "#e67e22");
            this.add_log(` > ${target.name}のHPが${item.effect}回復した`);
        } else if (item.id === "ether") {
            target.set_mp(item.effect);
            this.bgm.playHeal();
            this.effects.damagePopup(`+${item.effect}MP`, `card-${targetIdx}`, "#3498db");
            this.add_log(`${member.name}は${item.name}を使った！`, "#e67e22");
            this.add_log(` > ${target.name}のMPが${item.effect}回復した`);
        }
        this.finish_turn();
    }

    /**
     * 1人の味方の行動が全て完了した後の処理
     * 分裂判定、バフ・リジェネ更新、ターン送りを行う
     */
    finish_turn() {
        const member = this.party[this.current_turn_index];
        this.enemies.forEach((enemy, index) => {
            if (enemy.is_king && !enemy.has_split && enemy.is_alive() && enemy.get_hp() <= enemy.max_hp / 2) {
                this.execute_split(index);
            }
        });

        this.enemies.forEach(enemy => {
            if (!enemy.is_alive() && !enemy.has_split && !enemy.death_logged) {
                this.add_log(`★ ${enemy.name}を倒した！`, "#f1c40f", true);
                enemy.death_logged = true; 
            }
        });
        
        if (member.buff_turns > 0) {
            member.buff_turns--;
            if (member.buff_turns === 0) {
                this.add_log(` > ${member.name}の攻撃力アップが切れた`, "#bdc3c7");
                this.update_display(); 
            }
        }
        
        if (member.is_alive() && member.regen_turns > 0) {
            const heal_val = Math.floor(member.max_hp * 0.10);
            member.set_hp(heal_val);
            this.effects.healEffect(`card-${this.current_turn_index}`);
            this.effects.damagePopup(`+${heal_val}`, `card-${this.current_turn_index}`, "#2ecc71");
            this.add_log(` > ${member.name}はいのりの効果でHPを${heal_val}回復した`, "#2ecc71");
            member.regen_turns--;
            if (member.regen_turns === 0) this.add_log(` > ${member.name}の継続回復が終わった`, "#bdc3c7");
        }

        this.update_display();
        this.current_turn_index ++;
        setTimeout(() => this.next_player_step(), 200);
    }

    /**
     * 敵側のターン処理（再帰的に全敵を実行）
     */
    slime_turn(index = 0) {
        if (index >= this.enemies.length) {
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

        if (!enemy.is_alive() || alive_members.length === 0) {
            this.slime_turn(index + 1);
            return;
        }

        const action_roll = Math.random();
        const hero = this.party[0];

        if (action_roll < 0.2) {
            const h_val = enemy.heal(enemy);
            this.effects.healEffect(`enemy-sprite-${index}`);
            this.add_log(`${enemy.name}の再生！ HP${h_val}回復`, "#e67e22");
        } else if (action_roll < 0.5) {
            this.add_log(`${enemy.name}の「のしかかり」！`, "#e74c3c", true);
            this.bgm.playDamage();
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
            this.bgm.playDamage();
            const idx = this.party.indexOf(final_target);
            this.effects.slashEffect(`card-${idx}`);
            this.effects.damagePopup(dmg, `card-${idx}`, crit ? "#c0392b" : "#ff4757");
            this.add_log(`${enemy.name}の攻撃！`, "#e67e22", true);
            if (crit) this.add_log(" > 痛恨の一撃！！！", "#c0392b");
            this.add_log(` > ${final_target.name}に${dmg}のダメージ`);
        }
        this.update_display(); 
        setTimeout(() => this.slime_turn(index + 1), 1000); 
    }
    
    /**
     * キングスライム専用：HP低下時に自身を消滅させ、2体の通常スライムを生成する
     */
    execute_split(index) {
        const king = this.enemies[index];
        king.has_split = true;
        const kingSprite = document.getElementById(`enemy-sprite-${index}`);
        this.add_log(`！！ ${king.name}の体が震えている ！！`, "#f1c40f", true);
        if (kingSprite) kingSprite.classList.add('splitting');

        setTimeout(() => {
            king.set_hp(-9999);
            this.effects.flash("#fff");
            const s1 = new Slime("スライムA", "normal");
            const s2 = new Slime("スライムB", "normal");
            this.enemies = [s1, s2];
            this.add_log(` > ${king.name}が2体に分裂した！`, "#f1c40f");
            this.update_display();
            
            const currentMember = this.party[this.current_turn_index];
            if (currentMember) this.setup_command_buttons(currentMember);

            const spriteA = document.getElementById('enemy-sprite-0');
            const spriteB = document.getElementById('enemy-sprite-1');
            if (spriteA) spriteA.classList.add('appear-left');
            if (spriteB) spriteB.classList.add('appear-right');

            setTimeout(() => {
                if (spriteA) spriteA.classList.remove('appear-left');
                if (spriteB) spriteB.classList.remove('appear-right');
            }, 600); 
        }, 800);
    }

    /**
     * 指定した番号のコマンドボタンを表示・設定する
     */
    show_btn(index, text, color, action, enabled = true) {
        const btn = document.getElementById(`btn-${index}`);
        if (!btn) return;
        btn.innerText = text;
        btn.style.backgroundColor = color;
        btn.style.display = "inline-block";
        btn.disabled = !enabled;
        btn.onclick = action;
    }

    /**
     * 全てのコマンドボタンを非表示にする
     */
    hide_all_command_btns() {
        for (let i = 0; i < 4; i++) {
            const btn = document.getElementById(`btn-${i}`);
            if (btn) btn.style.display = "none";
        }
    }
}

/**
 * ページ読み込み完了時のエントリーポイント
 */
window.onload = () => {
    const game = new BattleManager();
    const startBtn = document.getElementById('start-button');
    const overlay = document.getElementById('start-overlay');

    startBtn.addEventListener("click", () => {
        game.bgm.initContext(); 
        overlay.style.display = 'none';
        setTimeout(() => {
            game.bgm.start();
            game.add_log("--- バトル開始 ---", "#f1c40f");
        }, 100);
    }, { once: true });
};