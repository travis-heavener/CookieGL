/****************** START LOGGING SHORTHANDS ******************/

const __cglLogFormat = ["%c[CookieGL]%c", "color: #ff0; font-weight: bold;", "color: inherit; font-weight: inherit;"];
const cglLog = (...args) => console.log(...__cglLogFormat, ...args);
const cglWarn = (...args) => console.warn(...__cglLogFormat, ...args);
const cglError = (...args) => console.error(...__cglLogFormat, ...args);

/****************** END LOGGING SHORTHANDS ******************/
/****************** START CGLERRORS ******************/

class CGLException extends Error {
    constructor(msg, name="CGLException") {
        super(msg);
        this.name = name;
    }
}

/****************** END CGLERRORS ******************/
/****************** START CGLCANVAS CLASS ******************/

class CGLCanvas {
    // options
    #frameRate; // integer; refresh rate of canvas, in frames per second
    #smoothingEnabled; // boolean; similar to antialiasing, smoothes rough edges of images on canvas
    #smoothingQuality; // "low", "medium", or "high"; for quality of smoothed images IF smoothingEnabled is true

    // dimensions of the canvas
    #width;
    #height;
    
    // rendering
    #canvas;
    #ctx; // canvas 2d context (canvas.getContext("2d"));
    #refreshTimeout = null; // returned by setInterval, holds engine loop interval
    #children;

    constructor(canvasElem, options={}) {
        if (canvasElem.constructor !== HTMLCanvasElement) {
            cglError("Parameter 0 (canvasElem) must be HTMLCanvasElement, not " + canvasElem.constructor.name);
            throw new CGLException("Invalid parameter passed to CGLCanvas constructor.");
        }

        this.#width = canvasElem.width;
        this.#height = canvasElem.height;

        // set options
        this.#frameRate = options.frameRate ?? 60;
        this.#smoothingEnabled = options.smoothingEnabled ?? false;
        this.#smoothingQuality = options.smoothingQuality ?? "medium";
        
        // set rendering fields
        this.#children = []; // contains CGLObjects
        
        // assign canvas properties
        this.#canvas = canvasElem;
        this.#ctx = canvasElem.getContext("2d");
        this.#ctx.imageSmoothingEnabled = this.#smoothingEnabled;
        this.#ctx.imageSmoothingQuality = this.#smoothingQuality;

        // TODO: bind resize event on canvas to update this element's width and height
    }

