cacheKey = Math.floor(Math.random()*1500);

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _UtilityLog = require('../Utility/Log');

var AtBat = (function () {
    function AtBat(text) {
        _classCallCheck(this, AtBat);

        this.infield = text.indexOf(AtBat.prototype.INFIELD_HIT_INDICATOR) > -1 ? AtBat.prototype.INFIELD_HIT_INDICATOR : '';
        text = text.replace(AtBat.prototype.INFIELD_HIT_INDICATOR, '');
        this.text = text.split(AtBat.prototype.RBI_INDICATOR)[0];
        this.rbi = text.split(this.text)[1] + '';

        var log = new _UtilityLog.Log();

        var beneficial = [log.WALK, log.SINGLE, log.HOMERUN, log.DOUBLE, log.TRIPLE, log.SACRIFICE, log.REACHED_ON_ERROR, log.STOLEN_BASE, log.RUN];
        if (beneficial.indexOf(this.text) > -1) {
            this.beneficial = true;
        }
    }

    _createClass(AtBat, [{
        key: 'toString',
        value: function toString() {
            return '' + this.infield + this.text + this.rbi;
        }
    }]);

    return AtBat;
})();

AtBat.prototype.constructor = AtBat;
AtBat.prototype.identifier = 'AtBat';
AtBat.prototype.INFIELD_HIT_INDICATOR = '';
AtBat.prototype.RBI_INDICATOR = '+';

exports.AtBat = AtBat;

},{"../Utility/Log":34}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _ModelPlayer = require('../Model/Player');

var _Services_services = require('../Services/_services');

/**
 * The baseball field tracks the ball's movement, fielders, and what runners are on
 * @param game
 * @constructor
 */
var Field = function Field(game) {
    this.init(game);
};

Field.prototype = {
    constructor: Field,
    init: function init(game) {
        this.game = game;
        this.first = null;
        this.second = null;
        this.third = null;
    },
    /**
     * @returns {boolean}
     */
    hasRunnersOn: function hasRunnersOn() {
        return this.first instanceof _ModelPlayer.Player || this.second instanceof _ModelPlayer.Player || this.third instanceof _ModelPlayer.Player;
    },
    /**
     * @param swing
     * @returns {object}
     */
    determineSwingContactResult: function determineSwingContactResult(swing) {

        if (this.first) this.first.fatigue += 4;
        if (this.second) this.second.fatigue += 4;
        if (this.third) this.third.fatigue += 4;

        var x = swing.x,
            y = swing.y;
        var eye = this.game.batter.skill.offense.eye;
        /**
         * The initial splay angle is 90 degrees for hitting up the middle and 0
         * for a hard foul left, 180 is a foul right. Depending on the angle of the bat,
         * a y-axis displacement which would otherwise pop or ground the ball can instead
         * increase the left/right effect.
         */
        var angles = _Services_services.Mathinator.getSplayAndFlyAngle(x, y, swing.angle, eye);
        var splayAngle = angles.splay;

        var flyAngle = angles.fly;
        var power = this.game.batter.skill.offense.power + (this.game.batter.eye.bonus || 0) / 5;
        var landingDistance = _Services_services.Distribution.landingDistance(power, flyAngle, x, y);
        if (flyAngle < 0 && landingDistance > 95) {
            landingDistance = (landingDistance - 95) / 4 + 95;
        }
        var game = this.game;

        if (Math.abs(splayAngle) > 50) swing.foul = true;
        swing.fielder = this.findFielder(splayAngle, landingDistance, power, flyAngle);
        if (['first', 'second', 'short', 'third'].indexOf(swing.fielder) > -1) {
            landingDistance = Math.min(landingDistance, 110); // stopped by infielder
        } else {
                landingDistance = Math.max(landingDistance, 150); // rolled past infielder
            }
        swing.travelDistance = landingDistance;
        swing.flyAngle = flyAngle;
        /**
         * the splay for the result is adjusted to 0 being up the middle and negatives being left field
         * @type {number}
         */
        swing.splay = splayAngle;
        swing.sacrificeAdvances = [];

        if (swing.fielder) {
            var fielder = game.half == 'top' ? game.teams.home.positions[swing.fielder] : game.teams.away.positions[swing.fielder];
            fielder.fatigue += 4;
            swing.error = false;
            var fieldingEase = fielder.skill.defense.fielding / 100,
                throwingEase = fielder.skill.defense.throwing / 100;
            //reach the batted ball?
            swing.fielderTravel = this.getPolarDistance(this.positions[swing.fielder], [splayAngle + 90, landingDistance]);
            var speedComponent = (1 + Math.sqrt(fielder.skill.defense.speed / 100)) / 2 * 100;
            var interceptRating = speedComponent * 1.8 + flyAngle * 2.4 - swing.fielderTravel * 1.55 - 15;
            if (interceptRating > 0 && flyAngle > 4) {
                //caught cleanly?
                if (_Services_services.Distribution.error(fielder)) {
                    //error
                    fieldingEase *= 0.5;
                    swing.error = true;
                    fielder.stats.fielding.E++;
                    swing.caught = false;
                } else {
                    fielder.stats.fielding.PO++;
                    swing.caught = true;
                    if (game.umpire.count.outs < 2) {
                        var sacrificeThrowInTime = _Services_services.Mathinator.fielderReturnDelay(swing.travelDistance, throwingEase, fieldingEase, 100);
                        // todo ran into outfield assist
                        if (this.first && sacrificeThrowInTime > this.first.getBaseRunningTime() + 4.5) {
                            swing.sacrificeAdvances.push('first');
                        }
                        if (this.second && sacrificeThrowInTime > this.second.getBaseRunningTime()) {
                            swing.sacrificeAdvances.push('second');
                        }
                        if (this.third && sacrificeThrowInTime > this.third.getBaseRunningTime() - 0.5) {
                            swing.sacrificeAdvances.push('third');
                        }
                    }
                }
            } else {
                swing.caught = false;
            }

            if (!swing.caught) {
                swing.bases = 0;
                swing.thrownOut = false; // default value
                var fieldingReturnDelay = _Services_services.Mathinator.fielderReturnDelay(swing.travelDistance, throwingEase, fieldingEase, interceptRating);
                swing.fieldingDelay = fieldingReturnDelay;
                swing.outfielder = ({ 'left': 1, 'center': 1, 'right': 1 })[swing.fielder] == 1;
                var speed = game.batter.skill.offense.speed,
                    baseRunningTime = _Services_services.Mathinator.baseRunningTime(speed);

                if (swing.outfielder) {
                    swing.bases = 1;
                    baseRunningTime *= 1.05;
                    fieldingReturnDelay -= baseRunningTime;

                    while ((fieldingReturnDelay > baseRunningTime && Math.random() < 0.25 + speed / 200 || Math.random() < 0.04 + speed / 650) && swing.bases < 3) {
                        baseRunningTime *= 0.95;
                        swing.bases++;
                        fieldingReturnDelay -= baseRunningTime;
                    }
                } else {
                    var first = this.first,
                        second = this.second,
                        third = this.third;
                    swing.fieldersChoice = null;
                    swing.bases = fieldingReturnDelay >= baseRunningTime + 1 ? 1 : 0;
                    if (first && fieldingReturnDelay < first.getBaseRunningTime()) swing.fieldersChoice = 'first';
                    if (first && second && fieldingReturnDelay < second.getBaseRunningTime() + 0.6) swing.fieldersChoice = 'second';
                    if (third && fieldingReturnDelay < third.getBaseRunningTime()) swing.fieldersChoice = 'third';
                    // double play
                    var outs = game.umpire.count.outs;
                    if (swing.fieldersChoice) {
                        outs++;
                        swing.bases = 1;
                        var fielders = fielder.team.positions;
                        var force = this.forcePlaySituation();
                        if (force) {
                            var additionalOuts = [];
                            var throwingDelay = fieldingReturnDelay;
                            if (third && force === 'third' && _Services_services.Mathinator.infieldThrowDelay(fielders.catcher) + throwingDelay < second.getBaseRunningTime() && outs < 3) {
                                throwingDelay += _Services_services.Mathinator.infieldThrowDelay(fielders.catcher);
                                fielders.catcher.fatigue += 4;
                                additionalOuts.push('second');
                                outs++;
                                force = 'second';
                            }
                            if (second && force === 'second' && _Services_services.Mathinator.infieldThrowDelay(fielders.third) + throwingDelay < first.getBaseRunningTime() && outs < 3) {
                                throwingDelay += _Services_services.Mathinator.infieldThrowDelay(fielders.third);
                                fielders.third.fatigue += 4;
                                additionalOuts.push('first');
                                outs++;
                                force = 'first';
                            }
                            if (first && force === 'first' && _Services_services.Mathinator.infieldThrowDelay(fielders.second) + throwingDelay < game.batter.getBaseRunningTime() && outs < 3) {
                                throwingDelay += _Services_services.Mathinator.infieldThrowDelay(fielders.second);
                                fielders.second.fatigue += 4;
                                additionalOuts.push('batter');
                                swing.bases = 0;
                                // todo (or shortstop)
                                outs++;
                            }
                            if (outs - game.umpire.count.outs === 2) {
                                swing.doublePlay = true;
                            }
                            if (additionalOuts.length) {
                                swing.additionalOuts = additionalOuts;
                                swing.firstOut = swing.fieldersChoice;
                                if (additionalOuts.indexOf('batter') > -1) {
                                    delete swing.fieldersChoice;
                                }
                            }
                        }
                        //console.log('DP?', !!this.forcePlaySituation(), 'throwingDelay', throwingDelay,
                        //    'fielding delay', fieldingReturnDelay, 'runner', game.batter.getBaseRunningTime());
                        //if (typeof additionalOuts !== 'undefined' && additionalOuts.length) {
                        //    console.log('omg dp', additionalOuts);
                        //}
                    } else {
                            delete swing.additionalOuts;
                            delete swing.firstOut;
                            delete swing.doublePlay;
                            delete swing.fieldersChoice;
                        }
                }
                swing.thrownOut = swing.bases == 0;
                if (swing.thrownOut) {
                    fielder.stats.fielding.PO++; // todo A to PO
                    swing.thrownOut = true;
                    swing.error = false;
                }
            }
        } else {
            if (Math.abs(splayAngle) < 45 && landingDistance > 300) {
                swing.bases = 4;
            } else {
                swing.foul = true;
                swing.caught = false;
            }
        }
        this.game.swingResult = swing;
        if (!_Services_services.Animator.console) {
            _Services_services.Animator._ball.hasIndicator = true;
            _Services_services.Animator.animateFieldingTrajectory(this.game);
        }
    },
    forcePlaySituation: function forcePlaySituation() {
        var first = this.first,
            second = this.second,
            third = this.third;
        return first && second && third && 'third' || first && second && 'second' || first && 'first';
    },
    /**
     * @returns {Player}
     * the best steal candidate.
     */
    getLeadRunner: function getLeadRunner() {
        var first = this.first,
            second = this.second,
            third = this.third;
        if (third && first && !second) return first;
        return third || second || first;
    },
    //printRunnerNames : function() {
    //    return [this.first ? this.first.getName() : '', this.second ? this.second.getName() : '', this.third ? this.third.getname() : ''];
    //},
    /**
     * @param splayAngle {Number} 0 to 180, apparently
     * @param landingDistance {Number} in feet, up to 310 or so
     * @param power {Number} 0-100
     * @param flyAngle {Number} roughly -15 to 90
     * @returns {string|boolean}
     */
    findFielder: function findFielder(splayAngle, landingDistance, power, flyAngle) {
        var angle = splayAngle; // 0 is up the middle, clockwise increasing

        var fielder;

        if (Math.abs(angle) > 50) return false; // foul
        if (landingDistance < 10 && landingDistance > -20) {
            return 'catcher';
        } else if (landingDistance >= 10 && landingDistance < 45 && Math.abs(angle) < 5) {
            return 'pitcher';
        }

        var infield = landingDistance < 145 - Math.abs(angle) / 90 * 50;
        if (flyAngle < 7) {
            // 7 degrees straight would fly over the infielder, but add some for arc
            var horizontalVelocity = Math.cos(flyAngle / 180 * Math.PI) * (85 + power / 100 * 10); // mph toward infielder
            if (flyAngle < 0) horizontalVelocity *= 0.5; // velocity loss on bounce
            var fielderLateralReachDegrees = 1 + 22.5 * (100 - horizontalVelocity) / 100; // up to 90/4 = 22.5
            if (angle < -20) {
                fielder = 'third';
            } else if (angle < 5) {
                fielder = 'short';
            } else if (angle < 30) {
                fielder = 'second';
            } else {
                // first has reduced arc to receive the throw
                fielder = 'first';
            }
            var fielderArcPosition = this.positions[fielder][0] - 90;
            // a good infielder can field a hard hit grounder even with a high terminal distance
            infield = Math.abs(angle - fielderArcPosition) < fielderLateralReachDegrees;
        }

        // ball in the air to infielder
        if (infield && landingDistance > 15) {
            if (angle < -20) {
                fielder = 'third';
            } else if (angle < 5) {
                fielder = 'short';
            } else if (angle < 30) {
                fielder = 'second';
            } else {
                // first has reduced arc to receive the throw
                fielder = 'first';
            }
        } else if (landingDistance < 310) {
            // past the infield or fly ball to outfielder
            if (angle < -15) {
                fielder = 'left';
            } else if (angle < 16) {
                fielder = 'center';
            } else {
                fielder = 'right';
            }
        } else {
            fielder = false;
        }
        return fielder;
    },
    /**
     * approximate fielder positions (polar degrees where 90 is up the middle, distance from origin (home plate))
     */
    positions: {
        pitcher: [90, 66],
        catcher: [0, 0],
        first: [90 + 45 - 7, 98],
        second: [90 + 12.5, 130],
        short: [90 - 12.5, 130],
        third: [90 - 45 + 7, 98],
        left: [45 + 14, 280],
        center: [90, 280],
        right: [135 - 14, 280]
    },
    getPolarDistance: function getPolarDistance(a, b) {
        return _Services_services.Mathinator.getPolarDistance(a, b);
    }
};

exports.Field = Field;

},{"../Model/Player":5,"../Services/_services":30}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _ModelField = require('../Model/Field');

var _ModelTeam = require('../Model/Team');

var _ModelUmpire = require('../Model/Umpire');

var _ModelPlayer = require('../Model/Player');

var _UtilityLog = require('../Utility/Log');

var _Utility_utils = require('../Utility/_utils');

var _Services_services = require('../Services/_services');

var Game = function Game(m) {
    this.init(m);
};

Game.prototype = {
    constructor: Game,
    gamesIntoSeason: 0,
    humanControl: 'home', //home, away, both, none
    console: false,
    debug: [],
    pitcher: {}, // Player&
    batter: {}, // Player&
    init: function init(m) {
        this.reset();
        this.startTime = {
            h: Math.random() * 6 + 11 | 0,
            m: Math.random() * 60 | 0
        };
        var timeOfDay = this.timeOfDay = {
            h: 0,
            m: 0
        }; // @see {Loop} for time initialization
        if (m) _Utility_utils.text.mode = m;
        this.gamesIntoSeason = 5 + Math.floor(Math.random() * 133);
        this.field = new _ModelField.Field(this);
        this.teams.away = new _ModelTeam.Team(this);
        this.teams.home = new _ModelTeam.Team(this);
        this.log = new _UtilityLog.Log();
        this.log.game = this;
        this.debug = [];
        this.helper = _Utility_utils.helper;
        while (this.teams.away.name == this.teams.home.name) {
            this.teams.away.pickName();
        }
        this.umpire = new _ModelUmpire.Umpire(this);
        if (this.humanPitching()) {
            this.stage = 'pitch';
        }
        this.autoPitchSelect();
        _Services_services.Animator.init();
        this.passMinutes(5);
    },
    passMinutes: function passMinutes(minutes) {
        var time = this.timeOfDay;
        time.m = parseInt(time.m);
        time.m += parseInt(minutes);
        while (time.m >= 60) {
            time.m = parseInt(time.m) - 60;
            time.h = (parseInt(time.h) + 1) % 24;
        }
        if (!_Services_services.Animator.console) _Services_services.Animator.loop.setTargetTimeOfDay(time.h, time.m);
    },
    getInning: function getInning() {
        return _Utility_utils.text.mode == 'n' ? this.inning + (this.half == 'top' ? 'オモテ' : 'ウラ') : this.half.toUpperCase() + ' ' + this.inning;
    },
    humanBatting: function humanBatting() {
        var humanControl = this.humanControl;
        if (humanControl == 'none') return false;
        switch (this.half) {
            case 'top':
                return humanControl == 'both' || humanControl == 'away';
            case 'bottom':
                return humanControl == 'both' || humanControl == 'home';
        }
    },
    humanPitching: function humanPitching() {
        var humanControl = this.humanControl;
        if (humanControl == 'none') return false;
        switch (this.half) {
            case 'top':
                return humanControl == 'both' || humanControl == 'home';
            case 'bottom':
                return humanControl == 'both' || humanControl == 'away';
        }
    },
    end: function end() {
        this.stage = 'end';
        var e, n;
        e = this.tally.home.R > this.tally.away.R ? 'Home team wins!' : this.tally.home.R == this.tally.away.R ? 'You tied. Yes, you can do that.' : 'Visitors win!';
        n = this.tally.home.R > this.tally.away.R ? this.teams.home.getName() + 'の勝利' : this.tally.home.R == this.tally.away.R ? '引き分け' : this.teams.away.getName() + 'の勝利';
        if (this.tally.home.R > this.tally.away.R) {
            this.teams.home.positions.pitcher.stats.pitching.W++;
            this.teams.away.positions.pitcher.stats.pitching.L++;
        } else if (this.tally.home.R < this.tally.away.R) {
            this.teams.home.positions.pitcher.stats.pitching.L++;
            this.teams.away.positions.pitcher.stats.pitching.W++;
        }
        this.log.note(e, n);
        this.log.note('Reload to play again', 'リロるは次の試合へ');
    },
    stage: 'pitch', //pitch, swing
    simulateInput: function simulateInput(callback) {
        var stage = this.stage,
            pitchTarget = this.pitchTarget;
        if (stage == 'end') {
            return;
        }
        if (stage == 'pitch') {
            this.autoPitch(callback);
        } else if (stage == 'swing') {
            if (typeof pitchTarget != 'object') {
                this.pitchTarget = { x: 100, y: 100 };
            }
            this.autoSwing(this.pitchTarget.x, this.pitchTarget.y, callback);
        }
    },
    simulatePitchAndSwing: function simulatePitchAndSwing(callback) {
        if (this.stage == 'end') {
            return;
        }
        this.autoPitch(callback);
        var giraffe = this;
        setTimeout(function () {
            if (typeof giraffe.pitchTarget != 'object') {
                giraffe.pitchTarget = { x: 100, y: 100 };
            }
            giraffe.autoSwing(giraffe.pitchTarget.x, giraffe.pitchTarget.y, function (callback) {
                callback();
            });
        }, giraffe.field.hasRunnersOn() ? _Services_services.Animator.TIME_FROM_SET + 2500 : _Services_services.Animator.TIME_FROM_WINDUP + 2500);
    },
    /**
     * generically receive click input and decide what to do
     * @param x
     * @param y
     * @param callback
     */
    receiveInput: function receiveInput(x, y, callback) {
        if (this.humanControl == 'none') {
            return;
        }
        if (this.stage == 'end') {
            return;
        }
        if (this.stage == 'pitch' && this.humanPitching()) {
            this.thePitch(x, y, callback);
        } else if (this.stage == 'swing' && this.humanBatting()) {
            this.theSwing(x, y, callback);
        }
    },
    autoPitchSelect: function autoPitchSelect() {
        var pitchNames = Object.keys(this.pitcher.pitching);
        var pitchName = pitchNames[Math.random() * pitchNames.length | 0];
        var pitch = this.pitcher.pitching[pitchName];
        pitch.name = pitchName;
        this.pitchInFlight = pitch;
    },
    autoPitch: function autoPitch(callback) {
        var pitcher = this.pitcher,
            giraffe = this;

        if (this.stage == 'pitch') {
            this.autoPitchSelect();
            pitcher.windingUp = true;
            if (!this.console) {
                $('.baseball').addClass('hide');
                var windup = $('.windup');
                windup.css('width', '100%');
            }
            var count = this.umpire.count;
            var pitch = _Services_services.Distribution.pitchLocation(count),
                x = pitch.x,
                y = pitch.y;
            if (this.console) {
                this.thePitch(x, y, callback);
            } else {
                if (!_Services_services.Animator.console) {
                    _Services_services.Animator.loop.resetCamera();
                }
                windup.animate({ width: 0 }, this.field.hasRunnersOn() ? _Services_services.Animator.TIME_FROM_SET : _Services_services.Animator.TIME_FROM_WINDUP, function () {
                    !giraffe.console && $('.baseball.pitch').removeClass('hide');
                    giraffe.thePitch(x, y, callback);
                    pitcher.windingUp = false;
                });
            }
        }
    },
    autoSwing: function autoSwing(deceptiveX, deceptiveY, callback) {
        var giraffe = this;
        var bonus = this.batter.eye.bonus || 0,
            eye = this.batter.skill.offense.eye + 6 * (this.umpire.count.balls + this.umpire.count.strikes) + bonus,
            convergence,
            convergenceSum;

        var x = _Services_services.Distribution.centralizedNumber(),
            y = _Services_services.Distribution.centralizedNumber();

        if (100 * Math.random() < eye) {
            // identified the break
            deceptiveX = this.pitchInFlight.x;
            deceptiveY = this.pitchInFlight.y;
        }

        if (100 * Math.random() < eye) {
            // identified the location
            convergence = eye / 25;
            convergenceSum = 1 + convergence;
        } else {
            convergence = eye / 100;
            convergenceSum = 1 + convergence;
        }

        x = (deceptiveX * convergence + x) / convergenceSum;
        y = (deceptiveY * convergence + y) / convergenceSum;

        this.swingResult.x = _Services_services.Distribution.cpuSwing(x, this.pitchInFlight.x, eye);
        this.swingResult.y = _Services_services.Distribution.cpuSwing(y, this.pitchInFlight.y, eye * 0.75);

        var swingProbability = _Services_services.Distribution.swingLikelihood(eye, x, y, this.umpire);
        if (swingProbability < 100 * Math.random()) {
            x = -20;
        }

        callback(function () {
            giraffe.theSwing(x, y);
        });
    },
    opponentConnected: false,
    /**
     * variable for what to do when the batter becomes ready for a pitch
     */
    onBatterReady: function onBatterReady() {},
    /**
     * @param setValue
     * @returns {boolean|*}
     * trigger batter readiness passively, or actively with setValue, i.e. ready to see pitch
     */
    batterReady: function batterReady(setValue) {
        clearTimeout(this.batterReadyTimeout);
        if (setValue !== undefined) {
            this.batter.ready = !!setValue;
        }
        if (this.batter.ready) {
            this.onBatterReady();
        }
        return this.batter.ready;
    },
    batterReadyTimeout: -1,
    waitingCallback: function waitingCallback() {},
    awaitPitch: function awaitPitch(callback, swingResult) {
        var giraffe = this;
        if (this.opponentConnected) {
            this.waitingCallback = callback;
            this.opponentService.emitSwing(swingResult);
            this.onBatterReady = function () {};
        } else {
            giraffe.onBatterReady = function () {
                giraffe.autoPitch(callback);
            };
            if (this.console) {
                giraffe.batterReady();
            } else {
                this.batterReadyTimeout = setTimeout(function () {
                    giraffe.batterReady();
                }, 5200);
            }
        }
    },
    awaitSwing: function awaitSwing(x, y, callback, pitchInFlight, pitchTarget) {
        if (this.opponentConnected) {
            this.waitingCallback = callback;
            this.opponentService.emitPitch({
                inFlight: pitchInFlight,
                target: pitchTarget
            });
        } else {
            this.autoSwing(x, y, callback);
        }
    },
    thePitch: function thePitch(x, y, callback, override) {
        var pitch = this.pitchInFlight;
        if (this.stage == 'pitch') {
            if (override) {
                this.pitchInFlight = override.inFlight;
                this.pitchTarget = override.target;
                callback = this.waitingCallback;
            } else {
                this.pitcher.fatigue++;
                this.pitchTarget.x = x;
                this.pitchTarget.y = y;

                pitch.breakDirection = this.helper.pitchDefinitions[pitch.name].slice(0, 2);
                this.battersEye = _Utility_utils.text.getBattersEye(this);

                var control = Math.floor(pitch.control - this.pitcher.fatigue / 2);
                this.pitchTarget.x = _Services_services.Distribution.pitchControl(this.pitchTarget.x, control);
                this.pitchTarget.y = _Services_services.Distribution.pitchControl(this.pitchTarget.y, control);

                if (this.pitcher.throws == 'right') pitch.breakDirection[0] *= -1;

                var breakEffect = _Services_services.Distribution.breakEffect(pitch, this.pitcher, this.pitchTarget.x, this.pitchTarget.y);

                pitch.x = breakEffect.x;
                pitch.y = breakEffect.y;
            }

            this.log.notePitch(pitch, this.batter);

            this.stage = 'swing';
            if (this.humanControl != 'none' && (this.humanControl == 'both' || this.humanBatting())) {
                callback();
            } else {
                this.awaitSwing(x, y, callback, pitch, this.pitchTarget);
            }
        }
    },
    battersEye: {
        e: '',
        n: ''
    },
    theSwing: function theSwing(x, y, callback, override) {
        var pitch = this.pitchInFlight;
        if (this.stage == 'swing') {
            if (override) {
                var result = this.swingResult = override;
                callback = this.waitingCallback;
            } else {
                this.swingResult = result = {};
                var bonus = this.batter.eye.bonus || 0,
                    eye = this.batter.skill.offense.eye + 6 * (this.umpire.count.balls + this.umpire.count.strikes) + bonus;

                if (x >= 0 && x <= 200) {
                    this.batter.fatigue++;

                    result.x = x - pitch.x;
                    result.y = y - pitch.y;
                    result.angle = this.setBatAngle();

                    var recalculation = _Services_services.Mathinator.getAngularOffset(result, result.angle);
                    var precision = _Services_services.Distribution.swing(eye);

                    result.x = recalculation.x * precision;
                    result.y = -5 + recalculation.y * precision;

                    //log(recalculation.y, precision);

                    result.looking = false;
                    if (Math.abs(result.x) < 60 && Math.abs(result.y) < 35) {
                        result.contact = true;
                        this.field.determineSwingContactResult(result);
                        // log(result.flyAngle, Math.floor(result.x), Math.floor(result.y));
                        this.debug.push(result);
                    } else {
                        result.contact = false;
                    }
                } else {
                    result.strike = pitch.x > 50 && pitch.x < 150 && pitch.y > 35 && pitch.y < 165;
                    this.batter.eye.bonus = Math.max(0, eye - Math.sqrt(Math.pow(this.batter.eye.x - pitch.x, 2) + Math.pow(this.batter.eye.y - pitch.y, 2)) * 1.5);
                    result.contact = false;
                    result.looking = true;
                    this.batter.eye.x = pitch.x;
                    this.batter.eye.y = pitch.y;
                }
            }

            // stealing bases
            var field = this.field;
            var team = this.batter.team;
            if ((team.stealAttempt === _ModelTeam.Team.RUNNER_GO || team.stealAttempt === _ModelTeam.Team.RUNNERS_DISCRETION) && !this.opponentConnected) {
                var thief = field.getLeadRunner();
                if (thief instanceof _ModelPlayer.Player) {
                    switch (thief) {
                        case field.first:
                            var base = 2;
                            break;
                        case field.second:
                            base = 3;
                            break;
                        case field.third:
                            base = 4;
                    }
                    var validToSteal = true;
                    if (result.looking) {
                        var count = this.umpire.count;
                        if (count.strikes >= 2 && result.strike && count.outs >= 2) validToSteal = false;
                        if (count.balls >= 3 && !result.strike && field.first) validToSteal = false;
                    }
                    if (result.foul || result.caught) {
                        validToSteal = false;
                    }
                    var discretion = team.stealAttempt === 'go' || _Services_services.Distribution.willSteal(pitch, this.pitcher.team.positions.catcher, thief, base);
                    if (discretion && validToSteal) {
                        thief.attemptSteal(this, base);
                    }
                    team.stealAttempt = _ModelTeam.Team.RUNNERS_DISCRETION;
                }
            }

            this.log.noteSwing(result);
            this.stage = 'pitch';

            var half = this.half;
            this.umpire.makeCall();
            emit = false;
            if (half != this.half) {
                callback = this.startOpponentPitching;
                var emit = !override;
            }

            if (typeof callback == 'function') {
                if (this.humanControl !== 'none' && (this.humanControl === 'both' || this.teams[this.humanControl] == this.pitcher.team)) {
                    callback();
                    if (emit) {
                        if (this.opponentService && this.opponentConnected) {
                            this.opponentService.emitSwing(result);
                        }
                    }
                } else {
                    this.awaitPitch(callback, result);
                }
            }
        }
    },
    setBatAngle: function setBatAngle(x, y) {
        var giraffe = this,
            pitchInFlight = this.pitchInFlight,
            swingResult = this.swingResult;
        var origin = {
            x: giraffe.batter.bats == 'right' ? -10 : 210,
            y: 199
        };
        var swing = {
            x: x ? x : pitchInFlight.x + swingResult.x,
            y: y ? y : pitchInFlight.y + swingResult.y
        };
        return _Services_services.Mathinator.battingAngle(origin, swing);
    },
    debugOut: function debugOut() {
        log('slugging', this.debug.filter(function (a) {
            return a.bases == 1;
        }).length, this.debug.filter(function (a) {
            return a.bases == 2;
        }).length, this.debug.filter(function (a) {
            return a.bases == 3;
        }).length, this.debug.filter(function (a) {
            return a.bases == 4;
        }).length);
        log('grounders', this.debug.filter(function (a) {
            return !a.caught && !a.foul && a.flyAngle < 0;
        }).length, 'thrown out', this.debug.filter(function (a) {
            return !a.caught && !a.foul && a.flyAngle < 0 && a.thrownOut;
        }).length);
        log('flies/liners', this.debug.filter(function (a) {
            return !a.foul && a.flyAngle > 0;
        }).length, 'caught', this.debug.filter(function (a) {
            return a.caught && a.flyAngle > 0;
        }).length);

        var PO = {};
        this.debug.map(function (a) {
            if (!a.fielder) return;
            if (!PO[a.fielder]) {
                PO[a.fielder] = 0;
            }
            if (!a.bases && a.fielder) {
                PO[a.fielder]++;
            }
        });
        log('fielding outs', JSON.stringify(PO));

        var hitters = this.teams.away.lineup.concat(this.teams.home.lineup);
        var atBats = [];
        hitters.map(function (a) {
            atBats = atBats.concat(a.getAtBats().map(function (ab) {
                return ab.text;
            }));
        });

        var LO = atBats.filter(function (ab) {
            return ab == 'LO';
        }).length;
        var FO = atBats.filter(function (ab) {
            return ab == 'FO';
        }).length;
        var GO = atBats.filter(function (ab) {
            return ab == 'GO';
        }).length;
        var GIDP = atBats.filter(function (ab) {
            return ab == '(IDP)';
        }).length;
        var SO = atBats.filter(function (ab) {
            return ab == 'SO';
        }).length;
        var BB = atBats.filter(function (ab) {
            return ab == 'BB';
        }).length;
        var SAC = atBats.filter(function (ab) {
            return ab == 'SAC';
        }).length;
        var FC = atBats.filter(function (ab) {
            return ab == 'FC';
        }).length;
        var CS = atBats.filter(function (ab) {
            return ab == 'CS';
        }).length;
        var SB = atBats.filter(function (ab) {
            return ab == 'SB';
        }).length;

        log('line outs', LO, 'fly outs', FO, 'groundouts', GO, 'strikeouts', SO, 'sacrifices', SAC, 'FC', FC, 'gidp', GIDP, 'CS', CS, 'total', LO + FO + GO + SO + SAC + FC + GIDP + CS);

        log('BB', BB, 'SB', SB);
        log('fouls', this.debug.filter(function (a) {
            return a.foul;
        }).length);
        log('fatigue, home vs away');
        var teams = this.teams;
        var fatigue = { home: {}, away: {} };
        _Services_services.Iterator.each(this.teams.home.positions, function (key) {
            var position = key;
            fatigue.home[position] = teams.home.positions[position].fatigue;
            fatigue.away[position] = teams.away.positions[position].fatigue;
        });
        console.table(fatigue);
        console.table(this.scoreboard);
        console.table(this.tally);
    },
    toData: function toData() {
        var data = {};
        data.half = this.half;
        data.inning = this.inning;
        data.tally = this.tally;
        var giraffe = this;
        var players = this.teams.away.lineup.concat(this.teams.home.lineup);
        // note: bench not included
        data.field = {
            first: players.indexOf(this.field.first),
            second: players.indexOf(this.field.second),
            third: players.indexOf(this.field.third)
        };
        data.batter = players.indexOf(this.batter);
        data.deck = players.indexOf(this.deck);
        data.hole = players.indexOf(this.hole);
        data.teams = {
            home: {
                name: giraffe.teams.home.name,
                nameJ: giraffe.teams.home.nameJ
            },
            away: {
                name: giraffe.teams.away.name,
                nameJ: giraffe.teams.away.nameJ
            }
        };
        data.umpire = {
            says: giraffe.umpire.says,
            count: {
                strikes: giraffe.umpire.count.strikes,
                balls: giraffe.umpire.count.balls,
                outs: giraffe.umpire.count.outs
            }
        };
        data.players = players.map(function (player) {
            return player.serialize();
        });
        data.log = {
            pitchRecord: giraffe.log.pitchRecord,
            record: giraffe.log.record
        };
        data.gamesIntoSeason = this.gamesIntoSeason;
        return data;
    },
    fromData: function fromData(data) {
        this.half = data.half;
        this.inning = data.inning;
        this.tally = data.tally;
        var giraffe = this;
        var players = data.players.map(function (playerJson, index) {
            var playerData = JSON.parse(playerJson);
            if (index > 8) {
                var side = 'home';
                index = index - 9;
            } else {
                side = 'away';
            }
            var player = giraffe.teams[side].positions[playerData.position];
            player.fromData(playerData);
            giraffe.teams[side].lineup[index] = player;
            player.resetStats(data.gamesIntoSeason);
            return player;
        });
        this.field.first = players[data.field.first];
        this.field.second = players[data.field.second];
        this.field.third = players[data.field.third];
        this.batter = players[data.batter];
        this.deck = players[data.deck];
        this.hole = players[data.hole];
        this.umpire.says = data.umpire.says;
        this.umpire.count = data.umpire.count;
        this.teams.away.name = data.teams.away.name;
        this.teams.away.nameJ = data.teams.away.nameJ;
        this.teams.home.name = data.teams.home.name;
        this.teams.home.nameJ = data.teams.home.nameJ;
        this.log.pitchRecord = data.log.pitchRecord;
        this.log.record = data.log.record;
        this.log.stabilizeShortRecord();
        this.gamesIntoSeason = data.gamesIntoSeason;
        if (this.humanPitching()) {
            this.autoPitchSelect();
        }
        return this;
    },
    startOpponentPitching: null, // late function
    pitchTarget: { x: 100, y: 100 },
    pitchInFlight: {
        x: 100,
        y: 100,
        breakDirection: [0, 0],
        name: 'slider',
        velocity: 50,
        'break': 50,
        control: 50
    },
    swingResult: {
        x: 100, //difference to pitch location
        y: 100, //difference to pitch location
        strike: false,
        foul: false,
        caught: false,
        contact: false,
        looking: true,
        bases: 0,
        fielder: 'short',
        outs: 0
    },
    playResult: {
        batter: '',
        fielder: ''
    },
    showPlayResultPanels: function showPlayResultPanels(batter) {
        var batterOutcomes = {};
        var atBat = batter.atBats.slice(0).pop();
        var fielderOutcomes = {};
        var n = function n() {
            var n = Math.floor(Math.random() * 3);
            return n ? n : '';
        };
        this.playResult = {
            batter: 'B_placeholder' + n() || batterOutcomes[atBat] || 'batter/' + atBat,
            fielder: 'F_placeholder' + n() || fielderOutcomes[atBat] || 'fielder/' + atBat
        };
    },
    pitchSelect: function pitchSelect() {},
    field: null,
    teams: {
        away: null,
        home: null
    },
    log: null,
    half: 'top',
    inning: 1,
    scoreboard: {
        away: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
            6: 0,
            7: 0,
            8: 0,
            9: 0
        },
        home: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
            6: 0,
            7: 0,
            8: 0,
            9: 0
        }
    },
    reset: function reset() {
        this.scoreboard = {
            away: {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0,
                7: 0,
                8: 0,
                9: 0
            },
            home: {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0,
                7: 0,
                8: 0,
                9: 0
            }
        };
        this.resetTally();
    },
    resetTally: function resetTally() {
        this.tally = {
            away: {
                H: 0,
                R: 0,
                E: 0
            },
            home: {
                H: 0,
                R: 0,
                E: 0
            }
        };
    },
    tally: {
        away: {
            H: 0,
            R: 0,
            E: 0
        },
        home: {
            H: 0,
            R: 0,
            E: 0
        }
    }
};

