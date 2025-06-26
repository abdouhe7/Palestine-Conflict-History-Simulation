const SpawnMode = {"Random": 0, "Point": 1, "InwardCircle": 2, "RandomCircle": 3};
var canvas = document.getElementById("renderCanvas");

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
}

var engine = null;
var scene = null;
var sceneToRender = null;
var createDefaultEngine = async function () {
    var engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();
    return engine;
};

function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

Math.random = mulberry32(123);

let slimeSimulation;
// Scene creation
const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    const layer = new BABYLON.Layer("layer", "", scene, true);
    slimeSimulation = new SlimeSimulation(layer, scene);
    SlimeSimulationDemo.demo4(slimeSimulation);
    slimeSimulation.start();

    makeGUI(engine, scene);

    scene.onBeforeRenderObservable.add(() => {
        slimeSimulation.update();
    });

    return scene;
};

window.initFunction = async function () {

    var asyncEngineCreation = async function () {
        try {
            return createDefaultEngine();
        } catch (e) {
            console.log("the available createEngine function failed. Creating the default engine instead");
            return createDefaultEngine();
        }
    }

    window.engine = await asyncEngineCreation();

    const engineOptions = window.engine.getCreationOptions?.();
    if (!engineOptions || engineOptions.audioEngine !== false) {

    }
    if (!engine) throw 'engine should not be null.';
window.addEventListener("resize", function () {
    engine.resize();
});
    startRenderLoop(engine, canvas);
    window.scene = createScene();
};
initFunction().then(() => {
    sceneToRender = scene
});

// Resize

