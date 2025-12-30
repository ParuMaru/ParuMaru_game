/**
 * 全てのキャラクター（味方・敵）の基底クラス
 */
class Entity {
    /**
     * @param {string} name - 名前
     * @param {number} hp - 最大HP
     * @param {number} mp - 最大MP
     * @param {number} atk - 物理攻撃力
     * @param {number} def - 物理防御力
     * @param {number} matk - 魔法攻撃力
     * @param {number} mdef - 魔法防御力
     * @param {number} spd - 素早さ
     * @param {number} rec - 回復力
     */
    constructor(name, hp, mp, atk, def, matk, mdef, spd, rec) {
        this.name = name;
        this.max_hp = hp;
        this.max_mp = mp;
        this._hp = hp;
        this._mp = mp;
        
        this.atk = atk;   // 物理攻撃の基準値
        this.def = def;   // 物理ダメージの軽減率に影響
        this.matk = matk; // 魔法攻撃の基準値
        this.mdef = mdef; // 魔法ダメージの軽減率に影響
        this.spd = spd;   // 行動順（現状はターン制だが定義保持）
        this.rec = rec;   // 回復スキルの効果量に影響

        // --- 状態フラグ ---
        this.is_covering = false; // 勇者の「かばう」発動中フラグ
        this.buff_turns = 0;      // 攻撃力UPバフの残り持続ターン
        this.regen_turns = 0;     // 「いのり」による継続回復の残りターン
    }

    /**
     * HPを増減させる（0〜最大値の範囲に収める）
     * 0以下になった場合は強化状態をすべて解除する
     */
    set_hp(value) {
        let new_hp = this._hp + value;
        this._hp = Math.max(0, Math.min(new_hp, this.max_hp));
        if (this._hp <= 0) {
            this._hp = 0;
            this.clear_all_buffs(); 
        }
    }

    /**
     * 全てのバフ・特殊状態をリセットする（戦闘不能時など）
     */
    clear_all_buffs(){
        this.buff_turns = 0;
        this.regen_turns = 0;
        this.is_covering = false;
    }
        
    /**
     * MPを増減させる
     */
    set_mp(value) {
        let new_mp = this._mp + value;
        this._mp = Math.max(0, Math.min(new_mp, this.max_mp));
    }

    get_hp() { return this._hp; }
    get_mp() { return this._mp; }

    /**
     * 物理攻撃を実行する
     * ダメージ計算： (攻撃力 * 乱数) * バフ倍率 * クリティカル倍率 - (相手の防御 / 2)
     */
    attack(target) {
        // 基本ダメージ: 攻撃力の 0.9 ～ 1.1 倍
        let damage = Math.floor(this.atk * (0.9 + Math.random() * 0.2));
        
        // 鼓舞バフ（勇者のスキル）の効果: ダメージ1.25倍
        if (this.buff_turns > 0) {
            damage = Math.floor(damage * 1.25);
        }
        
        // クリティカル判定（20%の確率でダメージ1.5倍）
        let is_critical = Math.random() < 0.2;
        if (is_critical) {
            damage = Math.floor(damage * 1.5);
        }

        // 防御力による減算（最低でも1ダメージは与える）
        let final_dmg = Math.max(1, damage - Math.floor(target.def / 2));   
        target.set_hp(-final_dmg);
        return [final_dmg, is_critical];
    }

    /**
     * 回復行動を実行する（MPを消費）
     */
    heal(target) {
        const COST = 15;
        this.set_mp(-COST);
        // 基本回復量: 自分の回復力の 0.9 ～ 1.1 倍
        let heal_val = Math.floor(this.rec * (0.9 + Math.random() * 0.2));
        
        // 20%の確率で「超回復（1.5倍）」が発生
        if (Math.random() < 0.2) {
            heal_val = Math.floor(heal_val * 1.5);
        }
        target.set_hp(heal_val);
        return heal_val;
    }
    
    /**
     * 戦闘不能状態から復帰させる
     */
    revive(hp_amount) {
        if (this._hp <= 0) {
            this._hp = hp_amount;
            return true; 
        }
        return false;
    }

    /**
     * 生存確認
     */
    is_alive() {
        return this._hp > 0;
    }
}

/**
 * 勇者クラス
 * 高いHPと防御力を持ち、仲間を守る・鼓舞するスキルを得意とする
 */
