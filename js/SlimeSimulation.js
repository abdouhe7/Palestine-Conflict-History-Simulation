const computeSimulation = `
struct Params {
    numAgents : u32,
    width : i32,
    height : i32,

    trailWeight : f32,

    deltaTime : f32,
    time : f32,
};

struct Agent {
	position : vec2<f32>,
	angle : f32,
	speciesIndex : i32,
	speciesMask : vec4<i32>,
};
struct Agents {
    agents : array<Agent>,
};

struct SpecieSettings {
	moveSpeed : f32,
	turnSpeed : f32,

	sensorAngleDegrees : f32,
	sensorOffsetDst : f32,
	sensorSize : f32,
};
struct SpeciesSettings {
    species : array<SpecieSettings>,
};

struct FloatArray {
  elements : array<f32>,
};

@group(0) @binding(0) var<uniform> params : Params;
@group(0) @binding(1) var<storage, read_write> agents : Agents;
@group(0) @binding(2) var<storage, read> speciesSettings : SpeciesSettings;
@group(0) @binding(3) var<storage, read_write> TrailMap : FloatArray;

// Hash function www.cs.ubc.ca/~rbridson/docs/schechter-sca08-turbulence.pdf
fn hash(state0 : u32) -> u32
{
    var state : u32 = state0;
    state = state ^ 2747636419u;
    state = state * 2654435769u;
    state = state ^ (state >> 16u);
    state = state * 2654435769u;
    state = state ^ (state >> 16u);
    state = state * 2654435769u;
    return state;
}

fn scaleToRange01(state : u32) -> f32
{
    return f32(state) / 4294967295.0;
}

fn sense(agent : Agent, settings : SpecieSettings, sensorAngleOffset : f32) -> f32
{
	let sensorAngle : f32 = agent.angle + sensorAngleOffset;
	let sensorDir : vec2<f32> = vec2<f32>(cos(sensorAngle), sin(sensorAngle));

	let sensorPos : vec2<f32> = agent.position + sensorDir * settings.sensorOffsetDst;
	let sensorCentreX : i32 = i32(sensorPos.x);
	let sensorCentreY : i32 = i32(sensorPos.y);

	var sum : f32 = 0.;

	let senseWeight : vec4<i32> = agent.speciesMask * vec4<i32>(2, 2, 2, 2) - vec4<i32>(1, 1, 1, 1);

    let sensorSize : i32 = i32(settings.sensorSize);
	for (var offsetX : i32 = -sensorSize; offsetX <= sensorSize; offsetX = offsetX + 1) {
		for (var offsetY : i32 = -sensorSize; offsetY <= sensorSize; offsetY = offsetY + 1) {
			let sampleX : i32 = min(params.width - 1, max(0, sensorCentreX + offsetX));
			let sampleY : i32 = min(params.height - 1, max(0, sensorCentreY + offsetY));
            let offset : i32 = sampleY * params.width * 4 + sampleX * 4;
			sum = sum + dot(vec4<f32>(senseWeight), vec4<f32>(TrailMap.elements[offset], TrailMap.elements[offset + 1], TrailMap.elements[offset + 2], TrailMap.elements[offset + 3]));
		}
	}

	return sum;
}

@compute @workgroup_size(64,1,1)
fn main(@builtin(global_invocation_id) id : vec3<u32>)
{
	if (id.x >= params.numAgents) {
		return;
	}


	let agent : Agent = agents.agents[id.x];
	let settings : SpecieSettings = speciesSettings.species[agent.speciesIndex];
	let pos : vec2<f32> = agent.position;

	var random : u32 = hash(u32(pos.y * f32(params.width) + pos.x) + hash(id.x + u32(params.time * 100000.)));

	// Steer based on sensory data
	let sensorAngleRad : f32 = settings.sensorAngleDegrees * (3.1415 / 180.);
	let weightForward : f32 = sense(agent, settings, 0.);
	let weightLeft : f32 = sense(agent, settings, sensorAngleRad);
	let weightRight : f32 = sense(agent, settings, -sensorAngleRad);


	let randomSteerStrength : f32 = scaleToRange01(random);
	let turnSpeed : f32 = settings.turnSpeed * 2. * 3.1415;

	// Continue in same direction
	if (weightForward > weightLeft && weightForward > weightRight) {
		//agents.agents[id.x].angle += 0;
	}
	else if (weightForward < weightLeft && weightForward < weightRight) {
		agents.agents[id.x].angle = agents.agents[id.x].angle + (randomSteerStrength - 0.5) * 2. * turnSpeed * params.deltaTime;
	}
	// Turn right
	else if (weightRight > weightLeft) {
		agents.agents[id.x].angle = agents.agents[id.x].angle - randomSteerStrength * turnSpeed * params.deltaTime;
	}
	// Turn left
	else if (weightLeft > weightRight) {
		agents.agents[id.x].angle = agents.agents[id.x].angle + randomSteerStrength * turnSpeed * params.deltaTime;
	}

	// Update position
	let direction : vec2<f32> = vec2<f32>(cos(agent.angle), sin(agent.angle));
	var newPos : vec2<f32> = agent.position + direction * params.deltaTime * settings.moveSpeed;

	// Clamp position to map boundaries, and pick new random move dir if hit boundary
	if (newPos.x < 0. || newPos.x >= f32(params.width) || newPos.y < 0. || newPos.y >= f32(params.height)) {
		random = hash(random);
		let randomAngle : f32 = scaleToRange01(random) * 2. * 3.1415;

		newPos.x = min(f32(params.width - 1), max(0., newPos.x));
		newPos.y = min(f32(params.height - 1), max(0., newPos.y));
		agents.agents[id.x].angle = randomAngle;
	} else {
        let offset : i32 = i32(newPos.y) * params.width * 4 + i32(newPos.x) * 4;
		let oldTrail : vec4<f32> = vec4<f32>(TrailMap.elements[offset], TrailMap.elements[offset + 1], TrailMap.elements[offset + 2], TrailMap.elements[offset + 3]);
        let newVal : vec4<f32> = min(vec4<f32>(1., 1., 1., 1.), oldTrail + vec4<f32>(agent.speciesMask) * vec4<f32>(params.trailWeight * params.deltaTime, params.trailWeight * params.deltaTime, params.trailWeight * params.deltaTime, params.trailWeight * params.deltaTime));
		TrailMap.elements[offset] = newVal.x;
		TrailMap.elements[offset + 1] = newVal.y;
		TrailMap.elements[offset + 2] = newVal.z;
		TrailMap.elements[offset + 3] = newVal.w;
	}

	agents.agents[id.x].position = newPos;
}
`;
const computeDrawAgents = `
struct Params {
    numAgents : u32,
};

struct Agent {
	position : vec2<f32>,
	angle : f32,
	speciesIndex : i32,
	speciesMask : vec4<i32>,
};
struct Agents {
    agents : array<Agent>,
};

@group(0) @binding(0) var<uniform> params : Params;
@group(0) @binding(1) var<storage, read> agents : Agents;
@group(0) @binding(2) var TargetTextureSampler : sampler;
@group(0) @binding(3) var TargetTexture : texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(64,1,1)
fn main(@builtin(global_invocation_id) id : vec3<u32>)
{
    if (id.x >= params.numAgents) {
		return;
	}

	let agent : Agent = agents.agents[id.x];
	// Draw to trail map
	let cellX : i32 = i32(agent.position.x);
	let cellY : i32 = i32(agent.position.y);

	textureStore(TargetTexture, vec2<i32>(cellX, cellY), vec4<f32>(1., 1., 1., 1.));
}
`;
const computeDiffuse = `
struct Params {
    width : i32,
    height : i32,
    deltaTime : f32,

    decayRate : f32,
    diffuseRate : f32,
};

struct FloatArray {
  elements : array<f32>,
};

@group(0) @binding(0) var<uniform> params : Params;
@group(0) @binding(1) var<storage, read> TrailMap : FloatArray;
@group(0) @binding(2) var DiffusedTrailMap : texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) id : vec3<u32>)
{
	if (id.x < 0u || id.x >= u32(params.width) || id.y < 0u || id.y >= u32(params.height)) {
		return;
	}

	var sum : vec4<f32> = vec4<f32>(0., 0., 0., 0.);
    let offset : u32 = id.y * u32(params.width) * 4u + id.x * 4u;
	let originalCol : vec4<f32> = vec4<f32>(TrailMap.elements[offset], TrailMap.elements[offset + 1u], TrailMap.elements[offset + 2u], TrailMap.elements[offset + 3u]);
	// 3x3 blur
	for (var offsetX : i32 = -1; offsetX <= 1; offsetX = offsetX + 1) {
		for (var offsetY : i32 = -1; offsetY <= 1; offsetY = offsetY + 1) {
			let sampleX : i32 = min(params.width - 1, max(0, i32(id.x) + offsetX));
			let sampleY : i32 = min(params.height - 1, max(0, i32(id.y) + offsetY));
            let offset2 : u32 = u32(sampleY) * u32(params.width) * 4u + id.x * 4u;
			sum = sum + vec4<f32>(TrailMap.elements[offset2], TrailMap.elements[offset2 + 1u], TrailMap.elements[offset2 + 2u], TrailMap.elements[offset2 + 3u]);
		}
	}

	var blurredCol : vec4<f32> = sum / vec4<f32>(9., 9., 9., 9.);
	let diffuseWeight : f32 = clamp(params.diffuseRate * params.deltaTime, 0., 1.);

	blurredCol = originalCol * (1. - diffuseWeight) + blurredCol * diffuseWeight;

	//DiffusedTrailMap[id.xy] = blurredCol * saturate(1 - decayRate * deltaTime);
    let p : f32 = params.decayRate * params.deltaTime;
	textureStore(DiffusedTrailMap, vec2<i32>(id.xy), max(vec4<f32>(0., 0., 0., 0.), blurredCol - vec4<f32>(p, p, p, p)));
}
`;

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

    _init() {
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
            } else if (this.settings.spawnMode == SpawnMode.RandomCircle) {
                startPos = centre.add(this._randomInsideUnitCircle().scaleInPlace(this.settings.height * 0.15));
                angle = randomAngle;
            }

            let speciesMask;
            let speciesIndex = 0;
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

        this._compute = new BABYLON.ComputeShader("simulation", engine, { computeSource: computeSimulation }, { bindingsMapping: {
                "params": { group: 0, binding: 0 },
                "agents": { group: 0, binding: 1 },
                "speciesSettings": { group: 0, binding: 2 },
                "TrailMap": { group: 0, binding: 3 },
            }});

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

        this._computeDiffuse = new BABYLON.ComputeShader("diffuse", engine, { computeSource: computeDiffuse }, { bindingsMapping: {
                "params": { group: 0, binding: 0 },
                "TrailMap": { group: 0, binding: 1 },
                "DiffusedTrailMap": { group: 0, binding: 2 },
            }});

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

        this._drawAgentsCS = new BABYLON.ComputeShader("drawAgent", engine, { computeSource: computeDrawAgents }, { bindingsMapping: {
                "params": { group: 0, binding: 0 },
                "agents": { group: 0, binding: 1 },
                "TargetTexture": { group: 0, binding: 3 },
            }});

        this._drawAgentsCS.setStorageBuffer("agents", agentBuffer);
        this._drawAgentsCS.setTexture("TargetTexture", this._displayTexture);

        const drawAgentsParamsBuffer = new BABYLON.UniformBuffer(engine);

        drawAgentsParamsBuffer.addUniform("numAgents", 1);

        this._drawAgentsCS.setUniformBuffer("params", drawAgentsParamsBuffer);

        drawAgentsParamsBuffer.updateInt("numAgents", this.settings.numAgents);
        drawAgentsParamsBuffer.update();

        this._drawAgentsParamsBuffer = drawAgentsParamsBuffer;
    }

    _runSimulation() {
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

class SlimeSettings {
    stepsPerFrame = 2;
    width = 1280;
    height = 720;
    numAgents = 250000;
    spawnMode = SpawnMode.InwardCircle;
    trailWeight = 5;
    decayRate = 0.2;
    diffuseRate = 3;
    speciesSettings = new Array();
}

class SpeciesSettings {
    moveSpeed;
    turnSpeed;
    sensorAngleSpacing;
    sensorOffsetDst;
    sensorSize;
}