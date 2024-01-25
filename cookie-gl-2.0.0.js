/****************** START LOGGING SHORTHANDS ******************/

const __cglLogFormat = ["%c[CookieGL]%c", "color: #ff0; font-weight: bold;", "color: inherit; font-weight: inherit;"];
const cglLog = (...args) => console.log(...__cglLogFormat, ...args);
const cglWarn = (...args) => console.warn(...__cglLogFormat, ...args);
const cglError = (...args) => console.error(...__cglLogFormat, ...args);

// for generating IDs for CGL classes
const __cglRandomID = () => ~~(Math.random() * Number.MAX_SAFE_INTEGER);

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
    id = __cglRandomID(); // unique id associated with this CGLCanvas

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

        // bind hover and click events to CGLCanvas
        this.#canvas.addEventListener("click", (e) => {
            // convert clientX and clientY into bottom-left coordinate system
            const pos = {"x": e.offsetX, "y": this.#height - e.offsetY};

            // find whatever children objects are at this point
            const children = this.#childrenAt(pos.x, pos.y, true, true);
            if (children.length === 0) return;

            // handle first element
            children[children.length-1].__handleEvent("click", this.#canvas, e);
        });

        this.#canvas.addEventListener("mousemove", (e) => {
            // convert clientX and clientY into bottom-left coordinate system
            const pos = {"x": e.offsetX, "y": this.#height - e.offsetY};

            // find whatever children objects are at this point
            const children = this.#childrenAt(pos.x, pos.y, true, true);
            if (children.length === 0) return;

            // handle first element
            children[children.length-1].__handleEvent("hover", this.#canvas, e);
        });

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
            if (!child.isVisible) continue; // cull hidden elements

            // assign properties
            ctx.fillStyle = child.fillColor;
            ctx.strokeStyle = child.outlineColor;
            ctx.lineWidth = child.outlineThickness;

            // move to child's x, y coords
            const offsetX = child.x, offsetY = child.y;
            ctx.translate(offsetX, offsetY);

            // rotate the child
            child.__move(); // move the child
            child.__draw(this.#ctx); // draw the child
            
            // revert to origin
            ctx.translate(-offsetX, -offsetY);
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
        else if (obj.canvasID !== null)
            throw new CGLException("CGLObject already belongs to a canvas with id: " + obj.canvasID);

        // otherwise, append the child
        this.#children.push(obj);
        obj.canvasID = this.id;
    }
    
    // append child to start of array (draws behind everything)
    prepend(obj=null) {
        if (obj === null || !(obj instanceof CGLObject))
            throw new CGLException("Invalid CGLCanvas child. Expected subclass of CGLObject, got " + (obj === null ? null : obj.constructor.name));
        else if (obj.canvasID !== null)
            throw new CGLException("CGLObject already belongs to a canvas with id: " + obj.canvasID);

        // otherwise, append the child
        this.#children.unshift(obj);
        obj.canvasID = this.id;
    }

    // get whatever child is at the current relative x-y position (regardless of visibility)
    #childrenAt(x, y, excludeInvisible=false, excludeClickOmitted=false) {
        let children = [];

        for (let child of this.#children) {
            if ((!child.isVisible && excludeInvisible) || (child.ignoreClicks && excludeClickOmitted)) continue;
            if (child.__isPointInBounds(x, y))
                children.push(child);
        }

        return children;
    }
}

/****************** END CGLCANVAS CLASS ******************/
/****************** START CGLOBJECT CLASS ******************/

// abstract class for all objects drawn on CGLCanvas
class CGLObject {
    fillColor; // fill color of polygon or "transparent"
    outlineColor; // outline color of polygon or "transparent"
    outlineThickness; // integer; outline thickness of polygon or 1, in pixels
    isVisible; // boolean, whether the CGLObject is culled at render
    ignoreClicks; // boolean, whether to ignore clicks on this object or not
    #cursor; // string; cursor shown when the CGLObject is hovered over

    id; // the ID of this particular CGLObject
    canvasID = null; // number, the ID of the canvas the CGLObject is associated with
    #lastUpdate; // the last timestamp of when __move() was called

    // physical properties
    x; // x-position of the CGLObject
    y; // y-position of the CGLObject
    velocity = {"x": 0, "y": 0} // the x and y velocities of the CGLObject, in px/s
    acceleration = {"x": 0, "y": 0} // the x and y accelerations of the CGLObject, in px/s/s
    
    rotation = 0; // the rotation of the object, in degrees
    angularVelocity = 0; // the angular velocity of the object, in degrees/s
    angularAcceleration = 0; // the angular acceleration of the object, in degrees/s/s

    // event listeners
    #eventListeners = {"click": [], "hover": []};