exports.Game = Game;

},{"../Model/Field":2,"../Model/Player":5,"../Model/Team":6,"../Model/Umpire":7,"../Services/_services":30,"../Utility/Log":34,"../Utility/_utils":35}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _Services_services = require('../Services/_services');

var Manager = function Manager(team) {
    this.init(team);
};

Manager.prototype = {
    constructor: Manager,
    init: function init(team) {
        this.team = team;
    },
    makeLineup: function makeLineup() {
        var jerseyNumber = 1;
        this.team.positions.pitcher = this.selectForSkill(this.team.bench, ['pitching']);
        this.team.positions.pitcher.position = 'pitcher';
        if (!this.team.positions.pitcher.number) {
            this.team.positions.pitcher.number = jerseyNumber++;
        }
        this.team.positions.catcher = this.selectForSkill(this.team.bench, ['defense', 'catching'], 'right');
        this.team.positions.catcher.position = 'catcher';
        if (!this.team.positions.catcher.number) {
            this.team.positions.catcher.number = jerseyNumber++;
        }
        _Services_services.Iterator.each(this.team.bench, function (key, player) {
            if (!player.number) {
                player.number = jerseyNumber++;
            }
        });
        this.team.positions.short = this.selectForSkill(this.team.bench, ['defense', 'fielding'], 'right');
        this.team.positions.short.position = 'short';
        this.team.positions.second = this.selectForSkill(this.team.bench, ['defense', 'fielding'], 'right');
        this.team.positions.second.position = 'second';
        this.team.positions.third = this.selectForSkill(this.team.bench, ['defense', 'fielding'], 'right');
        this.team.positions.third.position = 'third';
        this.team.positions.center = this.selectForSkill(this.team.bench, ['defense', 'speed']);
        this.team.positions.center.position = 'center';
        this.team.positions.left = this.selectForSkill(this.team.bench, ['defense', 'speed']);
        this.team.positions.left.position = 'left';
        this.team.positions.right = this.selectForSkill(this.team.bench, ['defense', 'speed']);
        this.team.positions.right.position = 'right';
        this.team.positions.first = this.selectForSkill(this.team.bench, ['defense', 'fielding'], 'left');
        this.team.positions.first.position = 'first';

        this.team.lineup[3] = this.selectForSkill(this.team.positions, ['offense', 'power']);
        this.team.lineup[3].order = 3;
        this.team.lineup[2] = this.selectForSkill(this.team.positions, ['offense', 'power']);
        this.team.lineup[2].order = 2;
        this.team.lineup[4] = this.selectForSkill(this.team.positions, ['offense', 'power']);
        this.team.lineup[4].order = 4;
        this.team.lineup[0] = this.selectForSkill(this.team.positions, ['offense', 'speed']);
        this.team.lineup[0].order = 0;
        this.team.lineup[1] = this.selectForSkill(this.team.positions, ['offense', 'eye']);
        this.team.lineup[1].order = 1;
        this.team.lineup[5] = this.selectForSkill(this.team.positions, ['offense', 'eye']);
        this.team.lineup[5].order = 5;
        this.team.lineup[6] = this.selectForSkill(this.team.positions, ['offense', 'eye']);
        this.team.lineup[6].order = 6;
        this.team.lineup[7] = this.selectForSkill(this.team.positions, ['offense', 'eye']);
        this.team.lineup[7].order = 7;
        this.team.lineup[8] = this.selectForSkill(this.team.positions, ['offense', 'speed']);
        this.team.lineup[8].order = 8;
    },
    selectForSkill: function selectForSkill(pool, skillset, requiredThrowingHandedness) {
        if (this.team.bench.length || pool == this.team.positions) {
            var selection = this.team.bench[0];
            var rating = 0;
            var index = 0;
            _Services_services.Iterator.each(pool, function (key, player) {
                var skills = skillset.slice();
                var cursor = player.skill;
                var property = skills.shift();
                while (property) {
                    cursor = cursor[property];
                    property = skills.shift();
                }
                if (!(player.order + 1) && cursor >= rating && (!requiredThrowingHandedness || player.throws == requiredThrowingHandedness)) {
                    rating = cursor;
                    selection = player;
                    index = key;
                }
            });
            if (pool == this.team.bench) {
                delete this.team.bench[index];
                this.team.bench = this.team.bench.filter(function (player) {
                    return player instanceof selection.constructor;
                });
            }
            return selection;
        }
        return 'no players available';
    }
};

exports.Manager = Manager;

},{"../Services/_services":30}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _Utility_utils = require('../Utility/_utils');

var _Services_services = require('../Services/_services');

var _Model_models = require('../Model/_models');

var Player = function Player(team, hero) {
    this.init(team, hero);
    this.resetStats(this.team.game && this.team.game.gamesIntoSeason || 0);
};

Player.prototype = {
    constructor: Player,
    init: function init(team, hero) {
        this.ready = false;
        this.throws = Math.random() > 0.86 ? 'left' : 'right';
        this.bats = Math.random() > 0.75 ? 'left' : 'right';
        this.team = team;
        this.skill = {};
        this.eye = {
            x: 100,
            y: 100
        };
        this.pitching = { averaging: [] };
        this.number = 0;
        this.randomizeSkills(hero || Math.random() > 0.9);
        var surnameKey = Math.floor(Math.random() * _Utility_utils.data.surnames.length),
            nameKey = Math.floor(Math.random() * _Utility_utils.data.names.length);

        this.name = _Utility_utils.data.surnames[surnameKey] + ' ' + _Utility_utils.data.names[nameKey];
        var jSurname = _Utility_utils.data.surnamesJ[surnameKey],
            jGivenName = _Utility_utils.data.namesJ[nameKey];
        this.spaceName(jSurname, jGivenName);
        this.surname = _Utility_utils.data.surnames[surnameKey];
        this.surnameJ = _Utility_utils.data.surnamesJ[surnameKey];
        this.atBats = [];
        this.definingBattingCharacteristic = {};
        this.definingCharacteristic = {};
    },
    spaceName: function spaceName(jSurname, jGivenName) {
        if (jSurname.length == 1 && jGivenName.length <= 2) jSurname += '・';
        if (jGivenName.length == 1 && jSurname.indexOf('・') < 0 && jSurname.length <= 2) jSurname += '・';
        this.nameJ = jSurname + jGivenName;
        this.surnameJ = jSurname;
    },
    serialize: function serialize() {
        var team = this.team;
        delete this.team;
        var data = JSON.stringify(this);
        this.team = team;
        return data;
    },
    fromData: function fromData(data) {
        var giraffe = this;
        _Services_services.Iterator.each(data, function (key, value) {
            giraffe[key] = value;
        });
        delete this.atBatObjects;
        this.getAtBats();
    },
    substitute: function substitute(player) {
        if (player.team !== this.team) return false;
        var order = player.order,
            position = player.position;
        player.team.substituted.push(player);
        player.team.positions[position] = this;
        player.team.lineup[order] = this;

        this.position = position;
        this.order = order;

        var game = this.team.game;
        if (game.pitcher === player) game.pitcher = this;
        if (game.batter === player) game.batter = this;
        if (game.deck === player) game.deck = this;
        if (game.hole === player) game.hole = this;

        var field = game.field;
        if (field.first === player) field.first = this;
        if (field.second === player) field.second = this;
        if (field.third === player) field.third = this;

        var bench = this.team.bench,
            bullpen = this.team.bullpen;
        if (bench.indexOf(this) > -1) {
            bench.splice(bench.indexOf(this), 1);
        }
        if (bullpen.indexOf(this) > -1) {
            bullpen.splice(bullpen.indexOf(this), 1);
        }
        game.log.noteSubstitution(this, player);
    },
    resetStats: function resetStats() {
        var gamesIntoSeason = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

        var offense = this.skill.offense;
        var defense = this.skill.defense;
        var randBetween = function randBetween(a, b, skill) {
            var total = 0,
                count = 0;
            skill += '';
            if (!skill) skill = '';
            _Services_services.Iterator.each(skill.split(' '), function (key, value) {
                var skill = value;
                if (offense[skill]) skill = offense[skill];
                if (defense[skill]) skill = defense[skill];
                if (isNaN(skill)) skill = 50;
                total += skill;
                count++;
            });

            skill = Math.sqrt(0.05 + Math.random() * 0.95) * (total / (count * 0.97));
            return Math.floor(skill / 100 * (b - a) + a);
        };
        var IP, ER, GS, W, L;
        if (this.skill.pitching > 65) {
            IP = (this.skill.pitching - 65) * gamesIntoSeason / 20;
            ER = IP / 9 * randBetween(800, 215, this.skill.pitching) / 100;
            if (IP > gamesIntoSeason) {
                //starter
                GS = Math.floor(gamesIntoSeason / 5);
                W = randBetween(GS * 0.1, GS * 0.8, this.skill.pitching / 1.20);
                L = randBetween(GS - W, 0, this.skill.pitching / 3);
            } else {
                //reliever
                GS = Math.floor(gamesIntoSeason / 40);
                W = randBetween(0, GS * 0.6, this.skill.pitching);
                L = randBetween(GS - W, 0, this.skill.pitching);
            }
        } else {
            IP = 0;
            ER = 0;
            GS = 0;W = 0;L = 0;
        }
        var pa = randBetween(gamesIntoSeason * 3, gamesIntoSeason * 5, 'speed eye');
        var paRemaining = pa;
        var bb = Math.floor(randBetween(0, 18, 'power eye') * paRemaining / 100);
        paRemaining -= bb;
        var ab = paRemaining;
        var so = Math.floor(randBetween(25, 2, 'eye') * paRemaining / 100);
        paRemaining -= so;
        var h = Math.floor(randBetween(185, 372, 'eye power speed') * paRemaining / 1000);
        paRemaining -= h;
        var sb = randBetween(0, (h + bb) / 6, 'speed') | 0;
        var cs = randBetween(sb, 0, 'speed eye') | 0;

        var doubles = randBetween(0, h / 4, 'power speed');
        var triples = randBetween(0, h / 12, 'speed');
        var hr = Math.max(0, randBetween(-h / 20, h / 5, 'power eye'));
        var r = randBetween(h / 8, (h + bb) / 3, 'speed') + hr;
        var rbi = randBetween(h / 8, h / 2, 'power eye') + hr;
        var hbp = randBetween(0, gamesIntoSeason / 25);
        var sac = randBetween(0, gamesIntoSeason / 5, 'eye');

        var chances = randBetween(gamesIntoSeason * 5, pa - bb - so - hr, 'fielding');
        var E = randBetween(chances / 10, 0, 'fielding');
        var PO = chances - E;

        this.stats = {
            pitching: {
                pitches: 0, // in game
                GS: GS,
                W: W,
                L: L,
                strikes: 0, // in game
                K: 0, // in game
                getK9: function getK9() {
                    return this.K / (this.IP[0] / 9);
                },
                getERA: function getERA() {
                    return 9 * this.ER / Math.max(1 / 3, this.IP[0] + this.IP[1] / 3);
                },
                ERA: null,
                ER: ER,
                H: 0, // in game
                HR: 0, // in game
                BB: 0, // in game
                IP: [IP, 0],
                WHIP: 0,
                getWHIP: function getWHIP() {
                    return (this.H + this.BB) / (this.IP[0] ? this.IP[0] : 1);
                }
            },
            batting: {
                getBA: function getBA() {
                    return this.h / Math.max(1, this.ab);
                },
                getBABIP: function getBABIP() {
                    return (this.h - this.hr) / (this.ab - this.so - this.hr + this.sac);
                },
                ba: null,
                getOBP: function getOBP() {
                    return (this.h + this.bb + this.hbp) / (this.ab + this.bb + this.hbp + this.sac);
                },
                obp: null,
                getSLG: function getSLG() {
                    return (this.h - this['2b'] - this['3b'] - this.hr + 2 * this['2b'] + 3 * this['3b'] + 4 * this.hr) / this.ab;
                },
                getSlash: function getSlash() {
                    this.slash = this.slash || [this.getBA() || '.---', this.getOBP(), this.getSLG()].map(function (x) {
                        if (isNaN(x)) return '.---';
                        if (x < 1) return (x + '0000').slice(1, 5);
                        return (x + '0000').slice(0, 5);
                    }).join('/');
                    return this.slash;
                },
                slg: null,
                pa: pa,
                ab: ab,
                so: so,
                bb: bb,
                h: h,
                '2b': doubles,
                '3b': triples,
                hr: hr,
                r: r,
                rbi: rbi,
                hbp: hbp,
                sac: sac,
                sb: sb,
                cs: cs
            },
            fielding: {
                E: E,
                PO: PO, // should depend on position
                A: Math.floor(Math.random() * 5) + 1 // ehh should depend on position
            }
        };
        this.stats.pitching.ERA = this.stats.pitching.getERA();
        this.stats.pitching.K9 = this.stats.pitching.getK9();
        this.stats.pitching.WHIP = this.stats.pitching.getWHIP();
        this.stats.batting.ba = this.stats.batting.getBA();
    },
    atBatObjects: [],
    getAtBats: function getAtBats() {
        if (this.atBats.length > this.atBatObjects.length) {
            this.atBatObjects = this.atBats.map(function (item) {
                return new _Model_models.AtBat(item);
            });
        }
        return this.atBatObjects;
    },
    recordRBI: function recordRBI() {
        this.atBats[this.atBats.length - 1] += _Model_models.AtBat.prototype.RBI_INDICATOR;
    },
    recordInfieldHit: function recordInfieldHit() {
        this.atBats[this.atBats.length - 1] += _Model_models.AtBat.prototype.INFIELD_HIT_INDICATOR;
    },
    getBaseRunningTime: function getBaseRunningTime() {
        return _Services_services.Mathinator.baseRunningTime(this.skill.offense.speed);
    },
    attemptSteal: function attemptSteal(game, base) {
        var pitch = game.pitchInFlight;
        var success = _Services_services.Distribution.stealSuccess(pitch, game.pitcher.team.positions.catcher, this, base, this.team.stealAttempt === _Model_models.Team.RUNNERS_DISCRETION);
        if (success) {
            game.swingResult.stoleABase = this;
            game.swingResult.caughtStealing = null;
        } else {
            game.swingResult.stoleABase = null;
            game.swingResult.caughtStealing = this;
        }
        switch (base) {
            case 1:
                base = '1st';
                break;
            case 2:
                base = '2nd';
                break;
            case 3:
                base = '3rd';
                break;
            case 4:
                base = 'Home';
        }
        game.swingResult.attemptedBase = base;
        return this;
    },
    defensiveAverage: function defensiveAverage() {
        var _this = this.skill.defense;
        return (_this.speed + _this.fielding + _this.throwing) / 3;
    },
    randomizeSkills: function randomizeSkills(hero, allPitches) {
        this.hero = hero;
        var giraffe = this;
        var randValue = function randValue(isPitching) {
            var value = Math.floor(Math.pow(Math.random(), 0.75) * 80 + Math.random() * 20);
            if (hero) {
                value += Math.floor((100 - value) * Math.max(Math.random(), isPitching ? 0 : 0.65));
            }
            if (isPitching) giraffe.pitching.averaging.push(value);
            return value;
        };
        this.skill.offense = {
            eye: randValue(),
            power: randValue(),
            speed: randValue()
        };
        this.skill.defense = {
            catching: randValue(),
            fielding: randValue(),
            speed: randValue(),
            throwing: randValue()
        };
        this.pitching.averaging = [];
        this.pitching['4-seam'] = {
            velocity: randValue(true),
            'break': randValue(true),
            control: randValue(true)
        };
        this.pitching.slider = {
            velocity: randValue(true),
            'break': randValue(true),
            control: randValue(true)
        };
        if (Math.random() < 0.17 || allPitches) {
            // can pitch!
            if (Math.random() > 0.6 || allPitches) {
                this.pitching['2-seam'] = {
                    velocity: randValue(true),
                    'break': randValue(true),
                    control: randValue(true)
                };
            }
            if (Math.random() < 0.18 || allPitches) {
                this.pitching.fork = {
                    velocity: randValue(true),
                    'break': randValue(true),
                    control: randValue(true)
                };
            }
            if (Math.random() > 0.77 || allPitches) {
                this.pitching.cutter = {
                    velocity: randValue(true),
                    'break': randValue(true),
                    control: randValue(true)
                };
            }
            if (Math.random() < 0.21 || allPitches) {
                this.pitching.sinker = {
                    velocity: randValue(true),
                    'break': randValue(true),
                    control: randValue(true)
                };
            }

            if (Math.random() < 0.4 || allPitches) {
                this.pitching.curve = {
                    velocity: randValue(true),
                    'break': randValue(true),
                    control: randValue(true)
                };
            }

            if (Math.random() < 0.9 || allPitches) {
                this.pitching.change = {
                    velocity: randValue(true),
                    'break': randValue(true),
                    control: randValue(true)
                };
            }
        }
        this.skill.pitching = Math.floor(this.pitching.averaging.reduce(function (prev, current) {
            return prev + current;
        }) / this.pitching.averaging.length + this.pitching.averaging.length * 3);
        delete this.pitching.averaging;
    },
    getSurname: function getSurname() {
        return _Utility_utils.text.mode == 'n' ? this.surnameJ : this.surname;
    },
    getName: function getName() {
        return _Utility_utils.text.mode == 'n' ? this.nameJ : this.name;
    },
    getUniformNumber: function getUniformNumber() {
        return (0, _Utility_utils.text)('#') + this.number;
    },
    getOrder: function getOrder() {
        return (0, _Utility_utils.text)([' 1st', ' 2nd', ' 3rd', ' 4th', ' 5th', ' 6th', '7th', ' 8th', ' 9th'][this.order]);
    },
    getDefiningBattingCharacteristic: function getDefiningBattingCharacteristic() {
        if (!this.definingBattingCharacteristic[_Utility_utils.text.mode]) {
            this.definingBattingCharacteristic[_Utility_utils.text.mode] = this.getDefiningCharacteristic(true);
        }
        return this.definingBattingCharacteristic[_Utility_utils.text.mode];
    },
    getDefiningCharacteristic: function getDefiningCharacteristic(battingOnly) {
        if (this.definingCharacteristic[_Utility_utils.text.mode] && !battingOnly) {
            return this.definingCharacteristic[_Utility_utils.text.mode];
        }
        var out = '';
        var o = this.skill.offense,
            d = this.skill.defense,
            pitcherRating = this.skill.pitching;
        var p = this.pitching;
        var ELITE = 90;
        var EXCELLENT = 80;
        var GOOD = 60;

        var POOR = 40;
        var BAD = 30;
        var INEPT = 20;

        var skills = [o.eye, o.power, o.speed, d.fielding, d.speed, d.throwing, pitcherRating];
        var offense = [o.eye, o.power, o.speed];
        var defense = [d.fielding, d.speed, d.throwing];

        var sum = function sum(x) {
            return x.reduce(function (a, b) {
                return a + b;
            });
        };

        var pitching = [0, 0, 0]; // control, speed, break
        var pitchingKeys = Object.keys(p);
        pitchingKeys.map(function (x) {
            pitching[0] += p[x].control;
            pitching[1] += p[x].velocity;
            pitching[2] += p[x]['break'];
        });
        var pitches = pitchingKeys.length;
        pitching = pitching.map(function (x) {
            return x / pitches | 0;
        });

        // var potentialPitcher = ((~this.team.bench.indexOf(this)) || (this.team.positions.pitcher === this));

        if (pitcherRating > 90 && !battingOnly) {
            if (pitcherRating > 105) {
                out = (0, _Utility_utils.text)('Ace');
            } else if (pitching[0] > EXCELLENT) {
                out = (0, _Utility_utils.text)('Control pitcher');
            } else if (pitching[1] > EXCELLENT) {
                out = (0, _Utility_utils.text)('Flamethrower');
            } else if (pitching[2] > EXCELLENT) {
                out = (0, _Utility_utils.text)('Breaking ball');
            }
        } else {
            if (battingOnly || sum([offense[0] * 2, offense[1] * 0.50, offense[2]]) > sum(defense)) {
                if (offense[0] > 98 || sum(offense) > ELITE * 3) {
                    out = (0, _Utility_utils.text)('Genius batter');
                } else if (offense[1] > EXCELLENT && offense[1] > offense[0]) {
                    out = (0, _Utility_utils.text)('Power hitter');
                } else if (offense[0] > EXCELLENT) {
                    out = (0, _Utility_utils.text)('Contact');
                } else if (offense[2] > EXCELLENT) {
                    out = (0, _Utility_utils.text)('Speedster');
                } else if (offense[0] < INEPT || sum(offense) < POOR * 3) {
                    out = (0, _Utility_utils.text)('Inept');
                } else if (offense[1] < INEPT && offense[1] < offense[0]) {
                    out = (0, _Utility_utils.text)('Weak swing');
                } else if (offense[0] < BAD) {
                    out = (0, _Utility_utils.text)('Strikes out');
                } else if (offense[2] < POOR) {
                    out = (0, _Utility_utils.text)('Leisurely runner');
                }
            } else {
                if (sum(defense) > EXCELLENT * 3) {
                    out = (0, _Utility_utils.text)('Defensive wizard');
                } else if (defense[0] > EXCELLENT) {
                    out = (0, _Utility_utils.text)('Glove');
                } else if (defense[1] > EXCELLENT) {
                    out = (0, _Utility_utils.text)('Range');
                } else if (defense[2] > ELITE) {
                    out = (0, _Utility_utils.text)('Strong throw');
                }
            }
        }
        if (battingOnly) return out;
        return this.definingCharacteristic[_Utility_utils.text.mode] = out;
    },
    /**
     * to ease comparison in Angular (?)
     */
    toString: function toString() {
        return this.name + ' #' + this.number;
    },
    eye: {},
    fatigue: 0,
    name: '',
    number: 0,
    position: '',
    atBats: []
};

