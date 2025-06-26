class SlimeSimulationDemo {
    static demo1(slimeSimulation) {
        slimeSimulation.demo = 1;
        const settings = slimeSimulation.settings;
        settings.speciesSettings = [20, 2, 30, 35, 1];
        settings.stepsPerFrame = 2;
        settings.numAgents = 250000;
        settings.spawnMode = SpawnMode.InwardCircle;
        settings.trailWeight = 5;
        settings.decayRate = 0.2;
        settings.diffuseRate = 3;
    }

    static demo2(slimeSimulation) {
        slimeSimulation.demo = 2;
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

    static demo3(slimeSimulation) {
        slimeSimulation.demo = 3;
        const settings = slimeSimulation.settings;
        settings.speciesSettings = [30, -3, 112, 20, 1];
        settings.stepsPerFrame = 2;
        settings.numAgents = 250000;
        settings.spawnMode = SpawnMode.Point;
        settings.trailWeight = 2;
        settings.decayRate = 0.75;
        settings.diffuseRate = 5;
    }

    static demo4(slimeSimulation) {
        slimeSimulation.demo = 4;
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