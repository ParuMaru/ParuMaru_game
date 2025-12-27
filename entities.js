// --- クラス定義 (Entity, Hero, Wizard, Healer, Slime) ---
class Entity {
    // 引数に共通ステータスを追加
    constructor(name, hp, mp, atk, def, spd, rec) {
        this.name = name;
        this.max_hp = hp;
        this.max_mp = mp;
        this._hp = hp;
        this._mp = mp;
        
        // 追加ステータス
        this.atk = atk;
        this.def = def;
        this.spd = spd;
        this.rec = rec;

        this.is_covering = false; // かばう中か
        this.buff_turns = 0;      // 攻撃力UPの残りターン
    }

    set_hp(value) {
        let new_hp = this._hp + value;
        this._hp = Math.max(0, Math.min(new_hp, this.max_hp));
    }

    set_mp(value) {
        let new_mp = this._mp + value;
        this._mp = Math.max(0, Math.min(new_mp, this.max_mp));
    }

    get_hp() { return this._hp; }
    get_mp() { return this._mp; }

    // attackを共通化。自分のatkと相手のdefを使用
    attack(target) {
    // 基本ダメージ: 攻撃力の 0.9 ～ 1.1 倍
    let damage = Math.floor(this.atk * (0.9 + Math.random() * 0.2));
    
    // ★鼓舞バフの効果: 1.5倍から1.25倍に変更
    if (this.buff_turns > 0) {
        damage = Math.floor(damage * 1.25);
    }
    
    // クリティカル判定（20%の確率で1.5倍）
    let is_critical = Math.random() < 0.2;
    if (is_critical) {
        damage = Math.floor(damage * 1.5);
    }

    // 防御力による減算（最低1ダメージ）
    let final_dmg = Math.max(1, damage - Math.floor(target.def / 2));
    
    target.set_hp(-final_dmg);
    return [final_dmg, is_critical];
}

    // healを共通化。自分のrecを使用
    heal(target) {
        // 基本回復量: 回復力の 0.9 ～ 1.1 倍
        let heal_val = Math.floor(this.rec * (0.9 + Math.random() * 0.2));
        
        if (Math.random() < 0.2) {
            heal_val = Math.floor(heal_val * 1.5);
        }
        target.set_hp(heal_val);
        return heal_val;
    }
    
    revive(hp_amount) {
        if (this._hp <= 0) {
            this._hp = hp_amount;
            return true; 
        }
        return false;
    }

    is_alive() {
        return this._hp > 0;
    }
}

class Hero extends Entity {
    constructor(name) {
        // 名前, HP, MP, ATK, DEF, SPD, REC
        super(name, 220, 80, 50, 45, 30, 25);
    }
    
    skill_cover() {
        const COST = 10;
        if (this.get_mp() >= COST) {
            this.set_mp(-COST);
            this.is_covering = true;
            return true;
        }
        return false;
    }

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

class Wizard extends Entity {
    constructor(name) {
        super(name, 180, 150, 25, 20, 50, 15);
    }

    magic_attack(target) {
    // 魔法攻撃の基本威力: 攻撃力の2.5倍 + 0～19の乱数
    let damage = Math.floor(this.atk * 2.5 + (Math.random() * 20));

    // ★鼓舞バフの効果: 1.25倍に統一（物理・魔法両方に恩恵がある設定）
    if (this.buff_turns > 0) {
        damage = Math.floor(damage * 1.25);
    }

    if (this.get_mp() >= 15) {
        target.set_hp(-damage);
        this.set_mp(-15);
        return damage;
    }
    return 0; // MP不足
}
}

class Healer extends Entity {
    constructor(name) {
        super(name, 200, 150, 30, 25, 35, 75);
    }
    // healは親クラスの共通処理を使うため削除

    resurrection(target) {
        const COST_MP = 40;
        const revive_hp = Math.floor(target.max_hp * 0.5);
        if (this.get_mp() >= COST_MP) {
            this.set_mp(-COST_MP);
            target.revive(revive_hp);
            return "magic";
        } else {
            this.set_hp(-999999);
            target.revive(target.max_hp);
            target.set_mp(target.max_mp);
            return "sacrifice";
        }
    }
}

class Slime extends Entity {
    constructor(name) {
        super(name, 1000, 0, 60, 30, 20, 40);
    }
    // attackは親クラスの共通処理を使うため削除
}