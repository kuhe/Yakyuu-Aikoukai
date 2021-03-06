import Baseball from './../app/baseball-lib';

/**
 * @typedef {Class} Stomp
 * @property {function} over
 * @property {function} debug
 */

/**
 *
 * Socket service for opponent connection.
 *
 */
const SocketService = (function () {

    /**
     * @param {string} field
     * @returns {string}
     */
    const teamToken = function (field) {

        const tn = 'Team' + (Math.random() * 100 | 0);
        const str = tn + Math.random() * Date.now();

        let hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }

        return tn + '_' + hash + '_' + field;

    };

    /**
     * Provides the socket.io interface to Stomp.
     * @param {Stomp} stomp
     * @param {String} teamToken
     * @returns {Stomp}
     */
    const IoAdapter = function (stomp, teamToken) {

        stomp.subscribe('/matchmaker/' + teamToken, function (frame) {

            const data = JSON.parse(frame.body);

            if (data.type in reactions) {
                reactions[data.type](data);
                if (LOG_TRAFFIC) console.log('socket event fired:', data.type);
            }

        });

        const reactions = {};
        stomp.on = function (key, fn) {
            key.split(' ').forEach(function (k) {
                reactions[k] = fn;
            });
        };
        stomp.emit = function (event, data) {
            data = data || {};
            data.type = event;
            data.team = teamToken;
            stomp.send('/action/' + event, {}, JSON.stringify(data));
        };

        return stomp;

    };

    const SocketService = function (game) {

        const connect = !!~location.hostname.indexOf('localhost')
            ? 'http://localhost:8080/match-socks'
            : 'https://d116k8htq7f4sm.cloudfront.net/match-socks';

        const socket = new (<any>window).SockJS(connect);

        this.game = game;

        this.socket = socket;
        this.stomp = (<any>window).Stomp.over(socket);
        if (!LOG_TRAFFIC) {
            this.stomp.debug = null;
        }

    };

    const LOG_TRAFFIC = false;
    let game, socket, NO_OPERATION = function () {},
        animator = Baseball.service.Animator;

    SocketService.prototype = {

        /**
         * @returns {boolean}
         */
        get connected() {
            return socket.connected;
        },

        /**
         * @param {string} field id e.g. Takarazuka47.
         */
        start: function (field) {
            game = this.game;
            socket = this.stomp;
            game.opponentService = this;
            this.field = field;

            const giraffe = this;
            const token = this.teamToken = teamToken(field);

            socket.connect({}, function (frame) {

                IoAdapter(socket, token);

                socket.emit('field_request', {
                    team: token,
                    field: field
                });

                giraffe.on();

            });

        },

        on: function () {
            socket.on('register', this.register);
            socket.on('pitch', function (pitch) {

                setTimeout(function () {
                    game.umpire.onSideChange();
                }, 500);

                if (LOG_TRAFFIC) console.log('receive', 'pitch', pitch);
                game.windupThen(function () {

                    game.thePitch(0, 0, NO_OPERATION, pitch);
                    const scope = (<any>window).s;
                    animator.updateFlightPath.bind(scope)();

                });
            });
            socket.on('swing', function (swing) {
                if (swing.fielder === 'false') {
                    swing.fielder = false;
                }
                if (swing.stoleABase === -1) {
                    delete swing.stoleABase;
                }
                if (swing.caughtStealing === -1) {
                    delete swing.caughtStealing;
                }
                if (LOG_TRAFFIC) console.log('receive', 'swing', swing);
                game.theSwing(0, 0, NO_OPERATION, swing);
                const scope = (<any>window).s;
                animator.updateFlightPath.bind(scope)(function () {
                    if (swing.contact) {
                        animator.animateFieldingTrajectory(game);
                    }
                });
            });
            socket.on('partner_disconnect', function () {
                console.log('The opponent has disconnected');
                const scope = (<any>window).s;
                game.opponentConnected = false;
                game.batter.ready = false;
                if (game.stage === 'pitch' && game.humanBatting()) {
                    game.onBatterReady = function () {
                        game.autoPitch(function (callback) {
                            scope.updateFlightPath(callback);
                        });
                    };
                    game.batterReady();
                }
                if (game.stage === 'swing' && game.humanPitching()) {
                    game.autoSwing(-20, 0, function (fn) {
                        fn();
                    });
                }
            });
            socket.on('partner_connect', function () {
                game.opponentConnected = true;
            });
            socket.on('opponent_taking_field', function () {
                console.log('A challenger has appeared! Sending game data.');
                socket.emit('game_data', {json: JSON.stringify(game.toData())});
            });
            socket.on('game_data', function (data) {
                if (data.json) {
                    data = JSON.parse(data.json);
                }
                game.fromData(data);
            });
            socket.on('field_in_use', function () {
                game.opponentConnected = false;
            });
        },
        off: function () {
            socket.on('register', NO_OPERATION);
        },
        register: function (data) {
            console.log('registration received', data.side || data);
            if (data === 'away' || data.side === 'away') {
                game.humanControl = 'away';
            } else {
                game.humanControl = 'home';
            }
            socket.on('register', NO_OPERATION);
        },
        emitPitch: function (pitch) {
            if (LOG_TRAFFIC) console.log('emit', 'pitch', pitch);
            socket.emit('pitch', pitch);
        },
        emitSwing: function (swing) {
            if (LOG_TRAFFIC) console.log('emit', 'swing', swing);
            socket.emit('swing', swing);
        }
    };
    return SocketService;
}());

//(function(app) {
//
//    app.SocketService = ng.core
//        .Class({
//            constructor: function() {
//                for (const i in SocketService.prototype) { if (SocketService.prototype.hasOwnProperty(i)) {
//                    this[i] = SocketService.prototype[i];
//                }}
//                SocketService.bind(this)();
//            }
//        });
//
//})((<any>window).app || ((<any>window).app = {}));

export default SocketService;