class Hero extends Entity {
    constructor(name) {
        // 名前, HP, MP, ATK, DEF, MATK, MDEF, SPD, REC
        super(name, 240, 80, 50, 45, 20, 30, 30, 25);
    }
    
    /**
     * スキル：かばう
     * 次の自分のターンまで、仲間に代わってダメージを受ける状態になる
     */
    skill_cover() {
        const COST = 10;
        if (this.get_mp() >= COST) {
            this.set_mp(-COST);
            this.is_covering = true;
            return true;
        }
        return false;
    }

    /**
     * スキル：勇者の鼓舞
     * パーティ全員の物理攻撃力を一定ターン上昇させる
     */
    skill_encourage(party) {
        const COST = 15;
        if (this.get_mp() >= COST) {
            this.set_mp(-COST);
            party.forEach(m => {
                if (m.is_alive()) m.buff_turns = 2;
            });
            return true;
        }
        return false;
    }
}

/**
 * 魔法使いクラス
 * 低耐久だが高い魔法攻撃力を持ち、多彩な攻撃魔法を操る
 */
class Wizard extends Entity {
    constructor(name) {
        super(name, 180, 150, 20, 20, 60, 50, 50, 15);
        this.skills = [
            { id: "fire", name: "ファイア", cost: 20, target: "single", type: "attack" },
            { id: "fira", name: "ファイラ", cost: 35, target: "all", type: "attack" },
            { id: "meteor", name: "メテオ", cost: 50, target: "single", type: "attack" }
        ];
    }

    /**
     * 魔法攻撃を実行する
     * ダメージ計算： (魔力 * スキル倍率 + 乱数) * バフ倍率 - (相手の魔防 / 3)
     */
    magic_attack(target, skill = null) {
        const skillId = skill ? skill.id : "magic";

        // スキルごとの威力倍率設定
        let powerMultiplier = 1.5;
        if (skillId === "fira") powerMultiplier = 1.1; 
        if (skillId === "fire") powerMultiplier = 1.5; 
        if (skillId === "meteor") powerMultiplier = 2.5; 

        let damage = Math.floor(this.matk * powerMultiplier + (Math.random() * 20));

        // 鼓舞バフは魔法ダメージにも影響する（1.25倍）
        if (this.buff_turns > 0) {
            damage = Math.floor(damage * 1.25);
        }

        // 魔法防御による減算
        let final_dmg = Math.max(1, damage - Math.floor(target.mdef / 3));
        
        target.set_hp(-final_dmg);
        return final_dmg;
    }
}

/**
 * 癒し手（ヒーラー）クラス
 * 回復と蘇生のエキスパート。MPが足りなくても仲間を救う手段を持つ
 */
class Healer extends Entity {
    constructor(name) {
        super(name, 200, 150, 25, 25, 40, 60, 35, 75);
        this.skills = [
            { id: "heal", name: "ケアル", cost: 15, target: "single", type: "heal" },
            { id: "medica", name: "メディカ", cost: 30, target: "all", type: "heal" },
            { id: "raise", name: "レイズ", cost: 40, target: "single", type: "res" }
        ];
    }

    /**
     * 蘇生スキル
     * MPがある場合：通常の蘇生（HP50%復帰）
     * MPが足りない場合：命の代償（自身が死亡し、対象を完全回復状態で蘇生）
     */
    resurrection(target) {
        const COST_MP = 40;
        const revive_hp = Math.floor(target.max_hp * 0.5);
        if (this.get_mp() >= COST_MP) {
            this.set_mp(-COST_MP);
            target.revive(revive_hp);
            return "magic";
        } else {
            // 【特殊仕様】MP不足時に発動。自分の命を捧げる
            this.set_hp(-999999);
            target.revive(target.max_hp);
            target.set_mp(target.max_mp);
            return "sacrifice";
        }
    }
}

/**
 * スライムクラス（敵専用）
 * キング形態は高い耐久力を持ち、HPが減ると小型の2体に分裂する
 */
class Slime extends Entity {
    constructor(name, type = "king") {
        if (type === "king") {
            // キングスライム：ボス級のステータス
            super(name, 1000, 0, 70, 40, 40, 35, 20, 40);
            this.is_king = true;
            this.img = "slime.png"; 
        } else {
            // 分裂後のスライム：単体は弱いが素早い
            super(name, 300, 0, 45, 25, 30, 20, 40, 20);
            this.is_king = false;
            this.img = "splited_slime.png"; 
        }
        this.has_split = false; // すでに分裂したかどうかの管理フラグ
    }
}