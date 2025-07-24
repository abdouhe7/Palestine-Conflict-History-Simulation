function makeGUI(engine, scene) {
    const supportCS = engine.getCaps().supportComputeShaders;
    const gui = getGUI();

    const simParams = {
        demo: slimeSimulation.demo,
        stepsPerFrame: slimeSimulation.settings.stepsPerFrame,
        trailWeight: slimeSimulation.settings.trailWeight,
        decayRate: slimeSimulation.settings.decayRate,
        diffuseRate: slimeSimulation.settings.diffuseRate,
        showAgentsOnly: slimeSimulation.showAgentsOnly,
    };

    // General
    const general = gui.addFolder("General");
    general.add(simParams, "demo", [1917, 1947, 1948, 1967])
        .name("Demo")
        .onChange((value) => {
            if (value !== slimeSimulation.demo) {
                slimeSimulation.dispose();
                slimeSimulation = new SlimeSimulation(slimeSimulation._layer, scene);
                SlimeSimulationDemo['year' + value](slimeSimulation);
                slimeSimulation.start();
                makeGUI(engine, scene);
            }
        });

    general.add(simParams, "stepsPerFrame", 1, 10, 1)
        .name("Steps per frame")
        .onChange((value) => {
            slimeSimulation.settings.stepsPerFrame = parseFloat(value);
        });

    general.add(simParams, "trailWeight", 0.01, 20, 0.1)
        .name("Trail weight")
        .onChange((value) => {
            slimeSimulation.settings.trailWeight = parseFloat(value);
        });

    general.add(simParams, "decayRate", 0.01, 2, 0.01)
        .name("Decay rate")
        .onChange((value) => {
            slimeSimulation.settings.decayRate = parseFloat(value);
        });

    general.add(simParams, "diffuseRate", -5, 5, 0.01)
        .name("Diffuse rate")
        .onChange((value) => {
            slimeSimulation.settings.diffuseRate = parseFloat(value);
        });

    general.add(simParams, "showAgentsOnly")
        .name("Show agents only")
        .onChange((value) => {
            slimeSimulation.showAgentsOnly = value;
        });

    general.open();

    // Species
    const species = gui.addFolder("Species");
    const numSpecies = slimeSimulation.settings.speciesSettings.length / 5;
    for (let s = 0; s < numSpecies; ++s) {
        const specie = species.addFolder("Specie #" + (s + 1));

        simParams['moveSpeed' + s] = slimeSimulation.settings.speciesSettings[s * 5 + 0];
        simParams['turnSpeed' + s] = slimeSimulation.settings.speciesSettings[s * 5 + 1];
        simParams['sensorAngleSpacing' + s] = slimeSimulation.settings.speciesSettings[s * 5 + 2];
        simParams['sensorOffsetDst' + s] = slimeSimulation.settings.speciesSettings[s * 5 + 3];
        simParams['sensorSize' + s] = slimeSimulation.settings.speciesSettings[s * 5 + 4];

        specie.add(simParams, "moveSpeed" + s, -200, 200, 0.1)
            .name("Move speed")
            .onChange(((s) => {
                return (value) => {
                    slimeSimulation.settings.speciesSettings[s * 5 + 0] = parseFloat(value);
                    slimeSimulation.updateSpecies();
                }
            })(s));

        specie.add(simParams, "turnSpeed" + s, -200, 200, 0.1)
            .name("Turn speed")
            .onChange(((s) => {
                return (value) => {
                    slimeSimulation.settings.speciesSettings[s * 5 + 1] = parseFloat(value);
                    slimeSimulation.updateSpecies();
                }
            })(s));

        specie.add(simParams, "sensorAngleSpacing" + s, -200, 200, 0.1)
            .name("Sensor angle spacing")
            .onChange(((s) => {
                return (value) => {
                    slimeSimulation.settings.speciesSettings[s * 5 + 2] = parseFloat(value);
                    slimeSimulation.updateSpecies();
                }
            })(s));

        specie.add(simParams, "sensorOffsetDst" + s, -200, 200, 0.1)
            .name("Sensor offset dst")
            .onChange(((s) => {
                return (value) => {
                    slimeSimulation.settings.speciesSettings[s * 5 + 3] = parseFloat(value);
                    slimeSimulation.updateSpecies();
                }
            })(s));

        specie.add(simParams, "sensorSize" + s, 1, 10, 1)
            .name("Sensor size")
            .onChange(((s) => {
                return (value) => {
                    slimeSimulation.settings.speciesSettings[s * 5 + 4] = parseFloat(value);
                    slimeSimulation.updateSpecies();
                }
            })(s));

        specie.open();
    }
    species.open();

    // Info panel
    var panel = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const textNOk = "**Use WebGPU to watch this demo which requires compute shaders support. To enable WebGPU please use Edge Canary or Chrome canary. Also select the WebGPU engine from the top right drop down menu.**";
    const textOk = "";

    var info = new BABYLON.GUI.TextBlock();
    info.text = supportCS ? textOk : textNOk;
    info.width = "100%";
    info.paddingLeft = "5px";
    info.paddingRight = "5px";
    info.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    info.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    info.color = supportCS ? "green" : "red";
    info.fontSize = supportCS ? "18px" : "24px";
    info.fontStyle = supportCS ? "" : "bold";
    info.textWrapping = true;
    panel.addControl(info);
}

function getGUI() {
    var oldgui = document.getElementById("datGUI");
    if (oldgui != null) {
        oldgui.remove();
    }

    var gui = new dat.GUI();
    gui.domElement.style.marginTop = "100px";
    gui.domElement.id = "datGUI";

    return gui;
}