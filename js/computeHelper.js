class ComputeHelper {
    static clearTextureComputeShader = `
        @group(0) @binding(0) var tbuf : texture_storage_2d<rgba16float, write>;
        struct Params {
            color : vec4<f32>,
            width : u32,
            height : u32,
        };
        @group(0) @binding(1) var<uniform> params : Params;
        @compute @workgroup_size(8, 8, 1)
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            if (global_id.x >= params.width || global_id.y >= params.height) {
                return;
            }
            textureStore(tbuf, vec2<i32>(global_id.xy), params.color);
        }
    `;

    static copyTextureComputeShader = `
        @group(0) @binding(0) var dest : texture_storage_2d<rgba16float, write>;
        @group(0) @binding(1) var src : texture_2d<f32>;
        struct Params {
            width : u32,
            height : u32,
        };
        @group(0) @binding(2) var<uniform> params : Params;
        @compute @workgroup_size(8, 8, 1)
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            if (global_id.x >= params.width || global_id.y >= params.height) {
                return;
            }
            let pix : vec4<f32> = textureLoad(src, vec2<i32>(global_id.xy), 0);
            textureStore(dest, vec2<i32>(global_id.xy), pix);
        }
    `;

    static copyBufferTextureComputeShader = `
        struct FloatArray {
            elements : array<f32>,
        };
        @group(0) @binding(0) var dest : texture_storage_2d<rgba16float, write>;
        @group(0) @binding(1) var<storage, read> src : FloatArray;
        struct Params {
            width : u32,
            height : u32,
        };
        @group(0) @binding(2) var<uniform> params : Params;
        @compute @workgroup_size(8, 8, 1)
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            if (global_id.x >= params.width || global_id.y >= params.height) {
                return;
            }
            let offset : u32 = global_id.y * params.width * 4u + global_id.x * 4u;
            let pix : vec4<f32> = vec4<f32>(src.elements[offset], src.elements[offset + 1u], src.elements[offset + 2u], src.elements[offset + 3u]);
            textureStore(dest, vec2<i32>(global_id.xy), pix);
        }
    `;

    static copyTextureBufferComputeShader = `
        struct FloatArray {
            elements : array<f32>,
        };
        @group(0) @binding(0) var src : texture_2d<f32>;
        @group(0) @binding(1) var<storage, read_write> dest : FloatArray;
        struct Params {
            width : u32,
            height : u32,
        };
        @group(0) @binding(2) var<uniform> params : Params;
        @compute @workgroup_size(8, 8, 1)
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            if (global_id.x >= params.width || global_id.y >= params.height) {
                return;
            }
            let offset : u32 = global_id.y * params.width * 4u + global_id.x * 4u;
            let pix : vec4<f32> = textureLoad(src, vec2<i32>(global_id.xy), 0);
            dest.elements[offset] = pix.r;
            dest.elements[offset + 1u] = pix.g;
            dest.elements[offset + 2u] = pix.b;
            dest.elements[offset + 3u] = pix.a;
        }
    `;

    static GetThreadGroupSizes(source) {
        const res = /workgroup_size\s*?\(\s*?(\d+)\s*?,\s*?(\d+)\s*?,\s*?(\d+)/g.exec(source);
        return res ? new BABYLON.Vector3(res[1] | 0, res[2] | 0, res[3] | 0) : new BABYLON.Vector3(1, 1, 1);
    }

    static CreateRenderTexture(name, texture, nwidth, nheight, filterMode, textureType, scene) {
        const { width, height } = texture ? texture.getSize() : { width: 0, height: 0 };
        const type = texture ? texture.getInternalTexture().type : -1;
        if (!texture || width !== nwidth || height !== nheight || textureType !== type) {
            texture = new BABYLON.RenderTargetTexture(name, { width: nwidth, height: nheight }, scene, false, undefined, textureType, false, filterMode, false, false, false,
                BABYLON.Constants.TEXTUREFORMAT_RGBA, false, undefined, BABYLON.Constants.TEXTURE_CREATIONFLAG_STORAGE);
        }
        texture.wrapU = BABYLON.Constants.TEXTURE_CLAMP_ADDRESSMODE;
        texture.wrapV = BABYLON.Constants.TEXTURE_CLAMP_ADDRESSMODE;
        texture.updateSamplingMode(filterMode);
        return texture;
    }

    static CopyTexture(source, dest) {
        if (!ComputeHelper.copyTextureCS) {
            const engine = source.getScene().getEngine();
            const cs1 = new BABYLON.ComputeShader("copyTextureCompute", engine, { computeSource: ComputeHelper.copyTextureComputeShader }, {
                bindingsMapping: {
                    "dest": { group: 0, binding: 0 },
                    "src": { group: 0, binding: 1 },
                    "params": { group: 0, binding: 2 },
                }
            });

            const uBuffer0 = new BABYLON.UniformBuffer(engine);
            uBuffer0.addUniform("width", 1);
            uBuffer0.addUniform("height", 1);
            cs1.setUniformBuffer("params", uBuffer0);

            ComputeHelper.copyTextureCS = cs1;
            ComputeHelper.copyTextureParams = uBuffer0;
        }

        ComputeHelper.copyTextureCS.setTexture("src", source, false);
        ComputeHelper.copyTextureCS.setStorageTexture("dest", dest);

        const { width, height } = source.getSize();
        ComputeHelper.copyTextureParams.updateInt("width", width);
        ComputeHelper.copyTextureParams.updateInt("height", height);
        ComputeHelper.copyTextureParams.update();
        ComputeHelper.Dispatch(ComputeHelper.copyTextureCS, width, height, 1);
    }

    static CopyBufferToTexture(source, dest) {
        if (!ComputeHelper.copyBufferTextureCS) {
            const engine = dest.getScene().getEngine();
            const cs1 = new BABYLON.ComputeShader("copyBufferTextureCompute", engine, { computeSource: ComputeHelper.copyBufferTextureComputeShader }, {
                bindingsMapping: {
                    "dest": { group: 0, binding: 0 },
                    "src": { group: 0, binding: 1 },
                    "params": { group: 0, binding: 2 },
                }
            });

            const uBuffer0 = new BABYLON.UniformBuffer(engine);
            uBuffer0.addUniform("width", 1);
            uBuffer0.addUniform("height", 1);
            cs1.setUniformBuffer("params", uBuffer0);

            ComputeHelper.copyBufferTextureCS = cs1;
            ComputeHelper.copyBufferTextureParams = uBuffer0;
        }

        ComputeHelper.copyBufferTextureCS.setStorageBuffer("src", source);
        ComputeHelper.copyBufferTextureCS.setStorageTexture("dest", dest);

        const { width, height } = dest.getSize();
        ComputeHelper.copyBufferTextureParams.updateInt("width", width);
        ComputeHelper.copyBufferTextureParams.updateInt("height", height);
        ComputeHelper.copyBufferTextureParams.update();
        ComputeHelper.Dispatch(ComputeHelper.copyBufferTextureCS, width, height, 1);
    }

    static CopyTextureToBuffer(source, dest) {
        if (!ComputeHelper.copyTextureBufferCS) {
            const engine = source.getScene().getEngine();
            const cs1 = new BABYLON.ComputeShader("copyTextureBufferCompute", engine, { computeSource: ComputeHelper.copyTextureBufferComputeShader }, {
                bindingsMapping: {
                    "src": { group: 0, binding: 0 },
                    "dest": { group: 0, binding: 1 },
                    "params": { group: 0, binding: 2 },
                }
            });

            const uBuffer0 = new BABYLON.UniformBuffer(engine);
            uBuffer0.addUniform("width", 1);
            uBuffer0.addUniform("height", 1);
            cs1.setUniformBuffer("params", uBuffer0);

            ComputeHelper.copyTextureBufferCS = cs1;
            ComputeHelper.copyTextureBufferParams = uBuffer0;
        }

        ComputeHelper.copyTextureBufferCS.setTexture("src", source, false);
        ComputeHelper.copyTextureBufferCS.setStorageBuffer("dest", dest);

        const { width, height } = source.getSize();
        ComputeHelper.copyTextureBufferParams.updateInt("width", width);
        ComputeHelper.copyTextureBufferParams.updateInt("height", height);
        ComputeHelper.copyTextureBufferParams.update();
        ComputeHelper.Dispatch(ComputeHelper.copyTextureBufferCS, width, height, 1);
    }

    static ClearTexture(source, color) {
        if (!ComputeHelper.clearTextureCS) {
            const engine = source.getScene().getEngine();
            const cs1 = new BABYLON.ComputeShader("clearTextureCompute", engine, { computeSource: ComputeHelper.clearTextureComputeShader }, {
                bindingsMapping: {
                    "tbuf": { group: 0, binding: 0 },
                    "params": { group: 0, binding: 1 },
                }
            });

            const uBuffer0 = new BABYLON.UniformBuffer(engine);
            uBuffer0.addUniform("color", 4);
            uBuffer0.addUniform("width", 1);
            uBuffer0.addUniform("height", 1);
            cs1.setUniformBuffer("params", uBuffer0);

            ComputeHelper.clearTextureCS = cs1;
            ComputeHelper.clearTextureParams = uBuffer0;
        }

        ComputeHelper.clearTextureCS.setStorageTexture("tbuf", source);

        const { width, height } = source.getSize();
        ComputeHelper.clearTextureParams.updateDirectColor4("color", color);
        ComputeHelper.clearTextureParams.updateInt("width", width);
        ComputeHelper.clearTextureParams.updateInt("height", height);
        ComputeHelper.clearTextureParams.update();
        ComputeHelper.Dispatch(ComputeHelper.clearTextureCS, width, height, 1);
    }

    static Dispatch(cs, numIterationsX, numIterationsY, numIterationsZ) {
        if (!numIterationsY) numIterationsY = 1;
        if (!numIterationsZ) numIterationsZ = 1;

        if (!cs.threadGroupSizes) {
            cs.threadGroupSizes = ComputeHelper.GetThreadGroupSizes(cs._shaderPath.computeSource);
        }

        const threadGroupSizes = cs.threadGroupSizes;
        const numGroupsX = Math.ceil(numIterationsX / threadGroupSizes.x);
        const numGroupsY = Math.ceil(numIterationsY / threadGroupSizes.y);
        const numGroupsZ = Math.ceil(numIterationsZ / threadGroupSizes.z);

        cs.dispatch(numGroupsX, numGroupsY, numGroupsZ);
    }
}