exports.Player = Player;

},{"../Model/_models":8,"../Services/_services":30,"../Utility/_utils":35}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _ModelPlayer = require('../Model/Player');

var _ModelManager = require('../Model/Manager');

var _Utility_utils = require('../Utility/_utils');

var Team = function Team(game, heroRate) {
    this.init(game, heroRate);
};

Team.RUNNERS_DISCRETION = 'runnersDiscretion';
Team.RUNNER_GO = 'go';
Team.RUNNER_HOLD = 'hold';

Team.prototype = {
    constructor: Team,
    init: function init(game, heroRate) {
        this.sub = this.noSubstituteSelected;
        heroRate = heroRate || 0.10;
        this.substituted = [];
        this.pickName();
        this.lineup = [];
        this.bench = [];
        this.bullpen = [];
        this.positions = {
            pitcher: null,
            catcher: null,
            first: null,
            second: null,
            short: null,
            third: null,
            left: null,
            center: null,
            right: null
        };
        this.manager = new _ModelManager.Manager(this);
        if (game !== 'no init') {
            this.game = game;
            for (var j = 0; j < 20; j++) {
                this.bench.push(new _ModelPlayer.Player(this, Math.random() < heroRate));
            }
            if (this.bench.length == 20) {
                this.manager.makeLineup();
            }
        }
    },
    pickName: function pickName() {
        var teamNameIndex = Math.floor(Math.random() * _Utility_utils.data.teamNames.length);
        this.name = _Utility_utils.data.teamNames[teamNameIndex];
        this.nameJ = _Utility_utils.data.teamNamesJ[teamNameIndex];
    },
    getName: function getName() {
        return _Utility_utils.text.mode == 'n' ? this.nameJ : this.name;
    },
    stealAttempt: Team.RUNNERS_DISCRETION,
    lineup: [],
    positions: {},
    manager: null,
    bench: [],
    bullpen: [],
    nowBatting: 0,
    expanded: 'Player&',
    noSubstituteSelected: {
        toString: function toString() {
            return '';
        },
        toValue: function toValue() {
            return false;
        }
    }
};

exports.Team = Team;

},{"../Model/Manager":4,"../Model/Player":5,"../Utility/_utils":35}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _Utility_utils = require('../Utility/_utils');

var _ModelPlayer = require('../Model/Player');

var Umpire = function Umpire(game) {
    this.init(game);
};

Umpire.prototype = {
    constructor: Umpire,
    init: function init(game) {
        this.game = game;
        this.playBall();
    },
    count: {
        strikes: 0,
        balls: 0,
        outs: 0
    },
    playBall: function playBall() {
        var game = this.game;
        game.half = 'top';
        game.inning = 1;
        game.batter = game.teams.away.lineup[0];
        game.batterRunner = game.teams.away.lineup[0];
        game.deck = game.teams.away.lineup[1];
        game.hole = game.teams.away.lineup[2];
        game.pitcher = game.teams.home.positions.pitcher;
        var n = '一回のオモテ、' + game.teams.away.nameJ + 'の攻撃対' + game.teams.home.nameJ + '、ピッチャーは' + game.teams.home.positions.pitcher.nameJ + '。',
            e = 'Top 1, ' + game.teams.away.name + ' offense vs. ' + game.teams.home.positions.pitcher.name + ' starting for ' + game.teams.home.name;
        game.log.note(e, n);
        game.batter.ready = true;
        game.log.noteBatter(game.batter);
    },
    makeCall: function makeCall() {
        this.says = '';
        var game = this.game;
        var result = game.swingResult;
        var pitcher = game.pitcher;
        var batter = game.batter;
        var field = game.field;

        if (game.swingResult.fielder) {
            var fielder = game.teams[game.half == 'top' ? 'home' : 'away'].positions[result.fielder];
        } else {
            fielder = null;
        }

        game.batterRunner = game.batter;

        if (result.stoleABase) {
            var thief = result.stoleABase;
            thief.atBats.push(_Utility_utils.Log.prototype.STOLEN_BASE);
            switch (thief) {
                case field.first:
                    field.second = thief;
                    field.first = null;
                    break;
                case field.second:
                    field.third = thief;
                    field.second = null;
                    break;
                case field.third:
                    field.third = null;
                    thief.stats.batting.r++;
                    thief.atBats.push(_Utility_utils.Log.prototype.RUN);
                    this.runScores();
            }
            thief.stats.batting.sb++;
        }
        if (result.caughtStealing) {
            game.teams[game.half == 'top' ? 'home' : 'away'].positions['catcher'].stats.fielding.PO++;
            this.count.outs++;
            thief = result.caughtStealing;
            thief.stats.batting.cs++;
            thief.atBats.push(_Utility_utils.Log.prototype.CAUGHT_STEALING);
            switch (thief) {
                case field.first:
                    field.first = null;
                    break;
                case field.second:
                    field.second = null;
                    break;
                case field.third:
                    field.third = null;
            }
            if (this.count.outs >= 3) {
                this.says = 'Three outs, change.';
                this.count.outs = this.count.balls = this.count.strikes = 0;
                pitcher.stats.pitching.IP[0]++;
                pitcher.stats.pitching.IP[1] = 0;
                return this.changeSides();
            }
        }

        pitcher.stats.pitching.pitches++;
        if (result.looking) {
            if (result.strike) {
                this.count.strikes++;
                pitcher.stats.pitching.strikes++;
            } else {
                this.count.balls++;
            }
        } else {
            pitcher.stats.pitching.strikes++;
            if (result.contact) {
                game.passMinutes(1);
                if (result.caught) {
                    batter.stats.batting.pa++;
                    pitcher.stats.pitching.IP[1]++;
                    if (result.sacrificeAdvances.length && this.count.outs < 2) {
                        batter.stats.batting.sac++;
                        game.batter.atBats.push(_Utility_utils.Log.prototype.SACRIFICE);
                        this.advanceRunners(false, null, result.sacrificeAdvances);
                    } else {
                        batter.stats.batting.ab++;
                        if (result.flyAngle < 15) {
                            game.batter.atBats.push(_Utility_utils.Log.prototype.LINEOUT);
                        } else {
                            game.batter.atBats.push(_Utility_utils.Log.prototype.FLYOUT);
                        }
                    }
                    this.count.outs++;
                    fielder.stats.fielding.PO++;
                    this.newBatter();
                } else {
                    if (result.foul) {
                        this.count.strikes++;
                        if (this.count.strikes > 2) this.count.strikes = 2;
                    } else {
                        batter.stats.batting.pa++;
                        batter.stats.batting.ab++;
                        if (result.firstOut) {
                            game.field[result.firstOut] = null;
                            result.additionalOuts.map(function (runner) {
                                if (runner !== 'batter') {
                                    game.field[runner] = null;
                                }
                            });
                            this.count.outs += result.additionalOuts.length;
                        }
                        if (result.fieldersChoice && this.count.outs < 2) {
                            result.bases = 0;
                            this.count.outs++;
                            fielder.stats.fielding.PO++;
                            pitcher.stats.pitching.IP[1]++;
                            game.batter.atBats.push(_Utility_utils.Log.prototype.FIELDERS_CHOICE);
                            this.advanceRunners(false, result.fieldersChoice);
                            result.doublePlay && game.batter.atBats.push(_Utility_utils.Log.prototype.GIDP);
                            this.reachBase();
                            result.outs = this.count.outs;
                            this.newBatter();
                        } else if (result.fieldersChoice) {
                            result.bases = 0;
                            result.thrownOut = true;
                        }
                        if (result.thrownOut) {
                            this.count.outs++;
                            fielder.stats.fielding.PO++;
                            pitcher.stats.pitching.IP[1]++;
                            game.batter.atBats.push(_Utility_utils.Log.prototype.GROUNDOUT);
                            result.doublePlay && game.batter.atBats.push(_Utility_utils.Log.prototype.GIDP);
                            if (this.count.outs < 3) {
                                this.advanceRunners(false);
                            }
                            result.outs = this.count.outs;
                            this.newBatter();
                        }
                        if (result.hitByPitch) {
                            batter.stats.batting.ab--;
                        }
                        if (result.bases) {
                            if (!result.error) {
                                game.tally[game.half == 'top' ? 'away' : 'home'][_Utility_utils.Log.prototype.SINGLE]++;
                                pitcher.stats.pitching.H++;
                            } else {
                                if (result.bases > 0) {
                                    game.tally[game.half == 'top' ? 'home' : 'away'].E++;
                                    fielder.stats.fielding.E++;
                                }
                            }
                            var bases = result.bases;
                            switch (bases) {
                                case 0:
                                    game.batter.atBats.push(_Utility_utils.Log.prototype.GROUNDOUT);
                                    break;
                                case 1:
                                    if (result.error) {
                                        game.batter.atBats.push(_Utility_utils.Log.prototype.REACHED_ON_ERROR);
                                        break;
                                    }
                                    game.batter.atBats.push(_Utility_utils.Log.prototype.SINGLE);
                                    batter.stats.batting.h++;
                                    break;
                                case 2:
                                    if (result.error) {
                                        game.batter.atBats.push(_Utility_utils.Log.prototype.REACHED_ON_ERROR);
                                        break;
                                    }
                                    game.batter.atBats.push(_Utility_utils.Log.prototype.DOUBLE);
                                    batter.stats.batting.h++;
                                    batter.stats.batting['2b']++;
                                    break;
                                case 3:
                                    if (result.error) {
                                        game.batter.atBats.push(_Utility_utils.Log.prototype.REACHED_ON_ERROR);
                                        break;
                                    }
                                    game.batter.atBats.push(_Utility_utils.Log.prototype.TRIPLE);
                                    batter.stats.batting.h++;
                                    batter.stats.batting['3b']++;
                                    break;
                                case 4:
                                    if (result.error) {
                                        game.batter.atBats.push(_Utility_utils.Log.prototype.REACHED_ON_ERROR);
                                        break;
                                    }
                                    game.batter.atBats.push(_Utility_utils.Log.prototype.HOMERUN);
                                    pitcher.stats.pitching.HR++;
                                    batter.stats.batting.h++;
                                    batter.stats.batting.hr++;
                                    break;
                            }
                            if (bases > 0 && bases < 4 && !result.error) {
                                if (['left', 'right', 'center'].indexOf(result.fielder) == -1) {
                                    batter.recordInfieldHit();
                                }
                            }
                            if (bases >= 1) {
                                this.advanceRunners();
                                this.reachBase();
                                bases -= 1;
                            }
                            while (bases > 0) {
                                bases -= 1;
                                this.advanceRunners();
                            }
                            this.newBatter();
                        }
                    }
                }
            } else {
                this.count.strikes++;
            }
        }

        this.says = this.count.balls + ' and ' + this.count.strikes;

        result.outs = this.count.outs;

        if (this.count.strikes > 2) {
            batter.stats.batting.pa++;
            batter.stats.batting.ab++;
            batter.stats.batting.so++;
            pitcher.stats.pitching.K++;
            this.count.outs++;
            pitcher.stats.pitching.IP[1]++;
            this.count.balls = this.count.strikes = 0;
            this.says = 'Strike three. Batter out.';
            batter.atBats.push(_Utility_utils.Log.prototype.STRIKEOUT);
            this.newBatter();
        }
        if (this.count.balls > 3) {
            batter.stats.batting.pa++;
            batter.stats.batting.bb++;
            pitcher.stats.pitching.BB++;
            this.says = 'Ball four.';
            this.count.balls = this.count.strikes = 0;
            batter.atBats.push(_Utility_utils.Log.prototype.WALK);
            this.advanceRunners(true).reachBase().newBatter();
        }
        if (this.count.outs > 2) {
            this.says = 'Three outs, change.';
            this.count.outs = this.count.balls = this.count.strikes = 0;
            pitcher.stats.pitching.IP[0]++;
            pitcher.stats.pitching.IP[1] = 0;
            this.changeSides();
        }
    },
    reachBase: function reachBase() {
        var game = this.game;
        game.field.first = game.batter;
        game.field.first.fatigue += 2;
        return this;
    },
    advanceRunners: function advanceRunners(isWalk, fieldersChoice, sacrificeAdvances) {
        isWalk = !!isWalk;
        var game = this.game;
        var first = game.field.first,
            second = game.field.second,
            third = game.field.third,
            swing = game.swingResult;

        if (isWalk) {
            if (first) {
                if (second) {
                    if (third) {
                        //bases loaded
                        game.batter.recordRBI();
                        game.batter.stats.batting.rbi++;
                        third.atBats.push(_Utility_utils.Log.prototype.RUN);
                        third.stats.batting.r++;
                        game.pitcher.stats.pitching.ER++;
                        this.runScores();
                        game.field.third = second;
                        game.field.second = first;
                        first = null;
                    } else {
                        // 1st and second
                        game.field.third = second;
                        game.field.second = first;
                        game.field.first = null;
                    }
                } else {
                    if (third) {
                        // first and third
                        game.field.second = first;
                        game.field.first = null;
                    } else {
                        // first only
                        game.field.second = first;
                        game.field.first = null;
                    }
                }
            } else {
                // no one on first
            }
        } else {
                if (fieldersChoice) {
                    game.field[fieldersChoice] = null;
                    first = game.field.first;
                    second = game.field.second;
                    third = game.field.third;
                }
                var canAdvance = function canAdvance() {
                    return true;
                };
                if (sacrificeAdvances) {
                    canAdvance = function (position) {
                        switch (position) {
                            case 'first':
                                return sacrificeAdvances.indexOf('first') > -1 && !game.field.second;
                            case 'second':
                                return sacrificeAdvances.indexOf('second') > -1 && !game.field.third;
                            case 'third':
                                return sacrificeAdvances.indexOf('third') > -1;
                        }
                    };
                }
                var arm = 0;
                if (swing.fielder) {
                    var fielder = game.pitcher.team.positions[swing.fielder];
                    if (['left', 'center', 'right'].indexOf(fielder.position) > -1) {
                        arm = fielder.skill.defense.throwing;
                    } else {
                        arm = fielder.skill.defense.throwing + 120; // very rare extra bases on infield BIP
                    }
                }
                if (third && canAdvance('third')) {
                    // run scored
                    this.runScores();
                    if (game.batter != third) {
                        game.batter.recordRBI();
                        third.atBats.push(_Utility_utils.Log.prototype.RUN);
                    }
                    game.batter.stats.batting.rbi++;
                    third.stats.batting.r++;
                    game.pitcher.stats.pitching.ER++;
                    game.field.third = null;
                }
                if (second && canAdvance('second')) {
                    game.field.third = second;
                    game.field.second = null;
                    if (second != game.batter && !sacrificeAdvances && Math.random() * (second.skill.offense.speed + 120) > arm + 50) {

                        this.runScores();
                        if (game.batter != second) {
                            game.batter.recordRBI();
                            second.atBats.push(_Utility_utils.Log.prototype.RUN);
                        }
                        game.field.third = null;
                    }
                }
                if (first && canAdvance('first')) {
                    game.field.second = first;
                    game.field.first = null;
                    if (first != game.batter && !game.field.third && !sacrificeAdvances && Math.random() * (first.skill.offense.speed + 120) > arm + 60) {

                        game.field.third = first;
                        game.field.second = null;
                    }
                }
            }
        return this;
    },
    runScores: function runScores() {
        var game = this.game;
        game.scoreboard[game.half == 'top' ? 'away' : 'home'][game.inning]++;
        game.tally[game.half == 'top' ? 'away' : 'home'].R++;
    },
    newBatter: function newBatter() {
        var game = this.game;
        game.passMinutes(2);
        game.log.pitchRecord = {
            e: [],
            n: []
        };
        this.count.balls = this.count.strikes = 0;
        game.log.notePlateAppearanceResult(game);
        var team = game.half == 'bottom' ? game.teams.home : game.teams.away;
        game.lastBatter = game.batter;
        game.batter = team.lineup[(team.nowBatting + 1) % 9];
        game.batter.ready = false;
        if (!game.humanBatting()) {
            game.batter.ready = true;
        }
        game.deck = team.lineup[(team.nowBatting + 2) % 9];
        game.hole = team.lineup[(team.nowBatting + 3) % 9];
        team.nowBatting = (team.nowBatting + 1) % 9;
        if (this.count.outs < 3) {
            game.log.noteBatter(game.batter);
        }
        game.showPlayResultPanels(game.lastBatter);
    },
    changeSides: function changeSides() {
        var game = this.game;
        game.passMinutes(5);
        game.swingResult = {};
        game.swingResult.looking = true; // hide bat
        game.pitchInFlight.x = null; // hide ball
        game.pitchInFlight.y = null; // hide ball
        game.log.pitchRecord = {
            e: [],
            n: []
        };
        var offense, defense;
        game.field.first = null;
        game.field.second = null;
        game.field.third = null;
        if (game.half == 'top') {
            if (game.inning == 9 && game.tally.home.R > game.tally.away.R) {
                return game.end();
            }
            game.half = 'bottom';
        } else {
            if (game.inning + 1 > 9) {
                return game.end();
            }
            game.inning++;
            game.half = 'top';
        }
        offense = game.half == 'top' ? 'away' : 'home';
        defense = game.half == 'top' ? 'home' : 'away';
        var n = game.inning + '回の' + (game.half == 'top' ? 'オモテ' : 'ウラ') + '、' + game.teams[game.half == 'top' ? 'away' : 'home'].getName() + 'の攻撃。',
            e = (game.half == 'top' ? 'Top' : 'Bottom') + ' ' + game.inning;
        game.log.note(e, n);
        var team = game.teams[offense];
        game.batter = team.lineup[team.nowBatting];
        game.batterRunner = game.batter;
        game.deck = team.lineup[(team.nowBatting + 1) % 9];
        game.hole = team.lineup[(team.nowBatting + 2) % 9];

        game.pitcher = game.teams[defense].positions.pitcher;
        game.log.noteBatter(game.batter);
        game.autoPitchSelect();
        game.field.defense = team.positions;
        this.onSideChange();
    },
    onSideChange: function onSideChange() {}, // can be bound externally
    says: 'Play ball!',
    game: null
};

exports.Umpire = Umpire;

},{"../Model/Player":5,"../Utility/_utils":35}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _ModelAtBat = require('../Model/AtBat');

var _ModelField = require('../Model/Field');

var _ModelGame = require('../Model/Game');

var _ModelManager = require('../Model/Manager');

var _ModelPlayer = require('../Model/Player');

var _ModelTeam = require('../Model/Team');

var _ModelUmpire = require('../Model/Umpire');

exports.AtBat = _ModelAtBat.AtBat;
exports.Field = _ModelField.Field;
exports.Game = _ModelGame.Game;
exports.Manager = _ModelManager.Manager;
exports.Player = _ModelPlayer.Player;
exports.Team = _ModelTeam.Team;
exports.Umpire = _ModelUmpire.Umpire;

},{"../Model/AtBat":1,"../Model/Field":2,"../Model/Game":3,"../Model/Manager":4,"../Model/Player":5,"../Model/Team":6,"../Model/Umpire":7}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _meshBall = require('./mesh/Ball');

var _meshMound = require('./mesh/Mound');

var _meshBase = require('./mesh/Base');

var _meshFoulLine = require('./mesh/FoulLine');

var _meshFoulPole = require('./mesh/FoulPole');

var _meshField = require('./mesh/Field');

var _meshGrass = require('./mesh/Grass');

var _meshBaseDirt = require('./mesh/BaseDirt');

var _meshBattersEye = require('./mesh/BattersEye');

var _meshWall = require('./mesh/Wall');

var _meshSky = require('./mesh/Sky');

var _meshSun = require('./mesh/Sun');

var _sceneLighting = require('./scene/lighting');

var _ShadersSkyShader = require('./Shaders/SkyShader');

var _ServicesAnimator = require('../Services/Animator');

/**
 * the constants should be tuned so that the camera coincides with the DOM's strike zone overlay
 * @type {number}
 */
var VERTICAL_CORRECTION = -0.2;
var INITIAL_CAMERA_DISTANCE = 8;

if (typeof THREE !== 'undefined') {
    var AHEAD = new THREE.Vector3(0, VERTICAL_CORRECTION, -60.5);
    var INITIAL_POSITION = new THREE.Vector3(0, VERTICAL_CORRECTION, INITIAL_CAMERA_DISTANCE);
}

/**
 * manager for the rendering loop
 */