    // getters and setters
    get isRunning() {  return this.#refreshTimeout !== null;  }
    get width() {  return this.#width;  }
    get height() {  return this.#height;  }
    set width(w) {
        this.#canvas.width = w;
        this.#width = w;
    }
    set height(h) {
        this.#canvas.height = h;
        this.#height = h;
    }
    get children() {  return this.#children;  }

    // framerate & frametime setters/getters
    get frameTime() {  return 1e3/this.#frameRate;  }
    set frameTime(hz) {  this.#frameRate = 1e3/hz;  }
    get frameRate() {  return this.#frameRate;  }
    set frameRate(hz) {  this.#frameRate = hz;  }

    // restarts the display interval & draw method
    start() {
        if (this.isRunning) return void cglWarn("CGLCanvas interval already started, aborting...");
        this.#draw(); // initial call to draw, binds refreshTimeout
    }

    // stops the display interval
    stop() {
        if (this.#refreshTimeout === null) return;
        clearTimeout(this.#refreshTimeout);
        this.#refreshTimeout = null;
    }

    // draws content on the canvas when called by the engine loop interval
    #draw() {
        const ctx = this.#ctx;

        ctx.clearRect(0, 0, this.width, this.height); // clear the canvas

        // store any values that will be changed for later reassignmet
        const opts = {"lineWidth": ctx.lineWidth, "fillStyle": ctx.fillStyle};

        // flip canvas to draw from BOTTOM LEFT
        ctx.translate(0, this.#height);
        ctx.scale(1, -1); // flip vertically
        
        // for each child, draw them on this canvas
        for (let child of this.#children) {
            // assign properties
            ctx.fillStyle = child.fillColor;
            ctx.strokeStyle = child.outlineColor;
            ctx.lineWidth = child.outlineThickness;

            ctx.translate(child.x, child.y); // move to child's x, y coords
            child.__draw(this.#ctx); // draw the child
            ctx.translate(-child.x, -child.y); // revert to origin
        }

        // unflip canvas
        ctx.scale(1, -1); // reset flip
        ctx.translate(0, -this.#height);

        // reassign any previous values that were overridden
        Object.assign(this.#ctx, opts);

        // queue next timeout
        this.#refreshTimeout = setTimeout(() => this.#draw(), this.frameTime);
    }
    
    // append child to the end of the children array (draws above everything)
    append(obj=null) {
        if (obj === null || !(obj instanceof CGLObject))
            throw new CGLException("Invalid CGLCanvas child. Expected subclass of CGLObject, got " + (obj === null ? null : obj.constructor.name));
        
        // otherwise, append the child
        this.#children.push(obj);
    }
    
    // append child to start of array (draws behind everything)
    prepend(obj=null) {
        if (obj === null || !(obj instanceof CGLObject))
            throw new CGLException("Invalid CGLCanvas child. Expected subclass of CGLObject, got " + (obj === null ? null : obj.constructor.name));
        
        // otherwise, append the child
        this.#children.unshift(obj);
    }
}

/****************** END CGLCANVAS CLASS ******************/
/****************** START CGLOBJECT CLASS ******************/

// abstract class for all objects drawn on CGLCanvas
class CGLObject {
    fillColor; // fill color of polygon or "transparent"
    outlineColor; // outline color of polygon or "transparent"
    outlineThickness; // integer; outline thickness of polygon or 1, in pixels

    constructor(x, y, options={}) {
        if (this.constructor === CGLObject)
            throw new CGLException("Cannot directly instantiate CGLObject class, only subclasses.");
        
        // check coordinates
        if (x === null || x.constructor !== Number)
            throw new CGLException("Invalid x-coordinate passed to CGLObject constructor. Expected number, got " + (x === null ? "null" : x.constructor.name));
        if (y === null || y.constructor !== Number)
            throw new CGLException("Invalid y-coordinate passed to CGLObject constructor. Expected number, got " + (y === null ? "null" : y.constructor.name));

        // assign parameters
        this.x = x;
        this.y = y;

        this.fillColor = options.fillColor ?? "transparent";
        this.outlineThickness = parseInt(options.outlineThickness ?? 1);

        // assign a black border when no fillColor or outlineColor is supplied
        this.outlineColor = options.outlineColor ?? (this.fillColor === "transparent" ? "black" : "transparent");
    }

    // template draw method, called by CGLCanvas
    // ctx: canvas.getContext("2d")
    __draw() {
        if (this.constructor === CGLObject)
            throw new CGLException("Cannot directly call draw() on CGLObject, only subclasses.");
    }
}

// polygon defined by set of points
class CGLPoly extends CGLObject {
    #vertices; // array of 3+ vertices, each as an array of 2 numbers in the format [x, y]

    constructor(x=null, y=null, vertices=null, options={}) {
        super(x, y, options);

        // check parameters
        if (vertices === null || vertices.constructor !== Array || vertices.length < 3)
            throw new CGLException("Invalid parameter passed to CGLPoly constructor. Parameter vertices array must have at least >=3 vertices.");

        // sanitize vertices
        vertices.forEach(n => {
            if (n.length !== 2 || n[0].constructor !== Number || n[1].constructor !== Number)
                throw new CGLException("Invalid argument: vertices must each be an array of 2 numbers in the format [x, y].");
        });

        // everything is good, assign vertices
        this.#vertices = vertices;
    }

    __draw(ctx) {
        // fill polygon vertices
        ctx.beginPath();
        for (let vertex of this.#vertices)
            ctx.lineTo(vertex[0], vertex[1]);
        ctx.lineTo(0, 0); // draw line back to x, y
        ctx.closePath();
        
        // stroke and fill (inset stroke thanks to https://stackoverflow.com/a/45125187)
        ctx.save();
        ctx.clip();
        ctx.lineWidth *= 2;
        if (this.fillColor !== "transparent") ctx.fill();
        if (this.outlineColor !== "transparent") ctx.stroke();
        ctx.restore();
    }
}

// ellipse defined by major and minor axes' lengths
class CGLEllipse extends CGLObject {
    #horizLength; // length of ellipse in the direction of the horizontal axis
    #vertLength; // length of ellipse in the direction of the vertical axis

    constructor(x=null, y=null, horizLength=null, vertLength=null, options={}) {
        super(x, y, options);

        // check axes
        if (horizLength === null || horizLength.constructor !== Number || horizLength < 0)
            throw new CGLException("Invalid horizontal axis length passed to CGLEllipse constructor. Length must be a positive number.");
        if (vertLength === null || vertLength.constructor !== Number || vertLength < 0)
            throw new CGLException("Invalid vertical axis length passed to CGLEllipse constructor. Length must be a positive number.");

        // assign parameters
        this.#horizLength = horizLength;
        this.#vertLength = vertLength;
    }

    __draw(ctx) {
        // draw ellipse
        ctx.beginPath();
        // move the ellipse since ctx.ellipse draws at the center
        ctx.ellipse(this.#horizLength/2, this.#vertLength/2, this.#horizLength/2, this.#vertLength/2, 0, 0, 2*Math.PI);
        ctx.stroke();

        // stroke polygon
        if (this.fillColor !== "transparent") ctx.fill();
        if (this.outlineColor !== "transparent") ctx.stroke();
    }
}

// circle defined by a radius (via immediate passthrough to CGLEllipse)
class CGLCircle extends CGLEllipse {
    constructor(x, y, radius, options={}) {
        super(x, y, radius, radius, options);
    }
}

// rectangle defined by width and height
class CGLRect extends CGLObject {
    #width; // numeric dimensions of rectangle, in pixels
    #height; // numeric dimensions of rectangle, in pixels

    constructor(x=null, y=null, width=null, height=null, options={}) {
        // verify width and height are valid
        if (width === null || width.constructor !== Number || width < 0)
            throw new CGLException("Invalid width passed to CGLRect constructor. Width must be a positive number.");
        if (height === null || height.constructor !== Number || height < 0)
            throw new CGLException("Invalid height passed to CGLRect constructor. Height must be a positive number.");

        // otherwise, passthrough to CGLRect
        super(x, y, options);
        this.#width = width;
        this.#height = height;
    }

    __draw(ctx) {
        if (this.fillColor !== "transparent")
            ctx.fillRect(0, 0, this.#width, this.#height);
        if (this.outlineColor !== "transparent")
            ctx.strokeRect(0, 0, this.#width, this.#height);
    }
}

// square defined by set of vertices (via immediate passthrough to CGLRect)
class CGLSquare extends CGLRect {
    constructor(x=null, y=null, size=null, options={}) {
        // verify width and height are valid
        if (size === null || size.constructor !== Number || size < 0)
            throw new CGLException("Invalid size passed to CGLRect constructor. Square size must be a positive number.");

        // otherwise, passthrough to CGLRect
        super(x, y, size, size, options);
    }
}

/****************** END CGLOBJECT CLASS ******************/