    constructor(x, y, options={}) {
        if (this.constructor === CGLObject)
            throw new CGLException("Cannot directly instantiate CGLObject class, only subclasses.");
        
        // check coordinates
        if (x === null || x.constructor !== Number)
            throw new CGLException("Invalid x-coordinate passed to CGLObject constructor. Expected number, got " + (x === null ? "null" : x.constructor.name));
        if (y === null || y.constructor !== Number)
            throw new CGLException("Invalid y-coordinate passed to CGLObject constructor. Expected number, got " + (y === null ? "null" : y.constructor.name));

        // assign parameters
        this.id = __cglRandomID();
        this.x = x;
        this.y = y;

        this.fillColor = options.fillColor ?? "transparent";
        this.outlineThickness = parseInt(options.outlineThickness ?? 1);
        // assign a black border when no fillColor or outlineColor is supplied
        this.outlineColor = options.outlineColor ?? (this.fillColor === "transparent" ? "black" : "transparent");

        this.isVisible = options.isVisible ?? true;
        this.#cursor = options.cursor ?? "";
        this.ignoreClicks = options.ignoreClicks ?? false;

        // update #lastUpdate timestamp
        this.#lastUpdate = Date.now();
    }

    // template draw method, called by CGLCanvas
    // ctx: canvas.getContext("2d")
    __draw(ctx) {
        if (this.constructor === CGLObject)
            throw new CGLException("Cannot directly call draw() on CGLObject, only subclasses.");
    }

