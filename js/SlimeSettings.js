class SlimeSettings {
    constructor() {
        this.stepsPerFrame = 2;
        this.width = 1280;
        this.height = 720;
        this.numAgents = 250000;
        this.spawnMode = SpawnMode.InwardCircle;
        this.trailWeight = 5;
        this.decayRate = 0.2;
        this.diffuseRate = 3;
        this.extractValueSpawn = 0.9;
        this.TextureMaskUrl = null;
        this.speciesSettings = [];
    }

    addSpecies(species) {
        if (Array.isArray(species)) {
            this.speciesSettings.push(...species.filter(s => s instanceof SpeciesSettings));
        } else if (species instanceof SpeciesSettings) {
            this.speciesSettings.push(species);
        }
    }

    clearSpecies() {
        this.speciesSettings = [];
    }
}

class SpeciesSettings {
    constructor(options = {}) {
        this.moveSpeed = options.moveSpeed || 1.0;
        this.turnSpeed = options.turnSpeed || 0.2;
        this.sensorAngleSpacing = options.sensorAngleSpacing || 45;
        this.sensorOffsetDst = options.sensorOffsetDst || 10;
        this.sensorSize = options.sensorSize || 1;
        //this.SpawnColor = options.SpawnColor || new BABYLON.Color4(0, 1, 0, 1);
    }
}