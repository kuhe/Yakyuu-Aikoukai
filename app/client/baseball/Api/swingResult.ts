import { base_name_t } from './baseName';
import { strike_zone_coordinate_t } from './pitchInFlight';
import { fielder_short_name_t } from './fielderShortName';
import { runner_name_t } from './runnerName';

/**
 * Describes the result of a pitch, and is poorly named.
 * It does not imply that a swing was made by the batter, only that a pitch and reaction
 * occurred.
 */
export type swing_result_t = strike_zone_coordinate_t & {
    /**
     * no swing.
     */
    looking: boolean;

    /**
     * caught strike, looking or swung on.
     */
    strike: boolean;

    /**
     * Positive: early, negative: late.
     */
    timing: number;

    /**
     * Batted into foul territory.
     */
    foul: boolean;

    /**
     * caught by fielder for immediate out.
     */
    caught: boolean;

    /**
     * thrown out by a fielder.
     */
    thrownOut: boolean;

    /**
     * swung and made contact.
     */
    contact: boolean;

    /**
     * Base stolen.
     * Index of the offensive lineup
     * who made the steal.
     */
    stoleABase: number | undefined;

    /**
     * Failed to steal a base.
     * Index of the offensive lineup who was caught.
     */
    caughtStealing: number | undefined;

    /**
     * Steal attempt's target base. Not indicative of
     * failure or success.
     */
    attemptedBase: base_name_t;

    /**
     * Angle of the bat, not the launch angle.
     */
    angle: number;

    /**
     * a.k.a. launch angle in baseball parlance.
     */
    flyAngle: number;

    /**
     * How far the ball landed.
     */
    travelDistance: number;

    /**
     * Which fielder was responsible for fielding the batted ball.
     */
    fielder: fielder_short_name_t | false;

    /**
     * Direction of the batted ball.
     * -45 to 45 degrees where 0 is a hit up the middle and 45 is the first base foul line.
     */
    splay: number;

    /**
     * A fielder allowed ROE.
     */
    error: boolean;

    /**
     * Any runners that advanced on a flyout.
     */
    sacrificeAdvances: runner_name_t[];

    /**
     * bases gained by the batter-runner.
     */
    bases: 0 | 1 | 2 | 3 | 4;

    /**
     * outs made on the play.
     */
    outs: 0 | 1 | 2 | 3;

    /**
     * Baserunner out on a fielder's choice, if any.
     */
    fieldersChoice: 'first' | 'second' | 'third' | null;

    /**
     * Distance needed to be covered by fielder on the play.
     */
    fielderTravel: number;

    /**
     * First (possibly only) out on the play.
     */
    firstOut: runner_name_t;

    /**
     * Anyone else out on the play besides the firstOut.
     */
    additionalOuts: runner_name_t[];

    /**
     * There was a double play.
     */
    doublePlay: boolean;

    /**
     * an outfielder fielded the play.
     */
    outfielder: boolean;

    /**
     * Time it took for the fielder to gather and throw
     * the ball.
     */
    fieldingDelay: number;

    /**
     * Hit by pitch, batter takes first.
     */
    hitByPitch: boolean;
};