var Loop = (function () {
    function Loop(elementClass, background) {
        _classCallCheck(this, Loop);

        (0, _ShadersSkyShader.loadSkyShader)();
        this.elementClass = elementClass;
        window.loop = this;
        this.timeOfDay = {
            h: 5,
            m: 30
        };
        this.main(background);
    }

    /**
     * individual objects<AbstractMesh> can attach and detach to the manager to be rendered
     */

    _createClass(Loop, [{
        key: 'loop',
        value: function loop() {
            requestAnimationFrame(this.loop.bind(this));
            this.panToward(this.target);
            var omt = this.overwatchMoveTarget;
            this.moveToward(this.moveTarget || {
                x: omt.x,
                y: omt.y + 12,
                z: omt.z
            });
            this.objects.map(function (i) {
                return i.animate();
            });
            //this.breathe();
            this.renderer.render(this.scene, this.camera);
        }

        /**
         * initialize lights, camera, action
         */
    }, {
        key: 'main',
        value: function main(background) {
            this.objects = [];
            var giraffe = this;

            if (this.getThree()) {

                var THREE = this.THREE;

                var scene = this.scene = new THREE.Scene();
                scene.fog = new THREE.FogExp2(0x838888, 0.002);
                if (this.attach()) {
                    this.lighting = _sceneLighting.lighting;
                    _sceneLighting.lighting.addTo(scene);
                    var camera = this.camera = new THREE.PerspectiveCamera(60, this.getAspect(), 0.1, 1000000);

                    this.target = new THREE.Vector3(0, 0, -60.5);
                    this._target = new THREE.Vector3(0, 0, -60.5);
                    this.moveTarget = camera.position;

                    this.resetCamera();
                    this.loop();
                    if (background) {
                        this.addStaticMeshes();
                    }
                } else {
                    setTimeout(function () {
                        giraffe.main(background);
                    }, 2000);
                }
            }
        }

        /**
         * @param addition
         */
    }, {
        key: 'addMinutes',
        value: function addMinutes(addition) {
            var hours = this.timeOfDay.h,
                minutes = this.timeOfDay.m;
            minutes += addition;
            while (minutes >= 60) {
                minutes -= 60;
                hours += 1;
                hours %= 24;
            }
            this.setTimeOfDay(hours, minutes);
        }

        /**
         * @param hours
         * @param minutes
         * gradual transition
         */
    }, {
        key: 'setTargetTimeOfDay',
        value: function setTargetTimeOfDay(hours, minutes) {
            var _this = this;

            if (this.background) {
                var sun = this.background.sun;
            } else {
                sun = this.sun;
            }
            if (sun) {
                sun.setTargetTime(hours, minutes);
            } else {
                setTimeout(function (x) {
                    _this.setTargetTimeOfDay(hours, minutes);
                }, 500);
            }
        }

        /**
         * @param hours {Number} 0-24
         * @param minutes {Number} 0-60
         * instant transition
         */
    }, {
        key: 'setTimeOfDay',
        value: function setTimeOfDay(hours, minutes) {
            this.timeOfDay = {
                h: hours,
                m: minutes
            };
            if (this.background) {
                var sky = this.background.sky,
                    sun = this.background.sun;
            } else {
                sky = this.sky;
                sun = this.sun;
            }
            if (hours < 7.5) {
                hours += 24;
            }
            var azimuth = (hours - 7.5) / 24 + minutes / 60 / 24;
            sky.uniforms.azimuth = azimuth;

            //if (azimuth > 0.5) {
            //    sky.uniforms.inclination = 0.48;
            //} else {
            sky.uniforms.inclination = 0.31;
            //}
            sun.time.h = hours;
            sun.time.m = minutes;
            sun.derivePosition(sky);
            var luminosity = (-0.5 + Math.max(Math.abs(1.25 - azimuth), Math.abs(0.25 - azimuth))) * 2;
            _ServicesAnimator.Animator.setLuminosity(0.1 + luminosity / 1.4);
        }

        /**
         * used by the background layer
         */
    }, {
        key: 'addStaticMeshes',
        value: function addStaticMeshes() {
            new _meshField.Field().join(this);
            new _meshMound.Mound().join(this);
            new _meshGrass.Grass().join(this);
            new _meshGrass.Grass(this, true);
            new _meshBattersEye.BattersEye().join(this);
            var sun = new _meshSun.Sun(),
                sky = new _meshSky.Sky();
            sun.derivePosition(sky);
            sky.join(this);
            sun.join(this);

            this.sky = sky;
            this.sun = sun;

            new _meshWall.Wall(this, -34);
            new _meshWall.Wall(this, -15);
            new _meshWall.Wall(this, 15);
            new _meshWall.Wall(this, 34);

            var b1 = new _meshBase.Base(this, 'first');
            var b2 = new _meshBase.Base(this, 'second');
            var b3 = new _meshBase.Base(this, 'third');
            var b4 = new _meshBase.Base(this, 'home');

            new _meshBaseDirt.BaseDirt(this, b1);
            new _meshBaseDirt.BaseDirt(this, b2);
            new _meshBaseDirt.BaseDirt(this, b3);
            new _meshBaseDirt.BaseDirt(this, b4);

            new _meshFoulLine.FoulLine(this, 'left');
            new _meshFoulLine.FoulLine(this, 'right');

            new _meshFoulPole.FoulPole(this, 'left');
            new _meshFoulPole.FoulPole(this, 'right');
        }

        /**
         * experimental camera bobbing
         */
    }, {
        key: 'breathe',
        value: function breathe() {
            var pos = this.camera.position;
            var x = pos.x,
                y = pos.y,
                z = pos.z;
            var rate = 0.0005 * this.bob || 1;
            if (y > 0.6) {
                this.bob = -1;
            } else if (y < -0.6) {
                this.bob = 1;
            }
            //pos.x += rate;
            pos.y += rate;
            pos.z += rate;
        }
    }, {
        key: 'getThree',
        value: function getThree() {
            if (this.THREE === Loop.prototype.THREE && typeof window === 'object' && window.THREE) {
                return this.THREE = window.THREE;
            }
            return true;
        }

        /**
         * attach to the DOM
         * @returns {THREE.WebGLRenderer|Boolean}
         */
    }, {
        key: 'attach',
        value: function attach() {
            window.removeEventListener('resize', this.onResize.bind(this), false);
            window.addEventListener('resize', this.onResize.bind(this), false);
            var element = document.getElementsByClassName(this.elementClass)[0];
            if (element) {
                element.innerHTML = '';
                var THREE = this.THREE;
                var renderer = new THREE.WebGLRenderer({ alpha: true });
                this.setSize(renderer);
                //renderer.setClearColor(0xffffff, 0);

                element.appendChild(renderer.domElement);

                this.renderer = renderer;
                return renderer;
            }
            return false;
        }

        /**
         * higher FOV on lower view widths
         */
    }, {
        key: 'onResize',
        value: function onResize() {
            var element = document.getElementsByClassName(this.elementClass)[0];
            this.camera.aspect = this.getAspect();
            this.camera.fov = Math.max(90 - 30 * (element.offsetWidth / 1200), 55);
            this.camera.updateProjectionMatrix();
            this.setSize(this.renderer);
        }
    }, {
        key: 'setSize',
        value: function setSize(renderer) {
            var element = document.getElementsByClassName(this.elementClass)[0];
            var width = element.offsetWidth;
            renderer.setSize(width, HEIGHT);
        }
    }, {
        key: 'getAspect',
        value: function getAspect() {
            var element = document.getElementsByClassName(this.elementClass)[0];
            return element.offsetWidth / HEIGHT;
        }

        /**
         * incrementally pan toward the vector given
         * @param vector
         */
    }, {
        key: 'panToward',
        value: function panToward(vector) {
            var maxIncrement = this.panSpeed;
            this.forAllLoops(function (loop) {
                var target = loop._target;
                if (target) {
                    target.x = target.x + Math.max(Math.min((vector.x - target.x) / 100, maxIncrement), -maxIncrement);
                    target.y = target.y + Math.max(Math.min((vector.y - target.y) / 100, maxIncrement), -maxIncrement);
                    target.z = target.z + Math.max(Math.min((vector.z - target.z) / 100, maxIncrement), -maxIncrement);
                    loop.camera.lookAt(target);
                }
            });
        }

        /**
         * incrementally move the camera to the vector
         * @param vector
         */
    }, {
        key: 'moveToward',
        value: function moveToward(vector) {
            var maxIncrement = this.moveSpeed;
            this.forAllLoops(function (loop) {
                var position = loop.camera && loop.camera.position;
                if (position) {
                    position.x += Math.max(Math.min(vector.x - position.x, maxIncrement), -maxIncrement);
                    position.y += Math.max(Math.min(vector.y - position.y, maxIncrement), -maxIncrement);
                    position.z += Math.max(Math.min(vector.z - position.z, maxIncrement), -maxIncrement);
                }
            });
        }

        /**
         * setting a target will cause the camera to pan toward it using the pan method above
         * @param vector
         * @param panSpeed
         */
    }, {
        key: 'setLookTarget',
        value: function setLookTarget(vector, panSpeed) {
            this.forAllLoops(function (loop) {
                loop.panSpeed = panSpeed || 0.9;
                loop.panning = vector !== AHEAD;
                loop.target = vector;
            });
        }

        /**
         * setting a target will cause the camera to move toward it using the incremental method above
         * @param vector
         * @param moveSpeed
         */
    }, {
        key: 'setMoveTarget',
        value: function setMoveTarget(vector, moveSpeed) {
            this.forAllLoops(function (loop) {
                loop.moveSpeed = moveSpeed || 0.7;
                loop.moveTarget = vector;
                loop.overwatchMoveTarget = null;
            });
        }
    }, {
        key: 'setOverwatchMoveTarget',
        value: function setOverwatchMoveTarget(vector, moveSpeed) {
            this.forAllLoops(function (loop) {
                loop.moveSpeed = moveSpeed || 0.7;
                loop.overwatchMoveTarget = vector;
                loop.moveTarget = null;
            });
        }
    }, {
        key: 'resetCamera',
        value: function resetCamera() {
            var moveSpeed = 0.5;
            if (this.camera.position.z !== INITIAL_POSITION.z) {
                moveSpeed = 2.5;
            }
            this.setLookTarget(AHEAD, moveSpeed);
            this.setMoveTarget(INITIAL_POSITION, moveSpeed / 10);
        }
    }, {
        key: 'moveCamera',
        value: function moveCamera(x, y, z) {
            if (typeof x === 'object') {
                return this.moveCamera(x.x, x.y, x.z);
            }
            this.forAllLoops(function (loop) {
                loop.camera.position.x = x;
                loop.camera.position.y = y;
                loop.camera.position.z = z;
            });
        }

        /**
         * execute the function on all loops
         * @param fn {Function}
         */
    }, {
        key: 'forAllLoops',
        value: function forAllLoops(fn) {
            if (this.background) {
                fn(this.background);
            }
            if (this.foreground) {
                fn(this.foreground);
            }
            fn(this);
        }
    }, {
        key: 'test',
        value: function test() {
            var ball = new _meshBall.Ball();
            window.Ball = _meshBall.Ball;
            window.ball = ball;
            ball.setType('4-seam');
            //with (ball.mesh.rotation) {x=0,y=0,z=0}; ball.rotation = {x:0.00, y:0.00};
            ball.animate = function () {
                ball.rotate();
            };
            ball.join(this);
            // Baseball.service.Animator.loop.test();
        }
    }, {
        key: 'testTrajectory',
        value: function testTrajectory(data) {
            var ball = new _meshBall.Ball();
            window.Ball = _meshBall.Ball;
            window.ball = ball;
            ball.deriveTrajectory(data || {
                splay: -35,
                travelDistance: 135,
                flyAngle: -15,
                x: 100,
                y: 100
            }, {
                x: 0, y: 0
            });
            ball.join(this);
        }
    }]);

    return Loop;
})();

var HEIGHT = 700;
Loop.VERTICAL_CORRECTION = VERTICAL_CORRECTION;
Loop.INITIAL_CAMERA_DISTANCE = INITIAL_CAMERA_DISTANCE;
Loop.prototype.THREE = {};
Loop.prototype.constructors = {
    Ball: _meshBall.Ball,
    Mound: _meshMound.Mound,
    Field: _meshField.Field
};

exports.Loop = Loop;

},{"../Services/Animator":26,"./Shaders/SkyShader":10,"./mesh/Ball":12,"./mesh/Base":13,"./mesh/BaseDirt":14,"./mesh/BattersEye":15,"./mesh/Field":16,"./mesh/FoulLine":17,"./mesh/FoulPole":18,"./mesh/Grass":19,"./mesh/Mound":21,"./mesh/Sky":22,"./mesh/Sun":23,"./mesh/Wall":24,"./scene/lighting":25}],10:[function(require,module,exports){
/**
 * @author zz85 / https://github.com/zz85
 *
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * http://www.cs.utah.edu/~shirley/papers/sunsky/sunsky.pdf
 *
 * First implemented by Simon Wallner
 * http://www.simonwallner.at/projects/atmospheric-scattering
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Three.js integration by zz85 http://twitter.com/blurspline
 */

"use strict";

Object.defineProperty(exports, "__esModule", {
            value: true
});
var loadSkyShader = function loadSkyShader() {
            THREE.ShaderLib['sky'] = {

                        uniforms: {
                                    luminance: { type: "f", value: 1 },
                                    turbidity: { type: "f", value: 2 },
                                    reileigh: { type: "f", value: 1 },
                                    mieCoefficient: { type: "f", value: 0.005 },
                                    mieDirectionalG: { type: "f", value: 0.8 },
                                    sunPosition: { type: "v3", value: new THREE.Vector3() }
                        },

                        vertexShader: ["varying vec3 vWorldPosition;", "void main() {", "vec4 worldPosition = modelMatrix * vec4( position, 1.0 );", "vWorldPosition = worldPosition.xyz;", "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );", "}"].join("\n"),

                        fragmentShader: ["uniform sampler2D skySampler;", "uniform vec3 sunPosition;", "varying vec3 vWorldPosition;", "vec3 cameraPos = vec3(0., 0., 0.);", "// uniform sampler2D sDiffuse;", "// const float turbidity = 10.0; //", "// const float reileigh = 2.; //", "// const float luminance = 1.0; //", "// const float mieCoefficient = 0.005;", "// const float mieDirectionalG = 0.8;", "uniform float luminance;", "uniform float turbidity;", "uniform float reileigh;", "uniform float mieCoefficient;", "uniform float mieDirectionalG;", "// constants for atmospheric scattering", "const float e = 2.71828182845904523536028747135266249775724709369995957;", "const float pi = 3.141592653589793238462643383279502884197169;", "const float n = 1.0003; // refractive index of air", "const float N = 2.545E25; // number of molecules per unit volume for air at", "// 288.15K and 1013mb (sea level -45 celsius)", "const float pn = 0.035;	// depolatization factor for standard air", "// wavelength of used primaries, according to preetham", "const vec3 lambda = vec3(680E-9, 550E-9, 450E-9);", "// mie stuff", "// K coefficient for the primaries", "const vec3 K = vec3(0.686, 0.678, 0.666);", "const float v = 4.0;", "// optical length at zenith for molecules", "const float rayleighZenithLength = 8.4E3;", "const float mieZenithLength = 1.25E3;", "const vec3 up = vec3(0.0, 1.0, 0.0);", "const float EE = 1000.0;", "const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;", "// 66 arc seconds -> degrees, and the cosine of that", "// earth shadow hack", "const float cutoffAngle = pi/1.95;", "const float steepness = 1.5;", "vec3 totalRayleigh(vec3 lambda)", "{", "return (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn));", "}",

                        // see http://blenderartists.org/forum/showthread.php?321110-Shaders-and-Skybox-madness
                        "// A simplied version of the total Reayleigh scattering to works on browsers that use ANGLE", "vec3 simplifiedRayleigh()", "{", "return 0.0005 / vec3(94, 40, 18);",
                        // return 0.00054532832366 / (3.0 * 2.545E25 * pow(vec3(680E-9, 550E-9, 450E-9), vec3(4.0)) * 6.245);
                        "}", "float rayleighPhase(float cosTheta)", "{	 ", "return (3.0 / (16.0*pi)) * (1.0 + pow(cosTheta, 2.0));", "//	return (1.0 / (3.0*pi)) * (1.0 + pow(cosTheta, 2.0));", "//	return (3.0 / 4.0) * (1.0 + pow(cosTheta, 2.0));", "}", "vec3 totalMie(vec3 lambda, vec3 K, float T)", "{", "float c = (0.2 * T ) * 10E-18;", "return 0.434 * c * pi * pow((2.0 * pi) / lambda, vec3(v - 2.0)) * K;", "}", "float hgPhase(float cosTheta, float g)", "{", "return (1.0 / (4.0*pi)) * ((1.0 - pow(g, 2.0)) / pow(1.0 - 2.0*g*cosTheta + pow(g, 2.0), 1.5));", "}", "float sunIntensity(float zenithAngleCos)", "{", "return EE * max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithAngleCos))/steepness)));", "}", "// float logLuminance(vec3 c)", "// {", "// 	return log(c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722);", "// }", "// Filmic ToneMapping http://filmicgames.com/archives/75", "float A = 0.15;", "float B = 0.50;", "float C = 0.10;", "float D = 0.20;", "float E = 0.02;", "float F = 0.30;", "float W = 1000.0;", "vec3 Uncharted2Tonemap(vec3 x)", "{", "return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;", "}", "void main() ", "{", "float sunfade = 1.0-clamp(1.0-exp((sunPosition.y/450000.0)),0.0,1.0);", "// luminance =  1.0 ;// vWorldPosition.y / 450000. + 0.5; //sunPosition.y / 450000. * 1. + 0.5;", "// gl_FragColor = vec4(sunfade, sunfade, sunfade, 1.0);", "float reileighCoefficient = reileigh - (1.0* (1.0-sunfade));", "vec3 sunDirection = normalize(sunPosition);", "float sunE = sunIntensity(dot(sunDirection, up));", "// extinction (absorbtion + out scattering) ", "// rayleigh coefficients",

                        // "vec3 betaR = totalRayleigh(lambda) * reileighCoefficient;",
                        "vec3 betaR = simplifiedRayleigh() * reileighCoefficient;", "// mie coefficients", "vec3 betaM = totalMie(lambda, K, turbidity) * mieCoefficient;", "// optical length", "// cutoff angle at 90 to avoid singularity in next formula.", "float zenithAngle = acos(max(0.0, dot(up, normalize(vWorldPosition - cameraPos))));", "float sR = rayleighZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));", "float sM = mieZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));", "// combined extinction factor	", "vec3 Fex = exp(-(betaR * sR + betaM * sM));", "// in scattering", "float cosTheta = dot(normalize(vWorldPosition - cameraPos), sunDirection);", "float rPhase = rayleighPhase(cosTheta*0.5+0.5);", "vec3 betaRTheta = betaR * rPhase;", "float mPhase = hgPhase(cosTheta, mieDirectionalG);", "vec3 betaMTheta = betaM * mPhase;", "vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex),vec3(1.5));", "Lin *= mix(vec3(1.0),pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex,vec3(1.0/2.0)),clamp(pow(1.0-dot(up, sunDirection),5.0),0.0,1.0));", "//nightsky", "vec3 direction = normalize(vWorldPosition - cameraPos);", "float theta = acos(direction.y); // elevation --> y-axis, [-pi/2, pi/2]", "float phi = atan(direction.z, direction.x); // azimuth --> x-axis [-pi/2, pi/2]", "vec2 uv = vec2(phi, theta) / vec2(2.0*pi, pi) + vec2(0.5, 0.0);", "// vec3 L0 = texture2D(skySampler, uv).rgb+0.1 * Fex;", "vec3 L0 = vec3(0.1) * Fex;", "// composition + solar disc", "//if (cosTheta > sunAngularDiameterCos)", "float sundisk = smoothstep(sunAngularDiameterCos,sunAngularDiameterCos+0.00002,cosTheta);", "// if (normalize(vWorldPosition - cameraPos).y>0.0)", "L0 += (sunE * 19000.0 * Fex)*sundisk;", "vec3 whiteScale = 1.0/Uncharted2Tonemap(vec3(W));", "vec3 texColor = (Lin+L0);   ", "texColor *= 0.04 ;", "texColor += vec3(0.0,0.001,0.0025)*0.3;", "float g_fMaxLuminance = 1.0;", "float fLumScaled = 0.1 / luminance;     ", "float fLumCompressed = (fLumScaled * (1.0 + (fLumScaled / (g_fMaxLuminance * g_fMaxLuminance)))) / (1.0 + fLumScaled); ", "float ExposureBias = fLumCompressed;", "vec3 curr = Uncharted2Tonemap((log2(2.0/pow(luminance,4.0)))*texColor);", "vec3 color = curr*whiteScale;", "vec3 retColor = pow(color,vec3(1.0/(1.2+(1.2*sunfade))));", "gl_FragColor.rgb = retColor;", "gl_FragColor.a = 1.0;", "}"].join("\n")
            };

            THREE.Sky = function () {

                        var skyShader = THREE.ShaderLib["sky"];
                        var skyUniforms = THREE.UniformsUtils.clone(skyShader.uniforms);

                        var skyMat = new THREE.ShaderMaterial({
                                    fragmentShader: skyShader.fragmentShader,
                                    vertexShader: skyShader.vertexShader,
                                    uniforms: skyUniforms,
                                    side: THREE.BackSide
                        });

                        var skyGeo = new THREE.SphereBufferGeometry(450000, 32, 15);
                        var skyMesh = new THREE.Mesh(skyGeo, skyMat);

                        // Expose variables
                        this.mesh = skyMesh;
                        this.uniforms = skyUniforms;
            };
};

exports.loadSkyShader = loadSkyShader;

},{}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _Loop = require('../Loop');

/**
 * Each class should adhere to this pattern.
 * When a scene object has been positioned correctly and its trajectory set,
 * it should use ::join to attach itself to the scene.
 *
 * While attached, the animate method will be called on each frame.
 * Typically the animate method can run through the trajectory queue and then
 * detach itself. @see Ball
 *
 * For static meshes the animate method will do nothing, leaving the mesh permanently attached.
 */

var AbstractMesh = (function () {
    function AbstractMesh() {
        _classCallCheck(this, AbstractMesh);
    }

    /**
     * since we are using (0, 0, 0) vector for the center of the strike zone, the actual ground level will be offset
     * downward
     * @type {number}
     */

    _createClass(AbstractMesh, [{
        key: 'attach',

        /**
         * attach and detach should be used to maintain the correct object list
         * todo use the built in object list of the scene object
         */
        value: function attach() {
            var objects = this.loop.objects;
            if (objects.indexOf(this) === -1) {
                objects.push(this);
            }
            this.loop.scene.add(this.mesh);
        }
    }, {
        key: 'detach',
        value: function detach() {
            var objects = this.loop.objects;
            var index = objects.indexOf(this);
            if (index !== -1) {
                this.loop.objects.splice(index, 1);
            }
            this.loop.scene.remove(this.mesh);
        }
    }, {
        key: 'join',
        value: function join(loop) {
            this.loop = loop || this.loop;
            if (this.loop instanceof _Loop.Loop) {
                this.attach();
            }
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return AbstractMesh;
})();

AbstractMesh.WORLD_BASE_Y = -4;

exports.AbstractMesh = AbstractMesh;

},{"../Loop":9}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var _ServicesMathinator = require('../../Services/Mathinator');

var _Indicator = require('./Indicator');

var _UtilityHelper = require('../../Utility/helper');

/**
 * on the DOM the pitch zone is 200x200 pixels
 * here we scale the strike zone to 4.2 units (feet)
 * for display purposes. It is only approximately related to actual pitch zone dimensions.
 * @type {number}
 */
var SCALE = 2.1 / 100;

var INDICATOR_DEPTH = -5;

var Ball = (function (_AbstractMesh) {
    _inherits(Ball, _AbstractMesh);

    /**
     *
     * @param loop
     * @param trajectory {Array<Vector3>} incremental vectors applied each frame
     * e.g. for 1 second of flight time there should be 60 incremental vectors
     */

    function Ball(loop, trajectory) {
        _classCallCheck(this, Ball);

        _get(Object.getPrototypeOf(Ball.prototype), 'constructor', this).call(this);
        if (!(loop instanceof _Loop.Loop) && loop instanceof Array) {
            trajectory = loop;
        }
        this.hasIndicator = false;
        this.trajectory = trajectory ? trajectory : [];
        this.breakingTrajectory = [];
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
        this.setType('4-seam', 1);
        this.bounce = 1;
    }

    _createClass(Ball, [{
        key: 'getMesh',
        value: function getMesh() {
            /** @see threex.sportballs */
            var baseURL = 'public/';
            var THREE = window.THREE;
            var loader = new THREE.TextureLoader();
            var textureColor = loader.load(baseURL + 'images/BaseballColor.jpg');
            var textureBump = loader.load(baseURL + 'images/BaseballBump.jpg');
            var geometry = new THREE.SphereGeometry(0.36, 32, 16); // real scale is 0.12
            var material = new THREE.MeshPhongMaterial({
                map: textureColor,
                bumpMap: textureBump,
                bumpScale: 0.01
            });
            this.mesh = new THREE.Mesh(geometry, material);
            return this.mesh;
        }

        /**
         * Leave an indicator when crossing the home plate front plane,
         * and rotate while moving (default 1000 RPM)
         */
    }, {
        key: 'animate',
        value: function animate() {
            var frame = this.trajectory.shift(),
                pos = this.mesh.position;

            if (frame) {
                pos.x += frame.x;
                pos.y += frame.y * this.bounce;
                pos.z += frame.z;
                if (pos.y < _AbstractMesh2.AbstractMesh.WORLD_BASE_Y) {
                    this.bounce *= -1;
                }
                if (frame.x + frame.y + frame.z !== 0) {
                    this.rotate();
                }
            }
            if (pos.z > INDICATOR_DEPTH && !this.hasIndicator) {
                this.spawnIndicator();
            }
            if (!frame) {
                this.detach();
                this.loop.resetCamera();
            }
        }
    }, {
        key: 'setType',
        value: function setType(type, handednessScalar) {
            var rpm = _UtilityHelper.helper.pitchDefinitions[type][4];
            var rotationAngle = _UtilityHelper.helper.pitchDefinitions[type][3];
            this.setRotation(rpm, rotationAngle * (handednessScalar || 1));
        }
    }, {
        key: 'rotate',
        value: function rotate() {
            var rotation = this.rotation;
            var meshRotation = this.mesh.rotation;
            meshRotation.x += rotation.x;
            meshRotation.y += rotation.y;
        }
    }, {
        key: 'setRotation',
        value: function setRotation(rpm, rotationAngle) {
            this.RPM = rpm;
            this.RPS = this.RPM / 60;
            var rotationalIncrement = this.RP60thOfASecond = this.RPS / 60;

            // calculate rotational components
            // +x is CCW along x axis increasing
            // +y is CW along y axis increasing
            // +z (unused) is CW along z axis increasing

            // 0   --> x:1 y:0
            // 45  --> x:+ y:+
            // 90  --> x:0 y:1
            // 180 --> x:-1 y:0

            var xComponent = rotationalIncrement * Math.cos(rotationAngle / 180 * Math.PI);
            var yComponent = rotationalIncrement * Math.sin(rotationAngle / 180 * Math.PI);

            this.rotation = {
                x: xComponent * 360 * Math.PI / 180,
                y: yComponent * 360 * Math.PI / 180
            };
        }
    }, {
        key: 'exportPositionTo',
        value: function exportPositionTo(mesh) {
            mesh.position.x = this.mesh.position.x;
            mesh.position.y = this.mesh.position.y;
            mesh.position.z = this.mesh.position.z;
        }
    }, {
        key: 'spawnIndicator',
        value: function spawnIndicator() {
            if (this.hasIndicator) {
                return;
            }
            this.hasIndicator = true;
            var indicator = new _Indicator.Indicator();
            indicator.mesh.position.x = this.mesh.position.x;
            indicator.mesh.position.y = this.mesh.position.y;
            indicator.mesh.position.z = this.mesh.position.z;
            indicator.join(this.loop.background);
        }
    }, {
        key: 'derivePitchingTrajectory',
        value: function derivePitchingTrajectory(game) {
            this.setType(game.pitchInFlight.name, game.pitcher.throws === 'right' ? 1 : -1);
            var top = 200 - game.pitchTarget.y,
                left = game.pitchTarget.x,
                breakTop = 200 - game.pitchInFlight.y,
                breakLeft = game.pitchInFlight.x,
                flightTime = _ServicesMathinator.Mathinator.getFlightTime(game.pitchInFlight.velocity, _UtilityHelper.helper.pitchDefinitions[game.pitchInFlight.name][2]);

            var scale = SCALE;
            var origin = {
                x: game.pitcher.throws == 'left' ? 1.5 : -1.5,
                y: _AbstractMesh2.AbstractMesh.WORLD_BASE_Y + 6,
                z: -60.5 // mound distance
            };
            this.mesh.position.x = origin.x;
            this.mesh.position.y = origin.y;
            this.mesh.position.z = origin.z;

            var ARC_APPROXIMATION_Y_ADDITIVE = 38; // made up number
            var terminus = {
                x: (left - 100) * scale,
                y: (100 - top + 2 * ARC_APPROXIMATION_Y_ADDITIVE) * scale + _Loop.Loop.VERTICAL_CORRECTION,
                z: INDICATOR_DEPTH
            };
            var breakingTerminus = {
                x: (breakLeft - 100) * scale,
                y: (100 - breakTop) * scale + _Loop.Loop.VERTICAL_CORRECTION,
                z: INDICATOR_DEPTH
            };

            var lastPosition = {
                x: origin.x, y: origin.y, z: origin.z
            },
                lastBreakingPosition = {
                x: origin.x, y: origin.y, z: origin.z
            };

            var frames = [],
                breakingFrames = [],
                frameCount = flightTime * 60 | 0,
                counter = frameCount * 1.08 | 0,
                frame = 0;

            var xBreak = breakingTerminus.x - terminus.x,
                yBreak = breakingTerminus.y - terminus.y;
            var breakingDistance = Math.sqrt(Math.pow(xBreak, 2) + Math.pow(yBreak, 2));
            /**
             * @type {number} 1.0+, an expression of how late the pitch breaks
             */
            var breakingLateness = breakingDistance / (2 * ARC_APPROXIMATION_Y_ADDITIVE) / scale,
                breakingLatenessMomentumExponent = 0.2 + Math.pow(0.45, breakingLateness);

            while (counter--) {
                var progress = ++frame / frameCount;

                // linear position
                var position = {
                    x: origin.x + (terminus.x - origin.x) * progress,
                    y: origin.y + (terminus.y - origin.y) * progress,
                    z: origin.z + (terminus.z - origin.z) * progress
                };
                // linear breaking position
                var breakingInfluencePosition = {
                    x: origin.x + (breakingTerminus.x - origin.x) * progress,
                    y: origin.y + (breakingTerminus.y - origin.y) * progress,
                    z: origin.z + (breakingTerminus.z - origin.z) * progress
                };
                if (progress > 1) {
                    momentumScalar = 1 - Math.pow(progress, breakingLateness);
                } else {
                    var momentumScalar = Math.pow(1 - progress, breakingLatenessMomentumExponent);
                }
                var breakingScalar = 1 - momentumScalar,
                    scalarSum = momentumScalar + breakingScalar;
                // adjustment toward breaking ball position
                var breakingPosition = {
                    x: (position.x * momentumScalar + breakingInfluencePosition.x * breakingScalar) / scalarSum,
                    y: (position.y * momentumScalar + breakingInfluencePosition.y * breakingScalar) / scalarSum,
                    z: (position.z * momentumScalar + breakingInfluencePosition.z * breakingScalar) / scalarSum
                };
                var increment = {
                    x: position.x - lastPosition.x,
                    y: position.y - lastPosition.y,
                    z: position.z - lastPosition.z
                };
                var breakingIncrement = {
                    x: breakingPosition.x - lastBreakingPosition.x,
                    y: breakingPosition.y - lastBreakingPosition.y,
                    z: breakingPosition.z - lastBreakingPosition.z
                };

                lastPosition = position;
                lastBreakingPosition = breakingPosition;

                breakingFrames.push(breakingIncrement);
                frames.push(increment);
            }

            var pause = 60;
            while (pause--) {
                breakingFrames.push({ x: 0, y: 0, z: 0 });
                frames.push({ x: 0, y: 0, z: 0 });
            }

            this.breakingTrajectory = breakingFrames;
            this.trajectory = frames;
            return frames;
        }
    }, {
        key: 'deriveTrajectory',
        value: function deriveTrajectory(result, pitch) {
            var dragScalarApproximation = {
                distance: 1,
                apexHeight: 0.57,
                airTime: 0.96
            };

            var flyAngle = result.flyAngle,
                distance = Math.abs(result.travelDistance),
                scalar = result.travelDistance < 0 ? -1 : 1,
                flightScalar = flyAngle < 7 ? -1 : 1,
                splay = result.splay; // 0 is up the middle

            if (flightScalar < 0 && result.travelDistance > 0) {
                distance = Math.max(90, distance);
            }

            flyAngle = 1 + Math.abs(flyAngle); // todo why plus 1?
            if (flyAngle > 90) flyAngle = 180 - flyAngle;

            // velocity in m/s, I think
            var velocity = dragScalarApproximation.distance * Math.sqrt(9.81 * distance / Math.sin(2 * Math.PI * flyAngle / 180));
            var velocityVerticalComponent = Math.sin(_ServicesMathinator.Mathinator.RADIAN * flyAngle) * velocity;
            // in feet
            var apexHeight = velocityVerticalComponent * velocityVerticalComponent / (2 * 9.81) * dragScalarApproximation.apexHeight;
            // in seconds
            var airTime = 1.5 * Math.sqrt(2 * apexHeight / 9.81) * dragScalarApproximation.airTime; // 2x freefall equation

            this.airTime = airTime;

            var scale = SCALE;

            var origin = {
                x: pitch.x + result.x - 100,
                y: pitch.y + result.y - 100,
                z: 0
            };

            this.mesh.position.x = origin.x * scale;
            this.mesh.position.y = origin.y * scale;
            this.mesh.position.z = origin.z;

            var extrema = {
                x: Math.sin(splay / 180 * Math.PI) * distance,
                y: apexHeight,
                z: -Math.cos(splay / 180 * Math.PI) * distance
            };

            var frames = [],
                frameCount = airTime * 60 | 0,
                counter = frameCount,
                frame = 0;

            var lastHeight = 0;

            while (counter--) {
                var progress = ++frame / frameCount,
                    percent = progress * 100;

                // this equation is approximate
                if (flightScalar < 0) {
                    var currentDistance = progress * distance;
                    y = (origin.y * scale + apexHeight * Math.abs(Math.sin(3 * Math.pow(currentDistance, 1.1) / distance * Math.PI / 2))) * ((100 - percent) / 100) + _AbstractMesh2.AbstractMesh.WORLD_BASE_Y * progress;
                } else {
                    var y = apexHeight - Math.pow(Math.abs(50 - percent) / 50, 2) * apexHeight;
                }

                frames.push({
                    x: extrema.x / frameCount,
                    y: y - lastHeight,
                    z: extrema.z / frameCount
                });

                lastHeight = y;
            }
            this.trajectory = frames;
            return frames;
        }
    }]);

    return Ball;
})(_AbstractMesh2.AbstractMesh);

Ball.prototype.DEFAULT_RPM = 1000;
Ball.prototype.RPM = 1000;
Ball.prototype.RPS = 1000 / 60;
Ball.prototype.RP60thOfASecond = 1000 / 60 / 60;
Ball.prototype.rotation = {
    x: Ball.prototype.RP60thOfASecond * 360 * Math.PI / 180, // in radians per 60th of a second
    y: Ball.prototype.RP60thOfASecond * 360 * Math.PI / 180
};

exports.Ball = Ball;

},{"../../Services/Mathinator":29,"../../Utility/helper":37,"../Loop":9,"./AbstractMesh":11,"./Indicator":20}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var Base = (function (_AbstractMesh) {
    _inherits(Base, _AbstractMesh);

    function Base(loop, base) {
        _classCallCheck(this, Base);

        _get(Object.getPrototypeOf(Base.prototype), 'constructor', this).call(this);
        this.base = base;
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(Base, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: 0xFFFFFF
            });

            var mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.5, 8, 8, 8), material);

            mesh.rotation.x = -0 / 180 * Math.PI;
            mesh.rotation.y = 45 / 180 * Math.PI;
            mesh.rotation.z = 0 / 180 * Math.PI;

            switch (this.base) {
                case 'first':
                    mesh.position.x = 69;
                    mesh.position.z = -64;
                    break;
                case 'second':
                    mesh.position.x = 0;
                    mesh.position.z = -128;
                    break;
                case 'third':
                    mesh.position.x = -69;
                    mesh.position.z = -64;
                    break;
                case 'home':
                    mesh.position.x = 0;
                    mesh.position.z = 0;

                    mesh.rotation.y = 0;
            }
            mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y + 0.5;
            mesh.position.z -= 0;

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return Base;
})(_AbstractMesh2.AbstractMesh);

exports.Base = Base;

},{"../Loop":9,"./AbstractMesh":11}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var BaseDirt = (function (_AbstractMesh) {
    _inherits(BaseDirt, _AbstractMesh);

    function BaseDirt(loop, base) {
        _classCallCheck(this, BaseDirt);

        _get(Object.getPrototypeOf(BaseDirt.prototype), 'constructor', this).call(this);
        this.base = base;
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(BaseDirt, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: 0xDCB096
            });
            var home = this.base.base === 'home';

            var mesh = new THREE.Mesh(new THREE.CircleGeometry(home ? 18 : 12, 32), material);

            mesh.rotation.x = -90 / 180 * Math.PI;
            mesh.rotation.y = 0;
            mesh.rotation.z = 45 / 180 * Math.PI;

            var base = this.base.getMesh().position;

            mesh.position.x = base.x * 0.9;
            mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y + 0.3;
            mesh.position.z = base.z;

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return BaseDirt;
})(_AbstractMesh2.AbstractMesh);

