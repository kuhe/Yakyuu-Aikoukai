import { AbstractMesh } from './AbstractMesh';
import { Loop } from '../Loop';

class Base extends AbstractMesh {
    constructor(loop, base) {
        super();
        this.base = base;
        this.getMesh();
        if (loop instanceof Loop) {
            this.join(loop);
        }
    }
    getMesh() {
        var material = new THREE.MeshLambertMaterial({
            color: 0xFFFFFF
        });

        var mesh = new THREE.Mesh(
            new THREE.BoxGeometry(
                1.5,
                0.3,
                1.5,
                8, 8, 8
            ),
            material
        );

        mesh.rotation.x = -0/180 * Math.PI;
        mesh.rotation.y = 45/180 * Math.PI;
        mesh.rotation.z = 0/180 * Math.PI;

        switch (this.base) {
            case 'first':
                mesh.position.x = 64;
                mesh.position.z = -64;
                break;
            case 'second':
                mesh.position.x = 0;
                mesh.position.z = -121;
                break;
            case 'third':
                mesh.position.x = -64;
                mesh.position.z = -64;
                break;
            case 'home':
                mesh.position.x = 0;
                mesh.position.z = 0;

                mesh.rotation.y = 0;
        }
        mesh.position.y = AbstractMesh.WORLD_BASE_Y + 0.5;
        mesh.position.z -= 0;

        this.mesh = mesh;
        return this.mesh;
    }
    animate() {

    }
}

export { Base }