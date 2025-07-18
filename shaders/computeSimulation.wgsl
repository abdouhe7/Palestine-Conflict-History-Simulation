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