exports.BaseDirt = BaseDirt;

},{"../Loop":9,"./AbstractMesh":11}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var BattersEye = (function (_AbstractMesh) {
    _inherits(BattersEye, _AbstractMesh);

    function BattersEye(loop) {
        _classCallCheck(this, BattersEye);

        _get(Object.getPrototypeOf(BattersEye.prototype), 'constructor', this).call(this);
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(BattersEye, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: 0x3F4045
            });

            var mesh = new THREE.Mesh(new THREE.BoxGeometry(200, 45, 4, 16, 16, 16), material);

            mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y + 0;
            mesh.position.z -= 310;

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return BattersEye;
})(_AbstractMesh2.AbstractMesh);

exports.BattersEye = BattersEye;

},{"../Loop":9,"./AbstractMesh":11}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var Field = (function (_AbstractMesh) {
    _inherits(Field, _AbstractMesh);

    function Field(loop) {
        _classCallCheck(this, Field);

        _get(Object.getPrototypeOf(Field.prototype), 'constructor', this).call(this);
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(Field, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: 0xDCB096
            });

            var mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 32, 32), material);

            mesh.rotation.x = -90 / 180 * Math.PI;
            mesh.rotation.y = 0;
            mesh.rotation.z = 45 / 180 * Math.PI;

            mesh.position.x = 0;
            mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y;
            mesh.position.z = -102;

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return Field;
})(_AbstractMesh2.AbstractMesh);

exports.Field = Field;

},{"../Loop":9,"./AbstractMesh":11}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var FoulLine = (function (_AbstractMesh) {
    _inherits(FoulLine, _AbstractMesh);

    function FoulLine(loop, side) {
        _classCallCheck(this, FoulLine);

        _get(Object.getPrototypeOf(FoulLine.prototype), 'constructor', this).call(this);
        this.side = side;
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(FoulLine, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: 0xFFFFFF
            });

            var mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 300, 1, 1), material);

            var left = this.side === 'left';

            mesh.rotation.x = -90 / 180 * Math.PI;
            mesh.rotation.y = 0 / 180 * Math.PI;

            if (left) {
                mesh.rotation.z = 45 / 180 * Math.PI;
                mesh.position.x = -108;
                mesh.position.z = -102;
            } else {
                mesh.rotation.z = -45 / 180 * Math.PI;
                mesh.position.x = 108;
                mesh.position.z = -102;
            }
            mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y + 0.35;

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return FoulLine;
})(_AbstractMesh2.AbstractMesh);

exports.FoulLine = FoulLine;

},{"../Loop":9,"./AbstractMesh":11}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var FoulPole = (function (_AbstractMesh) {
    _inherits(FoulPole, _AbstractMesh);

    function FoulPole(loop, side) {
        _classCallCheck(this, FoulPole);

        _get(Object.getPrototypeOf(FoulPole.prototype), 'constructor', this).call(this);
        this.side = side;
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(FoulPole, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: 0xE3EF6E
            });

            var mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 180, 8, 8), material);

            var left = this.side === 'left';

            if (left) {
                mesh.position.x = -218;
                mesh.position.z = -212;
            } else {
                mesh.position.x = 218;
                mesh.position.z = -212;
            }
            mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y;

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return FoulPole;
})(_AbstractMesh2.AbstractMesh);

exports.FoulPole = FoulPole;

},{"../Loop":9,"./AbstractMesh":11}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var Grass = (function (_AbstractMesh) {
    _inherits(Grass, _AbstractMesh);

    function Grass(loop, infield) {
        _classCallCheck(this, Grass);

        _get(Object.getPrototypeOf(Grass.prototype), 'constructor', this).call(this);
        this.infield = infield;
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(Grass, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: this.infield ? 0x486D1F : 0x284C19
            });

            var mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.infield ? 94 : 8000, this.infield ? 94 : 8000, 16, 16), material);

            if (this.infield) {
                mesh.rotation.x = -90 / 180 * Math.PI;
                mesh.rotation.y = 0;
                mesh.rotation.z = 45 / 180 * Math.PI;

                mesh.position.x = 0;
                mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y + 0.2;
                mesh.position.z = -62;
            } else {
                mesh.rotation.x = -90 / 180 * Math.PI;
                mesh.rotation.y = 0;
                mesh.rotation.z = 45 / 180 * Math.PI;

                mesh.position.x = 0;
                mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y - 0.2;
                mesh.position.z = -570;
            }

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return Grass;
})(_AbstractMesh2.AbstractMesh);

exports.Grass = Grass;

},{"../Loop":9,"./AbstractMesh":11}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var Indicator = (function (_AbstractMesh) {
    _inherits(Indicator, _AbstractMesh);

    function Indicator(loop) {
        _classCallCheck(this, Indicator);

        _get(Object.getPrototypeOf(Indicator.prototype), 'constructor', this).call(this);
        var n = 60;
        this.trajectory = [];
        while (n--) {
            this.trajectory.push(1);
        }
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(Indicator, [{
        key: 'getMesh',
        value: function getMesh() {
            var THREE = window.THREE;
            var geometry = new THREE.CircleGeometry(0.30, 32);
            var material = new THREE.MeshPhongMaterial({
                color: 0xFFFFFF
            });
            this.mesh = new THREE.Mesh(geometry, material);
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {
            this.trajectory.shift();

            if (!this.trajectory.length) {
                this.detach();
            }
        }
    }]);

    return Indicator;
})(_AbstractMesh2.AbstractMesh);

exports.Indicator = Indicator;

},{"../Loop":9,"./AbstractMesh":11}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var Mound = (function (_AbstractMesh) {
    _inherits(Mound, _AbstractMesh);

    function Mound(loop) {
        _classCallCheck(this, Mound);

        _get(Object.getPrototypeOf(Mound.prototype), 'constructor', this).call(this);
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(Mound, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: 0xDCB096
            });

            var mesh = new THREE.Mesh(new THREE.CircleGeometry(9), material);

            mesh.rotation.x = -90 / 180 * Math.PI;
            mesh.rotation.y = 0;
            mesh.rotation.z = 45 / 180 * Math.PI;

            mesh.position.x = 0;
            mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y + 0.9;
            mesh.position.z = -60.5;

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return Mound;
})(_AbstractMesh2.AbstractMesh);

exports.Mound = Mound;

},{"../Loop":9,"./AbstractMesh":11}],22:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var Sky = (function (_AbstractMesh) {
    _inherits(Sky, _AbstractMesh);

    function Sky(loop) {
        _classCallCheck(this, Sky);

        _get(Object.getPrototypeOf(Sky.prototype), 'constructor', this).call(this);
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(Sky, [{
        key: 'setUniforms',
        value: function setUniforms(uniforms) {
            this.uniforms = uniforms;
            var sky = this.sky;
            for (var key in uniforms) {
                if (uniforms.hasOwnProperty(key)) {
                    if (!sky.uniforms[key]) {
                        sky.uniforms[key] = uniforms[key];
                    }
                    if (typeof uniforms[key] === 'object') {
                        sky.uniforms[key].value = uniforms[key].value;
                    }
                }
            }
        }
    }, {
        key: 'getMesh',
        value: function getMesh() {
            var uniforms = this.uniforms = {
                luminance: { type: "f", value: 1.10 },
                turbidity: { type: "f", value: 1 },
                reileigh: { type: "f", value: 1.30 },
                mieCoefficient: { type: "f", value: 0.0022 },
                mieDirectionalG: { type: "f", value: 0.99 },
                sunPosition: { type: "v3", value: new THREE.Vector3() },
                inclination: 0.18, // elevation / inclination
                azimuth: 0.75,
                sun: false
            };

            var sky = new THREE.Sky();
            this.sky = sky;
            this.mesh = sky.mesh;

            this.setUniforms(uniforms);

            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return Sky;
})(_AbstractMesh2.AbstractMesh);

exports.Sky = Sky;

},{"../Loop":9,"./AbstractMesh":11}],23:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var Sun = (function (_AbstractMesh) {
    _inherits(Sun, _AbstractMesh);

    function Sun(loop) {
        _classCallCheck(this, Sun);

        _get(Object.getPrototypeOf(Sun.prototype), 'constructor', this).call(this);
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
        this.targetTime = {
            h: 0,
            m: 0
        };
        this.time = {
            h: 0,
            m: 0
        };
    }

    _createClass(Sun, [{
        key: 'setTargetTime',
        value: function setTargetTime(hours, minutes) {
            this.targetTime.h = hours;
            this.targetTime.m = minutes;
        }
    }, {
        key: 'getMesh',
        value: function getMesh() {
            var sun = new THREE.Mesh(new THREE.SphereGeometry(20000, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
            sun.position.z = -950000; // initialize away from scene
            sun.position.y = -100000;
            sun.position.x = -200000;
            sun.visible = false;

            this.mesh = sun;
            return this.mesh;
        }

        /**
         * @param sky Sky
         */
    }, {
        key: 'derivePosition',
        value: function derivePosition(sky) {
            var distance = 400000;
            var uniforms = sky.uniforms;

            var theta = Math.PI * (uniforms.inclination - 0.5);
            var phi = 2 * Math.PI * (uniforms.azimuth - 0.5);

            var mesh = this.mesh;

            mesh.position.z = distance * Math.cos(phi);
            mesh.position.y = distance * Math.sin(phi) * Math.sin(theta);
            mesh.position.x = -(distance * Math.sin(phi) * Math.cos(theta));

            mesh.visible = uniforms.sun;

            sky.uniforms.sunPosition.value.copy(mesh.position);
        }
    }, {
        key: 'animate',
        value: function animate() {
            if (this.time.h !== this.targetTime.h || this.time.m !== this.targetTime.m) {
                this.loop.addMinutes(1);
                this.time.m += 1;
                if (this.time.m >= 60) {
                    this.time.h++;
                    this.time.m -= 60;
                    this.time.h %= 24;
                }
            }
        }
    }]);

    return Sun;
})(_AbstractMesh2.AbstractMesh);

exports.Sun = Sun;

},{"../Loop":9,"./AbstractMesh":11}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _AbstractMesh2 = require('./AbstractMesh');

var _Loop = require('../Loop');

var Wall = (function (_AbstractMesh) {
    _inherits(Wall, _AbstractMesh);

    function Wall(loop, angle) {
        _classCallCheck(this, Wall);

        _get(Object.getPrototypeOf(Wall.prototype), 'constructor', this).call(this);
        this.angle = angle;
        this.getMesh();
        if (loop instanceof _Loop.Loop) {
            this.join(loop);
        }
    }

    _createClass(Wall, [{
        key: 'getMesh',
        value: function getMesh() {
            var material = new THREE.MeshLambertMaterial({
                color: 0x3F4045
            });

            var mesh = new THREE.Mesh(new THREE.BoxGeometry(120, 15, 4, 16, 16, 16), material);

            var radians = this.angle / 180 * Math.PI;
            mesh.rotation.y = -radians;

            var hypotenuse = 300;
            var distance = Math.cos(radians) * hypotenuse;
            var offset = Math.sin(radians) * hypotenuse;

            mesh.position.x += offset;
            mesh.position.y = _AbstractMesh2.AbstractMesh.WORLD_BASE_Y + 0;
            mesh.position.z -= distance;

            this.mesh = mesh;
            return this.mesh;
        }
    }, {
        key: 'animate',
        value: function animate() {}
    }]);

    return Wall;
})(_AbstractMesh2.AbstractMesh);

exports.Wall = Wall;

},{"../Loop":9,"./AbstractMesh":11}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var lighting = {
    addTo: function addTo(scene) {
        var light = new THREE.HemisphereLight(0xffffbb, 0x080820, 1.0);
        scene.add(light);
        var sun = new THREE.DirectionalLight(0xffffbb, 0.45);
        light.position.set(-1, 1, 1);
        this.light = light;
        this.sun = sun;
        scene.add(sun);
    },
    setLuminosity: function setLuminosity(level) {
        this.light.intensity = level;
        this.sun.intensity = level / 2;
    }
};

exports.lighting = lighting;

},{}],26:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _services_services = require('../services/_services');

var _RenderLoop = require('../Render/Loop');

var _UtilityHelper = require('../Utility/helper');

var Animator = function Animator() {
    this.init();
    throw new Error('No need to instantiate Animator');
};
Animator.TweenMax = {};
Animator.prototype = {
    identifier: 'Animator',
    constructor: Animator,
    /**
     * console mode disables most animator functions
     */
    console: false,
    TweenMax: {},
    THREE: {},
    /**
     * anything other than webgl will use TweenMax for JS animations
     */
    renderingMode: 'webgl',
    init: function init() {
        if (Animator.console) return;
        if (!this.loop && this.renderingMode === 'webgl') {
            this.beginRender();
        }
    },
    /**
     * @returns {Loop}
     */
    beginRender: function beginRender() {
        this.background = new _RenderLoop.Loop('webgl-bg-container', true);
        this.loop = new _RenderLoop.Loop('webgl-container');

        this.loop.background = this.background;
        this.background.foreground = this.loop;

        return this.loop;
    },
    /**
     * @param level {Number} 0 to 1
     */
    setLuminosity: function setLuminosity(level) {
        if (this.console) return;
        this.loop.lighting.setLuminosity(level);
        this.background.lighting.setLuminosity(level);
    },
    loadTweenMax: function loadTweenMax() {
        if (this.console || typeof window !== 'object') {
            Animator.TweenMax = {
                'set': function set() {},
                'to': function to() {},
                'from': function from() {},
                killAll: function killAll() {}
            };
        } else {
            Animator.TweenMax = window.TweenMax;
        }
        return Animator.TweenMax;
    },
    TIME_FROM_SET: 2300, //ms
    TIME_FROM_WINDUP: 3600, //ms
    HOLD_UP_ALLOWANCE: 0.25, // seconds
    pitchTarget: null,
    pitchBreak: null,
    /**
     * this is called with $scope context binding
     * @param callback
     */
    updateFlightPath: function updateFlightPath(callback) {
        if (Animator.console) return;

        if (Animator.renderingMode === 'webgl') {
            return Animator.renderFlightPath(callback, this);
        }
        return Animator.tweenFlightPath(callback, this);
    },
    /**
     * @param callback
     * @param $scope
     * animates the pitch's flight path
     */
    tweenFlightPath: function tweenFlightPath(callback, $scope) {
        var TweenMax = Animator.loadTweenMax();
        TweenMax.killAll();
        var game = $scope.y,
            top = 200 - game.pitchTarget.y,
            left = game.pitchTarget.x,
            breakTop = 200 - game.pitchInFlight.y,
            breakLeft = game.pitchInFlight.x,
            $baseballs = $('.baseball'),
            flightSpeed = 1.3 - 0.6 * (game.pitchInFlight.velocity + 300) / 400,
            originTop = 50,
            originLeft = 110 + (game.pitcher.throws == 'left' ? 20 : -20);
        var pitch = this.pitchTarget = $('.main-area .target .baseball.pitch'),
            henka = this.pitchBreak = $('.main-area .target .baseball.break'),
            quarter = flightSpeed / 4;

        var pitchTransition = _services_services.Mathinator.pitchTransition(top, left, originTop, originLeft, quarter, 12, 4),
            targetTransition = _services_services.Mathinator.pitchTransition(top, left, originTop, originLeft, quarter, 10, 3);

        var transitions = [pitchTransition(0, 0), pitchTransition(10, 0), pitchTransition(30, 1), pitchTransition(50, 2), targetTransition(100, 3), pitchTransition(100, 3, breakTop, breakLeft)];

        TweenMax.set([pitch, henka], transitions[0]);
        TweenMax.to([pitch, henka], quarter, transitions[1]);
        TweenMax.to([pitch, henka], quarter, transitions[2]);
        TweenMax.to([pitch, henka], quarter, transitions[3]);
        TweenMax.to(pitch, quarter, transitions[4]);
        TweenMax.to(henka, quarter, transitions[5]);

        $scope.lastTimeout = setTimeout(function () {
            $scope.allowInput = true;
            if (typeof callback == 'function') {
                callback();
            }
        }, flightSpeed * 1000);

        if (!game.pitchInFlight.x) {
            $baseballs.addClass('hide');
        } else {
            if (game.humanBatting() && Math.random() * 180 > game.batter.skill.offense.eye) {
                $('.baseball.break').addClass('hide');
            } else {
                $('.baseball.break').removeClass('hide');
            }
            $('.baseball.pitch').removeClass('hide');
        }

        if (game.humanBatting() && !game.humanPitching()) {
            $scope.holdUpTimeouts.push(setTimeout(function () {
                $scope.holdUp();
            }, (flightSpeed + Animator.HOLD_UP_ALLOWANCE) * 1000));
        }
    },
    /**
     * @param callback
     * @param $scope Angular scope
     * webgl version of tweenFlightPath
     */
    renderFlightPath: function renderFlightPath(callback, $scope) {
        var TweenMax = Animator.loadTweenMax();
        TweenMax.killAll();
        var game = $scope.y,
            flightSpeed = _services_services.Mathinator.getFlightTime(game.pitchInFlight.velocity, _UtilityHelper.helper.pitchDefinitions[game.pitchInFlight.name][2]);

        if (!this.loop) {
            this.beginRender();
        }
        var ball = new this.loop.constructors.Ball();
        Animator._ball = ball;
        ball.derivePitchingTrajectory(game);
        ball.trajectory = ball.breakingTrajectory;
        ball.join(this.loop);

        $scope.lastTimeout = setTimeout(function () {
            $scope.allowInput = true;
            if (typeof callback === 'function') {
                callback();
            }
        }, flightSpeed * 1000);

        var $baseballs = $('.baseball');
        $baseballs.addClass('hide');

        if (game.humanBatting() && !game.humanPitching()) {
            $scope.holdUpTimeouts.push(setTimeout(function () {
                $scope.holdUp();
            }, (flightSpeed + Animator.HOLD_UP_ALLOWANCE) * 1000));
        }
    },
    /**
     * @param game
     * @returns {*}
     * This only animates the flight arc of the ball in play.
     */
    animateFieldingTrajectory: function animateFieldingTrajectory(game) {
        if (Animator.console) return game.swingResult;

        if (this.renderingMode === 'webgl') {
            setTimeout(function () {
                Animator.tweenFieldingTrajectory(game, true);
            }, 50);
            return Animator.renderFieldingTrajectory(game);
        }
        return Animator.tweenFieldingTrajectory(game);
    },
    /**
     * @param game
     * @param splayOnly
     * @returns {Game.swingResult|*|swingResult|Field.game.swingResult}
     * JS/CSS animation
     */
    tweenFieldingTrajectory: function tweenFieldingTrajectory(game, splayOnly) {
        var TweenMax = Animator.loadTweenMax();
        var ball = $('.splay-indicator-ball');
        TweenMax.killAll();
        var result = game.swingResult;

        var linearApproximateDragScalar = {
            distance: 1,
            apexHeight: 0.57,
            airTime: 0.96
        };

        var angle = result.flyAngle,
            distance = Math.abs(result.travelDistance),
            scalar = result.travelDistance < 0 ? -1 : 1;

        _services_services.Mathinator.memory.bounding = angle < 0;
        angle = 1 + Math.abs(angle);
        if (angle > 90) angle = 180 - angle;

        var velocity = linearApproximateDragScalar.distance * Math.sqrt(9.81 * distance / Math.sin(2 * Math.PI * angle / 180));
        var velocityVerticalComponent = Math.sin(_services_services.Mathinator.RADIAN * angle) * velocity;
        var apexHeight = velocityVerticalComponent * velocityVerticalComponent / (2 * 9.81) * linearApproximateDragScalar.apexHeight;
        var airTime = 1.5 * Math.sqrt(2 * apexHeight / 9.81) * linearApproximateDragScalar.airTime; // 2x freefall equation

        //log('angle', angle, 'vel', velocity, 'apex', apexHeight, 'air', airTime, 'dist', result.travelDistance);
        var quarter = airTime / 4;
        var mathinator = new _services_services.Mathinator();
        var transitions = [mathinator.transitionalTrajectory(0, quarter, 0, apexHeight, scalar * distance, result.splay), mathinator.transitionalTrajectory(25, quarter, 0), mathinator.transitionalTrajectory(50, quarter, 1), mathinator.transitionalTrajectory(75, quarter, 2), mathinator.transitionalTrajectory(100, quarter, 3)];
        TweenMax.set(ball, transitions[0]);
        TweenMax.to(ball, quarter, transitions[1]);
        TweenMax.to(ball, quarter, transitions[2]);
        TweenMax.to(ball, quarter, transitions[3]);
        TweenMax.to(ball, quarter, transitions[4]);

        if (!splayOnly) {
            ball = $('.indicator.baseball.break').removeClass('hide').show();
            var time = quarter / 2;
            transitions = [mathinator.transitionalCatcherPerspectiveTrajectory(0, time, 0, apexHeight, scalar * distance, result.splay, game.pitchInFlight), mathinator.transitionalCatcherPerspectiveTrajectory(12.5, time * 0.75, 0), mathinator.transitionalCatcherPerspectiveTrajectory(25, time * 0.80, 1), mathinator.transitionalCatcherPerspectiveTrajectory(37.5, time * 0.85, 2), mathinator.transitionalCatcherPerspectiveTrajectory(50, time * 0.90, 3), mathinator.transitionalCatcherPerspectiveTrajectory(62.5, time * 0.95, 4), mathinator.transitionalCatcherPerspectiveTrajectory(75, time, 5), mathinator.transitionalCatcherPerspectiveTrajectory(87.5, time, 6), mathinator.transitionalCatcherPerspectiveTrajectory(100, time, 7)];
            TweenMax.set(ball, transitions[0]);
            TweenMax.to(ball, time, transitions[1]);
            TweenMax.to(ball, time, transitions[2]);
            TweenMax.to(ball, time, transitions[3]);
            TweenMax.to(ball, time, transitions[4]);
            TweenMax.to(ball, time, transitions[5]);
            TweenMax.to(ball, time, transitions[6]);
            TweenMax.to(ball, time, transitions[7]);
            TweenMax.to(ball, time, transitions[8]);

            setTimeout(function () {
                // hack
                $('.indicator.baseball.break').removeClass('hide').show();
            }, 50);
        }

        return game.swingResult;
    },
    /**
     * @param game
     * @returns {Game.swingResult|*|swingResult|Field.game.swingResult}
     * WebGL version of tweenFieldingTrajectory
     */
    renderFieldingTrajectory: function renderFieldingTrajectory(game) {
        if (!this.loop) {
            this.beginRender();
        }
        var result = game.swingResult;

        var ball = Animator._ball || new this.loop.constructors.Ball();
        ball.deriveTrajectory(result, game.pitchInFlight);
        ball.join(this.loop);

        if (result.thrownOut || result.caught || result.bases) {
            if (Math.random() < 0.15 && ball.airTime > 1.5 || Math.random() < 0.50 && ball.airTime > 2.5) {
                //var scale = 1;
                //if (result.splay > 0) {
                //    scale = -1;
                //}
                this.loop.setLookTarget(ball.mesh.position, 0.3);
                this.loop.setOverwatchMoveTarget(ball.mesh.position, 0.16);
            } else {
                this.loop.setLookTarget(ball.mesh.position, 0.5);
                this.loop.setMoveTarget({ x: 0, y: 6, z: _RenderLoop.Loop.INITIAL_CAMERA_DISTANCE }, 0.05);
            }
        } else if (Math.abs(result.splay) < 60) {
            this.loop.setLookTarget(ball.mesh.position, 0.5);
            this.loop.setMoveTarget({ x: 0, y: 6, z: _RenderLoop.Loop.INITIAL_CAMERA_DISTANCE }, 0.05);
        }

        return game.swingResult;
    }
};

for (var fn in Animator.prototype) {
    if (Animator.prototype.hasOwnProperty(fn)) {
        Animator[fn] = Animator.prototype[fn];
    }
}

exports.Animator = Animator;

},{"../Render/Loop":9,"../Utility/helper":37,"../services/_services":41}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _UtilityHelper = require('../Utility/helper');

