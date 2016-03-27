/**
 * For Math!
 * @constructor
 */
var Mathinator = function() {
};

/**
 * @param n
 * @returns {number}
 */
Mathinator.square = function(n) {
    return n * n;
};

Mathinator.prototype = {
    identifier : 'Mathinator',
    constructor : Mathinator,
    /**
     * CONST
     */
    RADIAN : Math.PI / 180,
    SPLAY_INDICATOR_LEFT : -4,
    /**
     * @param offset {{x: number, y: number}}
     * @param angle {number}
     * @returns {{x: number, y: number}}
     */
    getAngularOffset : function(offset, angle) {
        var xScalar = offset.x < 0 ? -1 : 1,
            yScalar = offset.y < 0 ? -1 : 1;
        var originalAngle = Math.atan(offset.x / offset.y)/this.RADIAN;
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
    getPolarDistance : function(a, b) {
        var radians = this.RADIAN;
        return Math.sqrt(a[1]*a[1] + b[1]*b[1] - 2*a[1]*b[1]*Math.cos(a[0]*radians - b[0]*radians));
    },
    /**
     * @param origin
     * @param target
     * @returns {number}
     * 0 is flat (left-right), positive is clockwise.
     * We use 125 instead of 180 to account for natural hand-height adjustments
     * of various swing heights.
     */
    battingAngle : function(origin, target) {
        return Math.atan((origin.y - target.y)/(target.x - origin.x))/Math.PI * 125;
    },
    memory : {},
    /**
     * @param percent {number} 0-100
     * @param quarter {number} seconds
     * @param step {number} 0 and up
     * @param [givenApexHeight] feet
     * @param [givenDistance] in feet
     * @param [givenSplayAngle] where 0 is up the middle and 90 is right foul
     * @returns {{bottom: number, left: number, padding: number, borderWidth: number, delay: number, ease: (r.easeOut|*)}}
     */
    transitionalTrajectory : function(percent, quarter, step, givenApexHeight, givenDistance, givenSplayAngle) {
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
            percent = Math.floor(Math.sqrt(percent/100)*100);
        }

        bottom = Math.cos(splay * radian) * percent/100 * distance * 95/300;
        left = Math.sin(splay * radian) * percent/100 * distance * 95/300 + this.SPLAY_INDICATOR_LEFT;

        var apexRatio = Math.sqrt((50 - Math.abs(percent - 50))/100)*(1/0.7071);
        if (bounding) {
            padding = 1;
            borderWidth = 1;
        } else {
            padding = apexRatio * apexHeight/90 * 15;
            borderWidth = 2 + (apexRatio * 2);
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
    transitionalCatcherPerspectiveTrajectory : function(percent, quarter, step, givenApexHeight, givenDistance, givenSplayAngle, givenOrigin) {
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
            percent = Math.floor(Math.sqrt(percent/100)*100);
        }

        var height = apexHeight - Math.pow(Math.abs(50 - percent)/50, 1.2) * apexHeight,
            currentDistance = distance * percent/100;

        var projection = Math.pow((500 - currentDistance)/500, 2); // reduction of dimensions due to distance

        top = (200 - origin.y) - (height * 20) * projection + (percent/100 * (origin.y - 85)) * projection;
        left = origin.x + Math.sin(splay * radian) * (currentDistance * 8) * projection;
        padding = 12 * projection * projection;
        borderWidth = Math.max(Math.min(padding/3, 4), 0);

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
    translateSwingResultToStylePosition: function(swingResult) {
        // CF HR bottom: 95px, centerline: left: 190px;
        var bottom, left;

        bottom = Math.cos(swingResult.splay / 180 * Math.PI) * swingResult.travelDistance * 95/300;
        left = Math.sin(swingResult.splay / 180 * Math.PI) * swingResult.travelDistance * 95/300 + this.SPLAY_INDICATOR_LEFT;

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
    pitchTransition : function(top, left, originTop, originLeft, quarter, maxPadding, maxBorderWidth) {
        /**
         * @param percent {number} 0-100
         * @param step {number} 0 and up
         * @param [breakTop] {number} 0-200 override
         * @param [breakLeft] {number} 0-200 override
         * @returns {{top: number, left: number, padding: string, borderWidth: string, transform: string, delay: number, ease: *}}
         */
        return function(percent, step, breakTop, breakLeft) {
            var _top, _left;
            _top = breakTop || top;
            _left = breakLeft || left;
            _top = originTop + Mathinator.square(percent/100)*(_top - originTop);
            if (step == 1) {
                _top -= 2;
            }
            if (step == 2) {
                _top -= 1;
            }
            _left = originLeft + Mathinator.square(percent/100)*(_left - originLeft);
            var padding = Math.max(Mathinator.square(percent/100)*maxPadding, 1),
                borderWidth = Math.max(Mathinator.square(percent/100)*maxBorderWidth, 1);
            return {
                top: _top,
                left: _left ,
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
    fielderReturnDelay : function(distance, throwing, fielding, intercept) {
        return distance/90 // bip distance (up to 3s+)
            + (5*((distance)/310) // worst case time to reach the ball,
            * (Math.min(intercept - 120, 0))/-240) // a good intercept rating will cut the base down to 0
            + 1 - (0.2 + fielding * 0.8) // gather time (up to 0.8s)
            + (distance/90)/(0.5 + throwing/2); // throwing distance (up to 2s)
    },
    /**
     * @param player {Player}
     * @returns {number} ~2.0
     */
    infieldThrowDelay : function(player) {
        var fielding = player.skill.defense.fielding,
            throwing = player.skill.defense.throwing;
        return 3.5 - (fielding + throwing)/200;
    },
    /**
     * @param speed {number} 0-100
     * @returns {number} seconds
     */
    baseRunningTime : function(speed) {
        return 7.0 - (speed/100 * 4.1)
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
    getSplayAndFlyAngle(x, y, angle, eye) {

        var splay = -1.5*x - (y * angle / 20);
        var direction = splay > 0 ? 1 : -1;
        // additional random splay
        // todo make it pull only
        splay += direction * Math.random() * 40 * (100/(50 + eye));

        return {
            splay: splay,
            fly: -3*y / ((Math.abs(angle) + 25) / 35 ) // more difficult to hit a pop fly on a angled bat
        }
    },
    /**
     * @param velocityRating {Number} 0-100
     * @param velocityScalar {Number} approx 1
     * @returns {number}
     */
    getFlightTime(velocityRating, velocityScalar) {
        return (1.3 - 0.6*(velocityRating + 300)/400)/(velocityScalar);
    }
};

for (var fn in Mathinator.prototype) {
    if (Mathinator.prototype.hasOwnProperty(fn)) {
        Mathinator[fn] = Mathinator.prototype[fn];
    }
}

export { Mathinator }