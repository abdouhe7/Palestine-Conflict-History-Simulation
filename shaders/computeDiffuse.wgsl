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