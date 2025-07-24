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