var pitchDefinitions = _UtilityHelper.helper.pitchDefinitions;

/**
 * For Probability!
 * @constructor
 */
var Distribution = function Distribution() {};

var random = Math.random,
    min = Math.min,
    max = Math.max,
    floor = Math.floor,
    ceil = Math.ceil,
    abs = Math.abs,
    pow = Math.pow,
    sqrt = Math.sqrt;

Distribution.prototype = {
    identifier: 'Distribution',
    constructor: Distribution,
    /**
     * @param scale {number}
     * @returns {number}
     */
    chance: function chance(scale) {
        if (!scale) scale = 1;
        return random() * scale;
    },
    /**
     * @param fielder {Player}
     * @returns {boolean}
     */
    error: function error(fielder) {
        return (100 - fielder.skill.defense.fielding) * 0.1 + 3.25 > random() * 100;
    },
    /**
     * @param power
     * @param flyAngle
     * @param x {number} batting offset horizontal
     * @param y {number} batting offset vertical
     * @returns {number}
     */
    landingDistance: function landingDistance(power, flyAngle, x, y) {
        x = min(5, abs(x) | 0);
        y = min(5, abs(y) | 0);
        var goodContactBonus = 8 - sqrt(x * x + y * y);

        var scalar = pow(random(), 1 - goodContactBonus * 0.125);

        return (10 + scalar * 320 + power / 300 + random() * power / 75 * 150) * (1 - abs(flyAngle - 30) / 60);
    },
    /**
     * @param count {{strikes: number, balls: number}}
     * @returns {{x: number, y: number}}
     */
    pitchLocation: function pitchLocation(count) {
        var x, y;
        if (random() < 0.5) {
            x = 50 + floor(random() * 90) - floor(random() * 30);
        } else {
            x = 150 + floor(random() * 30) - floor(random() * 90);
        }
        y = 30 + (170 - floor(sqrt(random() * 28900)));

        var sum = count.strikes + count.balls + 3;

        x = ((3 + count.strikes) * x + count.balls * 100) / sum;
        y = ((3 + count.strikes) * y + count.balls * 100) / sum;

        return { x: x, y: y };
    },
    /**
     * swing centering basis
     * @returns {number}
     */
    centralizedNumber: function centralizedNumber() {
        return 100 + floor(random() * 15) - floor(random() * 15);
    },
    /**
     * @param eye {Player.skill.offense.eye}
     * @param x
     * @param y
     * @param umpire {Umpire}
     */
    swingLikelihood: function swingLikelihood(eye, x, y, umpire) {
        var swingLikelihood = (200 - abs(100 - x) - abs(100 - y)) / 2;
        if (x < 60 || x > 140 || y < 50 || y > 150) {
            // ball
            /** 138 based on avg O-Swing of 30% + 8% for fun, decreased by better eye */
            swingLikelihood = (swingLikelihood + 138 - eye) / 2 - 15 * umpire.count.balls;
        } else {
            /** avg Swing rate of 65% - 8% for laughs, increased by better eye */
            swingLikelihood = (57 + (2 * swingLikelihood + eye) / 3) / 2;
        }
        // higher late in the count
        return swingLikelihood - 35 + 2 * (umpire.count.balls + 8 * umpire.count.strikes);
    },
    /**
     * @param target {number} 0-200
     * @param control {number} 0-100
     * @returns {number}
     */
    pitchControl: function pitchControl(target, control) {
        var effect = (50 - random() * 100) / (1 + control / 100);
        return min(199.9, max(0.1, target + effect));
    },
    /**
     * @param pitch {Game.pitchInFlight}
     * @param pitcher {Player}
     * @param x {number}
     * @param y {number}
     * @returns {object|{x: number, y: number}}
     * 0.5 to 1.5 of the pitch's nominal breaking effect X
     * 0.5 to 1.5 of the pitch's nominal breaking effect Y, magnified for lower Y
     */
    breakEffect: function breakEffect(pitch, pitcher, x, y) {
        var effect = {};
        effect.x = floor(x + pitch.breakDirection[0] * (0.50 + 0.5 * random() + pitcher.pitching[pitch.name]['break'] / 200));
        effect.y = floor(y + pitch.breakDirection[1] * ((0.50 + 0.5 * random() + pitcher.pitching[pitch.name]['break'] / 200) / (0.5 + y / 200)));
        return effect;
    },
    /**
     * Determine the swing target along an axis
     * @param target {number} 0-200
     * @param actual {number} 0-200
     * @param eye {number} 0-100
     * @returns {number} 0-200
     */
    cpuSwing: function cpuSwing(target, actual, eye) {
        eye = min(eye, 100); // higher eye would overcompensate here
        return 100 + (target - 100) * (0.5 + random() * eye / 200) - actual;
    },
    /**
     * Determine the swing scalar
     * @param eye {number} 0-100
     * @returns {number}
     */
    swing: function swing(eye) {
        return 100 / (eye + 25 + random() * 50);
    },
    /**
     * @param pitch {Object} game.pitchInFlight
     * @param catcher {Player}
     * @param thief {Player}
     * @param base {Number} 1,2,3,4
     * @param volitional {boolean} whether the runner decided to steal
     * @returns {boolean}
     */
    stealSuccess: function stealSuccess(pitch, catcher, thief, base, volitional) {
        var rand = random(),
            rand2 = random();

        if (base == 4) {
            rand = rand / 100;
        }

        var smoothedRand2 = (1 + rand2) / 2;

        var pitchBaseSpeedMultiplier = (pitchDefinitions[pitch.name] || ['', '', 0.6])[2];

        return ((volitional | 0) * 35 + thief.skill.offense.eye + (base * -25 + 45)) * rand + 10 + thief.skill.offense.speed * 2 - thief.fatigue > pitchBaseSpeedMultiplier * pitch.velocity * smoothedRand2 + (catcher.skill.defense.catching + catcher.skill.defense.throwing) * rand2;
    },
    /**
     * @param pitch {Object} game.pitchInFlight
     * @param catcher {Player}
     * @param thief {Player}
     * @param base {Number} 1,2,3,4
     * @returns {boolean}
     */
    willSteal: function willSteal(pitch, catcher, thief, base) {
        if (base == 4) return false;
        return random() < 0.15 && this.stealSuccess(pitch, catcher, thief, base, false) && random() < 0.5;
    }
};

for (var fn in Distribution.prototype) {
    if (Distribution.prototype.hasOwnProperty(fn)) {
        Distribution[fn] = Distribution.prototype[fn];
    }
}

Distribution.main = function () {
    var ump = {
        count: {
            balls: 0,
            strikes: 0
        }
    };
    while (ump.count.balls < 4) {
        while (ump.count.strikes < 3) {
            console.log('S', ump.count.strikes, 'B', ump.count.balls);
            console.log('middle', [15, 35, 55, 75, 95].map(function (x) {
                return Distribution.swingLikelihood(x, 100, 100, ump) | 0;
            }));
            console.log('corner', [15, 35, 55, 75, 95].map(function (x) {
                return Distribution.swingLikelihood(x, 50, 50, ump) | 0;
            }));
            console.log('ball', [15, 35, 55, 75, 95].map(function (x) {
                return Distribution.swingLikelihood(x, 15, 15, ump) | 0;
            }));
            ump.count.strikes++;
        }
        ump.count.balls++;
        ump.count.strikes = 0;
    }
};

exports.Distribution = Distribution;

},{"../Utility/helper":37}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var Iterator = function Iterator() {};

Iterator.prototype = {
    identifier: 'Iterator',
    constructor: Iterator,
    each: function each(collection, map) {
        var keys, i;
        if (collection instanceof Array) {
            for (i = 0; i < collection.length; i++) {
                map(i, collection[i]);
            }
        } else {
            keys = Object.keys(collection);
            for (i = 0; i < keys.length; i++) {
                map(keys[i], collection[keys[i]]);
            }
        }
    }
};

for (var fn in Iterator.prototype) {
    if (Iterator.prototype.hasOwnProperty(fn)) {
        Iterator[fn] = Iterator.prototype[fn];
    }
}

exports.Iterator = Iterator;

},{}],29:[function(require,module,exports){
/**
 * For Math!
 * @constructor
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var Mathinator = function Mathinator() {};

/**
 * @param n
 * @returns {number}
 */
Mathinator.square = function (n) {
    return n * n;
};

Mathinator.prototype = {
    identifier: 'Mathinator',
    constructor: Mathinator,
    /**
     * CONST
     */
    RADIAN: Math.PI / 180,
    SPLAY_INDICATOR_LEFT: -4,
    /**
     * @param offset {{x: number, y: number}}
     * @param angle {number}
     * @returns {{x: number, y: number}}
     */
    getAngularOffset: function getAngularOffset(offset, angle) {
        var xScalar = offset.x < 0 ? -1 : 1,
            yScalar = offset.y < 0 ? -1 : 1;
        var originalAngle = Math.atan(offset.x / offset.y) / this.RADIAN;
        var distance = Math.sqrt(offset.x * offset.x + offset.y * offset.y),
            angledY = yScalar * Math.cos((angle - originalAngle) * this.RADIAN) * distance,
            angledX = xScalar * Math.sqrt(distance * distance - angledY * angledY);
        return {
            x: angledX,
            y: angledY
        };
    },
    /**
     * @param a {Array<Number>}
     * @param b {Array<Number>}
     * @returns {number}
     */
    getPolarDistance: function getPolarDistance(a, b) {
        var radians = this.RADIAN;
        return Math.sqrt(a[1] * a[1] + b[1] * b[1] - 2 * a[1] * b[1] * Math.cos(a[0] * radians - b[0] * radians));
    },
    /**
     * @param origin
     * @param target
     * @returns {number}
     * 0 is flat (left-right), positive is clockwise.
     * We use 125 instead of 180 to account for natural hand-height adjustments
     * of various swing heights.
     */
    battingAngle: function battingAngle(origin, target) {
        return Math.atan((origin.y - target.y) / (target.x - origin.x)) / Math.PI * 125;
    },
    memory: {},
    /**
     * @param percent {number} 0-100
     * @param quarter {number} seconds
     * @param step {number} 0 and up
     * @param [givenApexHeight] feet
     * @param [givenDistance] in feet
     * @param [givenSplayAngle] where 0 is up the middle and 90 is right foul
     * @returns {{bottom: number, left: number, padding: number, borderWidth: number, delay: number, ease: (r.easeOut|*)}}
     */
    transitionalTrajectory: function transitionalTrajectory(percent, quarter, step, givenApexHeight, givenDistance, givenSplayAngle) {
        if (givenApexHeight) Mathinator.prototype.memory.apexHeight = givenApexHeight;
        if (givenDistance) Mathinator.prototype.memory.distance = givenDistance;
        if (givenSplayAngle) Mathinator.prototype.memory.splay = givenSplayAngle;
        var apexHeight = Mathinator.prototype.memory.apexHeight,
            distance = Mathinator.prototype.memory.distance,
            splay = Mathinator.prototype.memory.splay;
        var bottom, left, padding, borderWidth;
        var bounding = Mathinator.prototype.memory.bounding,
            radian = this.RADIAN;

        if (bounding) {
            quarter *= 4;
            percent = Math.floor(Math.sqrt(percent / 100) * 100);
        }

        bottom = Math.cos(splay * radian) * percent / 100 * distance * 95 / 300;
        left = Math.sin(splay * radian) * percent / 100 * distance * 95 / 300 + this.SPLAY_INDICATOR_LEFT;

        var apexRatio = Math.sqrt((50 - Math.abs(percent - 50)) / 100) * (1 / 0.7071);
        if (bounding) {
            padding = 1;
            borderWidth = 1;
        } else {
            padding = apexRatio * apexHeight / 90 * 15;
            borderWidth = 2 + apexRatio * 2;
        }
        bottom = Math.max(Math.min(bottom, 400), -20);
        left = Math.max(Math.min(left, 100), -100);
        padding = Math.max(Math.min(padding, 12), 0);
        return {
            bottom: bottom,
            left: left,
            padding: padding,
            borderWidth: borderWidth,
            delay: quarter * step,
            ease: bounding ? Power4.easeOut : Linear.easeNone
        };
    },
    /**
     * @param percent {number} 0-100
     * @param quarter {number} seconds
     * @param step {number} 0 and up
     * @param [givenApexHeight] feet
     * @param [givenDistance] in feet
     * @param [givenSplayAngle] where 0 is up the middle and 90 is right foul
     * @param [givenOrigin] Object with x, y -- pitchInFlight
     * @returns {{top: number, left: number, padding: number, borderWidth: number, delay: number, ease: (r.easeOut|*)}}
     */
    transitionalCatcherPerspectiveTrajectory: function transitionalCatcherPerspectiveTrajectory(percent, quarter, step, givenApexHeight, givenDistance, givenSplayAngle, givenOrigin) {
        var memory = Mathinator.prototype.memory;
        if (givenApexHeight) memory.apexHeight = givenApexHeight;
        if (givenDistance) memory.distance = givenDistance;
        if (givenSplayAngle) memory.splay = givenSplayAngle;
        if (givenOrigin) memory.origin = givenOrigin;
        var apexHeight = memory.apexHeight,
            distance = memory.distance,
            splay = memory.splay,
            origin = memory.origin;
        var top, left, padding, borderWidth;
        var bounding = Mathinator.prototype.memory.bounding,
            radian = this.RADIAN;

        if (bounding) {
            percent = Math.floor(Math.sqrt(percent / 100) * 100);
        }

        var height = apexHeight - Math.pow(Math.abs(50 - percent) / 50, 1.2) * apexHeight,
            currentDistance = distance * percent / 100;

        var projection = Math.pow((500 - currentDistance) / 500, 2); // reduction of dimensions due to distance

        top = 200 - origin.y - height * 20 * projection + percent / 100 * (origin.y - 85) * projection;
        left = origin.x + Math.sin(splay * radian) * (currentDistance * 8) * projection;
        padding = 12 * projection * projection;
        borderWidth = Math.max(Math.min(padding / 3, 4), 0);

        top = Math.max(Math.min(top, 500), -10000);
        left = Math.max(Math.min(left, 10000), -10000);
        padding = Math.max(Math.min(padding, 24), 1);

        //console.log('height', height|0, apexHeight|0, projection, 'left/pad/border', left|0, padding|0, borderWidth|0, 'top', top);

        return {
            top: top,
            left: left,
            padding: padding,
            borderWidth: borderWidth,
            delay: quarter * step,
            ease: bounding ? Power4.easeOut : Linear.easeNone
        };
    },
    /**
     * @param swingResult
     * @returns {Game.swingResult}
     */
    translateSwingResultToStylePosition: function translateSwingResultToStylePosition(swingResult) {
        // CF HR bottom: 95px, centerline: left: 190px;
        var bottom, left;

        bottom = Math.cos(swingResult.splay / 180 * Math.PI) * swingResult.travelDistance * 95 / 300;
        left = Math.sin(swingResult.splay / 180 * Math.PI) * swingResult.travelDistance * 95 / 300 + this.SPLAY_INDICATOR_LEFT;

        bottom = Math.max(Math.min(bottom, 400), -20);
        left = Math.max(Math.min(left, 100), -100);

        swingResult.bottom = bottom + 'px';
        swingResult.left = left + 'px';
        return swingResult;
    },
    /**
     * @param left {number} 0-200
     * @param top {number} 0-200
     * @param originLeft {number} 0-200
     * @param originTop {number} 0-200
     * @param quarter {number} seconds
     * @param maxPadding {number} px padding at full size
     * @param maxBorderWidth {number} px border width at full size
     * @returns {Function}
     */
    pitchTransition: function pitchTransition(top, left, originTop, originLeft, quarter, maxPadding, maxBorderWidth) {
        /**
         * @param percent {number} 0-100
         * @param step {number} 0 and up
         * @param [breakTop] {number} 0-200 override
         * @param [breakLeft] {number} 0-200 override
         * @returns {{top: number, left: number, padding: string, borderWidth: string, transform: string, delay: number, ease: *}}
         */
        return function (percent, step, breakTop, breakLeft) {
            var _top, _left;
            _top = breakTop || top;
            _left = breakLeft || left;
            _top = originTop + Mathinator.square(percent / 100) * (_top - originTop);
            if (step == 1) {
                _top -= 2;
            }
            if (step == 2) {
                _top -= 1;
            }
            _left = originLeft + Mathinator.square(percent / 100) * (_left - originLeft);
            var padding = Math.max(Mathinator.square(percent / 100) * maxPadding, 1),
                borderWidth = Math.max(Mathinator.square(percent / 100) * maxBorderWidth, 1);
            return {
                top: _top,
                left: _left,
                padding: padding + 'px',
                borderWidth: borderWidth + 'px',
                transform: 'translateZ(0)',
                delay: quarter * step,
                ease: Linear.easeNone
            };
        };
    },
    /**
     * @param distance {number} feet
     * @param throwing {number} 0-1
     * @param fielding {number} 0-1
     * @param intercept {number} approx. -140 to 140
     * @returns {number} seconds
     */
    fielderReturnDelay: function fielderReturnDelay(distance, throwing, fielding, intercept) {
        return distance / 90 // bip distance (up to 3s+)
         + 5 * (distance / 310) // worst case time to reach the ball,
         * Math.min(intercept - 120, 0) / -240 // a good intercept rating will cut the base down to 0
         + 1 - (0.2 + fielding * 0.8) // gather time (up to 0.8s)
         + distance / 90 / (0.5 + throwing / 2); // throwing distance (up to 2s)
    },
    /**
     * @param player {Player}
     * @returns {number} ~2.0
     */
    infieldThrowDelay: function infieldThrowDelay(player) {
        var fielding = player.skill.defense.fielding,
            throwing = player.skill.defense.throwing;
        return 3.5 - (fielding + throwing) / 200;
    },
    /**
     * @param speed {number} 0-100
     * @returns {number} seconds
     */
    baseRunningTime: function baseRunningTime(speed) {
        return 7.0 - speed / 100 * 4.1;
    },
    /**
     * @param x {Number} bat offset
     * @param y {Number} bat offset
     * @param angle {Number} batting angle where 0 is horizontal, RHB clockwise increasing
     * {
     *   splay: -90 to 90 where 0 is up the middle,
     *   fly: 0, flat, to 90, vertical pop up
     * }
     * @param eye {Number} 0 - 100 skill rating
     * @returns {{splay: number, fly: number}}
     */
    getSplayAndFlyAngle: function getSplayAndFlyAngle(x, y, angle, eye) {

        var splay = -1.5 * x - y * angle / 20;
        var direction = splay > 0 ? 1 : -1;
        // additional random splay
        // todo make it pull only
        splay += direction * Math.random() * 40 * (100 / (50 + eye));

        return {
            splay: splay,
            fly: -3 * y / ((Math.abs(angle) + 25) / 35) // more difficult to hit a pop fly on a angled bat
        };
    },
    /**
     * @param velocityRating {Number} 0-100
     * @param velocityScalar {Number} approx 1
     * @returns {number}
     */
    getFlightTime: function getFlightTime(velocityRating, velocityScalar) {
        return (1.3 - 0.6 * (velocityRating + 300) / 400) / velocityScalar;
    }
};

for (var fn in Mathinator.prototype) {
    if (Mathinator.prototype.hasOwnProperty(fn)) {
        Mathinator[fn] = Mathinator.prototype[fn];
    }
}

exports.Mathinator = Mathinator;

},{}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _ServicesAnimator = require('../Services/Animator');

var _ServicesDistribution = require('../Services/Distribution');

var _ServicesIterator = require('../Services/Iterator');

var _ServicesMathinator = require('../Services/Mathinator');

exports.Animator = _ServicesAnimator.Animator;
exports.Distribution = _ServicesDistribution.Distribution;
exports.Iterator = _ServicesIterator.Iterator;
exports.Mathinator = _ServicesMathinator.Mathinator;

},{"../Services/Animator":26,"../Services/Distribution":27,"../Services/Iterator":28,"../Services/Mathinator":29}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _TeamJapan = require('./TeamJapan');

var Provider = (function () {
    function Provider() {
        _classCallCheck(this, Provider);
    }

    _createClass(Provider, [{
        key: 'assignTeam',
        value: function assignTeam(game, team, side) {
            var special = this.teams[team];
            special.game = game;
            game.teams[side] = special;
        }
    }]);

    return Provider;
})();

Provider.prototype.teams = {
    TeamJapan: _TeamJapan.samurai
};

exports.Provider = Provider;

},{"./TeamJapan":32}],32:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _Model_models = require('../Model/_models');

var _ModelPlayer = require('../Model/Player');

var _TeamsTrainer = require('../Teams/Trainer');

var samurai = new _Model_models.Team('no init');
samurai.name = 'Japan';
samurai.nameJ = '日本';

var darvish = new _ModelPlayer.Player(samurai),
    johjima = new _ModelPlayer.Player(samurai),
    ogasawara = new _ModelPlayer.Player(samurai),
    nishioka = new _ModelPlayer.Player(samurai),
    kawasaki = new _ModelPlayer.Player(samurai),
    murata = new _ModelPlayer.Player(samurai),
    matsui = new _ModelPlayer.Player(samurai),
    ichiro = new _ModelPlayer.Player(samurai),
    inaba = new _ModelPlayer.Player(samurai);

var matsuzaka = new _ModelPlayer.Player(samurai),
    fukudome = new _ModelPlayer.Player(samurai),
    aoki = new _ModelPlayer.Player(samurai),
    abe = new _ModelPlayer.Player(samurai),
    iwamura = new _ModelPlayer.Player(samurai);

var coach = new _TeamsTrainer.Trainer();

coach.makePlayer(darvish, 'Yu', 'Darvish', 'ダルビッシュ', '有', 150, { eye: 80, power: 80, speed: 80 }, { catching: 50, fielding: 70, throwing: 100, speed: 80 }, 'right', 'right', 11);

coach.makePlayer(johjima, 'Kenji', 'Johjima', '城島', '健司', 60, { eye: 90, power: 108, speed: 70 }, { catching: 140, fielding: 88, throwing: 75, speed: 75 }, 'right', 'right', 2);

coach.makePlayer(ogasawara, 'Michihiro', 'Ogasawara', '小笠原', '道大', 80, { eye: 96, power: 90, speed: 90 }, { catching: 50, fielding: 96, throwing: 85, speed: 70 }, 'left', 'right', 36);

coach.makePlayer(nishioka, 'Tsuyoshi', 'Nishioka', '西岡', '剛', 80, { eye: 95, power: 75, speed: 92 }, { catching: 90, fielding: 88, throwing: 88, speed: 90 }, 'right', 'right', 7);

coach.makePlayer(kawasaki, 'Munenori', 'Kawasaki', '川崎', '宗則', 80, { eye: 95, power: 75, speed: 95 }, { catching: 90, fielding: 120, throwing: 99, speed: 100 }, 'left', 'right', 52);

coach.makePlayer(murata, 'Shuichi', 'Murata', '村田', '修一', 80, { eye: 82, power: 110, speed: 70 }, { catching: 80, fielding: 80, throwing: 90, speed: 60 }, 'right', 'right', 25);

coach.makePlayer(matsui, 'Hideki', 'Matsui', '松井', '秀樹', 75, { eye: 104, power: 120, speed: 50 }, { catching: 40, fielding: 85, throwing: 70, speed: 60 }, 'left', 'right', 55);

coach.makePlayer(ichiro, '', 'Ichiro', 'イチロー', '', 89, { eye: 115, power: 80, speed: 115 }, { catching: 80, fielding: 115, throwing: 115, speed: 115 }, 'left', 'right', 51);

coach.makePlayer(inaba, 'Atsunori', 'Inaba', '稲葉', '篤紀', 80, { eye: 92, power: 95, speed: 75 }, { catching: 50, fielding: 95, throwing: 95, speed: 75 }, 'right', 'right', 41);

samurai.bench = [darvish, johjima, ogasawara, nishioka, kawasaki, murata, matsui, ichiro, inaba];
//matsuzaka, fukudome, aoki, abe, iwamura];
samurai.manager.makeLineup();
samurai.positions = {
    pitcher: darvish,
    catcher: johjima,

    first: ogasawara,
    second: nishioka,
    short: kawasaki,
    third: murata,

    left: matsui,
    center: ichiro,
    right: inaba
};

for (var position in samurai.positions) {
    if (samurai.positions.hasOwnProperty(position)) {
        samurai.positions[position].position = position;
    }
}

samurai.lineup = [ichiro, kawasaki, inaba, matsui, ogasawara, johjima, murata, nishioka, darvish];

samurai.lineup.map(function (player, order) {
    player.order = order;
});

exports.samurai = samurai;

},{"../Model/Player":5,"../Model/_models":8,"../Teams/Trainer":33}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _ServicesIterator = require('../Services/Iterator');

var Trainer = (function () {
    function Trainer() {
        _classCallCheck(this, Trainer);
    }

    _createClass(Trainer, [{
        key: 'makePlayer',
        value: function makePlayer(player, name, surname, surnameJ, nameJ, pitching, offense, defense, bats, throws, number) {
            player.hero = true;

            if ('rights' && 0) {
                surnameJ = '代表';
                nameJ = '選手';
                name = 'TEAM';
                surname = 'JPN';
            }

            player.name = name + ' ' + surname;
            player.nameJ = surnameJ + nameJ;
            player.surname = surname;
            player.surnameJ = surnameJ;

            player.spaceName(surnameJ, nameJ);
            player.randomizeSkills(true, true);
            player.skill.offense = offense;
            player.skill.defense = defense;
            player.skill.pitching = pitching;
            player.bats = bats;
            player.throws = throws;
            player.number = number;
            _ServicesIterator.Iterator.each(player.pitching, function (key, value) {
                player.pitching[key].velocity += pitching / 5 | 0;
                player.pitching[key]['break'] += pitching / 5 | 0;
                player.pitching[key].control += pitching / 5 | 0;
            });
            player.resetStats(0);
        }
    }]);

    return Trainer;
})();

exports.Trainer = Trainer;

},{"../Services/Iterator":28}],34:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _UtilityText = require('../Utility/text');

var Log = function Log() {
    this.init();
};

