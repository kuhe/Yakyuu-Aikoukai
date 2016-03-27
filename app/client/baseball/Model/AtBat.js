import { Log } from '../Utility/Log';

class AtBat {
    constructor(text) {
        this.infield = text.indexOf(AtBat.prototype.INFIELD_HIT_INDICATOR) > -1 ? AtBat.prototype.INFIELD_HIT_INDICATOR : '';
        text = text.replace(AtBat.prototype.INFIELD_HIT_INDICATOR, '');
        this.text = text.split(AtBat.prototype.RBI_INDICATOR)[0];
        this.rbi = (text.split(this.text)[1] + '');

        var log = new Log();

        var beneficial = [
            log.WALK, log.SINGLE, log.HOMERUN, log.DOUBLE, log.TRIPLE, log.SACRIFICE, log.REACHED_ON_ERROR,
            log.STOLEN_BASE, log.RUN
        ];
        if (beneficial.indexOf(this.text) > -1) {
            this.beneficial = true;
        }
    }
    toString() {
        return '' + this.infield + this.text + this.rbi;
    }
}

AtBat.prototype.constructor = AtBat;
AtBat.prototype.identifier = 'AtBat';
AtBat.prototype.INFIELD_HIT_INDICATOR = '';
AtBat.prototype.RBI_INDICATOR = '+';

export { AtBat }