import { AbstractMesh } from './AbstractMesh';
import { Mathinator } from '../../Services/Mathinator';
import { Indicator } from './Indicator';
import { helper } from '../../Utility/helper';
import { VERTICAL_CORRECTION } from '../LoopConstants';
import { Loop } from '../Loop';
import { THREE, VECTOR3 } from '../../Api/externalRenderer';
import { Game } from '../../Model/Game';
import { swing_result_t } from '../../Api/swingResult';
import { pitch_in_flight_t } from '../../Api/pitchInFlight';
import { pitches_t } from '../../Api/pitches';
import { degrees_t } from '../../Api/math';
import { Mesh } from 'three';

/**
 * on the DOM the pitch zone is 200x200 pixels
 * here we scale the strike zone to 4.2 units (feet)
 * for display purposes. It is only approximately related to actual pitch zone dimensions.
 */
const SCALE = 2.1 / 100;

const INDICATOR_DEPTH = -5;

/**
 * Baseball, that is.
 */
class Ball extends AbstractMesh {
    public static readonly DEFAULT_RPM = 1000;
    public static readonly RPM = 1000;
    public static readonly RPS = 1000 / 60;
    public static readonly RP60thOfASecond = 1000 / 60 / 60;
    public static readonly rotation = {
        x: (Ball.RP60thOfASecond * 360 * Math.PI) / 180, // in radians per 60th of a second
        y: (Ball.RP60thOfASecond * 360 * Math.PI) / 180
    };

    public airTime: number;

    public RPM: number = 0;
    public RPS: number = 0;
    public RP60thOfASecond: number = 0;
    public rotation: {
        x: number;
        y: number;
    } = {
        x: 0,
        y: 0
    };
    public hasIndicator = false;
    public breakingTrajectory: VECTOR3[] = [];

    /**
     * ensures the ball does not go below the ground plane.
     */
    public bounce: 1 | -1 = 1;

    /**
     *
     * @param loop
     * @param trajectory - incremental vectors applied each frame
     * e.g. for 1 second of flight time there should be 60 incremental vectors
     */
    constructor(loop?: Loop | VECTOR3[], public trajectory: VECTOR3[] = []) {
        super();
        if (!(loop && (loop as Loop).loop) && loop instanceof Array) {
            this.trajectory = loop as VECTOR3[];
        }
        this.trajectory = trajectory ? trajectory : [];
        this.getMesh();
        if (loop && (loop as Loop).loop) {
            this.join(loop as Loop);
        }
        this.setType('4-seam', 1);
        this.bounce = 1;
    }