    // move the CGLObject based on the given frameGap (time between now and last update)
    __move() {
        // get frameGap, in seconds
        const frameGap = (Date.now() - this.#lastUpdate) / 1e3;

        // move the object
        this.velocity.x += this.acceleration.x * frameGap;
        this.velocity.y += this.acceleration.y * frameGap;
        this.x += this.velocity.x * frameGap;
        this.y += this.velocity.y * frameGap;

        // rotate the object
        this.angularVelocity += this.angularAcceleration * frameGap;
        this.rotation -= this.angularVelocity * frameGap;

        // update last timestamp
        this.#lastUpdate = Date.now();
    }

    // returns true if the specified point is in bounds of the object, or false otherwise
    __isPointInBounds(x, y) {
        if (this.constructor === CGLObject)
            throw new CGLException("Cannot directly call isPointInBounds() on CGLObject, only subclasses.");
    }
    
    // allow event listeners to be bound
    on(eventName=null, callback) {
        if (eventName === null || eventName.constructor !== String)
            throw new CGLException("Invalid event listener type: expected string.");
        else if (!(eventName in this.#eventListeners))
            throw new CGLException("Invalid event listener name: " + eventName);

        // add the event listener
        const id = __cglRandomID();
        this.#eventListeners[eventName].push({"callback": callback.bind(this), "id": id});
        return id;
    }

    // allow event listeners to be removed either by their type or by their callbackID
    off(eventName=null, callbackID=null) {
        if (eventName === null || eventName.constructor !== String)
            throw new CGLException("Invalid event listener type: expected string.");
        else if (!(eventName in this.#eventListeners))
            throw new CGLException("Invalid event listener name: " + eventName);
        
        // remove all events if the callbackID is null
        if (callbackID === null) {
            this.#eventListeners[eventName] = [];
        } else {
            const listeners = this.#eventListeners[eventName];
            for (let i = 0; i < listeners.length; i++)
                if (listeners[i].id === callbackID)
                    this.#eventListeners[eventName].splice(i--, 1);
        }
    }

    // allow events to be called
    __handleEvent(eventName, canvas, ...args) {
        if (!(eventName in this.#eventListeners))
            return cglError("Invalid event type: " + eventName);

        // call all events
        for (let event of this.#eventListeners[eventName])
            event.callback(...args);

        // allow mousemove to change the cursor
        if (eventName === "hover")
            canvas.style.cursor = this.#cursor;
    }
}

// polygon defined by set of points
class CGLPoly extends CGLObject {
    #vertices; // array of 3+ vertices, each as an array of 2 numbers in the format [x, y]
    
    // store dimensions for faster calculation of points in bounds
    #minX;
    #maxX;
    #minY;
    #maxY;

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
        this.#vertices = vertices.map(arr => [...arr]); // shallow copy

        // determine min and max x and y values
        const xVert = this.#vertices.map(arr => arr[0]);
        const yVert = this.#vertices.map(arr => arr[1]);
        this.#minX = this.x + Math.min(...xVert);
        this.#maxX = this.x + Math.max(...xVert);
        this.#minY = this.y + Math.min(...yVert);
        this.#maxY = this.y + Math.max(...yVert);
    }

    __draw(ctx) {
        const width = this.#maxX - this.#minX, height = this.#maxY - this.#minY;

        // rotate the polygon
        ctx.save();
        ctx.translate(width/2, height/2);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.translate(-width/2, -height/2);

        // fill polygon vertices
        ctx.beginPath();
        for (let vertex of this.#vertices)
            ctx.lineTo(vertex[0], vertex[1]);
        ctx.lineTo(this.#vertices[0][0], this.#vertices[0][1]); // draw line back to the first vertex
        ctx.closePath();

        // unrotate
        ctx.restore();
        
        // stroke and fill (inset stroke thanks to https://stackoverflow.com/a/45125187)
        ctx.save();
        ctx.translate(width/2, height/2);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.translate(-width/2, -height/2);
        
        ctx.clip();
        ctx.lineWidth *= 2;
        if (this.fillColor !== "transparent") ctx.fill();
        if (this.outlineColor !== "transparent") ctx.stroke();

        ctx.restore();
    }

    // shallow copy vertices on return to prevent reference modification
    get vertices() {  return this.#vertices.map(arr => [...arr]);  }
    set vertices(v) {
        // check parameters
        if (v === null || v.constructor !== Array || vertices.length < 3)
            throw new CGLException("Invalid parameter passed to CGLPoly vertices. Parameter vertices array must have at least >=3 vertices.");

        // sanitize vertices
        v.forEach(n => {
            if (n.length !== 2 || n[0].constructor !== Number || n[1].constructor !== Number)
                throw new CGLException("Invalid argument: vertices must each be an array of 2 numbers in the format [x, y].");
        });

        this.#vertices = v.map(arr => [...arr]); // shallow copy

        // determine min and max x and y values
        const xVert = this.#vertices.map(arr => arr[0]);
        const yVert = this.#vertices.map(arr => arr[1]);
        this.#minX = this.x + Math.min(...xVert);
        this.#maxX = this.x + Math.max(...xVert);
        this.#minY = this.y + Math.min(...yVert);
        this.#maxY = this.y + Math.max(...yVert);
    }

    __isPointInBounds(x, y) {
        // prelimiary check for extreme bounds (thanks to https://stackoverflow.com/a/218081)
        if (x < this.#minX || x > this.#maxX || y < this.#minY || y > this.#maxY) return false;

        // check if the point is within the vertices (largely thanks to https://stackoverflow.com/a/2922778)
        const xVert = this.#vertices.map(arr => arr[0] + this.x);
        const yVert = this.#vertices.map(arr => arr[1] + this.y);
        let isInBounds = false;
        
        for (let i = 0, j = xVert.length-1; i < xVert.length; j = i++) {
            if (((yVert[i] > y) !== (yVert[j] > y)) && (x < (xVert[j] - xVert[i]) * (y - yVert[i]) / (yVert[j] - yVert[i]) + xVert[i]))
                isInBounds = !isInBounds;
        }

        return isInBounds;
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
        // rotate
        ctx.save();
        ctx.translate(this.#horizLength/2, this.#vertLength/2);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.translate(-this.#horizLength/2, -this.#vertLength/2);
        
        // draw ellipse
        ctx.beginPath();
        // move the ellipse since ctx.ellipse draws at the center
        ctx.ellipse(this.#horizLength/2, this.#vertLength/2, this.#horizLength/2, this.#vertLength/2, 0, 0, 2*Math.PI);
        ctx.stroke();

        // restore rotation
        ctx.restore();

        // stroke polygon
        if (this.fillColor !== "transparent") ctx.fill();
        if (this.outlineColor !== "transparent") ctx.stroke();
    }

    __isPointInBounds(x, y) {
        // check the point against the ellipse boundaries
        const centerX = this.x + this.#horizLength/2;
        const centerY = this.y + this.#vertLength/2;
        return ( (2 * (x - centerX) / this.#horizLength) ** 2 + (2 * (y - centerY) / this.#vertLength) ** 2 ) <= 1;
    }
}

// circle defined by a radius (via immediate passthrough to CGLEllipse)
class CGLCircle extends CGLEllipse {
    constructor(x, y, radius, options={}) {
        super(x, y, radius, radius, options);
    }
}

// rectangle defined by width and height
class CGLRect extends CGLPoly {
    #width; // numeric dimensions of rectangle, in pixels
    #height; // numeric dimensions of rectangle, in pixels

    constructor(x=null, y=null, width=null, height=null, options={}) {
        // verify width and height are valid
        if (width === null || width.constructor !== Number || width < 0)
            throw new CGLException("Invalid width passed to CGLRect constructor. Width must be a positive number.");
        if (height === null || height.constructor !== Number || height < 0)
            throw new CGLException("Invalid height passed to CGLRect constructor. Height must be a positive number.");

        // otherwise, passthrough to CGLPoly
        super(x, y, [[0, 0], [0, height], [width, height], [width, 0]], options);
        this.#width = width;
        this.#height = height;
    }

    get width() {  return this.#width;  }
    get height() {  return this.#height;  }
    set width(w) {
        if (w.constructor !== Number || w < 0)
            throw new CGLException("Invalid width passed to CGLRect. Width must be a positive number.");
        this.#width = w;
        this.vertices = [[0, 0], [0, this.height], [w, this.height], [w, 0] ];
    }
    set height(h) {
        if (h.constructor !== Number || h < 0)
            throw new CGLException("Invalid height passed to CGLRect. Height must be a positive number.");
        this.#height = h;
        this.vertices = [[0, 0], [0, h], [this.width, h], [this.width, 0] ];
    }

    __isPointInBounds(x, y) {
        return (x >= this.x && this.#width + this.x >= x && y >= this.y && this.#height + this.y >= y)
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