import { AbstractMesh } from './AbstractMesh';
import { Loop } from '../Loop';

class Grass extends AbstractMesh {
    constructor(loop, infield) {
        super();
        this.infield = infield;
        this.getMesh();
        if (loop instanceof Loop) {
            this.join(loop);
        }
    }
    getMesh() {
        var material = new THREE.MeshLambertMaterial({
            color: this.infield ? 0x486D1F: 0x284C19
        });

        var mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(
                this.infield ? 80 : 8000,
                this.infield ? 80 : 8000,
                16,
                16
            ),
            material
        );

        if (this.infield) {
            mesh.rotation.x = -90/180 * Math.PI;
            mesh.rotation.y = 0;
            mesh.rotation.z = 45/180 * Math.PI;

            mesh.position.x = 0;
            mesh.position.y = AbstractMesh.WORLD_BASE_Y + 0.2;
            mesh.position.z = -62;
        } else {
            mesh.rotation.x = -90/180 * Math.PI;
            mesh.rotation.y = 0;
            mesh.rotation.z = 45/180 * Math.PI;

            mesh.position.x = 0;
            mesh.position.y = AbstractMesh.WORLD_BASE_Y - 0.2;
            mesh.position.z = -570;
        }

        this.mesh = mesh;
        return this.mesh;
    }
    animate() {

    }
}

export { Grass }