    public getMesh(): Mesh {
        /** @see threex.sportballs */
        const baseURL = 'public/';
        const loader = new THREE.TextureLoader();
        const textureColor = loader.load(`${baseURL}images/BaseballColor.jpg`);
        const textureBump = loader.load(`${baseURL}images/BaseballBump.jpg`);
        const geometry = new THREE.SphereGeometry(0.36, 32, 16); // real scale is 0.12
        const material = new THREE.MeshPhongMaterial({
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
    public animate(): void {
        const frame = this.trajectory.shift(),
            pos = this.mesh.position;

        if (frame) {
            pos.x += frame.x;
            pos.y += frame.y * this.bounce;
            pos.z += frame.z;
            if (pos.y < AbstractMesh.WORLD_BASE_Y) {
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

    /**
     * @param type
     * @param handednessScalar - inverts for left-handedness, I think.
     */
    public setType(type: pitches_t, handednessScalar?: 1 | -1): void {
        const rpm = helper.pitchDefinitions[type][4];
        const rotationAngle = helper.pitchDefinitions[type][3];
        this.setRotation(rpm, rotationAngle * (handednessScalar || 1));
    }

    public rotate(): void {
        const rotation = this.rotation;
        const meshRotation = this.mesh.rotation;
        meshRotation.x += rotation.x;
        meshRotation.y += rotation.y;
    }

    /**
     * Look for the seams!
     * @param rpm
     * @param rotationAngle
     */
    public setRotation(rpm: number, rotationAngle: degrees_t): void {
        this.RPM = rpm;
        this.RPS = this.RPM / 60;
        const rotationalIncrement = (this.RP60thOfASecond = this.RPS / 60);

        // calculate rotational components
        // +x is CCW along x axis increasing
        // +y is CW along y axis increasing
        // +z (unused) is CW along z axis increasing

        // 0   --> x:1 y:0
        // 45  --> x:+ y:+
        // 90  --> x:0 y:1
        // 180 --> x:-1 y:0

        const xComponent = rotationalIncrement * Math.cos((rotationAngle / 180) * Math.PI);
        const yComponent = rotationalIncrement * Math.sin((rotationAngle / 180) * Math.PI);

        this.rotation = {
            x: (xComponent * 360 * Math.PI) / 180,
            y: (yComponent * 360 * Math.PI) / 180
        };
    }

    public exportPositionTo(mesh: Mesh): void {
        mesh.position.x = this.mesh.position.x;
        mesh.position.y = this.mesh.position.y;
        mesh.position.z = this.mesh.position.z;
    }

    /**
     * This leaves a shadow as the ball crosses the strike zone serving
     * as a pitch location indicator.
     */
    public spawnIndicator(): void {
        if (this.hasIndicator) {
            return;
        }
        this.hasIndicator = true;
        const indicator = new Indicator();
        indicator.mesh.position.x = this.mesh.position.x;
        indicator.mesh.position.y = this.mesh.position.y;
        indicator.mesh.position.z = this.mesh.position.z;
        indicator.join(this.loop.background);
    }

    /**
     * @param game
     * @returns the positional increments for animating a pitch.
     */
    public derivePitchingTrajectory(game: Game): VECTOR3[] {
        this.setType(game.pitchInFlight.name, game.pitcher.throws === 'right' ? 1 : -1);
        const top = 200 - game.pitchTarget.y,
            left = game.pitchTarget.x,
            breakTop = 200 - game.pitchInFlight.y,
            breakLeft = game.pitchInFlight.x,
            flightTime = Mathinator.getFlightTime(
                game.pitchInFlight.velocity,
                helper.pitchDefinitions[game.pitchInFlight.name][2]
            );

        const scale = SCALE;
        const origin = {
            x: game.pitcher.throws == 'left' ? 1.5 : -1.5,
            y: AbstractMesh.WORLD_BASE_Y + 6,
            z: -60.5 // mound distance
        };
        this.mesh.position.x = origin.x;
        this.mesh.position.y = origin.y;
        this.mesh.position.z = origin.z;

        const ARC_APPROXIMATION_Y_ADDITIVE = 38; // made up number
        const terminus = {
            x: (left - 100) * scale,
            y: (100 - top + 2 * ARC_APPROXIMATION_Y_ADDITIVE) * scale + VERTICAL_CORRECTION,
            z: INDICATOR_DEPTH
        };
        const breakingTerminus = {
            x: (breakLeft - 100) * scale,
            y: (100 - breakTop) * scale + VERTICAL_CORRECTION,
            z: INDICATOR_DEPTH
        };

        let lastPosition = {
                x: origin.x,
                y: origin.y,
                z: origin.z
            },
            lastBreakingPosition = {
                x: origin.x,
                y: origin.y,
                z: origin.z
            };

        const frames: VECTOR3[] = [];
        const breakingFrames: VECTOR3[] = [];
        const frameCount = (flightTime * 60) | 0;
        let counter = (frameCount * 1.08) | 0;
        let frame = 0;

        const xBreak = breakingTerminus.x - terminus.x,
            yBreak = breakingTerminus.y - terminus.y;
        const breakingDistance = Math.sqrt(Math.pow(xBreak, 2) + Math.pow(yBreak, 2));
        /**
         * 1.0+, an expression of how late the pitch breaks
         */
        const breakingLateness = breakingDistance / (2 * ARC_APPROXIMATION_Y_ADDITIVE) / scale,
            breakingLatenessMomentumExponent = 0.2 + Math.pow(0.45, breakingLateness);

        while (counter--) {
            const progress = ++frame / frameCount;

            // linear position
            const position = {
                x: origin.x + (terminus.x - origin.x) * progress,
                y: origin.y + (terminus.y - origin.y) * progress,
                z: origin.z + (terminus.z - origin.z) * progress
            };
            // linear breaking position
            const breakingInfluencePosition = {
                x: origin.x + (breakingTerminus.x - origin.x) * progress,
                y: origin.y + (breakingTerminus.y - origin.y) * progress,
                z: origin.z + (breakingTerminus.z - origin.z) * progress
            };
            if (progress > 1) {
                momentumScalar = 1 - Math.pow(progress, breakingLateness);
            } else {
                var momentumScalar = Math.pow(1 - progress, breakingLatenessMomentumExponent);
            }
            const breakingScalar = 1 - momentumScalar,
                scalarSum = momentumScalar + breakingScalar;
            // adjustment toward breaking ball position
            const breakingPosition = {
                x:
                    (position.x * momentumScalar + breakingInfluencePosition.x * breakingScalar) /
                    scalarSum,
                y:
                    (position.y * momentumScalar + breakingInfluencePosition.y * breakingScalar) /
                    scalarSum,
                z:
                    (position.z * momentumScalar + breakingInfluencePosition.z * breakingScalar) /
                    scalarSum
            };
            const increment = {
                x: position.x - lastPosition.x,
                y: position.y - lastPosition.y,
                z: position.z - lastPosition.z
            };
            const breakingIncrement = {
                x: breakingPosition.x - lastBreakingPosition.x,
                y: breakingPosition.y - lastBreakingPosition.y,
                z: breakingPosition.z - lastBreakingPosition.z
            };

            lastPosition = position;
            lastBreakingPosition = breakingPosition;

            breakingFrames.push(breakingIncrement);
            frames.push(increment);
        }

        let pause = 60;
        while (pause--) {
            breakingFrames.push({ x: 0, y: 0, z: 0 });
            frames.push({ x: 0, y: 0, z: 0 });
        }

        this.breakingTrajectory = breakingFrames;
        this.trajectory = frames;
        return frames;
    }

    /**
     * @param result
     * @param pitch
     * @returns incremental positions for animating a batted ball.
     */
    public deriveTrajectory(result: swing_result_t, pitch: pitch_in_flight_t): VECTOR3[] {
        const dragScalarApproximation = {
            distance: 1,
            apexHeight: 0.57,
            airTime: 0.96
        };

        // a.k.a. launch angle in Baseball terminology.
        let flyAngle = result.flyAngle;

        // distance the ball travels before hitting the ground the first time.
        let distance = Math.abs(result.travelDistance);

        const scalar = result.travelDistance < 0 ? -1 : 1;

        // Using a different scalar for ground balls.
        const flightScalar = flyAngle < 7 ? -1 : 1;
        const splay = result.splay;

        if (flightScalar < 0 && result.travelDistance > 0) {
            switch (true) {
                case result.fielder in
                    {
                        first: 1,
                        second: 1,
                        short: 1,
                        third: 1
                    }:
                    // If we're using the ground ball animation trajectory,
                    // have the rendered travel distance be at least to the
                    // infield arc if the fielder
                    // is a non-battery infielder.
                    distance = Math.max(110, distance);
                    break;
            }
        }

        flyAngle = 1 + Math.abs(flyAngle); // todo why plus 1?
        if (flyAngle > 90) flyAngle = 180 - flyAngle;

        // exit velocity in mph.
        const velocity =
            dragScalarApproximation.distance *
            Math.sqrt((9.81 * distance) / Math.sin((2 * Math.PI * Math.max(flyAngle, 8)) / 180));
        const velocityVerticalComponent = Math.sin(Mathinator.RADIAN * flyAngle) * velocity;

        let groundTime = 0;

        // if the ball was caught, stop animation at the landing point.
        // otherwise, add fielder travel to the tail of the animation as the ball rolls.
        if (result.fieldingDelay) {
            groundTime = result.fieldingDelay;
        }

        // in feet
        const apexHeight =
            ((velocityVerticalComponent * velocityVerticalComponent) / (2 * 9.81)) *
            dragScalarApproximation.apexHeight;

        // in seconds
        const airTime = 1.5 * Math.sqrt((2 * apexHeight) / 9.81) * dragScalarApproximation.airTime; // 2x freefall equation

        this.airTime = airTime;

        const scale = SCALE;

        const origin = {
            x: pitch.x + result.x - 100,
            y: pitch.y + result.y - 100,
            z: 0
        };

        this.mesh.position.x = origin.x * scale;
        this.mesh.position.y = origin.y * scale;
        this.mesh.position.z = origin.z;

        const extrema = {
            x: Math.sin((splay / 180) * Math.PI) * distance,
            y: apexHeight,
            z: -Math.cos((splay / 180) * Math.PI) * distance
        };

        const frames = [];
        let frameCount = (airTime * 60 + groundTime * 20) | 0;
        let counter = frameCount;
        let frame = 0;

        let lastHeight = 0;
        let lastWaveDirection = 0;

        // travel rate reduction from hitting the ground.
        // decreases each bounce.
        let slow = 1;
        let bounces = 0;

        while (counter-- > 0) {
            let y;
            /** 0 to 1. */
            let progress: number;
            /** 0 to 100. */
            let percent: number;

            progress = Math.pow(
                ++frame / frameCount,
                0.87 // ease out / trend toward 1.0 to simulate higher initial speed.
            );
            percent = progress * 100;

            // this equation is approximate
            if (flightScalar < 0) {
                const currentDistance = progress * distance;

                const tapering = Math.max(0, (100 - bounces * 20) / 100);
                const startingHeight = origin.y * scale;
                const finalHeight = AbstractMesh.WORLD_BASE_Y;

                // lets say 3 bounces per 90 feet.
                // in practice, this effect will be invisible after a certain distance due to
                // tapering.
                const averageBounceRate = 3;

                // a map of distance to sine wave position.
                // the multiplication of bounce rate means that as distance approaches the
                // final distance, the sine wave will have been traversed that many times, giving that
                // many bounces.
                const waveProgress =
                    (averageBounceRate * Math.pow(currentDistance, 1.1)) / distance;
                const waveComponent = Math.sin((waveProgress * Math.PI) / 2);
                const waveHeight = Math.abs(waveComponent);

                if (waveComponent * lastWaveDirection < 0) {
                    bounces += 1;
                    slow *= 0.75;
                    frameCount /= slow;
                    frameCount |= 0;
                    frame /= slow;
                    frame |= 0;
                }
                lastWaveDirection = waveComponent;

                /**
                 * SIN wave with tapering gives a ground ball the bouncing trajectory.
                 */
                y = (startingHeight + apexHeight * waveHeight) * tapering + finalHeight * progress;
            } else {
                /**
                 * Note the pow(n, 2) gives the flyball a parabolic trajectory.
                 */
                y = apexHeight - Math.pow(Math.abs(50 - percent) / 50, 2) * apexHeight;
            }

            frames.push({
                x: (extrema.x / frameCount) * slow,
                y: y - lastHeight,
                z: (extrema.z / frameCount) * slow
            });

            lastHeight = y;
        }

        this.trajectory = frames;
        return frames;
    }
}

export { Ball };