Log.prototype = {
    game: 'instance of Game',
    init: function init() {
        this.stabilized = {
            pitchRecord: {
                e: ['', '', '', '', '', ''],
                n: ['', '', '', '', '', '']
            },
            shortRecord: {
                e: ['', '', '', '', '', ''],
                n: ['', '', '', '', '', '']
            }
        };
        this.pitchRecord = {
            e: [],
            n: []
        };
        this.shortRecord = {
            e: [],
            n: []
        };
        this.record = {
            e: [],
            n: []
        };
    },
    SINGLE: 'H',
    DOUBLE: '2B',
    TRIPLE: '3B',
    HOMERUN: 'HR',
    WALK: 'BB',
    GROUNDOUT: 'GO',
    FLYOUT: 'FO',
    LINEOUT: 'LO',
    RUN: 'R',
    STRIKEOUT: 'SO',
    SACRIFICE: 'SAC',
    REACHED_ON_ERROR: 'ROE',
    FIELDERS_CHOICE: 'FC',
    GIDP: '(IDP)',
    GITP: '(ITP)',
    STOLEN_BASE: 'SB',
    CAUGHT_STEALING: 'CS',
    stabilizeShortRecord: function stabilizeShortRecord() {
        var rec = this.record.e.slice(0, 6);
        this.shortRecord.e = rec;
        this.stabilized.shortRecord.e = rec.concat(['', '', '', '', '', '']).slice(0, 6);

        var rec2 = this.record.n.slice(0, 6);
        this.shortRecord.n = rec2;
        this.stabilized.shortRecord.n = rec2.concat(['', '', '', '', '', '']).slice(0, 6);
    },
    note: function note(_note, noteJ, only) {
        //todo fix don't double language when specifying param [only]
        if (only === 'e') {
            this.record.e.unshift(_note);
            this.async(function () {
                console.log(_note);
            });
        } else if (only === 'n') {
            this.record.n.unshift(noteJ);
            this.async(function () {
                console.log(noteJ);
            });
        } else {
            this.record.e.unshift(_note);
            this.record.n.unshift(noteJ);
            this.async(function () {
                if (_UtilityText.text.mode === 'n') {
                    console.log(noteJ);
                } else {
                    console.log(_note);
                }
            });
        }
        this.stabilizeShortRecord();
    },
    getBatter: function getBatter(batter) {
        var order = batter.team.nowBatting;
        order = ({
            0: (0, _UtilityText.text)(' 1st'),
            1: (0, _UtilityText.text)(' 2nd'),
            2: (0, _UtilityText.text)(' 3rd'),
            3: (0, _UtilityText.text)(' 4th'),
            4: (0, _UtilityText.text)(' 5th'),
            5: (0, _UtilityText.text)(' 6th'),
            6: (0, _UtilityText.text)(' 7th'),
            7: (0, _UtilityText.text)(' 8th'),
            8: (0, _UtilityText.text)(' 9th')
        })[order];
        var positions = this.longFormFielder();
        return (0, _UtilityText.text)('Now batting') + order + _UtilityText.text.comma() + positions[batter.position] + _UtilityText.text.comma() + batter.getUniformNumber() + _UtilityText.text.comma() + batter.getName();
    },
    noteBatter: function noteBatter(batter) {
        var m = _UtilityText.text.mode,
            record,
            recordJ;
        _UtilityText.text.mode = 'e';
        record = this.getBatter(batter);
        _UtilityText.text.mode = 'n';
        recordJ = this.getBatter(batter);
        _UtilityText.text.mode = m;
        this.note(record, recordJ);
    },
    getPitchLocationDescription: function getPitchLocationDescription(pitchInFlight, batterIsLefty) {
        var x = pitchInFlight.x,
            y = pitchInFlight.y,
            say = '';
        var noComma = false,
            noComma2 = false;
        var ball = false;
        if (!batterIsLefty) x = 200 - x;
        if (x < 50) {
            say += (0, _UtilityText.text)('way outside');
            ball = true;
        } else if (x < 70) {
            say += (0, _UtilityText.text)('outside');
        } else if (x < 100) {
            say += '';
            noComma = true;
        } else if (x < 130) {
            say += '';
            noComma = true;
        } else if (x < 150) {
            say += (0, _UtilityText.text)('inside');
        } else {
            say += (0, _UtilityText.text)('way inside');
            ball = true;
        }
        if (say != '') say += _UtilityText.text.comma();
        if (y < 35) {
            say += (0, _UtilityText.text)('way low');
            ball = true;
        } else if (y < 65) {
            say += (0, _UtilityText.text)('low');
        } else if (y < 135) {
            say += '';
            noComma2 = true;
        } else if (y < 165) {
            say += (0, _UtilityText.text)('high');
        } else {
            say += (0, _UtilityText.text)('way high');
            ball = true;
        }
        if (noComma || noComma2) {
            say = say.split(_UtilityText.text.comma()).join('');
            if (noComma && noComma2) {
                say = (0, _UtilityText.text)('down the middle');
            }
        }
        // say = (ball ? 'Ball, ' : 'Strike, ') + say;
        say = _UtilityText.text.namePitch(pitchInFlight) + _UtilityText.text.comma() + say + _UtilityText.text.stop();
        return say;
    },
    notePitch: function notePitch(pitchInFlight, batter) {
        var m = _UtilityText.text.mode,
            record,
            recordJ;
        _UtilityText.text.mode = 'e';
        record = this.getPitchLocationDescription(pitchInFlight, batter.bats == 'left');
        this.pitchRecord.e.unshift(record);
        this.stabilized.pitchRecord.e.unshift(record);
        this.stabilized.pitchRecord.e.pop();
        _UtilityText.text.mode = 'n';
        recordJ = this.getPitchLocationDescription(pitchInFlight, batter.bats == 'left');
        this.pitchRecord.n.unshift(recordJ);
        this.stabilized.pitchRecord.n.unshift(recordJ);
        this.stabilized.pitchRecord.n.pop();
        _UtilityText.text.mode = m;
    },
    broadcastCount: function broadcastCount(justOuts) {
        if (!this.game.umpire) return '';
        var count = this.game.umpire.count;
        if (this.lastOuts == 2 && count.outs == 0) {
            outs = 3 + (0, _UtilityText.text)(' outs');
        } else {
            var outs = count.outs + (count.outs == 1 ? (0, _UtilityText.text)(' out') : (0, _UtilityText.text)(' outs'));
        }
        this.lastOuts = count.outs;
        if (justOuts) {
            return outs + _UtilityText.text.stop();
        }
        return this.game.getInning() + ': ' + count.strikes + '-' + count.balls + ', ' + outs + _UtilityText.text.stop();
    },
    broadcastScore: function broadcastScore() {
        return this.game.teams.away.getName() + ' ' + this.game.tally.away.R + ', ' + this.game.teams.home.getName() + ' ' + this.game.tally.home.R + _UtilityText.text.stop();
    },
    broadcastRunners: function broadcastRunners() {
        var field = this.game.field;
        var runners = [field.first && (0, _UtilityText.text)('first') || '', field.second && (0, _UtilityText.text)('second') || '', field.third && (0, _UtilityText.text)('third') || ''].filter(function (x) {
            return x;
        });

        var runnerCount = 0;
        runners.map(function (runner) {
            if (runner) {
                runnerCount++;
            }
        });

        switch (runnerCount) {
            case 0:
                return (0, _UtilityText.text)('Bases empty') + _UtilityText.text.stop();
            case 1:
                return (0, _UtilityText.text)('Runner on') + ': ' + runners.join(_UtilityText.text.comma()) + _UtilityText.text.stop();
            default:
                return (0, _UtilityText.text)('Runners on') + ': ' + runners.join(_UtilityText.text.comma()) + _UtilityText.text.stop();
        }
    },
    getSwing: function getSwing(swingResult) {
        var result = '';
        if (swingResult.looking) {
            if (swingResult.strike) {
                result += (0, _UtilityText.text)('Strike.');
            } else {
                result += (0, _UtilityText.text)('Ball.');
            }
        } else {
            if (swingResult.contact) {
                if (swingResult.foul) {
                    result += (0, _UtilityText.text)('Fouled off.');
                } else {
                    if (swingResult.caught) {
                        result += (0, _UtilityText.text)('In play.');
                    } else {
                        if (swingResult.thrownOut) {
                            result += (0, _UtilityText.text)('In play.');
                        } else {
                            result += (0, _UtilityText.text)('In play.');
                        }
                    }
                }
            } else {
                result += (0, _UtilityText.text)('Swinging strike.');
            }
        }
        var steal = '';
        if (swingResult.stoleABase) {
            steal = this.noteStealAttempt(swingResult.stoleABase, true, swingResult.attemptedBase);
        }
        if (swingResult.caughtStealing) {
            steal = this.noteStealAttempt(swingResult.caughtStealing, false, swingResult.attemptedBase);
        }
        if (steal) {
            this.note(steal, steal, _UtilityText.text.mode);
        }
        return result + steal;
    },
    noteSwing: function noteSwing(swingResult) {
        var m = _UtilityText.text.mode,
            record,
            recordJ,
            pitchRecord = this.pitchRecord,
            stabilized = this.stabilized.pitchRecord;
        _UtilityText.text.mode = 'e';
        record = this.getSwing(swingResult);
        pitchRecord.e[0] += record;
        stabilized.e[0] += record;
        _UtilityText.text.mode = 'n';
        recordJ = this.getSwing(swingResult);
        pitchRecord.n[0] += recordJ;
        stabilized.n[0] += recordJ;
        _UtilityText.text.mode = m;
        recordJ = stabilized.n[0];
        record = stabilized.e[0];
        var giraffe = this;
        record.indexOf('Previous') !== 0 && this.async(function () {
            if (record.indexOf('In play') > -1 && record.indexOf('struck out') > -1) {
                if (_UtilityText.text.mode === 'n') {
                    console.log(recordJ);
                } else {
                    console.log(record);
                }
            } else {
                if (_UtilityText.text.mode === 'n') {
                    console.log(giraffe.broadcastCount(), recordJ);
                } else {
                    console.log(giraffe.broadcastCount(), record);
                }
            }
        });
    },
    async: function async(fn) {
        if (!this.game.console) {
            setTimeout(fn, 100);
        }
    },
    noteStealAttempt: function noteStealAttempt(thief, success, base) {
        return _UtilityText.text.space() + thief.getName() + _UtilityText.text.comma() + (success ? (0, _UtilityText.text)('stolen base') : (0, _UtilityText.text)('caught stealing')) + _UtilityText.text.space() + '(' + _UtilityText.text.baseShortName(base) + ')' + _UtilityText.text.stop();
    },
    noteSubstitution: function noteSubstitution(sub, player) {
        return this.note(_UtilityText.text.substitution(sub, player, 'e'), _UtilityText.text.substitution(sub, player, 'n'));
    },
    getPlateAppearanceResult: function getPlateAppearanceResult(game) {
        var r = game.swingResult;
        var record = '';
        var batter = game.batter.getName();
        var out = [];
        if (r.looking) {
            if (r.strike) {
                record = batter + (0, _UtilityText.text)(' struck out looking.');
            } else {
                record = batter + (0, _UtilityText.text)(' walked.');
            }
            var steal = '';
            if (r.stoleABase) {
                steal = this.noteStealAttempt(r.stoleABase, true, r.attemptedBase);
            }
            if (r.caughtStealing) {
                steal = this.noteStealAttempt(r.caughtStealing, false, r.attemptedBase);
            }
            record += steal;
        } else {
            if (r.contact) {
                var fielder = r.fielder,
                    bases = r.bases,
                    outBy;
                if (r.caught) {
                    if (r.flyAngle < 15) {
                        outBy = 'line';
                    } else {
                        if (['left', 'center', 'right'].indexOf(r.fielder) < 0) {
                            outBy = 'pop';
                        } else {
                            outBy = 'fly';
                        }
                    }
                } else {
                    if (r.foul) {
                        // not possible to end PA on foul?
                    } else {
                            if (r.error) {
                                bases = 1;
                                outBy = 'error';
                            } else {
                                if (r.thrownOut) {
                                    if (Math.random() < 0.5) {
                                        outBy = 'ground';
                                    } else {
                                        outBy = 'thrown';
                                    }
                                } else {
                                    switch (r.bases) {
                                        case 1:
                                        case 2:
                                        case 3:
                                            bases = r.bases;
                                            break;
                                        case 4:
                                            bases = 4;
                                            if (r.splay < -15) {
                                                fielder = 'left';
                                            } else if (r.splay < 15) {
                                                fielder = 'center';
                                            } else {
                                                fielder = 'right';
                                            }
                                            break;
                                    }
                                }
                                if (r.firstOut) {
                                    out = out.concat(r.additionalOuts.filter(function (runner) {
                                        return runner !== 'batter';
                                    }));
                                    out.doublePlay = r.doublePlay;
                                }
                                if (r.fieldersChoice) {
                                    out.push(r.fieldersChoice);
                                    if (r.outs == 3) {
                                        outBy = 'ground';
                                    } else {
                                        outBy = 'fieldersChoice';
                                    }
                                }
                            }
                        }
                }
                record = _UtilityText.text.contactResult(batter, fielder, bases, outBy, r.outs === 3 ? [] : r.sacrificeAdvances, out);
            } else {
                record = batter + (0, _UtilityText.text)(' struck out swinging.');
            }
        }
        return record;
    },
    notePlateAppearanceResult: function notePlateAppearanceResult(game) {
        var m = _UtilityText.text.mode,
            prevJ = (0, _UtilityText.text)('Previous: ', 'n'),
            prev = (0, _UtilityText.text)('Previous: ', 'e');

        var statement,
            record = this.record,
            pitchRecord = this.pitchRecord,
            stabilized = this.stabilized.pitchRecord;

        _UtilityText.text.mode = 'e';
        var result = this.getPlateAppearanceResult(game);
        record.e.unshift(result);
        statement = prev + result;
        pitchRecord.e = [statement];
        stabilized.e = [statement, '', '', '', '', ''];

        _UtilityText.text.mode = 'n';
        var resultJ = this.getPlateAppearanceResult(game);
        record.n.unshift(resultJ);
        statement = prevJ + resultJ;
        pitchRecord.n = [statement];
        stabilized.n = [statement, '', '', '', '', ''];

        _UtilityText.text.mode = m;
        var giraffe = this;
        this.async(function () {
            if (_UtilityText.text.mode === 'n') {
                console.log(['%c' + resultJ, giraffe.broadcastCount(true), giraffe.broadcastScore(), giraffe.broadcastRunners()].join(' '), 'color: darkgreen;');
            } else {
                console.log(['%c' + result, giraffe.broadcastCount(true), giraffe.broadcastScore(), giraffe.broadcastRunners()].join(' '), 'color: darkgreen;');
            }
        });
    },
    pointer: 0,
    stabilized: {
        pitchRecord: {
            e: ['', '', '', '', '', ''],
            n: ['', '', '', '', '', '']
        },
        shortRecord: {
            e: ['', '', '', '', '', ''],
            n: ['', '', '', '', '', '']
        }
    },
    pitchRecord: {
        e: [],
        n: []
    },
    shortRecord: {
        e: [],
        n: []
    },
    record: {
        e: [],
        n: []
    },
    longFormFielder: function longFormFielder() {
        return {
            first: (0, _UtilityText.text)('first baseman'),
            second: (0, _UtilityText.text)('second baseman'),
            third: (0, _UtilityText.text)('third baseman'),
            short: (0, _UtilityText.text)('shortstop'),
            pitcher: (0, _UtilityText.text)('pitcher'),
            catcher: (0, _UtilityText.text)('catcher'),
            left: (0, _UtilityText.text)('left fielder'),
            center: (0, _UtilityText.text)('center fielder'),
            right: (0, _UtilityText.text)('right fielder')
        };
    }
};

exports.Log = Log;

},{"../Utility/text":38}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _UtilityData = require('../Utility/data');

var _UtilityHelper = require('../Utility/helper');

var _UtilityLog = require('../Utility/Log');

var _UtilityText = require('../Utility/text');

exports.data = _UtilityData.data;
exports.helper = _UtilityHelper.helper;
exports.Log = _UtilityLog.Log;
exports.text = _UtilityText.text;

},{"../Utility/Log":34,"../Utility/data":36,"../Utility/helper":37,"../Utility/text":38}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var data = {
    surnames: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Yamamoto', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Shimizu', 'Hayashi', 'Saito', 'Saito', 'Yamazaki', 'Nakajima', 'Mori', 'Abe', 'Ikeda', 'Hashimoto', 'Ishikawa', 'Yamashita', 'Ogawa', 'Ishii', 'Hasegawa', 'Goto', 'Okada', 'Kondo', 'Maeda', 'Fujita', 'Endo', 'Aoki', 'Sakamoto', 'Murakami', 'Ota', 'Kaneko', 'Fujii', 'Fukuda', 'Nishimura', 'Miura', 'Takeuchi', 'Nakagawa', 'Okamoto', 'Matsuda', 'Harada', 'Nakano'],
    surnamesJ: ['佐藤', '鈴木', '高橋', '田中', '渡辺', '伊藤', '中村', '小林', '山本', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '清水', '林', '斉藤', '斎藤', '山崎', '中島', '森', '阿部', '池田', '橋本', '石川', '山下', '小川', '石井', '長谷川', '後藤', '岡田', '近藤', '前田', '藤田', '遠藤', '青木', '坂本', '村上', '太田', '金子', '藤井', '福田', '西村', '三浦', '竹内', '中川', '岡本', '松田', '原田', '中野'],

    namesJ: ['匠', 'ヒカル', 'ゆうき', '翔太', '冬馬', '漣', '港区', 'ルイ', '樹', '賢治', '五木', '春', '光一', '宗介', 'こうすけ', '雄太', '大樹', '瑛太',
    // newer set
    '宏', '亨', '道夫', '聡', '昭', '茂雄', '勝', '純一', '和夫', '勲', '省三', '隆', '達夫', '正一', '輝夫', '俊夫', '史郎', '勇', '義弘', '良雄', '登', '義明', '正義', '秀夫', '肇', '月', '克己', '正男', '光男', '久', '耕三', '清', '次郎', '正博', '明子', '武', '勉', '晴夫', '裕二', '稔', '障子', '和子', '敦', '茂', '信夫', '恵一', '忠', '高尾', '薫', 'ケン', '健治', '哲夫', '啓二', '光一', '真一', '貞夫', '靖', '武', '雄', '文雄', '久雄', '一朗', '健一', '正明', '五郎', '誠', '昭夫', '誠司', '洋一', '康夫', '誠一', '正美', '則夫', '幸雄', '忠雄', '仁', 'シンジ', '豊', '邦雄', '修', '雅之', '三郎', '英治', '浩二', '栄一', '恒夫', '義郎', '進', '博之', '巌'],
    names: ['Takumi', 'Hikaru', 'Yuuki', 'Shouta', 'Touma', 'Ren', 'Minato', 'Rui', 'Tatsuki', 'Kenji', 'Itsuki', 'Haru', 'Kouichi', 'Sousuke', 'Kousuke', 'Yuuta', 'Daiki', 'Eita',
    // newer set
    'Hiroshi', 'Toru', 'Michio', 'Satoshi', 'Akira', 'Shigeo', 'Masaru', 'Junichi', 'Kazuo', 'Isao', 'Shozo', 'Takashi', 'Tatsuo', 'Shoichi', 'Teruo', 'Toshio', 'Shiro', 'Isamu', 'Yoshihiro', 'Yoshio', 'Noboru', 'Yoshiaki', 'Tadayoshi', 'Hideo', 'Hajime', 'Akari', 'Katsumi', 'Masao', 'Mitsuo', 'Hisashi', 'Kozo', 'Kiyoshi', 'Jiro', 'Masahiro', 'Akiko', 'Takeshi', 'Tsutomu', 'Haruo', 'Yuji', 'Minoru', 'Shoji', 'Kazuko', 'Atsushi', 'Shigeru', 'Shinobu', 'Keiichi', 'Tadashi', 'Takao', 'Kaoru', 'Ken', 'Kenji', 'Tetsuo', 'Keiji', 'Koichi', 'Shinichi', 'Sadao', 'Yasushi', 'Takeshi', 'Yu', 'Fumio', 'Hisao', 'Ichiro', 'Kenichi', 'Masaaki', 'Goro', 'Makoto', 'Akio', 'Seiji', 'Yoichi', 'Yasuo', 'Seiichi', 'Masami', 'Norio', 'Yukio', 'Tadao', 'Hitoshi', 'Shinji', 'Yutaka', 'Kunio', 'Osamu', 'Masayuki', 'Saburo', 'Eiji', 'Koji', 'Eiichi', 'Tsuneo', 'Yoshio', 'Susumu', 'Hiroyuki', 'Iwao'],
    teamNamesJ: ['横浜', '大阪', '名古屋', '札幌', '神戸', '京都', '福岡', '川崎', '埼玉県', '広島', '仙台', '千葉県', '新潟', '浜松', '静岡', '相模原', '岡山', '熊本', '鹿児島', '船橋', '川口', '姫路', '松山', '宇都宮', '松戸', '西宮', '倉敷', '市川', '福山', '尼崎', '金沢', '長崎', '横須賀', '富山', '高松', '町田', '岐阜', '枚方', '藤沢', '柏', '豊中', '長野県', '豊橋', '一宮', '和歌山', '岡崎', '宮崎', '奈良', '吹田', '高槻', '旭川', 'いわき', '高崎', '所沢', '川越', '秋田', '越谷', '前橋', '那覇', '四日市', '青森', '久留米', '春日井', '盛岡', '明石', '福島', '下関', '長岡', '市原', '函館', '茨城県', '福井', '加古川', '徳島', '水戸', '平塚', '佐世保', '呉', '八戸', '佐賀', '寝屋川', '富士', '春日部', '茅ヶ崎', '松本', '厚木', '大和', '上尾', '宝塚', '筑波', '沼津', '熊谷', '伊勢崎', '岸和田', '鳥取', '小田原', '鈴鹿', '松江', '日立'],
    teamNames: ['Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 'Kobe', 'Kyoto', 'Fukuoka', 'Kawasaki', 'Saitama', 'Hiroshima', 'Sendai', 'Chiba', 'Niigata', 'Hamamatsu', 'Shizuoka', 'Sagamihara', 'Okayama', 'Kumamoto', 'Kagoshima', 'Funabashi', 'Kawaguchi', 'Himeji', 'Matsuyama', 'Utsunomiya', 'Matsudo', 'Nishinomiya', 'Kurashiki', 'Ichikawa', 'Fukuyama', 'Amagasaki', 'Kanazawa', 'Nagasaki', 'Yokosuka', 'Toyama', 'Takamatsu', 'Machida', 'Gifu', 'Hirakata', 'Fujisawa', 'Kashiwa', 'Toyonaka', 'Nagano', 'Toyohashi', 'Ichinomiya', 'Wakayama', 'Okazaki', 'Miyazaki', 'Nara', 'Suita', 'Takatsuki', 'Asahikawa', 'Iwaki', 'Takasaki', 'Tokorozawa', 'Kawagoe', 'Akita', 'Koshigaya', 'Maebashi', 'Naha', 'Yokkaichi', 'Aomori', 'Kurume', 'Kasugai', 'Morioka', 'Akashi', 'Fukushima', 'Shimonoseki', 'Nagaoka', 'Ichihara', 'Hakodate', 'Ibaraki', 'Fukui', 'Kakogawa', 'Tokushima', 'Mito', 'Hiratsuka', 'Sasebo', 'Kure', 'Hachinohe', 'Saga', 'Neyagawa', 'Fuji', 'Kasukabe', 'Chigasaki', 'Matsumoto', 'Atsugi', 'Yamato', 'Ageo', 'Takarazuka', 'Tsukuba', 'Numazu', 'Kumagaya', 'Isesaki', 'Kishiwada', 'Tottori', 'Odawara', 'Suzuka', 'Matsue', 'Hitachi']
};

exports.data = data;

},{}],37:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var helper = {
    /**
     * rotation angle from 0 to 360 where 180 is a fastball's backspin and 90 is a slider's, 0 for curveball
     * in the direction (CW for righty), CCW for lefty.
     *
     * x movement, y movement, speed ratio, rotation angle, RPM from RHP perspective where left is smaller X
     */
    pitchDefinitions: {
        // fastball, kinda
        '4-seam': [0, 0, 1, 180, 1000],
        '2-seam': [20, -20, 0.90, -45, 1200],
        'cutter': [-25, -20, 0.95, 75, 1200],
        'sinker': [15, -30, 0.95, -45, 1500],

        // breaking ball
        'slider': [-50, -35, 0.88, 80, 2000],
        'fork': [0, -70, 0.87, 20, 500],
        'curve': [0, -110, 0.82, 10, 2500],

        // change-up
        'change': [0, -10, 0.86, -15, 1000]
    },
    selectRandomPitch: function selectRandomPitch() {
        return ['4-seam', '2-seam', 'cutter', 'sinker', 'slider', 'fork', 'curve', 'change'][Math.floor(Math.random() * 8)];
    }
};

exports.helper = helper;

},{}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var text = function text(phrase, override) {
    if (!text.mode) text.mode = 'e';
    var string = ({
        n: {
            empty: '-',
            ' 1st': '1番',
            ' 2nd': '2番',
            ' 3rd': '3番',
            ' 4th': '4番',
            ' 5th': '5番',
            ' 6th': '6番',
            ' 7th': '7番',
            ' 8th': '8番',
            ' 9th': '9番',
            'Now batting': '次のバッター',
            'way outside': '相当外角',
            'outside': '外角',
            'inside': '内角',
            'way inside': '相当内角',
            'way low': '相当低め',
            'low': '低め',
            'high': '高め',
            'way high': '相当高め',
            'down the middle': '真ん中',
            'first baseman': 'ファースト',
            'second baseman': 'セカンド',
            'third baseman': 'サード',
            'shortstop': 'ショート',
            'pitcher': 'ピッチャー',
            'catcher': 'キャッチャー',
            'left fielder': 'レフト',
            'center fielder': 'センター',
            'right fielder': 'ライト',
            'Strike.': 'ストライク。',
            'Ball.': 'ボール。',
            'Fouled off.': 'ファウル。',
            'In play.': 'インプレー。',
            'Swinging strike.': '空振り。',
            ' outs': 'アウト',
            ' out': 'アウト',
            '4-seam': 'ストレート',
            '2-seam': 'シュート',
            'slider': 'スライダー',
            'fork': 'フォーク',
            'cutter': 'カット',
            'sinker': 'シンカー',
            'curve': 'カーブ',
            'change': 'チェンジ',
            ' struck out looking.': '、見逃し三振。',
            ' walked.': '、フォアボール。',
            ' struck out swinging.': '、空振り三振。',
            'Previous: ': '前：',
            'looks like: ': '予想',
            'breaking ball': '変化球',
            'fastball': 'ストレート',
            'Batting, ': '打球',
            'Catching, pitch selection': '捕球選択',
            'Season': '記録',
            'Game': '今試合',
            'Pitch': '球',
            'Control': '制球',
            'Velocity': '速度',
            'Break': '変化',
            'At Bat': 'バッター',
            'On Deck': '次バッター',
            'Eye': '目',
            'Power': '力',
            'Speed': '速',
            'Up to Bat': '打席',
            'Fielding': '守備',
            'Pitching': '投球',
            'BA': '打率',
            'OBP': '出塁',
            'SLG': '長打',
            'PA': '打席',
            'H 2B 3B HR': '安 二 三 本',
            'H': '安',
            '2B': '二',
            '3B': '三',
            'HR': '本塁打',
            'RBI': '打点',
            'R': '得点',
            'BB': '四球',
            'SO': '三振',

            'first': 'ファースト',
            'second': 'セカンド',
            'third': 'サード',
            'Runner on': 'ランナー',
            'Runners on': 'ランナー',
            'Bases empty': 'ランナーなし',
            'base': '塁',

            'stolen base': '盗塁成功',
            'caught stealing': '盗塁失敗',

            'Steal': '盗塁',
            'Opportunistic': '自由',
            'Hold': '止まれ',

            'Select Language:': '言語',
            'Run Fast Simulation': 'シミュレーションを試合終了まで行う',
            'Play Ball!': 'プレーボール',
            'Spectate the CPU': 'CPU観戦',
            'Play from the 7th': '７回からプレーする',

            'Throws/Bats': ' ',
            'LHP': '左投',
            'RHP': '右投',
            'LHB': '左打',
            'RHB': '右打',
            'L': '左投',
            'R ': '右投',
            ' L ': '左打',
            ' R ': '右打',
            '#': '背番号',

            'Opponent connected': '相手選手見参',
            'Click Here': 'ここにクリック',

            'Amateur Baseball Club': '野球愛好会',
            'Amateur Baseball Team': '愛好球団',
            'College Team': '大学球団',
            'Industrial League Team': '社会人球団',
            'Training Squad': '練習軍',
            'Team Japan': '日本代表',

            'Substituted': '交代',
            'Bench': 'ベンチ',

            'Batter Ready': '打撃準備',

            // descriptors pitching
            'Ace': 'エース',
            'Control pitcher': '技巧派',
            'Flamethrower': '速球派',
            'Breaking ball': '変化球',
            // descriptors batting
            'Genius batter': '天才',
            'Contact': 'バットコントロール',
            'Power hitter': '主砲',
            'Speedster': '足速い',
            'Inept': '不器用',
            'Weak swing': '弱い',
            'Strikes out': '三振がち',
            'Leisurely runner': '悠長',
            //'' : '',
            //'' : '',
            // descriptors fielding
            'Defensive wizard': '守備万能',
            'Glove': '好守',
            'Range': 'レンジ',
            'Strong throw': '肩強い'
        },
        //'' : '',
        //'' : '',
        e: {
            empty: '-',
            'Season': 'Season',
            Fielding: 'F%',
            Pitching: 'P',
            Eye: 'Eye',
            Power: 'Pow',
            Speed: 'Spd'
        }
    })[override ? override : text.mode][phrase];
    return string ? string : phrase;
};

