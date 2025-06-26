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
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    if (id.x >= params.numAgents) {
        return;
    }

    let agent : Agent = agents.agents[id.x];
    // Draw to trail map
    let cellX : i32 = i32(agent.position.x);
    let cellY : i32 = i32(agent.position.y);
    textureStore(TargetTexture, vec2<i32>(cellX, cellY), vec4<f32>(1., 1., 1., 1.));
}