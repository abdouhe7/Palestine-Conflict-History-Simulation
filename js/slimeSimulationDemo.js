class SlimeSimulationDemo {
    static year1917(slimeSimulation) {
        slimeSimulation.demo = 1917;
        const settings = slimeSimulation.settings;
        settings.speciesSettings = [20, 2, 30, 35, 1];
        settings.stepsPerFrame = 2;
        settings.numAgents = 50;
        settings.spawnMode = SpawnMode.Mask;
        settings.trailWeight = 5;
        settings.decayRate = 0.2;
        settings.diffuseRate = 3;
        settings.TextureMaskUrl = "Textures/1917.png";
    }

    static year1947(slimeSimulation) {
        slimeSimulation.demo = 1947;
        const settings = slimeSimulation.settings;
        settings.speciesSettings = [
            50, 30, 45, 20, 1,
            50, -90, 112, 30, 1
        ];
        settings.stepsPerFrame = 2;
        settings.numAgents = 100000;
        settings.spawnMode = SpawnMode.RandomCircle;
        settings.trailWeight = 5;
        settings.decayRate = 0.5;
        settings.diffuseRate = 3;
    }

    static year1948(slimeSimulation) {
        slimeSimulation.demo = 1948;
        const settings = slimeSimulation.settings;
        settings.speciesSettings = [30, -3, 112, 20, 1];
        settings.stepsPerFrame = 2;
        settings.numAgents = 250000;
        settings.spawnMode = SpawnMode.Point;
        settings.trailWeight = 2;
        settings.decayRate = 0.75;
        settings.diffuseRate = 5;
    }

    static year1967(slimeSimulation) {
        slimeSimulation.demo = 1967;
        const settings = slimeSimulation.settings;
        settings.speciesSettings = [
            118.8, -87.8, -47.4, 168.2, 2,
            118.8, 30, 45, 127.7, 2,
            100.8, -11.4, 112, 159.2, 2
        ];
        settings.stepsPerFrame = 2;
        settings.numAgents = 50000;
        settings.spawnMode = SpawnMode.Random;
        settings.trailWeight = 8;
        settings.decayRate = 0.35;
        settings.diffuseRate = 4;
    }
    static year2025(slimeSimulation) {
        slimeSimulation.demo = 2025;
        const settings = slimeSimulation.settings;
        settings.speciesSettings = [
            118.8, -87.8, -47.4, 168.2, 2,
            118.8, 30, 45, 127.7, 2,
            100.8, -11.4, 112, 159.2, 2
        ];
        settings.stepsPerFrame = 2;
        settings.numAgents = 50000;
        settings.spawnMode = SpawnMode.Random;
        settings.trailWeight = 8;
        settings.decayRate = 0.35;
        settings.diffuseRate = 4;
    }
}