text.substitution = function (sub, player, mode) {
    var originalMode = text.mode;
    mode = mode || text.mode;
    var order = ({
        0: text(' 1st', mode),
        1: text(' 2nd', mode),
        2: text(' 3rd', mode),
        3: text(' 4th', mode),
        4: text(' 5th', mode),
        5: text(' 6th', mode),
        6: text(' 7th', mode),
        7: text(' 8th', mode),
        8: text(' 9th', mode)
    })[player.order];
    var position = text.fielderShortName(player.position, mode);

    if (mode === 'n') {
        text.mode = 'n';
        var output = sub.getName() + text.comma() + player.getName() + 'の交代' + text.comma() + order + '(' + position + ')';
    } else {
        text.mode = 'e';
        output = sub.getName() + ' replaces ' + player.getName() + ' at ' + position + ', batting' + order;
    }
    text.mode = originalMode;
    return output;
};

text.getBattersEye = function (game) {
    var eye = {},
        breaking = Math.abs(game.pitchInFlight.breakDirection[0]) + Math.abs(game.pitchInFlight.breakDirection[1]) > 40;
    eye.e = text('looks like: ', 'e') + breaking ? text('breaking ball', 'e') : text('fastball', 'e');
    eye.n = text('looks like: ', 'n') + breaking ? text('breaking ball', 'n') : text('fastball', 'n');
    return eye;
};

text.baseShortName = function (base) {
    if (text.mode == 'n') {
        return ({
            '1st': '一',
            '2nd': '二',
            '3rd': '三',
            'home': '本',
            'Home': '本',

            'left': '左',
            'center': '中',
            'right': '右'
        })[base];
    }
    return base;
};

text.fielderShortName = function (fielder, override) {
    var mode = override || text.mode;
    if (mode === 'n') {
        return ({
            'first': '一',
            'second': '二',
            'third': '三',
            'short': '遊',
            'pitcher': '投',
            'catcher': '捕',
            'left': '左',
            'center': '中',
            'right': '右'
        })[fielder];
    }
    return fielder;
};

text.slash = function () {
    if (text.mode == 'n') {
        return '・';
    }
    return '/';
};

text.fielderLongName = function (fielder) {
    if (text.mode == 'n') {
        return ({
            'first': 'ファースト',
            'second': 'セカンド',
            'third': 'サード',
            'short': 'ショート',
            'pitcher': 'ピッチャー',
            'catcher': 'キャッチャー',
            'left': 'レフト',
            'center': 'センター',
            'right': 'ライト'
        })[fielder];
    }
    return ({
        first: text('first baseman'),
        second: text('second baseman'),
        third: text('third baseman'),
        short: text('shortstop'),
        pitcher: text('pitcher'),
        catcher: text('catcher'),
        left: text('left fielder'),
        center: text('center fielder'),
        right: text('right fielder')
    })[fielder];
};

text.comma = function () {
    return ({ n: '、', e: ', ' })[text.mode];
};
text.space = function () {
    return ({ n: '', e: ' ' })[text.mode];
};
text.stop = function () {
    return ({ n: '。', e: '. ' })[text.mode];
};

text.namePitch = function (pitch) {
    if (text.mode == 'e') {
        return pitch.name.charAt(0).toUpperCase() + pitch.name.slice(1);
    }
    if (text.mode == 'n') {
        return text(pitch.name);
    }
};

text.contactResult = function (batter, fielder, bases, outBy, sacrificeAdvances, out) {
    var statement = '';
    var infield = ['left', 'center', 'right'].indexOf(fielder) < 0;
    var doublePlay = out.doublePlay;
    if (text.mode == 'e') {
        statement += batter;
        if (outBy) {
            switch (outBy) {
                case 'fieldersChoice':
                    play = out.length === 2 ? 'double play ' : '';
                    statement += ' reached on a fielder\'s choice ' + play + 'by ' + text.fielderShortName(fielder);
                    break;
                case 'line':
                    statement += ' lined out to ' + text.fielderShortName(fielder);
                    break;
                case 'fly':
                    statement += ' flew out to ' + text.fielderShortName(fielder);
                    break;
                case 'error':
                    statement += ' reached on error by ' + text.fielderShortName(fielder);
                    break;
                case 'pop':
                    statement += ' popped out to ' + text.fielderShortName(fielder);
                    break;
                case 'ground':
                    var play = doublePlay ? 'into a double play by' : 'out to';
                    statement += ' grounded ' + play + ' ' + text.fielderShortName(fielder);
                    break;
                case 'thrown':
                    play = doublePlay ? ' on a double play' : '';
                    statement += ' was thrown out by ' + text.fielderShortName(fielder) + play;
                    break;
            }
            if (out.length) {
                var plural = out.length > 1;
                var runner = plural ? 'Runners' : 'Runner';
                var is = plural ? 'are' : 'is';
                statement += '. ' + runner + ' from ' + text(out.join(text.comma())) + ' ' + is + ' out';
            }
        } else {
            switch (bases) {
                case 1:
                    if (infield) {
                        statement += ' reached on an infield hit to ' + text.fielderShortName(fielder);
                    } else {
                        statement += ' reached on a single to ' + text.fielderShortName(fielder);
                    }
                    break;
                case 2:
                    statement += ' doubled past ' + text.fielderShortName(fielder);
                    break;
                case 3:
                    statement += ' tripled past ' + text.fielderShortName(fielder);
                    break;
                case 4:
                    statement += ' homered to ' + text.fielderShortName(fielder);
                    break;
            }
        }
        if (sacrificeAdvances) {
            sacrificeAdvances.map(function (base) {
                if (base == 'third') {
                    statement += text.stop() + 'Runner on third scores';
                } else {
                    statement += text.stop() + 'Runner on ' + base + ' advances';
                }
            });
        }
        statement += text.stop();
    }
    if (text.mode == 'n') {
        var stop = text.stop();
        statement += batter + 'は';
        if (outBy) {
            var fielderLong = text.fielderLongName(fielder);
            fielder = text.fielderShortName(fielder);
            switch (outBy) {
                case 'fieldersChoice':
                    statement += '野選(' + fielder + ')で出塁';
                    break;
                case 'line':
                    statement += fielder + '直';
                    break;
                case 'fly':
                    statement += fielder + '飛';
                    break;
                case 'error':
                    statement += 'エラー(' + fielder + ')で出塁';
                    break;
                case 'pop':
                    statement += 'ポップフライで' + fielder + '飛';
                    break;
                case 'ground':
                    statement += fielderLong + 'ゴロに封殺';
                    break;
                case 'thrown':
                    statement += fielder + 'ゴロ';
                    break;
            }
            if (out.length) {
                statement += '。' + out.map(function (runner) {
                    return text(runner);
                }).join(text.comma()) + 'ランナーはアウト';
            }
            if (doublePlay) {
                statement += '。ゲッツー';
            }
        } else {
            fielder = text.fielderShortName(fielder);
            switch (bases) {
                case 1:
                    if (infield) {
                        statement += '内野安打' + '(' + fielder + ')' + 'で出塁';
                    } else {
                        statement += '安打(' + fielder + ')' + 'で出塁';
                    }
                    break;
                case 2:
                    statement += '二塁打（' + fielder + '）で出塁';
                    break;
                case 3:
                    statement += '三塁打（' + fielder + '）で出塁';
                    break;
                case 4:
                    statement += '本塁打（' + fielder + '）';
                    break;
            }
        }
        if (sacrificeAdvances) {
            sacrificeAdvances.map(function (base) {
                if (base == 'third') {
                    statement += stop + 'サードランナーホームイン';
                } else {
                    statement += stop + text(base) + 'ランナー進塁';
                }
            });
        }
        statement += stop;
    }
    return statement;
};

exports.text = text;

},{}],39:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _namespace = require('./namespace');

if (typeof window == 'object') {
    window.Baseball = _namespace.Baseball;
}

exports.Baseball = _namespace.Baseball;

},{"./namespace":40}],40:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _ModelAtBat = require('./Model/AtBat');

var _ModelField = require('./Model/Field');

var _ModelGame = require('./Model/Game');

var _ModelManager = require('./Model/Manager');

var _ModelPlayer = require('./Model/Player');

var _ModelTeam = require('./Model/Team');

var _ModelUmpire = require('./Model/Umpire');

var _Utility_utils = require('./Utility/_utils');

var _Services_services = require('./Services/_services');

var _TeamsProvider = require('./Teams/Provider');

var Baseball = {};

Baseball.model = {};
Baseball.model.Game = Baseball.Game = _ModelGame.Game;
Baseball.model.Player = Baseball.Player = _ModelPlayer.Player;
Baseball.model.Team = Baseball.Team = _ModelTeam.Team;

Baseball.service = {};
Baseball.service.Animator = _Services_services.Animator;
Baseball.service.Distribution = _Services_services.Distribution;
Baseball.service.Iterator = _Services_services.Iterator;
Baseball.service.Mathinator = _Services_services.Mathinator;

Baseball.util = {};
Baseball.util.text = _Utility_utils.text;
Baseball.util.Log = _Utility_utils.Log;

Baseball.teams = {};
Baseball.teams.Provider = _TeamsProvider.Provider;

exports.Baseball = Baseball;

},{"./Model/AtBat":1,"./Model/Field":2,"./Model/Game":3,"./Model/Manager":4,"./Model/Player":5,"./Model/Team":6,"./Model/Umpire":7,"./Services/_services":30,"./Teams/Provider":31,"./Utility/_utils":35}],41:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _ServicesAnimator = require('../Services/Animator');

var _ServicesDistribution = require('../Services/Distribution');

var _ServicesIterator = require('../Services/Iterator');

var _ServicesMathinator = require('../Services/Mathinator');

exports.Animator = _ServicesAnimator.Animator;
exports.Distribution = _ServicesDistribution.Distribution;
exports.Iterator = _ServicesIterator.Iterator;
exports.Mathinator = _ServicesMathinator.Mathinator;

},{"../Services/Animator":26,"../Services/Distribution":27,"../Services/Iterator":28,"../Services/Mathinator":29}]},{},[39]);

var SocketService = function() {
    var Service = function() {};
    var game, socket, NO_OPERATION = function() {},
        animator = Baseball.service.Animator;
    Service.prototype = {
        socket : {},
        game : {},
        connected : false,
        start : function(key) {
            game = this.game;
            socket = this.socket;
            game.opponentService = this;
            this.connected = socket.connected;
            this.on();
            socket.emit('register', key);
            socket.on('connect_failed reconnect_failed', function() {
                console.log('connection unavailable');
            });
        },
        on : function() {
            var giraffe = this;
            socket.on('register', this.register);
            socket.on('connect reconnect', function() {
                giraffe.connected = true;
            });
            socket.on('disconnect', function() {
                giraffe.connected = false;
            });
            socket.on('pitch', function(pitch) {
                //console.log('receive', 'pitch', pitch);
                game.thePitch(0, 0, NO_OPERATION, pitch);
                var scope = window.s;
                animator.updateFlightPath.bind(scope)();
            });
            socket.on('swing', function(swing) {
                //console.log('receive', 'swing', swing);
                game.theSwing(0, 0, NO_OPERATION, swing);
                var scope = window.s;
                animator.updateFlightPath.bind(scope)(function() {
                    if (swing.contact) {
                        animator.animateFieldingTrajectory(game);
                    }
                });
            });
            socket.on('partner_disconnect', function() {
                console.log('The opponent has disconnected');
                var scope = window.s;
                game.opponentConnected = false;
                game.batter.ready = false;
                if (game.stage === 'pitch' && game.humanBatting()) {
                    game.onBatterReady = function() {
                        game.autoPitch(function(callback) {
                            scope.updateFlightPath(callback);
                        });
                    };
                    game.batterReady();
                }
                if (game.stage === 'swing' && game.humanPitching()) {
                    game.autoSwing(-20, 0, function(fn) {
                        fn();
                    });
                }
                //scope.$digest();
            });
            socket.on('partner_connect', function() {
                game.opponentConnected = true;
                var scope = window.s;
                //scope.$digest();
            });
            socket.on('opponent_taking_field', function() {
                console.log('A challenger has appeared! Sending game data.');
                socket.emit('game_data', game.toData());
            });
            socket.on('game_data', function(data) {
                game.fromData(data);
            });
            socket.on('field_in_use', function() {
                game.opponentConnected = false;
            });
        },
        off : function() {
            socket.on('register', NO_OPERATION);
        },
        register: function(data) {
            console.log(data);
            if (data === 'away') {
                game.humanControl = 'away';
            }
            socket.on('register', NO_OPERATION);
        },
        emitPitch : function(pitch) {
            //console.log('emit', 'pitch', pitch);
            socket.emit('pitch', pitch);
        },
        emitSwing : function(swing) {
            //console.log('emit', 'swing', swing);
            socket.emit('swing', swing);
        },
        swing : function() {

        },
        pitch : function() {

        }
    };
    return Service;
};

SocketService = SocketService();

//(function(app) {
//
//    app.SocketService = ng.core
//        .Class({
//            constructor: function() {
//                for (var i in SocketService.prototype) { if (SocketService.prototype.hasOwnProperty(i)) {
//                    this[i] = SocketService.prototype[i];
//                }}
//                SocketService.bind(this)();
//            }
//        });
//
//})(window.app || (window.app = {}));
(function(app) {

    app.ToIterableService = ng.core
        .Pipe({
            name: 'toIterable'
        })
        .Class({
            constructor: function() {

            },
            transform : function(value) {
                if (typeof value === 'object') {
                    var keys = Object.keys(value);
                    var primitive = window;
                    return keys.map(function(key) {
                        var val = value[key];
                        if (val instanceof Object) {

                        } else {
                            var type = (typeof val).toUpperCase()[0] + (typeof val).slice(1);
                            if (primitive[type]) {
                                val = new primitive[type](val);
                            } else {
                                val = {};
                            }
                        }
                        val.__key = key;
                        return val;
                    });
                }
            }
        });

})(window.app || (window.app = {}));
BattersDirective = function() {
    return {
        //scope: {
        //    game: '=',
        //    text: '='
        //},
        templateUrl: 'public/html/views/directives/batters.html?cache='+cacheKey,
        transclude : true,
        //link: function(scope) {
        //    scope.t = scope.text;
        //    scope.y = scope.game;
        //}
    };
};

(function(app) {
    app.BattersDataComponent = ng.core
        .Component({
            selector: 'batters-data',
            templateUrl: BattersDirective().templateUrl,
            inputs : ['y', 't']
        })
        .Class({
            constructor: function() {
                this.abbreviatePosition = s.abbreviatePosition;
            }
        });
})(window.app || (window.app = {}));
BatteryDirective = function() {
    return {
        //scope: {
        //    game: '=',
        //    text: '='
        //},
        templateUrl: 'public/html/views/directives/battery.html?cache='+cacheKey,
        transclude : true,
        //link: function(scope) {
        //    scope.t = scope.text;
        //    scope.y = scope.game;
        //}
    };
};

(function(app) {
    app.BatteryDataComponent = ng.core
        .Component({
            selector: 'battery-data',
            templateUrl: BatteryDirective().templateUrl,
            inputs : ['y', 't']
        })
        .Class({
            constructor: function() {
                this.abbreviatePosition = s.abbreviatePosition;
            }
        });
})(window.app || (window.app = {}));
FieldDirective = function() {
    return {
        //scope: {
        //    game: '=',
        //    text: '='
        //},
        templateUrl: 'public/html/views/directives/field.html?cache='+cacheKey,
        transclude : true,
        //link: function(scope) {
        //    scope.t = scope.text;
        //    scope.y = scope.game;
        //}
    };
};

(function(app) {
    app.FieldComponent = ng.core
        .Component({
            selector: 'field',
            templateUrl: FieldDirective().templateUrl
        })
        .Class({
            constructor: function() {
            }
        });
})(window.app || (window.app = {}));
FlagDirective = function() {
    return {
        scope: {
            rating: '='
        },
        transclude: true,
        templateUrl: 'public/html/views/directives/flag.html?cache='+cacheKey,
        link: function(scope) {
        }
    };
};

(function(app) {
    app.FlagComponent = ng.core
        .Component({
            selector: 'flag',
            templateUrl: FlagDirective().templateUrl,
            inputs: ['team'],
            directives: [ng.common.NgStyle]
        })
        .Class({
            constructor: function() {

            }
        });
})(window.app || (window.app = {}));
RatingBlockDirective = function() {
    return {
        scope: {
            rating: '='
        },
        transclude: true,
        templateUrl: 'public/html/views/directives/ratingBlock.html?cache='+cacheKey,
        link: function(scope) {
        }
    };
};

(function(app) {
    app.RatingBlockComponent = ng.core
        .Component({
            selector: 'rating-block',
            templateUrl: RatingBlockDirective().templateUrl,
            inputs: ['rating'],
            directives: [ng.common.NgStyle]
        })
        .Class({
            constructor: function() {
            }
        });
})(window.app || (window.app = {}));
ScoreboardDirective = function() {
    return {
        scope: {
            game: '=',
            text: '='
        },
        templateUrl: 'public/html/views/directives/scoreboard.html?cache='+cacheKey,
        link: function(scope) {
            window.s2 = scope;
            scope.t = scope.text;
            scope.y = scope.game;
        }
    };
};

(function(app) {
    app.ScoreboardComponent = ng.core
        .Component({
            selector: 'scoreboard',
            templateUrl: ScoreboardDirective().templateUrl,
            inputs: ['y', 't'],
            pipes: [app.ToIterableService]
        })
        .Class({
            constructor: function() {
                window.s2 = this;
                this.expandScoreboard = false;
            }
        });
})(window.app || (window.app = {}));
IndexController = function($scope, socket) {

    var text = Baseball.util.text;
    var Game = Baseball.Game;
    var Animator = Baseball.service.Animator;

    window.s = $scope;
    $scope.t = text;

    $scope.y = new Game();

    $scope.mode = function(setMode) {
        if (setMode) {
            text.mode = setMode;
            if (localStorage) {
                localStorage.__$yakyuuaikoukai_text_mode = setMode;
            }
        }
        return text.mode;
    };

    if (localStorage) {
        var storedMode = localStorage.__$yakyuuaikoukai_text_mode;
        if (storedMode === 'e' || storedMode === 'n') {
            $scope.mode(storedMode);
        }
    }

    $scope.teamJapan = function() {
        var provider = new Baseball.teams.Provider;
        provider.assignTeam($scope.y, 'TeamJapan', 'away');
        var game = $scope.y;
        if (game.half === 'top') {
            game.batter = game.teams.away.lineup[game.batter.order];
            game.deck = game.teams.away.lineup[(game.batter.order + 1) % 9];
            game.hole = game.teams.away.lineup[(game.batter.order + 2) % 9];
        } else {
            game.pitcher = game.teams.away.positions.pitcher;
        }
    };

    $scope.abbreviatePosition = function(position) {
        if (text.mode == 'e') {
            return {
                pitcher : 'P',
                catcher : 'C',
                first : '1B',
                second : '2B',
                short : 'SS',
                third : '3B',
                left : 'LF',
                center : 'CF',
                right : 'RF'
            }[position];
        }
        return text.fielderShortName(position);
    };

    $scope.sim = function() {$scope.proceedToGame(1, 1);};
    $scope.seventh = function() {$scope.proceedToGame(7);};
    $scope.playball = function() {$scope.proceedToGame();};
    $scope.spectate = function() {$scope.proceedToGame(0,1);};

    $scope.proceedToGame = function(quickMode, spectateCpu) {
        $scope.begin = true;
        var game = $scope.y;
        game.humanControl = spectateCpu ? 'none' : 'home';
        game.console = !!quickMode && quickMode !== 7;
        var field = window.location.hash ? window.location.hash.slice(1) : game.teams.home.name + Math.ceil(Math.random()*47);
        if (typeof io !== 'undefined') {
            socket.game = game;
            $scope.socket = io(/*window.location.hostname*/'http://georgefu.info' + ':64321', {
                reconnection: false
            });
            $scope.socketService = socket;
            socket.socket = $scope.socket;
            socket.start(field);
        }
        window.location.hash = '#' + field;
        bindMethods();
        $('.blocking').remove();
        $('.play-begins').show();
        if (game.humanControl == 'none' && game.console) {
            var n = 0;
            Animator.console = true;
            game.console = true;
            do {
                n++;
                game.simulateInput(function(callback) {
                    typeof callback == 'function' && callback();
                });
            } while (game.stage != 'end' && n < 500);
            Animator.console = game.console = false;
            log('sim ended');
            game.debugOut();
        } else if (game.humanControl == 'none') {
            var scalar = game.console ? 0.05 : 1;
            var auto = setInterval(function() {
                if (game.stage == 'end') {
                    clearInterval(auto);
                }
                game.simulatePitchAndSwing(function(callback) {
                    $scope.updateFlightPath(callback);
                });
            }, scalar*(game.field.hasRunnersOn() ? Animator.TIME_FROM_SET + 2000 : Animator.TIME_FROM_WINDUP + 2000));
        } else if (quickMode === 7 && spectateCpu === undefined) {
            Animator.console = game.console = true;
            do {
                game.simulateInput(function(callback) {
                    typeof callback == 'function' && callback();
                });
            } while (game.inning < 7);
            log('sim halted in 7th');
            game.debugOut();
            Animator.console = game.console = false;
            game.stage = 'pitch';
            game.half = 'top';
            game.humanControl = 'home';
        }
        if (game.humanControl === 'away') {
            game.simulateInput(function(callback) {
                $scope.updateFlightPath(callback);
            });
        }
        if (game.humanControl === 'home') {
            $scope.showMessage = true;
        }
        if (!quickMode || quickMode === 7) {
            Animator.loop.setTargetTimeOfDay(game.startTime.h, game.startTime.m);
            game.timeOfDay.h = game.startTime.h;
            game.timeOfDay.m = game.startTime.m;
        }
    };

    var bindMethods = function() {
        var game = $scope.y;
        $scope.holdUpTimeouts = [];
        $scope.expandScoreboard = false;
        $scope.updateFlightPath = Animator.updateFlightPath.bind($scope);

        // avoid scope cycles, any other easy way?
        var bat = $('.target .swing.stance-indicator');
        var showBat = function(event) {
            if (game.humanBatting()) {
                var offset = $('.target').offset();
                var relativeOffset = {
                    x : event.pageX - offset.left,
                    y : 200 - (event.pageY - offset.top)
                };
                var angle = game.setBatAngle(relativeOffset.x, relativeOffset.y);
                bat.css({
                    top: 200-relativeOffset.y + "px",
                    left: relativeOffset.x + "px",
                    transform: "rotate(" + angle + "deg) rotateY("+(game.batter.bats == "left" ? 0 : -0)+"deg)"
                });
                if (relativeOffset.x > 200 || relativeOffset.x < 0 || relativeOffset.y > 200 || relativeOffset.y < 0) {
                    bat.hide();
                } else {
                    bat.show();
                }
            }
        };
        var glove = $('.target .glove.stance-indicator');
        var showGlove = function(event) {
            if (game.humanPitching()) {
                var offset = $('.target').offset();
                var relativeOffset = {
                    x : event.pageX - offset.left,
                    y : 200 - (event.pageY - offset.top)
                };
                glove.css({
                    top: 200-relativeOffset.y + "px",
                    left: relativeOffset.x + "px"
                });
                if (relativeOffset.x > 200 || relativeOffset.x < 0 || relativeOffset.y > 200 || relativeOffset.y < 0) {
                    glove.hide();
                } else {
                    glove.show();
                }
            }
        };

        $scope.generateTeam = function(heroRate) {
            $scope.y.teams.away = new Baseball.model.Team($scope.y, heroRate);
        };
        $scope.clickLineup = function(player) {
            if (player.team.sub !== player.team.noSubstituteSelected) {
                var sub = player.team.sub;
                player.team.sub = null;
                return sub.substitute(player);
            }
            player.team.expanded = (player.team.expanded == player ? null : player);
        };
        $scope.selectSubstitute = function(player) {
            if (game.humanControl === 'home' && player.team !== game.teams.home) return;
            if (game.humanControl === 'away' && player.team !== game.teams.away) return;
            player.team.sub = (player.team.sub === player ? player.team.noSubstituteSelected : player);
        };

        $scope.selectPitch = function(pitchName) {
            if (game.stage == 'pitch') {
                game.pitchInFlight = $.extend({}, game.pitcher.pitching[pitchName]);
                game.pitchInFlight.name = pitchName;
                game.swingResult.looking = true;
            }
        };
        $scope.allowInput = true;
        $scope.holdUp = function() {
            $('.input-area').click();
        };
        game.startOpponentPitching = function(callback) {
            $scope.updateFlightPath(callback);
        };
        $scope.indicate = function($event) {
            if (!$scope.allowInput) {
                return;
            }
            if (game.humanPitching()) {
                $scope.allowInput = false;
                game.pitcher.windingUp = false;
            }
            if (game.pitcher.windingUp) {
                return;
            }
            var offset = $('.target').offset();
            var relativeOffset = {
                x : $event.pageX - offset.left,
                y : 200 - ($event.pageY - offset.top)
            };
            clearTimeout($scope.lastTimeout);
            while ($scope.holdUpTimeouts.length) {
                clearTimeout($scope.holdUpTimeouts.shift());
            }
            $scope.showMessage = false;
            game.receiveInput(relativeOffset.x, relativeOffset.y, function(callback) {
                $scope.updateFlightPath(callback);
            });
        };
        game.umpire.onSideChange = function() {
            if ($scope.y.humanBatting()) {
                $('.input-area').mousemove(showBat);
            } else {
                $('.input-area').unbind('mousemove', showBat);
                bat.hide();
            }
            if ($scope.y.humanPitching()) {
                $('.input-area').mousemove(showGlove);
            } else {
                $('.input-area').unbind('mousemove', showGlove);
                glove.hide();
            }
        };
        game.umpire.onSideChange();
        //var aside = {
        //    left: $('aside.image-panel.left'),
        //    right: $('aside.image-panel.right')
        //};
        //$scope.$watch('y.playResult', function() {
        //    aside.left.hide();
        //    aside.right.hide();
        //    aside.left.fadeIn(1000, function() {
        //        aside.left.fadeOut(1000);
        //        aside.right.fadeIn(1000, function() {
        //            aside.right.fadeOut(1000);
        //        })
        //    });
        //    $scope.imagePanel = {
        //        left: 'url(./public/images/' + $scope.y.playResult.batter + '.png)',
        //        right: 'url(./public/images/' + $scope.y.playResult.fielder + '.png)'
        //    };
        //});
    };

};

(function(app) {

    app.Main = ng.core
        .Component({
            selector: 'application-hook',
            templateUrl: './public/html/views/main.html',
            directives: [ng.common.NgStyle, ng.common.NgFor,
                app.BattersDataComponent,
                app.BatteryDataComponent,
                app.FlagComponent,
                app.RatingBlockComponent,
                app.ScoreboardComponent
            ],
            pipes: [app.ToIterableService]
        })
        .Class({
            constructor: function() {
                var service = new SocketService();
                IndexController(this, service);
            }
        });

})(window.app || (window.app = {}));
if (typeof angular === 'object') {

    var app = angular.module('YakyuuAikoukai', ['directives'])
        .service('socket', SocketService)
        .controller('IndexController', ['$scope', 'socket', IndexController]);

    app.config(function($interpolateProvider) {
        $interpolateProvider.startSymbol('{{');
        $interpolateProvider.endSymbol('}}');
    });

    angular.module('directives', [])
        .directive('scoreboard', ScoreboardDirective)
        .directive('batters', BattersDirective)
        .directive('battery', BatteryDirective)
        .directive('field', FieldDirective)
        .directive('ratingBlock', RatingBlockDirective)
        .directive('teamFlag', FlagDirective);

} else {

    (function(app) {
        document.addEventListener('DOMContentLoaded', function() {
            ng.core.enableProdMode();
            ng.platform.browser.bootstrap(app.Main);
        });
    })(window.app || (window.app = {}));

}