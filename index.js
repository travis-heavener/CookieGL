let cgl;

$(document).ready(() => {
    // create canvas
    const canvas = $("#game-canvas")[0];
    cgl = new CGLCanvas(canvas);

    // draw polygons
    const triangle = new CGLPoly(0, 0, [[20, 20], [50, 100], [100, 20]], {fillColor: "blue", outlineColor: "#111"});
    const squarePoly = new CGLPoly(50, 50, [[0, 0], [0, 100], [100, 100], [100, 0]], {fillColor: "red", cursor: "grab"});
    const ellipse = new CGLEllipse(0, 0, 50, 40, {fillColor: "green"});
    const circle = new CGLCircle(75, 75, 50, {fillColor: "purple", cursor: "pointer"});
    const rect = new CGLRect(100, 100, 25, 50, {fillColor: "gold", outlineColor: "magenta"});
    const square = new CGLSquare(100, 100, 30, {fillColor: "lime"});

    // cgl.append(squarePoly);
    // cgl.append(ellipse);
    // cgl.append(circle);
    cgl.append(rect);
    cgl.append(square);
    // cgl.append(triangle);

    const id = square.on("click", function() {
        console.log("Square is clicked!", this);
    });
    
    const id2 = triangle.on("hover", function() {
        console.log("Triangle is hovered!", this);
    });

    // triangle.velocity.x = 10;
    triangle.angularVelocity = 90;
    // triangle.angularAcceleration = 5;

    // TODO: enforce number type on physical properties via setters

    // start interval
    cgl.start();
});