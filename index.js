let cgl;

$(document).ready(() => {
    // create canvas
    const canvas = $("#game-canvas")[0];
    cgl = new CGLCanvas(canvas);

    // draw polygons
    const triangle = new CGLPoly(0, 0, [[0, 0], [50, 100], [100, 0]], {fillColor: "blue"});
    const square = new CGLPoly(50, 50, [[0, 0], [0, 100], [100, 100], [100, 0]], {fillColor: "red"});
    const ellipse = new CGLEllipse(0, 0, 50, 40, {fillColor: "green"});
    const circle = new CGLCircle(75, 75, 50, {fillColor: "purple"});
    cgl.append(triangle);
    cgl.append(square);
    cgl.append(ellipse);
    cgl.append(circle);

    // start interval
    cgl.start();
});