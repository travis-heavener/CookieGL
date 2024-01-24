let cgl;

$(document).ready(() => {
    // create canvas
    const canvas = $("#game-canvas")[0];
    cgl = new CGLCanvas(canvas);

    // draw polygons
    const triangle = new CGLPoly(0, 0, [[0, 0], [50, 100], [100, 0]], {fillColor: "blue", outlineColor: "#111"});
    const squarePoly = new CGLPoly(50, 50, [[0, 0], [0, 100], [100, 100], [100, 0]], {fillColor: "red"});
    const ellipse = new CGLEllipse(0, 0, 50, 40, {fillColor: "green"});
    const circle = new CGLCircle(75, 75, 50, {fillColor: "purple"});
    const rect = new CGLRect(100, 100, 25, 50, {fillColor: "gold", outlineColor: "magenta"});
    const square = new CGLSquare(100, 100, 30, {fillColor: "lime"});

    cgl.append(triangle);
    cgl.append(squarePoly);
    cgl.append(ellipse);
    cgl.append(circle);
    cgl.append(rect);
    cgl.append(square);

    // start interval
    cgl.start();
});