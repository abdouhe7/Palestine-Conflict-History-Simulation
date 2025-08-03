async function loadShader(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load shader from ${url}`);
    return await response.text();
}

class SlimeSimulation {

    // Display Settings
    showAgentsOnly = false;
    filterMode = BABYLON.Constants.TEXTURE_BILINEAR_SAMPLINGMODE;
    textureType = BABYLON.Constants.TEXTURETYPE_HALF_FLOAT;

    settings = new SlimeSettings();

    _layer;
    _scene;
    _engine;
    _trailMap;
    _diffusedTrailMap;
    _displayTexture;

    constructor(layer, scene) {
        this._layer = layer;
        this._scene = scene;
        this._engine = engine;

        this.settings.width = this._engine.getRenderWidth();
        this.settings.height = this._engine.getRenderHeight();

        this.supportCS = this._engine.getCaps().supportComputeShaders;
    }

    start() {
        if (!this.supportCS) {
            return;
        }
        this._init();
        this._layer.texture = this._displayTexture;
        this._startTime = new Date().getTime();
    }

    update() {
        if (!this.supportCS) {
            return;
        }
        for (let i = 0; i < this.settings.stepsPerFrame; i++) {
            this._runSimulation();
        }
        if (this.showAgentsOnly) {
            ComputeHelper.ClearTexture(this._displayTexture, new BABYLON.Color4(0, 0, 0, 0));

            ComputeHelper.Dispatch(this._drawAgentsCS, this.settings.numAgents, 1, 1);
        } else {
            ComputeHelper.CopyBufferToTexture(this._trailMap, this._displayTexture);
        }
    }

    updateSpecies() {
        this._speciesBuffer.update(this.settings.speciesSettings);
    }

    dispose() {
        this._trailMap.dispose();
        this._diffusedTrailMap.dispose();
        this._displayTexture.dispose();
        this._agentBuffer.dispose();
        this._speciesBuffer.dispose();
        this._computeParams.dispose();
        this._computeDiffuseParams.dispose();
        this._drawAgentsParamsBuffer.dispose();
    }

    _randomInsideUnitCircle() {
        const r = Math.sqrt(Math.random());
        const angle = Math.random() * 2 * Math.PI;

        return new BABYLON.Vector2(r * Math.cos(angle), r * Math.sin(angle));
    }

    async InitTextureCheck(spawnColor) {
        for (let attempts = 0; attempts < 100; attempts++) {
            const InitPos = new BABYLON.Vector2(
                Math.floor(Math.random() * this.settings.width),
                Math.floor(Math.random() * this.settings.height)
            );
            try {
                const pixelColor = await this.getPixelColor(this.settings.TextureMaskUrl, InitPos.x, InitPos.y);
                if (this.ColorDifference(pixelColor, spawnColor) > this.settings.extractValueSpawn) {
                    return InitPos;
                }
            } catch (err) {
                console.error("Error reading pixel color:", err);
                return null;
            }
        }
        return null; // fail-safe after 100 attempts
    }
    static ColorDifference(a, b) {
        const rDiff = a.r - b.r;
        const gDiff = a.g - b.g;
        const bDiff = a.b - b.b;
        const aDiff = a.a - b.a;

        // Euclidean distance in 4D RGBA space
        return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff + aDiff * aDiff);
    }

    getPixelColor(url, x, y) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous'; // Needed if the image is loaded from a different domain

            image.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;

                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);

                const pixelData = context.getImageData(x, y, 1, 1).data;
                const color = {
                    r: pixelData[0],
                    g: pixelData[1],
                    b: pixelData[2],
                    a: pixelData[3]
                };

                resolve(color);
            };

            image.onerror = function (e) {
                reject(new Error('Failed to load image: ' + url));
            };

            image.src = url;
        });
    }

    async _init() {
        // Create render textures
        this._trailMap = new BABYLON.StorageBuffer(this._engine, this.settings.width * this.settings.height * 4 * 4);

        this._diffusedTrailMap = ComputeHelper.CreateRenderTexture("rttDiffusedTrail", this._diffusedTrailMap, this.settings.width, this.settings.height, this.filterMode, this.textureType, this._scene);
        this._displayTexture = ComputeHelper.CreateRenderTexture("rttDisplay", this._displayTexture, this.settings.width, this.settings.height, this.filterMode, this.textureType, this._scene);

        // Create agents with initial positions and angles
        const agents = [];
        for (let i = 0; i < this.settings.numAgents; i++) {
            const centre = new BABYLON.Vector2(this.settings.width / 2, this.settings.height / 2);
            let startPos = BABYLON.Vector2.Zero();
            let randomAngle = Math.random() * Math.PI * 2;
            let angle = 0;
            let speciesIndex = 0;

            if (this.settings.spawnMode === SpawnMode.Point) {
                startPos = centre;
                angle = randomAngle;
            } else if (this.settings.spawnMode === SpawnMode.Random) {
                startPos = new BABYLON.Vector2(Math.floor(Math.random() * this.settings.width), Math.floor(Math.random() * this.settings.height));
                angle = randomAngle;
            } else if (this.settings.spawnMode === SpawnMode.InwardCircle) {
                startPos = centre.add(this._randomInsideUnitCircle().scaleInPlace(this.settings.height * 0.5));
                centre.subtractInPlace(startPos).normalize();
                angle = Math.atan2(centre.y, centre.x);
            } else if (this.settings.spawnMode === SpawnMode.RandomCircle) {
                startPos = centre.add(this._randomInsideUnitCircle().scaleInPlace(this.settings.height * 0.15));
                angle = randomAngle;
            } else if (this.settings.spawnMode === SpawnMode.Mask) {
                startPos = this.InitTextureCheck(this.settings.speciesSettings[speciesIndex].SpawnColor);
                angle = randomAngle;
            }


            let speciesMask;
            const numSpecies = this.settings.speciesSettings.length / 5;

            if (numSpecies === 1) {
                speciesMask = [1, 1, 1];
            } else {
                const species = 1 + Math.round(Math.random() * (numSpecies - 1));
                speciesIndex = species - 1;
                speciesMask = [(species === 1) ? 1 : 0, (species === 2) ? 1 : 0, (species === 3) ? 1 : 0];
            }

            agents.push(startPos.x, startPos.y, angle, speciesIndex, ...speciesMask, 1);
        }
        const engine = this._engine;

        const computeSimulationCode = await loadShader("shaders/computeSimulation.wgsl");
        this._compute = new BABYLON.ComputeShader("simulation", engine, {computeSource: computeSimulationCode}, {
            bindingsMapping: {
                "params": {group: 0, binding: 0},
                "agents": {group: 0, binding: 1},
                "speciesSettings": {group: 0, binding: 2},
                "TrailMap": {group: 0, binding: 3},
            }
        });

        this._compute.setStorageBuffer("TrailMap", this._trailMap);

        const agentBuffer = new BABYLON.StorageBuffer(engine, agents.length * 4);
        agentBuffer.update(agents);

        this._agentBuffer = agentBuffer;

        this._compute.setStorageBuffer("agents", agentBuffer);

        const speciesBuffer = new BABYLON.StorageBuffer(engine, this.settings.speciesSettings.length * 4);
        speciesBuffer.update(this.settings.speciesSettings);

        this._speciesBuffer = speciesBuffer;

        this._compute.setStorageBuffer("speciesSettings", speciesBuffer);

        const computeParamsBuffer = new BABYLON.UniformBuffer(engine);

        computeParamsBuffer.addUniform("numAgents", 1);
        computeParamsBuffer.addUniform("width", 1);
        computeParamsBuffer.addUniform("height", 1);
        computeParamsBuffer.addUniform("trailWeight", 1);
        computeParamsBuffer.addUniform("deltaTime", 1);
        computeParamsBuffer.addUniform("time", 1);

        this._compute.setUniformBuffer("params", computeParamsBuffer);

        computeParamsBuffer.updateInt("numAgents", this.settings.numAgents);
        computeParamsBuffer.updateInt("width", this.settings.width);
        computeParamsBuffer.updateInt("height", this.settings.height);

        this._computeParams = computeParamsBuffer;

        const computeDiffuseCode = await loadShader("shaders/computeDiffuse.wgsl");
        if (!computeDiffuseCode || computeDiffuseCode.length < 10) {
            throw new Error("Failed to load computeDiffuse shader");
        }
        this._computeDiffuse = new BABYLON.ComputeShader("diffuse", engine, {computeSource: computeDiffuseCode}, {
            bindingsMapping: {
                "params": {group: 0, binding: 0},
                "TrailMap": {group: 0, binding: 1},
                "DiffusedTrailMap": {group: 0, binding: 2},
            }
        });

        this._computeDiffuse.setStorageBuffer("TrailMap", this._trailMap);
        this._computeDiffuse.setStorageTexture("DiffusedTrailMap", this._diffusedTrailMap);

        const computeDiffuseParamsBuffer = new BABYLON.UniformBuffer(engine);

        computeDiffuseParamsBuffer.addUniform("width", 1);
        computeDiffuseParamsBuffer.addUniform("height", 1);
        computeDiffuseParamsBuffer.addUniform("deltaTime", 1);
        computeDiffuseParamsBuffer.addUniform("decayRate", 1);
        computeDiffuseParamsBuffer.addUniform("diffuseRate", 1);

        this._computeDiffuse.setUniformBuffer("params", computeDiffuseParamsBuffer);

        computeDiffuseParamsBuffer.updateInt("width", this.settings.width);
        computeDiffuseParamsBuffer.updateInt("height", this.settings.height);

        this._computeDiffuseParams = computeDiffuseParamsBuffer;

        const computeDrawAgentsCode = await loadShader("shaders/computeDrawAgents.wgsl");
        this._drawAgentsCS = new BABYLON.ComputeShader("drawAgent", this._engine, {computeSource: computeDrawAgentsCode},
            {
                bindingsMapping: {
                    "params": {group: 0, binding: 0},
                    "agents": {group: 0, binding: 1},
                    "TargetTexture": {group: 0, binding: 3},
                }
            }
        );

        this._drawAgentsCS.setStorageBuffer("agents", agentBuffer);
        this._drawAgentsCS.setTexture("TargetTexture", this._displayTexture);

        const drawAgentsParamsBuffer = new BABYLON.UniformBuffer(engine);

        drawAgentsParamsBuffer.addUniform("numAgents", 1);

        this._drawAgentsCS.setUniformBuffer("params", drawAgentsParamsBuffer);

        drawAgentsParamsBuffer.updateInt("numAgents", this.settings.numAgents);
        drawAgentsParamsBuffer.update();

        this._drawAgentsParamsBuffer = drawAgentsParamsBuffer;

        this._ready = true;
    }

    _runSimulation() {

        if (!this._ready) return;

        const deltaTime = this._engine.getDeltaTime() / 1000;
        // simulation
        this._computeParams.updateFloat("deltaTime", deltaTime);
        this._computeParams.updateFloat("time", (new Date().getTime() - this._startTime) / 1000);
        this._computeParams.updateFloat("trailWeight", this.settings.trailWeight);
        this._computeParams.update();

        // diffuse
        this._computeDiffuseParams.updateFloat("deltaTime", deltaTime);
        this._computeDiffuseParams.updateFloat("decayRate", this.settings.decayRate);
        this._computeDiffuseParams.updateFloat("diffuseRate", this.settings.diffuseRate);
        this._computeDiffuseParams.update();

        ComputeHelper.Dispatch(this._compute, this.settings.numAgents, 1, 1);
        ComputeHelper.Dispatch(this._computeDiffuse, this.settings.width, this.settings.height, 1);

        ComputeHelper.CopyTextureToBuffer(this._diffusedTrailMap, this._trailMap);
    }
}
