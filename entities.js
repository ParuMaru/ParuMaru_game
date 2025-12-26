// --- クラス定義 (Entity, Hero, Wizard, Healer, Slime) ---
class Entity {
    constructor(name, hp, mp) {
        this.name = name;
        this.max_hp = hp;
        this.max_mp = mp;
        this._hp = hp; // JSでは非公開変数に _ をつける
        this._mp = mp;
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

    attack(target) {
        // Pythonの random.randint(10, 20) 相当
        let damage = Math.floor(Math.random() * (20 - 10 + 1)) + 10;
        let is_critical = Math.random() < 0.2;
        if (is_critical) damage *= 2;
        target.set_hp(-damage);
        return [damage, is_critical];
    }

    heal(target) {
        let heal_val = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
        if (Math.random() < 0.2) {
            heal_val = Math.floor(heal_val * 1.5);
        }
        target.set_hp(heal_val);
        return heal_val;
    }

    is_alive() {
        return this._hp > 0;
    }
}

class Hero extends Entity {
    constructor(name, hp = 200, mp = 80) {
        super(name, hp, mp);
    }

    attack(target) {
        let damage = Math.floor(Math.random() * (50 - 35 + 1)) + 35;
        let is_critical = Math.random() < 0.25;
        if (is_critical) damage *= 2;
        target.set_hp(-damage);
        return [damage, is_critical];
    }
}

class Wizard extends Entity {
    constructor(name, hp = 180, mp = 150) {
        super(name, hp, mp);
    }

    magic_attack(target) {
        let damage = Math.floor(Math.random() * (70 - 50 + 1)) + 50;
        if (this.get_mp() >= 15) {
            target.set_hp(-damage);
            this.set_mp(-15);
            return damage;
        }
        return 0;
    }
}

class Healer extends Entity {
    constructor(name, hp = 200, mp = 150) {
        super(name, hp, mp);
    }
    
    heal(target) {
        let heal_val = Math.floor(Math.random() * (80 - 50 + 1)) + 50;
        if (Math.random() < 0.25) {
            heal_val = Math.floor(heal_val * 2);
        }
        target.set_hp(heal_val);
        return heal_val;
    }

    resurrection(target) {
        const COST_MP = 40;
        if (this.get_mp() >= COST_MP) {
            this.set_mp(-COST_MP);
            target.set_hp(Math.floor(target.max_hp / 2));
            return "magic";
        } else {
            this.set_hp(-999999);
            target.set_hp(target.max_hp);
            target.set_mp(target.max_mp);
            return "sacrifice";
        }
    }
}

class Slime extends Entity {
    constructor(name, hp = 1000, mp = 0) {
        super(name, hp, mp);
    }

    attack(target) {
        let damage = Math.floor(Math.random() * (60 - 40 + 1)) + 40;
        let is_critical = Math.random() < 0.15;
        if (is_critical) damage = Math.floor(damage * 1.5);
        target.set_hp(-damage);
        return [damage, is_critical];
    }
}